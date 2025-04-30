import { parseRefsFromDecorateFull } from '../js/git-interface/parsers.js';
import Commit from '../js/models/commit.js';
import Reference from '../js/models/reference.js';
import { getEdges } from '../js/ui/graph-functions.js';
import { GraphElement } from '../js/ui/graph.js';

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

export default [
  async function graphTestSingleCommit() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: '1'}), '(HEAD -> refs/heads/main)'],
    ];
    const { commits, paths } = await renderForTest(commitsAndRefs);
    const commit1 = commits[0];
    const path1 = paths[0];
    const node1 = path1.nodes[0];
    assert(node1.commit.id === commit1.id, 'First commit of Path should be commit "1".');
    assert(path1.columnIndex === 0, 'First Path should occupy column 0.');
  },
  async function graphTestTwoCommits() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: '2', parents: ['1']}), '(HEAD -> refs/heads/main)'],
      [new Commit({id: '1'}), ''],
    ];
    const { commits, paths, edgesForCommitId } = await renderForTest(commitsAndRefs);
    const commit1 = commits[0];
    const commit2 = commits[1];
    const path1 = paths[0];
    const node1 = path1.nodes[0];
    const edge1 = edgesForCommitId[commit1.id][0];
    const edge1_x1 = edge1.edgePoints[0][0];
    const edge1_y1 = edge1.edgePoints[0][1];
    const edge1_x2 = edge1.edgePoints[1][0];
    const edge1_y2 = edge1.edgePoints[1][1];
    assert(node1.commit.id === commit1.id, 'First commit of Path should be commit "2".');
    assert(path1.columnIndex === 0, 'First Path should occupy column 0.');
    assert(edge1_x1 === 0, 'Edge should start at x=0.', edge1_x1);
    assert(edge1_y1 === 0, 'Edge should start at y=0.', edge1_y1);
    assert(edge1_x2 === 0, 'Edge should end at x=0.', edge1_x2);
    assert(edge1_y2 === 1, 'Edge should end at y=1.', edge1_y2);
  },
];
