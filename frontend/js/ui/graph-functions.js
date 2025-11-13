import Reference from '../models/reference.js';
import Commit from '../models/commit.js';
import { Node, Path } from './graph-models.js';
import { parseBranchNamesFromSubject } from '../git-interface/parsers.js';
import { asTextContent, requestIdlePromise, splitOnce } from '../utils.js';
import { calculatePathStringLength } from './animations.js';
/** @typedef {import('graph-models.js').EdgeContext} EdgeContext */
/** @typedef {import('graph-models.js').OccupiedRange} OccupiedRange */
/** @typedef {import('graph-models.js').Column} Column */


/** @param {Object.<string, Reference>} refs */
export function getRefMappings(refs) {
  /** @type {Object.<string, Reference[]>} */ const refsByCommitId = {};
  /** @type {Object.<string, number>} */ const pathRefPriorityForCommitId = {};
  const namePriorities = [
    /^(.+\/)?(master)$/i,
    /^(.+\/)?(main)$/i,
    /^(.+\/)?(trunk)$/i,
    /^(.+\/)?(default)$/i,
    /^(.+\/)?(develop)$/i,
    /^(.+\/)?(development)$/i,
  ];
  for (const ref of Object.values(refs)) {
    if (refsByCommitId[ref.commitId] === undefined) {
      refsByCommitId[ref.commitId] = [];
    }
    refsByCommitId[ref.commitId].push(ref);
    for (const [index, namePriorityRegex] of [...namePriorities.entries()]) {
      if (namePriorityRegex?.test(ref.refName)) {
        pathRefPriorityForCommitId[ref.commitId] = namePriorities.length - index;
        // These are used to split paths. To avoid splitting for example
        // main multiple times, remove it after the first occurrence.
        namePriorities[index] = undefined;
      }
    }
  }
  return {
    refsByCommitId,
    pathRefPriorityForCommitId,
  };
}


/**
 * @param {Commit[]} commits
 * @param {Object.<Commit['id'], Reference[]>} refsByCommitId
 * @param {Object.<Commit['id'], number>} pathRefPriorityForCommitId
 */
export async function collectPaths(commits, refsByCommitId, pathRefPriorityForCommitId) {
  /** @type {Path[]} */ let paths = [];
  /** @type {Map<Commit['id'], Path>} */ const pathForCommitId = new Map();
  /** @type {Map<Commit['id'], Node>} */ const nodeForCommitId = new Map();
  /** @type {Map<Commit['id'], Commit['id'][]>} */ const childIdsForCommitId = new Map();

  /** @param {Commit['id']} commitId */
  function createPath(commitId) {
    const path = new Path({
      nodes: [],
    });
    paths.push(path);
    pathForCommitId.set(commitId, path);
    return path;
  }
  /** @param {Commit['id']} commitId */
  function getOrCreatePathForCommitId(commitId) {
    const path = pathForCommitId.get(commitId);
    if (path !== undefined) {
      return path;
    }
    return createPath(commitId);
  }

  for (const [index, commit] of commits.entries()) {
    // Non-blocking iteration
    const batchSize = 1000;
    const maxWaitMs = 100;
    const isBatchSizeReached = index !== 0 && index % batchSize === 0;
    if (isBatchSizeReached) {
      await requestIdlePromise(maxWaitMs);
    }
    // Place node on a path
    let path;
    const pathRefPriority = pathRefPriorityForCommitId[commit.id];
    const shouldCreateNewPath = pathRefPriority !== undefined;
    if (shouldCreateNewPath) {
      path = createPath(commit.id);
      path.priorityForNodes = pathRefPriority;
    } else {
      path = getOrCreatePathForCommitId(commit.id);
    }
    const node = new Node({
      commit,
      path,
      row: index,
    });
    path.nodes.push(node);
    nodeForCommitId.set(commit.id, node);
    // Tentatively place primary parent on the same path, based on path precedence
    const primaryParentId = commit.parents[0];
    const existingPath = pathForCommitId.get(primaryParentId);
    if (primaryParentId === undefined) {
      // No parents, do nothing.
    }
    else if (existingPath !== undefined && existingPath.nodes.length > 0 && path.compareForNodeInsertion(existingPath) < 0) {
      // Existing path for parent node has precedence, do nothing.
    }
    else {
      // No existing path for parent node, or our path has precedence.
      pathForCommitId.set(primaryParentId, path);
    }
    // Keep track of child ids for node relationships
    for (const parentId of commit.parents) {
      if ( ! childIdsForCommitId.has(parentId)) {
        childIdsForCommitId.set(parentId, []);
      }
      childIdsForCommitId.get(parentId).push(commit.id);
    }
    // Update node relationships
    for (const childId of childIdsForCommitId.get(commit.id) ?? []) {
      const childNode = nodeForCommitId.get(childId);
      if (childNode === undefined) {
        continue;
      }
      node.children.push(childNode);
      for (const [parentIndex, parentId] of childNode.commit.parents.entries() ?? []) {
        const parentNode = nodeForCommitId.get(parentId);
        if (parentNode !== undefined) {
          childNode.parents[parentIndex] = parentNode;
        }
      }
    }
    // Add path name candidates from refs
    const refs = refsByCommitId[commit.id] ?? [];
    for (const ref of refs) {
      path.nameCandidatesFromRefs.push(ref.refName);
    }
    // Add path name candidates from commit subject lines
    const { mergeSourceBranchName, mergeTargetBranchName } = parseBranchNamesFromSubject(commit.subject);
    if (mergeTargetBranchName !== undefined) {
      // Current commit is a merge commit. Use the merge target branch name as a candidate.
      path.nameCandidatesFromCommitSubjectLines.push(mergeTargetBranchName);
    }
    if (mergeSourceBranchName !== undefined) {
      // Current commit is a merge commit. Use the merge source branch name as a candidate for the secondary parent's path.
      const secondaryParentCommitId = commit.parents[1];
      const secondaryParentPath = getOrCreatePathForCommitId(secondaryParentCommitId);
      secondaryParentPath.nameCandidatesFromCommitSubjectLines.push(mergeSourceBranchName);
    }
  }

  // Remove empty paths
  paths = paths.filter(path => path.nodes.length > 0);

  return {
    paths,
    nodeForCommitId,
  };
}


/**
 * @param {Path} pathA
 * @param {Path} pathB
 */
export function comparePaths(pathA, pathB) {
  // Prioritize paths with known name priority
  const pathANamePriority = pathA.getPathNamePriority();
  const pathBNamePriority = pathB.getPathNamePriority();
  if (pathBNamePriority - pathANamePriority !== 0) {
    return pathBNamePriority - pathANamePriority;
  }
  // Prioritize paths that have parents with high merge count
  const pathAMergeCountPriority = pathA.getMergeCountPriority();
  const pathBMergeCountPriority = pathB.getMergeCountPriority();
  if (pathBMergeCountPriority - pathAMergeCountPriority !== 0) {
    return pathBMergeCountPriority - pathAMergeCountPriority;
  }
  // Prioritize high merge count
  if (pathB.mergeCount - pathA.mergeCount !== 0) {
    return pathB.mergeCount - pathA.mergeCount;
  }
  // Prioritize ancestor paths over descendant paths
  const pathAAncestorCount = pathA.getAncestorCount();
  const pathBAncestorCount = pathB.getAncestorCount();
  if (pathAAncestorCount - pathBAncestorCount !== 0) {
    return pathAAncestorCount - pathBAncestorCount;
  }
  // Prioritize shorter paths, considering open paths to always be longer than closed paths.
  const pathAIsOpen = pathA.getIsOpenPath();
  const pathBIsOpen = pathB.getIsOpenPath();
  if (pathAIsOpen && ! pathBIsOpen) {
    return 1;
  }
  if ( ! pathAIsOpen && pathBIsOpen) {
    return -1;
  }
  const pathALength = pathA.getExtendedEndIndex() - pathA.getExtendedStartIndex();
  const pathBLength = pathB.getExtendedEndIndex() - pathB.getExtendedStartIndex();
  if (pathBLength - pathALength !== 0) {
    // If both paths are open, prioritize longer paths.
    if (pathAIsOpen && pathBIsOpen) {
      return pathBLength - pathALength;
    }
    else {
      return pathALength - pathBLength;
    }
  }
  return 0;
}


/** @param {Path[]} paths */
export function sortPaths(paths) {
  // Sort paths
  for (const path of paths) {
    path.mergeCount = 0;
    for (const node of path.nodes) {
      if (node.parents.length > 1) {
        path.mergeCount += 1;
      }
    }
  }
  paths.sort(comparePaths);
}


/**
 * @param {Path[]} paths
 * @param {object} options
 */
export function assignPathColumns(paths, options) {
  /** @type {Column[]} */
  const columns = [];
  /** @type {Object.<string, number>} */
  const nodelessPathColumnIndices = {};
  /** @type {Object.<number, Path>} */
  const lastPathByColumnIndex = {};
  for (const path of paths) {
    const pathStart = path.getExtendedStartIndex();
    const pathEnd = path.getExtendedEndIndex();
    const minColumnIndex = path.getPrimaryParentPath()?.columnIndex ?? 0;
    let selectedColumnIndex = undefined;
    let indeterminateMergeEdgeCounter = 0;
    const columnIterator = columns.values();

    /** @param {Column} column */
    const assignColumnsForHighToLowMergeEdges = function(column) {
      // Look for merges from higher priority paths into this path and give them their own columns.
      for (const node of path.nodes) {
        const secondaryParents = node.parents.slice(1);
        const parentsWithPath = secondaryParents.filter(node => node.path !== null);
        for (const parentNode of parentsWithPath) {
          // If there is a node within the parentNode's Path between the parentNode and this node
          // then the merge edge would overlap that node and will need its own column. Otherwise skip as its not needed.
          const edgeWouldOverlapNodes = node.row < parentNode.getPreviousNodeInPath()?.row;
          if ( ! edgeWouldOverlapNodes) {
            continue;
          }
          if (parentNode.isPlaceholder && options.shouldHideIndeterminateMergeEdges) {
            continue;
          }
          const range = {start: node.row, end: parentNode.row};
          const parentIndex = node.parents.indexOf(parentNode);
          const parentPathHasPriority = comparePaths(parentNode.path, path) < 0;
          if (parentPathHasPriority) {
            // Check if the columns between the parent path's column and the current column have room for the merge edge
            let existingColumnIndex;
            let wasExistingColumnOccupied = false;
            for (
              existingColumnIndex = (parentNode.path.columnIndex ?? -1) + 1;
              existingColumnIndex < column.columnIndex;
              existingColumnIndex += 1
            ) {
              const existingColumn = columns[existingColumnIndex];
              const isOverlapping = getIsOverlappingOccupiedRange(existingColumn, range.start, range.end);
              if ( ! isOverlapping) {
                column.occupiedRanges.push(range);
                nodelessPathColumnIndices[`${node.row}-${parentIndex}`] = existingColumn.columnIndex;
                wasExistingColumnOccupied = true;
              }
            }
            // Otherwise get the next unoccupied column
            if ( ! wasExistingColumnOccupied) {
              let mergeEdgeColumn = column;
              while (getIsOverlappingOccupiedRange(mergeEdgeColumn, range.start, range.end)) {
                mergeEdgeColumn = getNextColumn(columnIterator);
              }
              mergeEdgeColumn.occupiedRanges.push(range);
              nodelessPathColumnIndices[`${node.row}-${parentIndex}`] = mergeEdgeColumn.columnIndex;
              if (mergeEdgeColumn.columnIndex === column.columnIndex) {
                // Since we occupied the current path's would-be column, give the path a new column
                while ( ! getIsColumnValidForPath(column, pathStart, pathEnd)) {
                  column = getNextColumn(columnIterator);
                }
              }
            }
          }
          else {
            let mergeEdgeColumn = createColumn();
            while (getIsOverlappingOccupiedRange(mergeEdgeColumn, range.start, range.end)) {
              mergeEdgeColumn = createColumn();
            }
            mergeEdgeColumn.occupiedRanges.push(range);
            nodelessPathColumnIndices[`${node.row}-${parentIndex}`] = mergeEdgeColumn.columnIndex;
          }
        }
      }
      // Look for merges with unknown parents and give them their own columns.
      // Reversed order makes the edges nest instead of cross each other.
      for (const node of path.nodes.toReversed()) {
        const secondaryParents = node.parents.slice(1);
        const parentsWithoutPath = secondaryParents.filter(node => node.path === null);
        for (const parentNode of parentsWithoutPath) {
          const parentIndex = node.parents.indexOf(parentNode);
          if (parentNode.isPlaceholder && node !== node.path.getLastNode() && options.shouldHideIndeterminateMergeEdges) {
            indeterminateMergeEdgeCounter += 1;
            nodelessPathColumnIndices[`${node.row}-${parentIndex}`] = column.columnIndex + indeterminateMergeEdgeCounter + 1;
            continue;
          }
          const range = {start: node.row, end: parentNode.row};
          let nextColumn = getNextColumn(columnIterator);
          while (getIsOverlappingOccupiedRange(nextColumn, range.start, range.end)) {
            nextColumn = getNextColumn(columnIterator);
          }
          nodelessPathColumnIndices[`${node.row}-${parentIndex}`] = nextColumn.columnIndex;
          nextColumn.occupiedRanges.push(range);
        }
      }
      return column;
    };

    /** @param {Iterator<Column>} columnIterator */
    const getNextColumn = function(columnIterator) {
      /** @type {Column} */
      let nextColumn;
      const next = columnIterator.next();
      if (next.done) {
        nextColumn = createColumn();
      }
      else {
        nextColumn = next.value;
      }
      return nextColumn;
    };

    /** @returns {Column} */
    const createColumn = function() {
      /** @type {Column} */
      const column = {
        columnIndex: columns.length,
        occupiedRanges: [],
      };
      columns.push(column);
      return column;
    };

    /**
     * @param {Column} column
     * @param {number} pathStart
     * @param {number} pathEnd
     */
    const getIsOverlappingOccupiedRange = function(column, pathStart, pathEnd) {
      let isOverlappingOccupiedRange = false;
      for (const {start, end} of column.occupiedRanges) {
        if (pathStart < end && pathEnd > start) {
          isOverlappingOccupiedRange = true;
          break;
        }
      }
      return isOverlappingOccupiedRange;
    };

    /**
     * @param {Column} column
     * @param {number} pathStart
     * @param {number} pathEnd
     */
    const getIsColumnValidForPath = function(column, pathStart, pathEnd) {
      if (column.columnIndex < minColumnIndex) {
        return false;
      }
      if (getIsOverlappingOccupiedRange(column, pathStart, pathEnd)) {
        return false;
      }
      return true;
    };

    for (let column of columnIterator) {
      if ( ! getIsColumnValidForPath(column, pathStart, pathEnd)) {
        continue;
      }
      else {
        column = assignColumnsForHighToLowMergeEdges(column);
        // Assign column for path
        column.occupiedRanges.push({start: pathStart, end: pathEnd});
        selectedColumnIndex = column.columnIndex;
        break;
      }
    }
    if (selectedColumnIndex === undefined) {
      /** @type {Column} */
      let column = {
        columnIndex: columns.length,
        occupiedRanges: [],
      };
      columns.push(column);
      column = assignColumnsForHighToLowMergeEdges(column);
      // Assign column for path
      column.occupiedRanges.push({start: pathStart, end: pathEnd});
      selectedColumnIndex = column.columnIndex;
    }
    path.columnIndex = selectedColumnIndex;
    const currentLastPath = lastPathByColumnIndex[path.columnIndex];
    if (currentLastPath === undefined || path.getLastNode().row > currentLastPath.getLastNode().row) {
      lastPathByColumnIndex[path.columnIndex] = path;
    }
  }

  return {
    columns,
    nodelessPathColumnIndices,
    lastPathByColumnIndex,
  };
}


/**
 * @param {Commit[]} commits
 * @param {Map<Commit['id'], Node>} nodeForCommitId
 * @param {number} maxRow
 */
export function addPlaceholderParents(commits, nodeForCommitId, maxRow) {
  // Add placeholder parent nodes where needed
  for (const commit of commits) {
    const node = nodeForCommitId.get(commit.id);
    if (node.parents.length === commit.parents.length) {
      continue;
    }
    for (const [parentIndex, parentId] of commit.parents.entries()) {
      if (node.parents[parentIndex] !== undefined) {
        continue;
      }
      node.parents[parentIndex] = new Node({
        commit: new Commit({id: parentId}),
        path: null,
        row: maxRow,
        isPlaceholder: true,
      });
    }
  }
}


/** @param {Reference} ref */
export function renderRef(ref) {
  const rightArrow = '\u2192';
  let refName = asTextContent(ref.refName);
  let refTitle = refName;
  let refTypeClass;
  let remotePart = '';
  let iconPart = '';
  if (ref.refType === null) {
    refTypeClass = 'special-ref';
  } else {
    refTypeClass = `ref-${ref.refType}`;
  }
  if (ref.refName === 'HEAD') {
    refName = `YOU ARE HERE ${rightArrow}`;
    refTitle = '';
  } else if (ref.refType === 'stash') {
    refName = 'Your latest stash';
    refTitle = '';
    iconPart = '<svg-icon src="img/icon-box-package.svg" title="Your latest stash"></svg-icon>';
  } else if (ref.refType === 'remotes') {
    let remoteName;
    // TODO: Remotes can have slashes, although you should probably be slapped if you do that.
    [remoteName, refName] = splitOnce(ref.refName, '/');
    refName = asTextContent(refName);
    remotePart = `<span class="ref-part-remote">(${asTextContent(remoteName)})</span>`;
    iconPart = `<svg-icon src="img/icon-share.svg" title="Remote branch"></svg-icon>`;
  }
  else if (ref.refType === 'tags') {
    iconPart = '<svg-icon src="img/icon-tag.svg" title="Tag"></svg-icon>';
  }
  else if (ref.refType === 'heads') {
    iconPart = '<svg-icon src="img/icon-branching.svg" title="Local branch"></svg-icon>';
  }
  return `<div class="ref ${asTextContent(refTypeClass)}" title="${refTitle}">${remotePart}${iconPart}<span class="ref-part-name">${refName}</span></div>`;
}


/**
 * @param {Reference} a
 * @param {Reference} b
 */
export function compareRefs(a, b) {
  let refTypeA = a.refType;
  let refTypeB = b.refType;
  if (a.isPointedToByHEAD && b.refType === 'HEAD') {
    return 1;
  }
  if (b.isPointedToByHEAD && a.refType === 'HEAD') {
    return -1;
  }
  if (a.isPointedToByHEAD) {
    refTypeA = 'HEAD';
  }
  if (b.isPointedToByHEAD) {
    refTypeB = 'HEAD';
  }
  const refTypeOrder = {
    'HEAD': 0,
    'tags': 1,
    'heads': 2,
    'remotes': 3,
  };
  const refTypeOrderOther = 4;
  const refTypeOrderResult = (refTypeOrder[refTypeB] ?? refTypeOrderOther) - (refTypeOrder[refTypeA] ?? refTypeOrderOther);
  if (refTypeOrderResult !== 0) {
    return refTypeOrderResult;
  }
  return a.refName.localeCompare(b.refName);
}


/**
 * @param {object} context
 * @param {Commit} context.commit
 * @param {Node} context.node
 * @param {Map<Commit['id'], Node>} context.nodeForCommitId
 * @param {Object.<string, number>} context.nodelessPathColumnIndices
 * @param {Object.<number, Path>} context.lastPathByColumnIndex
 * @param {number} context.maxRow
 *
 * @param {object} options
 * @param {string[]} options.colors
 * @param {number} options.columnWidth
 * @param {number} options.rowHeight
 * @param {boolean} options.shouldHideIndeterminateMergeEdges
 * @param {number} options.xOffset
 * @param {number} options.yOffset
 * @param {number} options.cornerOffset
 */
export function getEdges(context, options) {
  const {
    commit,
    node,
    nodeForCommitId,
    nodelessPathColumnIndices,
    lastPathByColumnIndex,
    maxRow,
  } = context;
  const {
    colors,
    columnWidth,
    rowHeight,
    shouldHideIndeterminateMergeEdges,
  } = options;
  const { xOffset, yOffset, cornerOffset } = options;
  const edges = [];
  for (const [parentIndex, parentId] of commit.parents.entries()) {
    const isPrimaryParent = parentIndex === 0;
    const parentNode = nodeForCommitId.get(parentId);
    const parentHasPriority = parentNode !== undefined ? parentNode.path.columnIndex < node.path.columnIndex : false;
    const edgeColumnIndex = nodelessPathColumnIndices[`${node.row}-${parentIndex}`];
    const edgeHasOwnColumn = edgeColumnIndex !== undefined;
    const isLastPathOfColumn = lastPathByColumnIndex[node.path.columnIndex] === node.path;
    const isLastNode = node === node.path.getLastNode();
    const isLastNodeOfLastPathOfColumn = isLastPathOfColumn && isLastNode;
    const edgePoints = [];
    let isIndeterminate = false;
    let strokeColor = colors[0];
    if (isPrimaryParent && parentNode === undefined) {
      // Parent has not been parsed yet. Draw a simple line through the bottom of the graph.
      isIndeterminate = ! isLastNodeOfLastPathOfColumn;
      const startX = node.path.columnIndex;
      const startY = 0;
      edgePoints.push([startX * columnWidth + xOffset, startY * rowHeight + yOffset]);
      const endX = node.path.columnIndex;
      const endY = isIndeterminate ? 1 : (maxRow + 1 - node.row);
      edgePoints.push([endX * columnWidth + xOffset, endY * rowHeight + yOffset]);
      strokeColor = colors[node.path.columnIndex % colors.length];
    }
    else if (parentNode === undefined) {
      // Parent has not been parsed yet. Draw a line with a corner through the bottom of the graph.
      isIndeterminate = ! isLastNodeOfLastPathOfColumn && shouldHideIndeterminateMergeEdges;
      const startX = node.path.columnIndex;
      const startY = 0;
      edgePoints.push([startX * columnWidth + xOffset, startY * rowHeight + yOffset]);
      const cornerX = edgeColumnIndex;
      const cornerY = 0;
      edgePoints.push([cornerX * columnWidth + xOffset, cornerY * rowHeight + yOffset + cornerOffset]);
      const endX = edgeColumnIndex;
      const endY = isIndeterminate ? 1 : (maxRow + 1 - node.row);
      edgePoints.push([endX * columnWidth + xOffset, endY * rowHeight + yOffset]);
      strokeColor = colors[edgeColumnIndex % colors.length];
    }
    else if (node.path === parentNode.path) {
      // Edge is within the same path. Draw a simple line.
      const startX = node.path.columnIndex;
      const startY = 0;
      edgePoints.push([startX * columnWidth + xOffset, startY * rowHeight + yOffset]);
      const endX = parentNode.path.columnIndex;
      const endY = parentNode.row - node.row;
      edgePoints.push([endX * columnWidth + xOffset, endY * rowHeight + yOffset]);
      strokeColor = colors[node.path.columnIndex % colors.length];
    }
    else if (isPrimaryParent) {
      // Edge is converging. Draw a line with a corner.
      const startX = node.path.columnIndex;
      const startY = 0;
      edgePoints.push([startX * columnWidth + xOffset, startY * rowHeight + yOffset]);
      const cornerX = node.path.columnIndex;
      const cornerY = parentNode.row - node.row;
      edgePoints.push([cornerX * columnWidth + xOffset, cornerY * rowHeight + yOffset - cornerOffset]);
      const endX = parentNode.path.columnIndex;
      const endY = parentNode.row - node.row;
      edgePoints.push([endX * columnWidth + xOffset, endY * rowHeight + yOffset]);
      strokeColor = colors[node.path.columnIndex % colors.length];
    }
    else if (edgeHasOwnColumn) {
      // Edge has its own column. Draw a line with two corners.
      const startX = node.path.columnIndex;
      const startY = 0;
      edgePoints.push([startX * columnWidth + xOffset, startY * rowHeight + yOffset]);
      const cornerX = edgeColumnIndex;
      const cornerY = 0;
      edgePoints.push([cornerX * columnWidth + xOffset, cornerY * rowHeight + yOffset + cornerOffset]);
      const endX = parentNode.path.columnIndex;
      const endY = parentNode.row - node.row;
      edgePoints.push([cornerX * columnWidth + xOffset, endY * rowHeight + yOffset - cornerOffset]);
      edgePoints.push([endX * columnWidth + xOffset, endY * rowHeight + yOffset]);
      strokeColor = colors[parentNode.path.columnIndex % colors.length];
    }
    else {
      // Edge is diverging from top left to bottom right. Draw a line with a corner.
      // From a low priority path to a high priority path. For example merge develop to main.
      const startX = node.path.columnIndex;
      const startY = 0;
      edgePoints.push([startX * columnWidth + xOffset, startY * rowHeight + yOffset]);
      const cornerX = parentNode.path.columnIndex;
      const cornerY = 0;
      edgePoints.push([cornerX * columnWidth + xOffset, cornerY * rowHeight + yOffset + cornerOffset]);
      const endX = parentNode.path.columnIndex;
      const endY = parentNode.row - node.row;
      edgePoints.push([endX * columnWidth + xOffset, endY * rowHeight + yOffset]);
      strokeColor = colors[parentNode.path.columnIndex % colors.length];
    }
    // For consistent animations all edges should have the same number of points.
    const edgePointCount = 4;
    let pathString = '';
    for (let i = 0; i < edgePointCount; i++) {
      // Last point will be duplicated if there are no more points.
      const [x, y] = edgePoints[i] ?? edgePoints.at(-1);
      const svgCommand = i === 0 ? 'M' : 'L';
      pathString += `${svgCommand}${x},${y} `;
    }
    /** @type {EdgeContext} */
    const edgeContext = {
      edgePoints,
      pathString,
      totalLength: calculatePathStringLength(pathString),
      strokeColor,
      isIndeterminate,
    };
    edges.push(edgeContext);
  }
  return edges;
}
