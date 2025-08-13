/// <reference types="@figma/plugin-typings" />

import { agentOrchestrator } from "../plugin/orchestrator/agentOrchestrator";

figma.showUI(__html__, { width: 400, height: 800 });

// Recursively traverse any node type and collect all descendants
function getAllNodes(node: SceneNode): SceneNode[] {
  const allNodes: SceneNode[] = [node];

  if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      allNodes.push(...getAllNodes(child));
    }
  }

  return allNodes;
}

function extractNodeDetails(node: SceneNode) {
  const details: any = {
    id: node.id,
    name: node.name,
    type: node.type,

    // Position data
    x: node.x,
    y: node.y,

    // Dimensions
    width: Number(
      "absoluteBoundingBox" in node && node.absoluteBoundingBox
        ? node.absoluteBoundingBox.width
        : (node as any).width
    ),
    height: Number(
      "absoluteBoundingBox" in node && node.absoluteBoundingBox
        ? node.absoluteBoundingBox.height
        : (node as any).height
    ),

    // Parent context
    parentId: node.parent?.id || null,
    parentType: node.parent?.type || null,

    // Rotation and visibility
    rotation: "rotation" in node ? (node as any).rotation || 0 : 0,
    visible: node.visible,
    locked: node.locked,
  };

  // Add absolute positioning for reference
  if ("absoluteBoundingBox" in node && node.absoluteBoundingBox) {
    details.absolutePosition = {
      x: node.absoluteBoundingBox.x,
      y: node.absoluteBoundingBox.y,
    };
  }

  // Text-specific properties
  if (node.type === "TEXT" && "characters" in node) {
    details.text = node.characters;
    details.fontSize = Number(node.fontSize) || null;
    details.textLength = node.characters.length;

    // Font information
    if (node.fontName && typeof node.fontName === "object") {
      details.fontFamily =
        (node.fontName as FontName).family || String(node.fontName);
      details.fontStyle = (node.fontName as FontName).style || "Regular";
    }

    // Text formatting
    details.textAlignHorizontal = (node as TextNode).textAlignHorizontal;
    details.textAlignVertical = (node as TextNode).textAlignVertical;
    details.letterSpacing = (node as TextNode).letterSpacing;
    details.lineHeight = (node as TextNode).lineHeight;
  }

  // Frame-specific properties
  if (node.type === "FRAME") {
    const frameNode = node as FrameNode;
    details.layoutMode = frameNode.layoutMode || null;
    details.paddingLeft = frameNode.paddingLeft || 0;
    details.paddingRight = frameNode.paddingRight || 0;
    details.paddingTop = frameNode.paddingTop || 0;
    details.paddingBottom = frameNode.paddingBottom || 0;
    details.itemSpacing = frameNode.itemSpacing || 0;
    details.primaryAxisAlignItems = frameNode.primaryAxisAlignItems || null;
    details.counterAxisAlignItems = frameNode.counterAxisAlignItems || null;
    details.clipsContent = frameNode.clipsContent;
  }

  // Shape properties (Rectangle, Ellipse, etc.)
  if (node.type === "RECTANGLE" || node.type === "ELLIPSE") {
    try {
      details.fills = Array.isArray((node as any).fills)
        ? (node as any).fills.map((f: any) => ({
            type: f.type,
            color: f.color,
            opacity: f.opacity,
          }))
        : [];

      details.strokes = Array.isArray((node as any).strokes)
        ? (node as any).strokes.map((s: any) => ({
            type: s.type,
            color: s.color,
            opacity: s.opacity,
          }))
        : [];

      details.strokeWeight = (node as any).strokeWeight || 0;
      details.cornerRadius = (node as any).cornerRadius || 0;
    } catch {
      details.fills = [];
      details.strokes = [];
    }
  }

  // Container properties (Frame, Instance, Group)
  if (
    node.type === "FRAME" ||
    node.type === "INSTANCE" ||
    node.type === "GROUP"
  ) {
    details.childrenCount = Array.isArray((node as any).children)
      ? node.children.length
      : 0;
  }

  // Instance-specific properties
  if (node.type === "INSTANCE") {
    const instanceNode = node as InstanceNode;
    details.mainComponent = {
      id: instanceNode.mainComponent?.id || null,
      name: instanceNode.mainComponent?.name || null,
    };
  }

  // Constraints for positioning
  if ("constraints" in node) {
    details.constraints = {
      horizontal: (node as any).constraints?.horizontal || "LEFT",
      vertical: (node as any).constraints?.vertical || "TOP",
    };
  }

  return details;
}

// Create structured context for the orchestrator
function createOrchestratorContext(prompt: string, selectionDetails: any[]) {
  // Group nodes by type
  const nodesByType = selectionDetails.reduce((acc, node) => {
    if (!acc[node.type]) acc[node.type] = [];
    acc[node.type].push(node);
    return acc;
  }, {} as Record<string, any[]>);

  // Extract specific node types for easy access
  const textNodes = nodesByType.TEXT || [];
  const frames = nodesByType.FRAME || [];
  const instances = nodesByType.INSTANCE || [];
  const shapes = [
    ...(nodesByType.RECTANGLE || []),
    ...(nodesByType.ELLIPSE || []),
    ...(nodesByType.POLYGON || []),
    ...(nodesByType.VECTOR || []),
  ];

  // Create summary statistics
  const nodeTypesSummary = Object.keys(nodesByType).map((type) => ({
    type,
    count: nodesByType[type].length,
  }));

  // Build context object
  const context = {
    // User request
    userPrompt: prompt,

    // Selection summary
    summary: {
      totalNodes: selectionDetails.length,
      nodeTypes: nodeTypesSummary,
      hasText: textNodes.length > 0,
      hasFrames: frames.length > 0,
      hasInstances: instances.length > 0,
      hasShapes: shapes.length > 0,
    },

    // Detailed breakdown
    nodes: {
      all: selectionDetails,
      byType: nodesByType,
      text: textNodes,
      frames: frames,
      instances: instances,
      shapes: shapes,
    },

    // Text analysis
    textAnalysis: {
      totalTextNodes: textNodes.length,
      totalCharacters: textNodes.reduce(
        (sum, node) => sum + (node.textLength || 0),
        0
      ),
      languages: textNodes.map((node) => node.text).filter(Boolean),
      emptyTextFields: textNodes.filter(
        (node) => !node.text || node.text.trim() === ""
      ).length,
    },

    // Layout analysis
    layoutAnalysis: {
      totalFrames: frames.length,
      layoutModes: [
        ...new Set(frames.map((f) => f.layoutMode).filter(Boolean)),
      ],
      frameHierarchy: frames.map((f) => ({
        id: f.id,
        name: f.name,
        childrenCount: f.childrenCount,
        layoutMode: f.layoutMode,
      })),
    },

    // Figma context (formatted string for LLM)
    figmaContextString: `Figma context:
- Total nodes selected: ${selectionDetails.length}
- Node types: ${nodeTypesSummary
      .map((nt) => `${nt.type} (${nt.count})`)
      .join(", ")}
- Text nodes found: ${textNodes.length}
- Frames found: ${frames.length}
- Instances found: ${instances.length}
- Shapes found: ${shapes.length}`,
  };

  return context;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "run-prompt") {
    const { prompt } = msg;

    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify("⚠️ Please select at least one node");
      return;
    }

    // Collect all nodes from selection (including nested children)
    let allSelectedNodes: SceneNode[] = [];
    for (const selectedNode of selection) {
      allSelectedNodes.push(...getAllNodes(selectedNode));
    }

    // Remove duplicates
    allSelectedNodes = allSelectedNodes.filter(
      (node, index, arr) => arr.findIndex((n) => n.id === node.id) === index
    );

    console.log(`[Plugin] Total nodes to process: ${allSelectedNodes.length}`);

    // Extract detailed node information
    const selectionDetails = allSelectedNodes.map(extractNodeDetails);

    // Create structured context for orchestrator
    const orchestratorContext = createOrchestratorContext(
      prompt,
      selectionDetails
    );

    console.log("[Plugin] Orchestrator context:", orchestratorContext);

    try {
      figma.notify("🤖 Processing your request...");

      // Send structured context to orchestrator
      const results = await agentOrchestrator(orchestratorContext);

      // Send results back to UI
      figma.ui.postMessage({
        type: "orchestrator-results",
        results,
        nodeContext: orchestratorContext.summary,
      });

      figma.notify(" Request completed!");
    } catch (error) {
      console.error("[Plugin] Error during orchestration:", error);
      figma.notify(" Something went wrong. Check console for details.");
      figma.ui.postMessage({
        type: "orchestrator-error",
        error: String(error),
      });
    }
  }
};
