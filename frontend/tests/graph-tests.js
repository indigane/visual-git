import Commit from '../js/models/commit.js';
import { assertEdges, assertPath, getRenderData, renderGraph } from './test-harness.js';
/** @typedef {import('../js/ui/graph-models.js').EdgeContext} EdgeContext */

export default [
  async function testSingleCommit() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'A'}), '(HEAD -> refs/heads/main)'],
    ];
    renderGraph('Single commit', commitsAndRefs);
    const renderData = await getRenderData(commitsAndRefs);
    const [path1] = renderData.paths;
    assertPath('First Path', path1, 'A', {column: 0});
  },

  async function testTwoCommits() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'B', parents: ['A']}), '(HEAD -> refs/heads/main)'],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Two commits', commitsAndRefs);
    const renderData = await getRenderData(commitsAndRefs);
    const [path1] = renderData.paths;
    assertPath('First Path', path1, 'B-A', {column: 0});
    assertEdges(renderData, {
      from: { commitId: 'B', row: 0, column: 0 },
      to: [
        { commitId: 'A', row: 1, column: 0 },
      ],
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
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2] = renderData.paths;
    assertPath('First Path', path1, 'C-A', {column: 0});
    assertPath('Second Path', path2, 'B', {column: 1});
    assertEdges(renderData, {
      from: { commitId: 'C', row: 0, column: 0 },
      to: [
        { commitId: 'A', row: 2, column: 0 },
        { commitId: 'B', row: 1, column: 1, midRow: 0, midColumn: 1 },
      ],
    });
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
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2] = renderData.paths;
    assertPath('First path', path1, 'C-B-A', {column: 0});
    assertPath('Second path', path2, 'D', {column: 2});
    assertEdges(renderData, {
      from: { commitId: 'D', row: 0, column: 2 },
      to: [
        { commitId: 'A', row: 3, column: 0, midRow: 3, midColumn: 2 },
        { commitId: 'B', row: 2, column: 0, midRow: 0, midColumn: 1, secondMidColumn: 1, secondMidRow: 2 },
      ],
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
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2] = renderData.paths;
    assertPath('First path', path1, 'C-B-A', {column: 0});
    assertPath('Second path', path2, 'D', {column: 2});
    assertEdges(renderData, {
      from: { commitId: 'D', row: 0, column: 2 },
      to: [
        { commitId: 'B', row: 2, column: 0, midRow: 2, midColumn: 2 },
        { commitId: 'A', row: 3, column: 0, midRow: 0, midColumn: 1, secondMidColumn: 1, secondMidRow: 3 },
      ],
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
    const renderData = await getRenderData(commitsAndRefs);
  },

  async function testMergeHasOwnColumnWithOpenBranch() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'E', parents: ['A', 'C']}), '(refs/heads/develop)'],
      [new Commit({id: 'D', parents: ['C']}), '(refs/heads/main)'],
      [new Commit({id: 'C', parents: ['A']}), ''],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Merge has own column, with open branch in same column', commitsAndRefs);
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2, path3] = renderData.paths;

    assertPath('First path', path1, 'D-C-A', {column: 0});
    assertPath('Second path', path2, 'B', {column: 1});
    assertPath('Third path', path3, 'E', {column: 2});

    // TODO: Assert edges when the third path assertion passes.
  },

  async function testMergeHasOwnColumnWithOpenBranchDifferentDirection() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'E', parents: ['A', 'C']}), '(refs/heads/main)'],
      [new Commit({id: 'D', parents: ['C']}), '(refs/heads/develop)'],
      [new Commit({id: 'C', parents: ['A']}), ''],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Merge has own column, with open branch in same column, different direction', commitsAndRefs);
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2, path3] = renderData.paths;

    assertPath('First path', path1, 'E-A', {column: 0});
    assertPath('Second path', path2, 'B', {column: 1});
    assertPath('Third path', path3, 'D-C', {column: 2});
    assertEdges(renderData, {
      from: { commitId: 'E', row: 0, column: 0 },
      to: [
        { commitId: 'A', row: 4, column: 0 },
        { commitId: 'C', row: 2, column: 2, midRow: 0, midColumn: 1, secondMidRow: 2, secondMidColumn: 1 },
      ],
    });
  },

  async function testCrissCrossMergeSymmetric() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({ id: 'M2', parents: ['F', 'B'] }), '(refs/heads/develop)'],
      [new Commit({ id: 'M1', parents: ['B', 'F'] }), '(refs/heads/main)'],
      [new Commit({ id: 'F', parents: ['A'] }), ''],
      [new Commit({ id: 'B', parents: ['A'] }), ''],
      [new Commit({ id: 'A' }), ''],
    ];
    renderGraph('Criss-cross merge, symmetric', commitsAndRefs);
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2] = renderData.paths;
    assertPath('First path', path1, 'M1-B-A', {column: 0});
    assertPath('Second path', path2, 'M2-F', {column: 2});
    assertEdges(renderData, {
      from: { commitId: 'M1', row: 1, column: 0 },
      to: [
        { commitId: 'B', row: 3, column: 0 },
        { commitId: 'F', row: 2, column: 2, midRow: 1, midColumn: 2 },
      ],
    });
    assertEdges(renderData, {
      from: { commitId: 'M2', row: 0, column: 2 },
      to: [
        { commitId: 'F', row: 2, column: 2 },
        { commitId: 'B', row: 3, column: 0, midRow: 0, midColumn: 1, secondMidRow: 3, secondMidColumn: 1 },
      ],
    });
  },

  async function testCrissCrossMergeSymmetricDifferentOrder() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({ id: 'M2', parents: ['B', 'F'] }), '(refs/heads/main)'],
      [new Commit({ id: 'M1', parents: ['F', 'B'] }), '(refs/heads/develop)'],
      [new Commit({ id: 'F', parents: ['A'] }), ''],
      [new Commit({ id: 'B', parents: ['A'] }), ''],
      [new Commit({ id: 'A' }), ''],
    ];
    renderGraph('Criss-cross merge, symmetric, different order', commitsAndRefs);
    // TODO: It's the bug again.
  },

  async function testCrissCrossMergeChained() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({ id: 'M2', parents: ['B', 'M1'] }), '(refs/heads/main)'],
      [new Commit({ id: 'M1', parents: ['A', 'B'] }), '(refs/heads/develop)'],
      [new Commit({ id: 'B', parents: ['A'] }), ''],
      [new Commit({ id: 'A' }), ''],
    ];
    renderGraph('Criss-cross merge, chained', commitsAndRefs);
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2] = renderData.paths;
    assertPath('First path', path1, 'M2-B-A', { column: 0 });
    assertPath('Second path', path2, 'M1', { column: 1 });
    assertEdges(renderData, {
      from: { commitId: 'M1', row: 1, column: 1 },
      to: [
        { commitId: 'A', row: 3, column: 0, midRow: 3, midColumn: 1 },
        { commitId: 'B', row: 2, column: 0, midRow: 1, midColumn: 0 },
      ],
    });
    assertEdges(renderData, {
      from: { commitId: 'M2', row: 0, column: 0 },
      to: [
        { commitId: 'B', row: 2, column: 0 },
        { commitId: 'M1', row: 1, column: 1, midRow: 0, midColumn: 1 },
      ],
    });
  },

  async function testCrissCrossMergeChainedDifferentOrder() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({ id: 'M2', parents: ['F', 'M1'] }), '(refs/heads/develop)'],
      [new Commit({ id: 'M1', parents: ['B', 'F'] }), '(refs/heads/main)'],
      [new Commit({ id: 'F', parents: ['B'] }), ''],
      [new Commit({ id: 'B', parents: ['A'] }), ''],
      [new Commit({ id: 'A' }), ''],
    ];
    renderGraph('Criss-cross merge, chained, different order', commitsAndRefs);
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2] = renderData.paths;
    assertPath('First path', path1, 'M1-B-A', { column: 0 });
    assertPath('Second path', path2, 'M2-F', { column: 1 });
    assertEdges(renderData, {
      from: { commitId: 'M1', row: 1, column: 0 },
      to: [
        { commitId: 'B', row: 3, column: 0 },
        { commitId: 'F', row: 2, column: 1, midRow: 1, midColumn: 1 },
      ],
    });
    assertEdges(renderData, {
      from: { commitId: 'M2', row: 0, column: 1 },
      to: [
        { commitId: 'F', row: 2, column: 1 },
        { commitId: 'M1', row: 1, column: 0, midRow: 0, midColumn: 0 },
      ],
    });
  },

  async function testCrissCrossMergeChainedMultiple() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({ id: 'M4', parents: ['M2', 'M3'] }), '(refs/heads/main)'],
      [new Commit({ id: 'M3', parents: ['M1', 'M2'] }), '(refs/heads/develop)'],
      [new Commit({ id: 'M2', parents: ['B', 'M1'] }), ''],
      [new Commit({ id: 'M1', parents: ['A', 'B'] }), ''],
      [new Commit({ id: 'B', parents: ['A'] }), ''],
      [new Commit({ id: 'A' }), ''],
    ];
    renderGraph('Criss-cross merge, multiple chained', commitsAndRefs);
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2] = renderData.paths;
    assertPath('First path', path1, 'M4-M2-B-A', { column: 0 });
    assertPath('Second path', path2, 'M3-M1', { column: 1 });
    assertEdges(renderData, {
      from: { commitId: 'M1', row: 3, column: 1 },
      to: [
        { commitId: 'A', row: 5, column: 0, midRow: 5, midColumn: 1 },
        { commitId: 'B', row: 4, column: 0, midRow: 3, midColumn: 0 },
      ],
    });
    assertEdges(renderData, {
      from: { commitId: 'M2', row: 2, column: 0 },
      to: [
        { commitId: 'B', row: 4, column: 0 },
        { commitId: 'M1', row: 3, column: 1, midRow: 2, midColumn: 1 },
      ],
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
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2] = renderData.paths;
    assertPath('First Path', path1, 'A', {column: 0});
    assertPath('Second Path', path2, 'B', {column: 1});
  },

  async function testSimpleBranchPriorityDifferentOrder() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'C', parents: ['A']}), '(refs/heads/main)'],
      [new Commit({id: 'B', parents: ['A']}), '(refs/heads/develop)'],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Branch priority, different order', commitsAndRefs);
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2] = renderData.paths;
    assertPath('First Path', path1, 'C-A', {column: 0});
    assertPath('Second Path', path2, 'B', {column: 1});
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
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2, path3, path4] = renderData.paths;
    assertPath('First Path', path1, 'A', {column: 0});
    assertPath('Second Path', path2, 'B', {column: 1});
    assertPath('Third Path', path3, 'C', {column: 2});
    assertPath('Fourth Path', path4, 'D', {column: 3});
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
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2, path3, path4] = renderData.paths;
    assertPath('First Path', path1, 'A', {column: 0});
    assertPath('Second Path', path2, 'C', {column: 1});
    assertPath('Third Path', path3, 'B', {column: 2});
    assertPath('Fourth Path', path4, 'D', {column: 3});
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
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2, path3] = renderData.paths;
    assertPath('First Path', path1, 'D-A', {column: 0});
    assertPath('Second Path', path2, 'C', {column: 1});
    assertPath('Third Path', path3, 'B', {column: 2});
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
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2, path3] = renderData.paths;
    assertPath('First Path', path1, 'B-A', {column: 0});
    assertPath('Second Path', path2, 'D', {column: 1});
    assertPath('Third Path', path3, 'C', {column: 2});
  },

  async function testBranchPriorityOpenBranchWithMerge() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['A']}), ''],
      [new Commit({id: 'C', parents: ['A', 'B']}), '(refs/heads/main)'],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Branch priority open branch, with merge', commitsAndRefs);
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2, path3] = renderData.paths;
    assertPath('First Path', path1, 'C-A', {column: 0});
    assertPath('Second Path', path2, 'B', {column: 1});
    assertPath('Third Path', path3, 'D', {column: 2});
  },

  async function testBranchPriorityOpenBranchesLongerPathD() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'E', parents: ['D']}), ''],
      [new Commit({id: 'D', parents: ['A']}), ''],
      [new Commit({id: 'C', parents: ['A']}), ''],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Branch priority open branches, longer path on D', commitsAndRefs);
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2, path3] = renderData.paths;
    assertPath('First Path', path1, 'E-D-A', {column: 0});
    assertPath('Second Path', path2, 'C', {column: 1});
    assertPath('Third Path', path3, 'B', {column: 2});
  },

  async function testBranchPriorityOpenBranchesLongerPathC() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'E', parents: ['C']}), ''],
      [new Commit({id: 'D', parents: ['A']}), ''],
      [new Commit({id: 'C', parents: ['A']}), ''],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Branch priority open branches, longer path on C', commitsAndRefs);
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2, path3] = renderData.paths;
    assertPath('First Path', path1, 'E-C-A', {column: 0});
    assertPath('Second Path', path2, 'D', {column: 1});
    assertPath('Third Path', path3, 'B', {column: 2});
  },

  async function testBranchPriorityOpenBranchesLongerPathB() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'E', parents: ['B']}), ''],
      [new Commit({id: 'D', parents: ['A']}), ''],
      [new Commit({id: 'C', parents: ['A']}), ''],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Branch priority open branches, longer path on B', commitsAndRefs);
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2, path3] = renderData.paths;
    assertPath('First Path', path1, 'E-B-A', {column: 0});
    assertPath('Second Path', path2, 'D', {column: 1});
    assertPath('Third Path', path3, 'C', {column: 2});
  },

  async function testBranchPriorityOpenBranchWithMergeDifferentOrder() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['A', 'B']}), '(refs/heads/main)'],
      [new Commit({id: 'C', parents: ['A']}), ''],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Branch priority open branch, with merge, different order', commitsAndRefs);
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2, path3] = renderData.paths;
    assertPath('First Path', path1, 'D-A', {column: 0});
    assertPath('Second Path', path2, 'B', {column: 1});
    assertPath('Third Path', path3, 'C', {column: 2});
  },

  async function testBranchPriorityOpenBranchWithMergeDifferentOrder2() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({id: 'D', parents: ['A', 'C']}), '(refs/heads/main)'],
      [new Commit({id: 'C', parents: ['A']}), ''],
      [new Commit({id: 'B', parents: ['A']}), ''],
      [new Commit({id: 'A'}), ''],
    ];
    renderGraph('Branch priority open branch, with merge, different order 2', commitsAndRefs);
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2, path3] = renderData.paths;
    assertPath('First Path', path1, 'D-A', {column: 0});
    assertPath('Second Path', path2, 'C', {column: 1});
    assertPath('Third Path', path3, 'B', {column: 2});
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
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2, path3] = renderData.paths;
    assertPath('First Path', path1, 'E-D-A', {column: 0});
    assertPath('Second Path', path2, 'B', {column: 1});
    assertPath('Third Path', path3, 'C', {column: 2});
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
    const renderData = await getRenderData(commitsAndRefs);
    const [path1, path2, path3] = renderData.paths;
    assertPath('First Path', path1, 'E-D-A', {column: 0});
    assertPath('Second Path', path2, 'C', {column: 1});
    assertPath('Third Path', path3, 'B', {column: 2});
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
  },

  async function testTBD() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({ id: 'M2', parents: ['M1', 'F'] }), '(refs/heads/develop)'],
      [new Commit({ id: 'M1', parents: ['B', 'F'] }), '(refs/heads/main)'],
      [new Commit({ id: 'F', parents: ['A'] }), ''],
      [new Commit({ id: 'B', parents: ['A'] }), ''],
      [new Commit({ id: 'A' }), ''],
    ];
    renderGraph('TBD', commitsAndRefs);
  },

  async function testTBD() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({ id: 'M2', parents: ['M1', 'B'] }), '(refs/heads/main)'],
      [new Commit({ id: 'M1', parents: ['B', 'A'] }), '(refs/heads/develop)'],
      [new Commit({ id: 'B', parents: ['A'] }), ''],
      [new Commit({ id: 'A' }), ''],
    ];
    renderGraph('TBD', commitsAndRefs);
  },

  async function testTBD() {
    /** @type {[Commit, string][]} */
    const commitsAndRefs = [
      [new Commit({ id: 'M2', parents: ['M1', 'B'] }), '(refs/heads/develop)'],
      [new Commit({ id: 'M1', parents: ['B', 'A'] }), '(refs/heads/main)'],
      [new Commit({ id: 'B', parents: ['A'] }), ''],
      [new Commit({ id: 'A' }), ''],
    ];
    renderGraph('TBD', commitsAndRefs);
  },
];
