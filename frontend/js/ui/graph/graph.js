import { adoptWebComponentStyleSheet, loadWebComponentTemplates } from "../webcomponents.js";
import {
  animateCommitEnter,
  animateCommitLeave,
  animateRefEnter,
  animateRefTransition,
} from '../animations.js';
import Commit from '../../models/commit.js';
import Reference from '../../models/reference.js';
import {
  addPlaceholderParents,
  assignPathColumns,
  collectPaths,
  getEdges,
  getRefMappings,
  compareRefs,
  renderRef,
  sortPaths,
} from '../graph-functions.js';
import { requestIdlePromise } from '../../utils.js';
import styleSheet from "./graph.css" with { type: "css" };
/** @typedef {import('graph-models.js').CommitContext} CommitContext */
/** @typedef {import('graph-models.js').EdgeContext} EdgeContext */
/** @typedef {import('graph-models.js').ReferenceContext} ReferenceContext */


document.adoptedStyleSheets.push(styleSheet);
const [ graphTemplate, commitTemplate ] = await loadWebComponentTemplates(import.meta.url);


// TOOD: This should be a setting
const shouldHideIndeterminateMergeEdges = true;

const previousViewportRowIndices = {
  min: -1,
  max: -1,
};


function getViewportMinMaxRows() {
  const columnWidth = 24;
  const rowHeight = 32;
  const topOffset = 5;
  const bottomOffset = Math.ceil(window.innerHeight / rowHeight);
  const viewportMinRowIndex = Math.floor(document.documentElement.scrollTop / rowHeight) - topOffset;
  const viewportMaxRowIndex = Math.ceil((document.documentElement.scrollTop + window.innerHeight) / rowHeight) + bottomOffset;
  return { viewportMinRowIndex, viewportMaxRowIndex };
}


function isCommitInRange(commitContext, minRow, maxRow) {
  if (commitContext === undefined) {
    return false;
  }
  if (commitContext.row >= minRow && commitContext.row <= maxRow) {
    return true;
  }
  // If the commit is above the viewport, it may have an edge hanging downwards that is in range.
  if (commitContext.row < minRow) {
    for (const parentCommitRow of commitContext.parentCommitRows) {
      if (parentCommitRow >= minRow) {
        // The edge from commit to parent is visible in the viewport.
        return true;
      }
    }
  }
  return false;
}


export class GraphElement extends HTMLElement {
  static uniqueIdCounter = 0;

  constructor() {
    super();
    const graph = this;
    // Unique ID for each graph instance, for example used to avoid ID conflicts in SVG markers.
    graph.uniqueId = `graph-${GraphElement.uniqueIdCounter++}`;
    graph.appendChild(graphTemplate.content.cloneNode(true));
    /** @type {HTMLElement} */
    graph.commitsContainer = graph.querySelector('.commits');
    graph.commitElementPool = GraphElement.getCommitElementPool(graph);
    /** @type {Object.<string, CommitContext>} */ graph.commitContextByCommitId = {};
    /** @type {Object.<number, string>} */ graph.commitIdByRowIndex = {};
    /** @type {Object.<string, ReferenceContext>} */ graph.refContextByRefPath = {};
  }
  connectedCallback() {
    document.addEventListener('scroll', this.renderVisibleCommits.bind(this));
    window.addEventListener('resize', this.renderVisibleCommits.bind(this));
  }

  /**
   * @param {Commit[]} commits
   * @param {Object.<string, Reference>} refs
   */
  static async prepareData(commits, refs) {
    const maxRow = commits.length - 1;

    const {
      refsByCommitId,
      pathRefPriorityForCommitId,
    } = getRefMappings(refs);

    const {
      paths,
      nodeForCommitId,
    } = await collectPaths(commits, refsByCommitId, pathRefPriorityForCommitId);

    addPlaceholderParents(commits, nodeForCommitId, maxRow);

    sortPaths(paths);

    const {
      columns,
      nodelessPathColumnIndices,
      lastPathByColumnIndex,
    } = assignPathColumns(paths, {shouldHideIndeterminateMergeEdges});

    return {
      refsByCommitId,
      nodeForCommitId,
      nodelessPathColumnIndices,
      lastPathByColumnIndex,
      columns,
      paths,
      maxRow,
    };
  }

  /** @param {GraphElement} graph */
  static getCommitElementPool(graph) {
    return {
      elementsByCommitId: {},
      index: 0,
      /** @type {CommitElement[]} */
      pool: [],
      getNext: function () {
        const { viewportMinRowIndex, viewportMaxRowIndex } = getViewportMinMaxRows();
        for (let i = 0; i < this.pool.length; i++) {
          const commitElement = this.pool[this.index % this.pool.length];
          this.index += 1;
          if (commitElement._boundCommitId === undefined) {
            return commitElement;
          }
          const isWithinViewport = isCommitInRange(commitElement._context, viewportMinRowIndex, viewportMaxRowIndex);
          if (isWithinViewport) {
            // Do not reuse visible commit elements.
            continue;
          } else {
            return commitElement;
          }
        }
        // Pool is out of available elements.
        const commitElement = graph.createCommitElement();
        this.pool.push(commitElement);
        return commitElement;
      },
      removeByCommitId: function (commitId) {
        const commitElement = this.elementsByCommitId[commitId];
        if (commitElement === undefined) {
          return;
        }
        this.remove(commitElement);
      },
      remove: function (commitElement) {
        delete this.elementsByCommitId[commitElement._boundCommitId];
        commitElement.style.display = 'none';
        commitElement._boundCommitId = undefined;
      },
      removeOutOfRangeElements: function () {
        const { viewportMinRowIndex, viewportMaxRowIndex } = getViewportMinMaxRows();
        for (const commitElement of this.pool) {
          const isWithinViewport = isCommitInRange(commitElement._context, viewportMinRowIndex, viewportMaxRowIndex);
          if ( ! isWithinViewport) {
            this.remove(commitElement);
          }
        }
      },
      get: function (commitId) {
        const commitContext = graph.commitContextByCommitId[commitId];
        if (this.elementsByCommitId[commitId] !== undefined) {
          return this.elementsByCommitId[commitId];
        }
        const commitElement = this.getNext();
        if (commitContext !== undefined) {
          graph.updateCommitElement(commitElement, commitContext);
        }
        // Delete previous reference so that there are no stale references.
        delete this.elementsByCommitId[commitElement._boundCommitId];
        this.elementsByCommitId[commitId] = commitElement;
        commitElement._boundCommitId = commitId;
        return commitElement;
      },
    };
  }

  /** @param {{ commits: Commit[], refs: Object.<string, Reference> }} args */
  async renderCommits({ commits, refs }) {
    const graph = this;
    //const colors = ['#dd826f', '#8bacd2', '#bad56a', '#ae7fba', '#e8b765', '#f8ed73', '#bab6d8', '#f0cee5', '#a2d2c7'];
    //const colors = ['#68023F', '#008169', '#EF0096', '#00DCB5', '#FFCFE2', '#003C86', '#9400E6', '#009FFA', '#FF71FD', '#7CFFFA', '#6A0213', '#008607', '#F60239', '#00E307', '#FFDC3D'];
    const colors = ['#ee6677', '#228833', '#4477aa', '#ccbb44', '#66ccee', '#aa3377', '#bbbbbb'];
    const columnWidth = 24;
    const rowHeight = 32;
    const graphThicknessBase = 32;
    const redrawTransitionDurationMs = 1000;
    const knownCommitIdsForEnterLeaveAnimation = [];
    const knownRefPathsForEnterLeaveAnimation = [];

    const maxRow = commits.length - 1;
    const { viewportMinRowIndex, viewportMaxRowIndex } = getViewportMinMaxRows();
    previousViewportRowIndices.min = viewportMinRowIndex;
    previousViewportRowIndices.max = viewportMaxRowIndex;

    graph.commitsContainer.style.setProperty('--column-width', columnWidth + 'px');
    graph.commitsContainer.style.setProperty('--row-height', rowHeight + 'px');
    graph.commitsContainer.style.setProperty('--graph-thickness-base', graphThicknessBase + 'px');
    graph.commitsContainer.style.setProperty('--max-row', maxRow.toString());

    const {
      refsByCommitId,
      nodeForCommitId,
      nodelessPathColumnIndices,
      lastPathByColumnIndex,
      columns,
    } = await GraphElement.prepareData(commits, refs);

    // Update max column
    const maxColumn = columns.length;

    // Draw nodes and edges
    const deferredAnimations = [];
    for (const [index, commit] of commits.entries()) {
      // Non-blocking iteration
      const batchSize = 1000;
      const maxWaitMs = 100;
      const isBatchSizeReached = index !== 0 && index % batchSize === 0;
      if (isBatchSizeReached) {
        await requestIdlePromise(maxWaitMs);
      }
      // Refs
      const commitRefs = refsByCommitId[commit.id] ?? [];
      commitRefs.sort(compareRefs);
      for (const ref of commitRefs) {
        const oldRefContext = graph.refContextByRefPath[ref.fullRefPath];
        /** @type {ReferenceContext} */
        const newRefContext = {
          ref,
          htmlString: renderRef(ref),
          previousCommitId: oldRefContext?.ref.commitId,
        };
        graph.refContextByRefPath[ref.fullRefPath] = newRefContext;
        knownRefPathsForEnterLeaveAnimation.push(ref.fullRefPath);
      }
      // Node
      const node = nodeForCommitId.get(commit.id);
      const color = colors[node.path.columnIndex % colors.length];
      const edges = getEdges({
        commit,
        node,
        nodeForCommitId,
        nodelessPathColumnIndices,
        lastPathByColumnIndex,
        maxRow,
      }, {
        colors,
        columnWidth,
        rowHeight,
        shouldHideIndeterminateMergeEdges,
        xOffset: columnWidth / 2,
        yOffset: rowHeight / 2,
        cornerOffset: rowHeight / 3,
      });
      /** @type {CommitContext} */
      const newCommitContext = {
        commit: commit,
        row: node.row,
        column: node.path.columnIndex,
        color,
        childCommitIds: node.children.map(childNode => childNode.commit.id),
        parentCommitRows: commit.parents.map(parentId => nodeForCommitId.get(parentId)?.row ?? maxRow),
        edges,
        maxColumn,
        refs: commitRefs,
      };
      const oldCommitContext = graph.commitContextByCommitId[commit.id];
      const isOldCommitElementWithinViewport = isCommitInRange(oldCommitContext, viewportMinRowIndex, viewportMaxRowIndex);
      const isNewCommitElementWithinViewport = isCommitInRange(newCommitContext, viewportMinRowIndex, viewportMaxRowIndex);
      if (isOldCommitElementWithinViewport || isNewCommitElementWithinViewport) {
        deferredAnimations.push(() => {
          const commitElement = graph.commitElementPool.get(commit.id);
          if (oldCommitContext === undefined) {
            // New commit element
            graph.updateCommitElement(commitElement, {...newCommitContext, transitionDuration: '0s'});
            // Half duration so that leaving elements are hidden before entering elements appear.
            const halfDuration = redrawTransitionDurationMs / 2;
            animateCommitEnter(commitElement, halfDuration);
          } else {
            // Existing commit element
            graph.updateCommitElement(commitElement, {...newCommitContext, transitionDuration: redrawTransitionDurationMs + 'ms'}, oldCommitContext);
          }
          // Refs
          // TODO: Check if context.refs has changed?
          for (const ref of newCommitContext.refs) {
            const refContext = graph.refContextByRefPath[ref.fullRefPath];
            if (refContext === undefined) {
              continue;
            }
            const refOldCommitContext = refContext.previousCommitId && graph.commitContextByCommitId[refContext.previousCommitId];
            if (refOldCommitContext === undefined) {
              animateRefEnter(commitElement, refContext, redrawTransitionDurationMs);
            } else {
              animateRefTransition(commitElement, refContext, newCommitContext, refOldCommitContext, redrawTransitionDurationMs);
            }
          }
        });
      }
      graph.commitContextByCommitId[commit.id] = newCommitContext;
      graph.commitIdByRowIndex[newCommitContext.row] = commit.id;
      knownCommitIdsForEnterLeaveAnimation.push(commit.id);
    }
    for (const [commitId, commitContext] of Object.entries(graph.commitContextByCommitId)) {
      const isCommitGone = knownCommitIdsForEnterLeaveAnimation.includes(commitId) === false;
      if (isCommitGone) {
        const isWithinViewport = isCommitInRange(commitContext, viewportMinRowIndex, viewportMaxRowIndex);
        if (isWithinViewport) {
          deferredAnimations.push(() => {
            const commitElement = graph.commitElementPool.get(commitId);
            // Half duration so that leaving elements are hidden before entering elements appear.
            const halfDuration = redrawTransitionDurationMs / 2;
            animateCommitLeave(commitElement, halfDuration).then(() => graph.commitElementPool.removeByCommitId(commitId));
          });
        }
        else {
          graph.commitElementPool.removeByCommitId(commitId);
        }
        delete graph.commitContextByCommitId[commitId];
      }
    }
    graph.commitElementPool.removeOutOfRangeElements();
    // For now all animations are deferred until the end of graph construction.
    // An optimization is possible:
    // - Move knownCommitIdsForEnterLeaveAnimation to the first-pass for loop.
    // - Move leave animations to be as close as possible to the other animations.
    // - Block graph construction from progressing until the animation has finished.
    // Batch boundaries must also be taken into account. The added complexity may not be worth it.
    for (const deferredAnimation of deferredAnimations) {
      deferredAnimation();
    }
  }

  renderVisibleCommits() {
    const graph = this;
    const { viewportMinRowIndex, viewportMaxRowIndex } = getViewportMinMaxRows();
    for (let rowIndex = viewportMinRowIndex; rowIndex <= viewportMaxRowIndex; rowIndex++) {
      if (rowIndex >= previousViewportRowIndices.min && rowIndex <= previousViewportRowIndices.max) {
        // The previous viewport already made this row visible.
        continue;
      }
      const commitId = graph.commitIdByRowIndex[rowIndex];
      if (commitId === undefined) {
        continue;
      }
      const commitElement = graph.commitElementPool.get(commitId);
      const commitContext = graph.commitContextByCommitId[commitId];
      if (commitContext !== undefined) {
        // Render any commit that points to this commit as their parent,
        // because those nodes have an edge hanging downwards that needs
        // to be rendered as it connects to this node.
        for (const childCommitId of commitContext.childCommitIds) {
          graph.commitElementPool.get(childCommitId);
        }
        // Refs
        let refsHtml = '';
        for (const ref of commitContext.refs) {
          const refContext = graph.refContextByRefPath[ref.fullRefPath];
          if (refContext === undefined) {
            continue;
          }
          const refHtml = refContext.htmlString;
          refsHtml += refHtml;
        }
        if (refsHtml !== '') {
          commitElement._elems.refsContainer.innerHTML = refsHtml;
        }
      }
    }
    previousViewportRowIndices.min = viewportMinRowIndex;
    previousViewportRowIndices.max = viewportMaxRowIndex;
  }

  /**
   * @typedef {HTMLElement & {
   *   _elems: {
   *     edges: (SVGElement | null)[]
   *     arrowMarker: SVGElement | null
   *     message: Element | null
   *     identifier: Element | null
   *     author: Element | null
   *     timestamp: Element | null
   *     refsContainer: Element | null
   *   }
   *   _boundCommitId: string
   *   _context: CommitContext
   * }} CommitElement
   */
  createCommitElement() {
    const clonedFragment = /** @type {DocumentFragment} */ (commitTemplate.content.cloneNode(true));
    const commitElement = /** @type {CommitElement} */ (clonedFragment.firstElementChild);
    this.commitsContainer.appendChild(commitElement);
    commitElement._elems = {
      edges: /** @type {SVGElement[]} */([...commitElement.querySelectorAll('.edge')]),
      arrowMarker: /** @type {SVGElement} */(commitElement.querySelector('.arrow-marker')),
      message: commitElement.querySelector('.message'),
      identifier: commitElement.querySelector('.identifier'),
      author: commitElement.querySelector('.author'),
      timestamp: commitElement.querySelector('.timestamp'),
      refsContainer: commitElement.querySelector('.refs'),
    };
    return commitElement;
  }

  /**
   * @param {CommitElement} commitElement
   * @param {CommitContext} context
   * @param {CommitContext} [oldContext]
   */
  updateCommitElement(commitElement, context, oldContext) {
    const graph = this;
    const graphThicknessBase = 32;
    // Remove `display: none;` because new and reused commit elements are initially hidden.
    commitElement.style.removeProperty('display');
    commitElement._context = context;
    commitElement.style.setProperty('--transition-duration', context.transitionDuration ?? '0s');
    commitElement.style.setProperty('--row', context.row.toString());
    commitElement.style.setProperty('--column', context.column.toString());
    commitElement.style.setProperty('--color', context.color);
    commitElement.style.setProperty('--max-column', context.maxColumn.toString());
    commitElement.setAttribute('data-commit-id', context.commit.id);
    if (parseFloat(context.transitionDuration) !== 0) {
      const removeTransitionDuration = function() {
        commitElement.style.setProperty('--transition-duration', '0s');
        commitElement.removeEventListener('transitionend', removeTransitionDuration);
      };
      commitElement.addEventListener('transitionend', removeTransitionDuration);
    }
    for (const [index, edgeElement] of commitElement._elems.edges.entries()) {
      const edge = context.edges[index];
      if (edge) {
        edgeElement.style.removeProperty('display');
        edgeElement.setAttribute('d', edge.pathString);
        if (edge.isIndeterminate) {
          edgeElement.style.setProperty('--stroke-dasharray', 'var(--indeterminate-dasharray)');
        } else {
          edgeElement.style.setProperty('--stroke-dasharray', edge.totalLength.toString());
        }
        // Edge needs its own color, because a node may have multiple different color edges starting from it.
        edgeElement.style.setProperty('--color', edge.strokeColor);
        if (index > 0) {
          const markerId = `arrow-marker-${graph.uniqueId}-${context.commit.id}-${index}`;
          commitElement._elems.arrowMarker.setAttribute('id', markerId);
          commitElement._elems.arrowMarker.setAttribute('fill', edge.strokeColor);
          commitElement._elems.arrowMarker.setAttribute('markerWidth', (graphThicknessBase / 10).toString());
          commitElement._elems.arrowMarker.setAttribute('markerHeight', (graphThicknessBase / 10).toString());
          edgeElement.setAttribute('marker-start', `url(#${markerId})`);
          edgeElement.classList.add('has-marker');
        } else {
          edgeElement.removeAttribute('marker-start');
          edgeElement.classList.remove('has-marker');
        }
      }
      else {
        edgeElement.style.display = 'none';
      }
    }
    if (oldContext?.commit.subject !== context.commit.subject) {
      commitElement._elems.message.textContent = context.commit.subject;
    }
    if (oldContext?.commit.id !== context.commit.id) {
      commitElement._elems.identifier.textContent = context.commit.id.substring(0, 8);
      commitElement._elems.author.textContent = context.commit.authorName;
      commitElement._elems.timestamp.textContent = context.commit.committerDate?.toISOString().replace('T', ' ').split('.')[0];
    }
    commitElement._elems.refsContainer.replaceChildren();
  }
}

customElements.define('vg-graph', GraphElement);
