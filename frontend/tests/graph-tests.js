import Commit from '../js/models/commit.js';
import { assert, assertEdge, getRenderData, renderGraph } from './test-harness.js';
/** @typedef {import('../js/ui/graph-models.js').EdgeContext} EdgeContext */

export default [
  async function graphTestSingleCommit() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'A'}), '(HEAD -> refs/heads/main)'],
    ];
    renderGraph('Single commit', commitsAndRefs);
    const { commits, paths } = await getRenderData(commitsAndRefs);
    const commitA = commits[0];
    const path1 = paths[0];
    const node1 = path1.nodes[0];
    assert(node1.commit.id === commitA.id, 'First commit of Path should be commit "a".');
    assert(path1.columnIndex === 0, 'First Path should occupy column 0.');
  },

  async function graphTestTwoCommits() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'B', parents: ['A']}), '(HEAD -> refs/heads/main)'],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Two commits', commitsAndRefs);
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const commitA = commits[0];
    const commitB = commits[1];
    const path1 = paths[0];
    const node1 = path1.nodes[0];
    const edge1 = edgesForCommitId[commitA.id][0];
    assert(node1.commit.id === commitA.id, 'First node of Path should be commit "B".');
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
    renderGraph('Simple merge', commitsAndRefs);
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const commitA = commits[0];
    const commitB = commits[1];
    const commitC = commits[2];
    const path1 = paths[0];
    const node1 = path1.nodes[0];
    const edge1 = edgesForCommitId[commitA.id][0];
    const edge2 = edgesForCommitId[commitA.id][1];
    assert(node1.commit.id === commitA.id, 'First node of Path should be commit "C".');
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

  async function graphTestSimpleMergeWrongDirection() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'C', parents: ['B', 'A']}), '(HEAD -> refs/heads/main)'],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Simple merge wrong direction', commitsAndRefs);
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const commitA = commits[0];
    const commitB = commits[1];
    const commitC = commits[2];
    const path1 = paths[0];
    const node1 = path1.nodes[0];
    const edge1 = edgesForCommitId[commitA.id][0];
    const edge2 = edgesForCommitId[commitA.id][1];
    assert(node1.commit.id === commitA.id, 'First node of Path should be commit "C".');
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
