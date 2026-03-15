import { GraphData } from "./types/graph";

let currentGraph: GraphData | null = null;

export const setGraph = (graph: GraphData): void => {
  currentGraph = graph;
  console.log(
    `[GraphStore] Graph updated: ${graph.nodes.length} nodes, ${graph.edges.length} edges`,
  );
};

export const getGraph = (): GraphData | null => currentGraph;

export const hasGraph = (): boolean => currentGraph !== null;
