import Commit from '../js/models/commit.js';
import { assert, assertEdge, assertPath, assertPathColumn, getRenderData, renderGraph } from './test-harness.js';
/** @typedef {import('../js/ui/graph-models.js').EdgeContext} EdgeContext */

export default [
  async function testSingleCommit() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'A'}), '(HEAD -> refs/heads/main)'],
    ];
    renderGraph('Single commit', commitsAndRefs);
    const { paths } = await getRenderData(commitsAndRefs);
    assertPath('First Path', paths[0], 'A', {column: 0});
  },

  async function testTwoCommits() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'B', parents: ['A']}), '(HEAD -> refs/heads/main)'],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Two commits', commitsAndRefs);
    const { paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const path1 = paths[0];
    const edgesB = edgesForCommitId['B'];
    assertPath('First Path', path1, 'B-A', {column: 0});
    assertEdge('B edge', path1.nodes[0], edgesB[0], {
      fromRow: 0,
      toRow: 1,
      fromColumn: 0,
      toColumn: 0,
    });
  },

  async function testSimpleMerge() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'C', parents: ['A', 'B']}), '(refs/heads/main)'],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Simple merge', commitsAndRefs);
    const { paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const path1 = paths[0];
    const path2 = paths[1];
    const edgesC = edgesForCommitId['C'];
    assertPath('First Path', path1, 'C-A', {column: 0});
    assertPath('Second Path', path2, 'B', {column: 1});
    assertEdge('C to A edge', path1.nodes[0], edgesC[0], {
      fromRow: 0,
      toRow: 2,
      fromColumn: 0,
      toColumn: 0,
    });
    assertEdge('C to B edge', path1.nodes[0], edgesC[1], {
      fromRow: 0,
      toRow: 1,
      fromColumn: 0,
      toColumn: 1,
      midRow: 0,
      midColumn: 1,
    });
  },

  async function testSimpleMergeParentsSwapped() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'C', parents: ['B', 'A']}), '(refs/heads/main)'],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Simple merge, parents swapped', commitsAndRefs);
    const { paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const path1 = paths[0];
    const node1 = path1.nodes[0];
    const edgesC = edgesForCommitId['C'];
    assertPath('First Path', path1, 'A', {column: 0});
    assertPath('Second Path', path1, 'C-B', {column: 1});
    assertEdge('C to B edge', node1, edgesC[0], {
      fromRow: 0,
      toRow: 1,
      fromColumn: 0,
      toColumn: 0,
    });
    assertEdge('C to A edge', node1, edgesC[1], {
      fromRow: 0,
      toRow: 2,
      fromColumn: 0,
      toColumn: 0,
    });
  },

  async function testTDB() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'C', parents: ['A', 'B']}), ''],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), '(refs/heads/main)'],
    ];
    renderGraph('TBD', commitsAndRefs);
  },

  async function testTBD() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['A']}), ''],
      [new Commit({id: 'C', parents: ['A', 'B']}), ''],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('TBD', commitsAndRefs);
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitD, commitC, commitB, commitA] = commits;
  },

  async function testTBD() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['A', 'B']}), ''],
      [new Commit({id: 'C', parents: ['A', 'B']}), '(refs/heads/main)'],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('TBD', commitsAndRefs);
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitD, commitC, commitB, commitA] = commits;
  },

  async function testTBD() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['A', 'C']}), '(refs/heads/develop)'],
      [new Commit({id: 'C', parents: ['A', 'B']}), '(refs/heads/main)'],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('TBD', commitsAndRefs);
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitD, commitC, commitB, commitA] = commits;
  },

  async function testTBD() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['C', 'A']}), '(refs/heads/develop)'],
      [new Commit({id: 'C', parents: ['A', 'B']}), '(refs/heads/main)'],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('TBD', commitsAndRefs);
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitD, commitC, commitB, commitA] = commits;
  },

  async function testMergeHasOwnColumnAscendingPriority() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['A', 'B']}), '(refs/heads/develop)'],
      [new Commit({id: 'C', parents: ['B']}), '(refs/heads/main)'],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Merge has own column, ascending priority', commitsAndRefs);
    const { paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const path1 = paths[0];
    const path2 = paths[1];
    const edgesD = edgesForCommitId['D'];
    assertPath('First path', path1, 'C-B-A', {column: 0});
    assertPath('Second path', path2, 'D', {column: 2});
    assertEdge('D to A edge', path2.nodes[0], edgesD[0], {
      fromRow: 0,
      toRow: 3,
      fromColumn: 2,
      toColumn: 0,
      midRow: 3,
      midColumn: 2,
    });
    assertEdge('D to B edge', path2.nodes[0], edgesD[1], {
      fromRow: 0,
      toRow: 2,
      fromColumn: 2,
      toColumn: 0,
      midRow: 0,
      midColumn: 1,
      secondMidColumn: 1,
      secondMidRow: 2,
    });
  },

  async function testMergeHasOwnColumnAscendingPriorityParentsSwapped() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['B', 'A']}), '(refs/heads/develop)'],
      [new Commit({id: 'C', parents: ['B']}), '(refs/heads/main)'],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Merge has own column, ascending priority, parents swapped', commitsAndRefs);
    const { paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const path1 = paths[0];
    const path2 = paths[1];
    const edgesD = edgesForCommitId['D'];
    assertPath('First path', path1, 'C-B-A', {column: 0});
    assertPath('Second path', path2, 'D', {column: 2});
    assertEdge('D to B edge', path2.nodes[0], edgesD[0], {
      fromRow: 0,
      toRow: 2,
      fromColumn: 2,
      toColumn: 0,
      midRow: 2,
      midColumn: 2,
    });
    assertEdge('D to A edge', path2.nodes[0], edgesD[1], {
      fromRow: 0,
      toRow: 3,
      fromColumn: 2,
      toColumn: 0,
      midRow: 0,
      midColumn: 1,
      secondMidColumn: 1,
      secondMidRow: 3,
    });
  },

  async function testMergeHasOwnColumnDescendingPriority() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['A', 'B']}), '(refs/heads/main)'],
      [new Commit({id: 'C', parents: ['B']}), '(refs/heads/develop)'],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Merge has own column, descending priority', commitsAndRefs);
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitD, commitC, commitB, commitA] = commits;
    const path1 = paths[0];
  },

  async function testCrissCrossMerge() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({ id: 'M2', parents: ['F', 'B'] }), '(refs/heads/develop)'],
      [new Commit({ id: 'M1', parents: ['B', 'F'] }), '(refs/heads/main)'],
      [new Commit({ id: 'F', parents: ['A'] }), ''],
      [new Commit({ id: 'B', parents: ['A'] }), ''],
      [new Commit({ id: 'A' }), ''],
    ];
    renderGraph('Criss-cross merge', commitsAndRefs);

    const { paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const path1 = paths[0];
    const path2 = paths[1];
    const edgesM1 = edgesForCommitId['M1'];
    const edgesM2 = edgesForCommitId['M2'];
    assertPath('First path', path1, 'M1-B-A', {column: 0});
    assertPath('Second path', path2, 'M2-F', {column: 2});
    assertEdge('M1 to B edge', path1.nodes[0], edgesM1[0], {
      fromRow: 1,
      toRow: 3,
      fromColumn: 0,
      toColumn: 0,
    });
    assertEdge('M1 to F edge', path1.nodes[0], edgesM1[1], {
      fromRow: 1,
      toRow: 2,
      fromColumn: 0,
      toColumn: 2,
      midRow: 1,
      midColumn: 2,
    });
    assertEdge('M2 to F edge', path2.nodes[0], edgesM2[0], {
      fromRow: 0,
      toRow: 2,
      fromColumn: 2,
      toColumn: 2,
    });
    assertEdge('M2 to B edge', path2.nodes[0], edgesM2[1], {
      fromRow: 0,
      toRow: 3,
      fromColumn: 2,
      toColumn: 0,
      midRow: 0,
      midColumn: 1,
      secondMidRow: 3,
      secondMidColumn: 1,
    });
  },

  async function testCrissCrossMergeDifferentOrder() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({ id: 'M2', parents: ['B', 'F'] }), '(refs/heads/main)'],
      [new Commit({ id: 'M1', parents: ['F', 'B'] }), '(refs/heads/develop)'],
      [new Commit({ id: 'F', parents: ['A'] }), ''],
      [new Commit({ id: 'B', parents: ['A'] }), ''],
      [new Commit({ id: 'A' }), ''],
    ];
    renderGraph('Criss-cross merge, different order', commitsAndRefs);

    const { paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    // TODO: It's the bug again.
  },

  // TODO: When settings for branch priority are added,
  // arrange settings so that "main" has higher priority than "develop".

  async function testSimpleBranchPriority() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'B', parents: ['A']}), '(refs/heads/develop)'],
      [new Commit({id: 'A'}), '(refs/heads/main)'],
    ];
    renderGraph('Branch priority', commitsAndRefs);
    const { paths } = await getRenderData(commitsAndRefs);
    assertPath('First Path', paths[0], 'A', {column: 0});
    assertPath('Second Path', paths[1], 'B', {column: 1});
  },

  async function testBranchPriorityInBetweenNamedBranches() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['C']}), ''],
      [new Commit({id: 'C', parents: ['A']}), '(refs/heads/develop)'],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), '(refs/heads/main)'],
    ];
    renderGraph('Branch priority in between named branches', commitsAndRefs);
    const { paths } = await getRenderData(commitsAndRefs);
    assertPath('First Path', paths[0], 'A', {column: 0});
    assertPath('Second Path', paths[1], 'B', {column: 1});
    assertPath('Third Path', paths[2], 'C', {column: 2});
    assertPath('Fourth Path', paths[3], 'D', {column: 3});
  },

  async function testBranchPriorityInBetweenNamedBranchesDifferentOrder() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['B']}), ''],
      [new Commit({id: 'C', parents: ['A']}), ''],
      [new Commit({id: 'B', parents: ['A']}), '(refs/heads/develop)'],
      [new Commit({id: 'A'}), '(refs/heads/main)'],
    ];
    renderGraph('Branch priority in between named branches, different order', commitsAndRefs);
    const { paths } = await getRenderData(commitsAndRefs);
    assertPath('First Path', paths[0], 'A', {column: 0});
    assertPath('Second Path', paths[1], 'C', {column: 1});
    assertPath('Third Path', paths[2], 'B', {column: 2});
    assertPath('Fourth Path', paths[3], 'D', {column: 3});
  },

  async function testBranchPriorityOpenBranches() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['A']}), ''],
      [new Commit({id: 'C', parents: ['A']}), ''],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Branch priority open branches', commitsAndRefs);
    const { paths } = await getRenderData(commitsAndRefs);
    assertPath('First Path', paths[0], 'D-A', {column: 0});
    assertPath('Second Path', paths[1], 'C', {column: 1});
    assertPath('Third Path', paths[2], 'B', {column: 2});
  },

  async function testBranchPriorityOpenBranchesWithNamedBranch() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['A']}), ''],
      [new Commit({id: 'C', parents: ['A']}), ''],
      [new Commit({id: 'B', parents: ['A']}), '(refs/heads/main)'],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Branch priority open branches, with named branch', commitsAndRefs);
    const { paths } = await getRenderData(commitsAndRefs);
    assertPath('First Path', paths[0], 'B-A', {column: 0});
    assertPath('Second Path', paths[1], 'D', {column: 1});
    assertPath('Third Path', paths[2], 'C', {column: 2});
  },

  async function testBranchPriorityOpenBranchesWithMerge() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['A']}), ''],
      [new Commit({id: 'C', parents: ['A', 'B']}), '(refs/heads/main)'],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Branch priority open branches, with named branch', commitsAndRefs);
    const { paths } = await getRenderData(commitsAndRefs);
    assertPath('First Path', paths[0], 'C-A', {column: 0});
    assertPath('Second Path', paths[1], 'B', {column: 1});
    assertPath('Third Path', paths[2], 'D', {column: 2});
  },

  async function testBranchPriorityNestedMerges() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'E', parents: ['D', 'C']}), ''],
      [new Commit({id: 'D', parents: ['A', 'B']}), ''],
      [new Commit({id: 'C', parents: ['A']}), ''],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Branch priority nested merges', commitsAndRefs);
    const { paths } = await getRenderData(commitsAndRefs);
    assertPath('First Path', paths[0], 'E-D-A', {column: 0});
    assertPath('Second Path', paths[1], 'B', {column: 1});
    assertPath('Third Path', paths[2], 'C', {column: 2});
  },

  async function testBranchPriorityNestedMergesDifferentOrder() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'E', parents: ['D', 'B']}), ''],
      [new Commit({id: 'D', parents: ['A', 'C']}), ''],
      [new Commit({id: 'C', parents: ['A']}), ''],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Branch priority nested merges, different order', commitsAndRefs);
    const { paths } = await getRenderData(commitsAndRefs);
    assertPath('First Path', paths[0], 'E-D-A', {column: 0});
    assertPath('Second Path', paths[1], 'C', {column: 1});
    assertPath('Third Path', paths[2], 'B', {column: 2});
  },
];
