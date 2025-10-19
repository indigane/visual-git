import { parseRefsFromDecorateFull } from '../js/git-interface/parsers.js';
import Commit from '../js/models/commit.js';
import Reference from '../js/models/reference.js';
import { getEdges } from '../js/ui/graph-functions.js';
import { Node, Path } from '../js/ui/graph-models.js';
import { GraphElement } from '../js/ui/graph/graph.js';
/** @typedef {import('../js/ui/graph-models.js').EdgeContext} EdgeContext */

/**
 * Parse commits and references from the given commits and reference decorations.
 * @param {[Commit, string][]} commitsAndRefs An array of tuples containing Commit objects and their associated reference decoration strings.
 * @return {{ commits: Commit[], refs: Object.<string, Reference> }} An object containing the parsed commits and references.
 */
function getCommitsAndParseRefs(commitsAndRefs) {
  const commits = commitsAndRefs.map(([commit]) => commit);
  /** @type {Object.<string, Reference>} */
  const refs = {};
  for (const [commit, refString] of commitsAndRefs) {
    Object.assign(refs, parseRefsFromDecorateFull(refString, commit.id));
  }
  return { commits, refs };
}

/**
 * Prepare render data for the given commits and reference decorations.
 * @param {[Commit, string][]} commitsAndRefs An array of tuples containing Commit objects and their associated reference decoration strings.
 * @return {Promise<{
 *   commits: Commit[],
 *   paths: Path[],
 *   nodeForCommitId: Map<string, Node>,
 *   edgesForCommitId: Partial<{
 *     [commitId: string]: EdgeContext[]
 *   }>
 * }>}
 */
export async function getRenderData(commitsAndRefs) {
  const testColors = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];
  const columnWidth = 1;
  const rowHeight = 1;
  const shouldHideIndeterminateMergeEdges = false;
  const edgesForCommitId = {};
  const { commits, refs } = getCommitsAndParseRefs(commitsAndRefs);
  const {
    paths,
    nodeForCommitId,
    nodelessPathColumnIndices,
    lastPathByColumnIndex,
    maxRow,
  } = await GraphElement.prepareData(commits, refs);
  for (const commit of commits) {
    const edges = getEdges({
      commit,
      node: nodeForCommitId.get(commit.id),
      nodeForCommitId,
      nodelessPathColumnIndices,
      lastPathByColumnIndex,
      maxRow,
    }, {
      colors: testColors,
      columnWidth,
      rowHeight,
      shouldHideIndeterminateMergeEdges,
      xOffset: 0,
      yOffset: 0,
      cornerOffset: 0,
    });
    edgesForCommitId[commit.id] = edges;
  }
  return {
    commits,
    paths,
    nodeForCommitId,
    edgesForCommitId,
  };
};

/**
 * Render a graph for the given commits and references.
 * @param {string} testTitle A title to distinguish this test from the others.
 * @param {[Commit, string][]} commitsAndRefs An array of tuples containing Commit objects and their associated reference strings.
 */
export async function renderGraph(testTitle, commitsAndRefs) {
  const graphElement = new GraphElement();
  document.querySelector('.tests').insertAdjacentHTML('beforeend', `<h2>${testTitle}</h2>`);
  document.querySelector('.tests').appendChild(graphElement);
  const { commits, refs } = getCommitsAndParseRefs(commitsAndRefs);
  await graphElement.renderCommits({ commits, refs });
};

/**
 * Assert that a condition is true, throwing an error with the given message if not.
 * @param {boolean} condition
 * @param {string} message
 */
export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
};

/**
 * Assert that the edge points match the expected values.
 * @param {string} description A description of the edge being tested, for debugging purposes.
 * @param {Node} node The node the edge starts from.
 * @param {EdgeContext} edge The points of the edge to test.
 * @param {Object} expected The expected values for the edge.
 * @param {number} expected.fromRow The expected starting row of the edge.
 * @param {number} expected.toRow The expected ending row of the edge.
 * @param {number} expected.fromColumn The expected starting column of the edge.
 * @param {number} expected.toColumn The expected ending column of the edge.
 * @param {number} [expected.midRow] The expected mid-point row of the edge, if any.
 * @param {number} [expected.midColumn] The expected mid-point column of the edge, if any.
 * @param {number} [expected.secondMidRow] The expected second mid-point row of the edge, if any.
 * @param {number} [expected.secondMidColumn] The expected second mid-point column of the edge, if any.
 */
export function assertEdge(description, node, edge, expected) {
  const [startPointX, startPointY] = edge.edgePoints[0] ?? [];
  const [endPointX, endPointY] = edge.edgePoints.at(-1) ?? [];
  const [midPointX, midPointY] = (edge.edgePoints.length > 2 ? edge.edgePoints[1] : null) ?? [];
  const [secondMidPointX, secondMidPointY] = (edge.edgePoints.length > 3 ? edge.edgePoints[2] : null) ?? [];
  // Convert relative edge coordinates to absolute rows and columns,
  // because they are easier to reason about when asserting.
  const startRow = startPointY + node.row;
  const startColumn = startPointX;
  const endRow = endPointY + node.row;
  const endColumn = endPointX;
  const midPointRow = midPointY !== undefined ? midPointY + node.row : undefined;
  const midPointColumn = midPointX;
  const secondMidPointRow = secondMidPointY !== undefined ? secondMidPointY + node.row : undefined;
  const secondMidPointColumn = secondMidPointX;
  assert(startRow === expected.fromRow, `${description || 'Edge'} should start at row ${expected.fromRow}. Actual: ${startRow}`);
  assert(startColumn === expected.fromColumn, `${description || 'Edge'} should start at column ${expected.fromColumn}. Actual: ${startColumn}`);
  assert(endRow === expected.toRow, `${description || 'Edge'} should end at row ${expected.toRow}. Actual: ${endRow}`);
  assert(endColumn === expected.toColumn, `${description || 'Edge'} should end at column ${expected.toColumn}. Actual: ${endColumn}`);
  if (midPointRow !== undefined) {
    assert(expected.midRow !== undefined, `${description || 'Edge'}: Unexpected mid-point in edgePoints (row:${midPointRow}, col:${midPointColumn}).`);
    assert(midPointRow === expected.midRow, `${description || 'Edge'} mid-point should be at row ${expected.midRow}. Actual: ${midPointRow}`);
    assert(midPointColumn === expected.midColumn, `${description || 'Edge'} mid-point should be at column ${expected.midColumn}. Actual: ${midPointColumn}`);
  } else {
    assert(expected.midRow === undefined && expected.midColumn === undefined, `${description || 'Edge'}: Expected mid-point to be defined, but it was not.`);
  }
  if (secondMidPointRow !== undefined) {
    assert(expected.secondMidRow !== undefined, `${description || 'Edge'}: Unexpected second mid-point in edgePoints (row:${secondMidPointRow}, col:${secondMidPointColumn}).`);
    assert(secondMidPointRow === expected.secondMidRow, `${description || 'Edge'} second mid-point should be at row ${expected.secondMidRow}. Actual: ${secondMidPointRow}`);
    assert(secondMidPointColumn === expected.secondMidColumn, `${description || 'Edge'} second mid-point should be at column ${expected.secondMidColumn}. Actual: ${secondMidPointColumn}`);
  } else {
    assert(expected.secondMidRow === undefined && expected.secondMidColumn === undefined, `${description || 'Edge'}: Expected second mid-point to be undefined, but it was not.`);
  }
};

/** @param {string[]} commitIds */
function formatCommitIds(commitIds) {
  return commitIds.join('➜');
}

/** @param {string} commitIdsString */
function splitCommitIds(commitIdsString) {
  return commitIdsString.split(/\W+/).filter(s => s.length > 0);
}

/** @param {Path} path */
function formatPath(path) {
  return formatCommitIds(path.nodes.map(node => node.commit.id));
}

/** Assert that the path consists of the expected commit IDs in order.
 * @param {string} description A description of the path being tested, for debugging purposes.
 * @param {Path} path The path to test.
 * @param {string[]|string} expectedCommitIds The expected commit IDs in order.
 * @param {object} [options] Additional options for the assertion.
 * @param {number} [options.column] The expected column index of the path.
 */
export function assertPath(description, path, expectedCommitIds, { column: expectedColumnIndex } = {}) {
  if (typeof expectedCommitIds === 'string') {
    expectedCommitIds = splitCommitIds(expectedCommitIds);
  }
  assert(path.nodes.length === expectedCommitIds.length, `${description || 'Path'} – Expected: ${formatCommitIds(expectedCommitIds)}. Actual: ${formatPath(path)}.`);
  for (let i = 0; i < path.nodes.length; i++) {
    const actualNode = path.nodes[i];
    const expectedCommitId = expectedCommitIds[i];
    assert(actualNode.commit.id === expectedCommitId, `${description || 'Path'} – Expected: ${formatCommitIds(expectedCommitIds)}. Actual: ${formatPath(path)}.`);
  }
  if (expectedColumnIndex !== undefined) {
    assertPathColumn(description, path, expectedColumnIndex);
  }
};

/** Assert that the path occupies the expected column.
 * @param {string} description A description of the path being tested, for debugging purposes.
 * @param {Path} path The path to test.
 * @param {number} expectedColumnIndex The expected column index of the path.
 */
export function assertPathColumn(description, path, expectedColumnIndex) {
  assert(path.columnIndex === expectedColumnIndex, `${description || 'Path'} should occupy column ${expectedColumnIndex}. Actual: ${path.columnIndex}.`);
};
