export interface FigmaContext {
  allNodes: Record<string, BaseNode>; // all tracked nodes from selection or specified IDs
  textNodes: BaseNode[]; // nodes relevant for Translation & ContentFiller
  resizableNodes: BaseNode[]; // nodes relevant for Resize agent
  contrastCheckNodes: BaseNode[]; // nodes relevant for ContrastChecker
}

/**
 * Builds (or rebuilds) the FigmaContext object.
 * Called whenever:
 *   1. At the start (initial extraction from current selection)
 *   2. After an agent updates/creates nodes (so orchestrator always has fresh context)
 *
 * Note: Only works with currently selected nodes and their children, not all page nodes
 */
export function buildFigmaContext(nodeIds?: string[]): FigmaContext {
  let nodes: BaseNode[] = [];

  if (nodeIds && nodeIds.length > 0) {
    // If specific node IDs passed (like after agent response), fetch only those
    const specificNodes = nodeIds
      .map((id) => figma.getNodeById(id))
      .filter((n): n is BaseNode => n !== null);

    nodes = [];
    for (const node of specificNodes) {
      nodes.push(node);
      // Also include children of specified nodes for comprehensive context
      if ("children" in node) {
        const children = node.findAll(() => true);
        nodes.push(...children);
      }
    }
  } else {
    // Only use currently selected nodes, not all nodes on the page
    const selectedNodes = figma.currentPage.selection;
    if (selectedNodes.length > 0) {
      // Get selected nodes and their children recursively
      nodes = [];
      for (const selectedNode of selectedNodes) {
        nodes.push(selectedNode);
        // Also include children of selected nodes for comprehensive context
        if ("children" in selectedNode) {
          const children = selectedNode.findAll(() => true);
          nodes.push(...children);
        }
      }
    } else {
      // If nothing is selected, return empty context
      nodes = [];
    }
  }

  // Build subsets for different agents
  const textNodes = nodes.filter((n) => n.type === "TEXT");
  const resizableNodes = nodes.filter(
    (n) => n.type === "FRAME" || n.type === "RECTANGLE"
  );
  const contrastCheckNodes = nodes.filter(
    (n) => n.type === "TEXT" || n.type === "RECTANGLE" || n.type === "FRAME"
  );

  // Build mapping for quick access
  const allNodes: Record<string, BaseNode> = {};
  nodes.forEach((n) => (allNodes[n.id] = n));

  return {
    allNodes,
    textNodes,
    resizableNodes,
    contrastCheckNodes,
  };
}
