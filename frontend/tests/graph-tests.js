import Commit from '../js/models/commit.js';
import { assert, assertEdge, assertPath, getRenderData, renderGraph } from './test-harness.js';
/** @typedef {import('../js/ui/graph-models.js').EdgeContext} EdgeContext */

export default [
  async function testSingleCommit() {
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

  async function testTwoCommits() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'B', parents: ['A']}), '(HEAD -> refs/heads/main)'],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Two commits', commitsAndRefs);
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitB, commitA] = commits;
    const path1 = paths[0];
    const node1 = path1.nodes[0];
    const edge1ForB = edgesForCommitId[commitB.id][0];
    assert(node1.commit.id === commitB.id, 'First node of Path should be commit "B".');
    assert(path1.columnIndex === 0, 'First Path should occupy column 0.');
    assertEdge('B edge', node1, edge1ForB, {
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
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitC, commitB, commitA] = commits;
    const path1 = paths[0];
    const node1 = path1.nodes[0];
    assert(node1.commit.id === commitC.id, 'First node of Path should be commit "C".');
    assert(path1.columnIndex === 0, 'First Path should occupy column 0.');
    assertEdge('C to A edge', node1, edgesForCommitId[commitC.id][0], {
      fromRow: 0,
      toRow: 2,
      fromColumn: 0,
      toColumn: 0,
    });
    assertEdge('C to B edge', node1, edgesForCommitId[commitC.id][1], {
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
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitC, commitB, commitA] = commits;
    const path1 = paths[0];
    const node1 = path1.nodes[0];
    assert(node1.commit.id === commitC.id, 'First node of Path should be commit "C".');
    assert(path1.columnIndex === 0, 'First Path should occupy column 0.');
    assertEdge('C to B edge', node1, edgesForCommitId[commitC.id][0], {
      fromRow: 0,
      toRow: 1,
      fromColumn: 0,
      toColumn: 0,
    });
    assertEdge('C to A edge', node1, edgesForCommitId[commitC.id][1], {
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

  async function testMergeWithOwnColumnAscendingPriority() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['A', 'B']}), '(refs/heads/develop)'],
      [new Commit({id: 'C', parents: ['B']}), '(refs/heads/main)'],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Merge with own column, ascending priority', commitsAndRefs);
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitD, commitC, commitB, commitA] = commits;
    const path1 = paths[0];
    const path2 = paths[1];
    assertPath('First path', path1, 'C-B-A');
    assertPath('Second path', path2, 'D');
    assertEdge('D to A edge', path2.nodes[0], edgesForCommitId[commitD.id][0], {
      fromRow: 0,
      toRow: 3,
      fromColumn: 2,
      toColumn: 0,
      midRow: 3,
      midColumn: 2,
    });
    assertEdge('D to B edge', path2.nodes[0], edgesForCommitId[commitD.id][1], {
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

  async function testMergeWithOwnColumnAscendingPriorityParentsSwapped() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['B', 'A']}), '(refs/heads/develop)'],
      [new Commit({id: 'C', parents: ['B']}), '(refs/heads/main)'],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Merge with own column, ascending priority, parents swapped', commitsAndRefs);
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitD, commitC, commitB, commitA] = commits;
    const path1 = paths[0];
    const path2 = paths[1];
    assertPath('First path', path1, 'C-B-A');
    assertPath('Second path', path2, 'D');
    assertEdge('D to B edge', path2.nodes[0], edgesForCommitId[commitD.id][0], {
      fromRow: 0,
      toRow: 2,
      fromColumn: 2,
      toColumn: 0,
      midRow: 2,
      midColumn: 2,
    });
    assertEdge('D to A edge', path2.nodes[0], edgesForCommitId[commitD.id][1], {
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

  async function testMergeWithOwnColumnDescendingPriority() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['A', 'B']}), '(refs/heads/main)'],
      [new Commit({id: 'C', parents: ['B']}), '(refs/heads/develop)'],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Merge with own column, descending priority', commitsAndRefs);
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

    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitM2, commitM1, commitF, commitB, commitA] = commits;
    const path1 = paths[0];
    const path2 = paths[1];
    assertPath('First path', path1, 'M1-B-A');
    assertPath('Second path', path2, 'M2-F');
    assertEdge('M1 to B edge', path1.nodes[0], edgesForCommitId[commitM1.id][0], {
      fromRow: 1,
      toRow: 3,
      fromColumn: 0,
      toColumn: 0,
    });
    assertEdge('M1 to F edge', path1.nodes[0], edgesForCommitId[commitM1.id][1], {
      fromRow: 1,
      toRow: 2,
      fromColumn: 0,
      toColumn: 2,
      midRow: 1,
      midColumn: 2,
    });
    assertEdge('M2 to F edge', path2.nodes[0], edgesForCommitId[commitM2.id][0], {
      fromRow: 0,
      toRow: 2,
      fromColumn: 2,
      toColumn: 2,
    });
    assertEdge('M2 to B edge', path2.nodes[0], edgesForCommitId[commitM2.id][1], {
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

  // TODO: When settings for branch priority are added,
  // arrange settings so that "main" has higher priority than "develop".

  async function testSimpleBranchPriority() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'B', parents: ['A']}), '(refs/heads/develop)'],
      [new Commit({id: 'A'}), '(refs/heads/main)'],
    ];
    renderGraph('Branch priority', commitsAndRefs);
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitB, commitA] = commits;
    const path1 = paths[0];
    const path2 = paths[1];
    assert(path1.nodes[0].commit.id === commitA.id, 'First Path should be commit "A".');
    assert(path2.nodes[0].commit.id === commitB.id, 'Second Path should be commit "B".');
    assert(path1.columnIndex === 0, 'First Path should occupy column 0.');
    assert(path2.columnIndex === 1, 'Second Path should occupy column 1.');
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
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitD, commitC, commitB, commitA] = commits;
    const path1 = paths[0];
    const path2 = paths[1];
    const path3 = paths[2];
    const path4 = paths[3];
    assert(path1.nodes[0].commit.id === commitA.id, 'First Path should be commit "A".');
    assert(path2.nodes[0].commit.id === commitB.id, 'Second Path should be commit "B".');
    assert(path3.nodes[0].commit.id === commitC.id, 'Third Path should be commit "C".');
    assert(path4.nodes[0].commit.id === commitD.id, 'Fourth Path should be commit "D".');
    assert(path1.columnIndex === 0, 'First Path should occupy column 0.');
    assert(path2.columnIndex === 1, 'Second Path should occupy column 1.');
    assert(path3.columnIndex === 2, 'Third Path should occupy column 2.');
    assert(path4.columnIndex === 3, 'Fourth Path should occupy column 3.');
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
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitD, commitC, commitB, commitA] = commits;
    const path1 = paths[0];
    const path2 = paths[1];
    const path3 = paths[2];
    const path4 = paths[3];
    assert(path1.nodes[0].commit.id === commitA.id, 'First Path should be commit "A".');
    assert(path2.nodes[0].commit.id === commitC.id, 'Second Path should be commit "C".');
    assert(path3.nodes[0].commit.id === commitB.id, 'Third Path should be commit "B".');
    assert(path4.nodes[0].commit.id === commitD.id, 'Fourth Path should be commit "D".');
    assert(path1.columnIndex === 0, 'First Path should occupy column 0.');
    assert(path2.columnIndex === 1, 'Second Path should occupy column 1.');
    assert(path3.columnIndex === 2, 'Third Path should occupy column 2.');
    assert(path4.columnIndex === 3, 'Fourth Path should occupy column 3.');
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
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitD, commitC, commitB, commitA] = commits;
    const path1 = paths[0];
    const path2 = paths[1];
    const path3 = paths[2];
    assert(path1.nodes[0].commit.id === commitD.id, 'First Path should be commit "D".');
    assert(path2.nodes[0].commit.id === commitC.id, 'Second Path should be commit "C".');
    assert(path3.nodes[0].commit.id === commitB.id, 'Third Path should be commit "B".');
    assert(path1.columnIndex === 0, 'First Path should occupy column 0.');
    assert(path2.columnIndex === 1, 'Second Path should occupy column 1.');
    assert(path3.columnIndex === 2, 'Third Path should occupy column 2.');
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
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitD, commitC, commitB, commitA] = commits;
    const path1 = paths[0];
    const path2 = paths[1];
    const path3 = paths[2];
    assert(path1.nodes[0].commit.id === commitB.id, 'First Path should be commit "B".');
    assert(path2.nodes[0].commit.id === commitD.id, 'Second Path should be commit "D".');
    assert(path3.nodes[0].commit.id === commitC.id, 'Third Path should be commit "C".');
    assert(path1.columnIndex === 0, 'First Path should occupy column 0.');
    assert(path2.columnIndex === 1, 'Second Path should occupy column 1.');
    assert(path3.columnIndex === 2, 'Third Path should occupy column 2.');
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
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitD, commitC, commitB, commitA] = commits;
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
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitD, commitC, commitB, commitA] = commits;
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
    const { commits, paths, edgesForCommitId } = await getRenderData(commitsAndRefs);
    const [commitD, commitC, commitB, commitA] = commits;
  },
];
