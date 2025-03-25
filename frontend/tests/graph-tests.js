import { GraphElement } from '../js/ui/graph.js';

export default [
  function testGraphElement() {
    new GraphElement();
  },
  function failingTest() {
    foo.bar.baz;
  },
];
