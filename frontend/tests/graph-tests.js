import { parseRefsFromDecorateFull } from '../js/git-interface/parsers.js';
import Commit from '../js/models/commit.js';
import Reference from '../js/models/reference.js';
import { getEdges } from '../js/ui/graph-functions.js';
import { Node } from '../js/ui/graph-models.js';
import { GraphElement } from '../js/ui/graph.js';
/** @typedef {import('../js/ui/graph-models.js').EdgeContext} EdgeContext */

/**
 * Render commits and paths for testing purposes.
 * @param {[Commit, string][]} commitsAndRefs An array of tuples containing Commit objects and their associated reference strings.
 * @return {Promise<{
 *   commits: Commit[],
 *   paths: any[],
 *   nodeForCommitId: Map<string, Node>,
 *   edgesForCommitId: Partial<{
 *     [commitId: string]: EdgeContext[]
 *   }>
 * }>}
 */
async function renderForTest(commitsAndRefs) {
  const testColors = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];
  const columnWidth = 1;
  const rowHeight = 1;
  const shouldHideIndeterminateMergeEdges = false;
  const edgesForCommitId = {};
  const commits = commitsAndRefs.map(([commit]) => commit);
  /** @type {Object.<string, Reference>} */
  const refs = {};
  for (const [commit, refString] of commitsAndRefs) {
    Object.assign(refs, parseRefsFromDecorateFull(refString, commit.id));
  }
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
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

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
function assertEdge(description, node, edge, expected) {
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
}

export default [
  async function graphTestSingleCommit() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'A'}), '(HEAD -> refs/heads/main)'],
    ];
    const { commits, paths } = await renderForTest(commitsAndRefs);
    const commit1 = commits[0];
    const path1 = paths[0];
    const node1 = path1.nodes[0];
    assert(node1.commit.id === commit1.id, 'First commit of Path should be commit "a".');
    assert(path1.columnIndex === 0, 'First Path should occupy column 0.');
  },
  async function graphTestTwoCommits() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'B', parents: ['A']}), '(HEAD -> refs/heads/main)'],
      [new Commit({id: 'A'}), ''],
    ];
    const { commits, paths, edgesForCommitId } = await renderForTest(commitsAndRefs);
    const commit1 = commits[0];
    const commit2 = commits[1];
    const path1 = paths[0];
    const node1 = path1.nodes[0];
    const edge1 = edgesForCommitId[commit1.id][0];
    assert(node1.commit.id === commit1.id, 'First node of Path should be commit "B".');
    assert(path1.columnIndex === 0, 'First Path should occupy column 0.');
    assertEdge('B edge', node1, edge1, {
      fromRow: 0,
      toRow: 1,
      fromColumn: 0,
      toColumn: 0,
    });
  },
  async function graphTestSimpleMerge() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'C', parents: ['A', 'B']}), '(HEAD -> refs/heads/main)'],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    const { commits, paths, edgesForCommitId } = await renderForTest(commitsAndRefs);
    const commit1 = commits[0];
    const commit2 = commits[1];
    const commit3 = commits[2];
    const path1 = paths[0];
    const node1 = path1.nodes[0];
    const edge1 = edgesForCommitId[commit1.id][0];
    const edge2 = edgesForCommitId[commit1.id][1];
    assert(node1.commit.id === commit1.id, 'First node of Path should be commit "C".');
    assert(path1.columnIndex === 0, 'First Path should occupy column 0.');
    assertEdge('C to A edge', node1, edge1, {
      fromRow: 0,
      toRow: 2,
      fromColumn: 0,
      toColumn: 0,
    });
    assertEdge('C to B edge', node1, edge2, {
      fromRow: 0,
      toRow: 1,
      fromColumn: 0,
      toColumn: 1,
      midRow: 0,
      midColumn: 1,
    });
  },

  // TODO: Rename variables, perhaps from commit1 to commitA etc. or figure out something better.
  // TODO: Figure out what this actually draws. Why is there no mid-point? Is this the bug I'm trying to fix?

  async function graphTestSimpleMergeWrongDirection() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'C', parents: ['B', 'A']}), '(HEAD -> refs/heads/main)'],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    const { commits, paths, edgesForCommitId } = await renderForTest(commitsAndRefs);
    const commit1 = commits[0];
    const commit2 = commits[1];
    const commit3 = commits[2];
    const path1 = paths[0];
    const node1 = path1.nodes[0];
    const edge1 = edgesForCommitId[commit1.id][0];
    const edge2 = edgesForCommitId[commit1.id][1];
    assert(node1.commit.id === commit1.id, 'First node of Path should be commit "C".');
    assert(path1.columnIndex === 0, 'First Path should occupy column 0.');
    assertEdge('C to B edge', node1, edge1, {
      fromRow: 0,
      toRow: 1,
      fromColumn: 0,
      toColumn: 0,
    });
    assertEdge('C to A edge', node1, edge2, {
      fromRow: 0,
      toRow: 2,
      fromColumn: 0,
      toColumn: 0,
    });
  },
];
