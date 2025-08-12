/// <reference types="@figma/plugin-typings" />

import { agentOrchestrator } from "../plugin/orchestrator/agentOrchestrator";

figma.showUI(__html__, { width: 400, height: 600 });

// Helper function to recursively get all nodes inside a frame
function getAllNodesInFrame(node: SceneNode): SceneNode[] {
  const allNodes: SceneNode[] = [node];

  if ("children" in node && node.children) {
    for (const child of node.children) {
      allNodes.push(...getAllNodesInFrame(child));
    }
  }

  return allNodes;
}

// Helper function to extract detailed node information
function extractNodeDetails(node: SceneNode) {
  const details: any = {
    id: node.id,
    name: node.name,
    type: node.type,
    width:
      "absoluteBoundingBox" in node && node.absoluteBoundingBox
        ? node.absoluteBoundingBox.width
        : undefined,
    height:
      "absoluteBoundingBox" in node && node.absoluteBoundingBox
        ? node.absoluteBoundingBox.height
        : undefined,
  };

  // Add text content if it's a text node
  if (node.type === "TEXT" && "characters" in node) {
    details.text = (node as TextNode).characters;
    details.fontSize = (node as TextNode).fontSize;
    details.fontFamily = (node as TextNode).fontName;
  }

  // Add additional properties for different node types
  if (node.type === "RECTANGLE" || node.type === "ELLIPSE") {
    details.fills = "fills" in node ? node.fills : undefined;
  }

  // Add frame-specific information
  if (node.type === "FRAME") {
    details.childrenCount = "children" in node ? node.children.length : 0;
  }

  return details;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "run-prompt") {
    const { prompt } = msg;

    // Step 1: Extract selected node details
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify("⚠️ Please select at least one node");
      // Send message back to UI to reset button
      figma.ui.postMessage({
        type: "selection-error",
        message: "Please select at least one node",
      });
      return;
    }

    // Step 2: Get all nodes (including children of frames)
    let allSelectedNodes: SceneNode[] = [];

    for (const selectedNode of selection) {
      if (
        selectedNode.type === "FRAME" ||
        selectedNode.type === "GROUP" ||
        selectedNode.type === "COMPONENT"
      ) {
        // If it's a container (frame/group/component), get all children
        const nodesInContainer = getAllNodesInFrame(selectedNode);
        allSelectedNodes.push(...nodesInContainer);

        console.log(
          `[Plugin] Frame "${selectedNode.name}" contains ${nodesInContainer.length} nodes (including itself)`
        );
      } else {
        // If it's a regular node, just add it
        allSelectedNodes.push(selectedNode);
      }
    }

    // Remove duplicates (in case same node is selected multiple times)
    allSelectedNodes = allSelectedNodes.filter(
      (node, index, array) => array.findIndex((n) => n.id === node.id) === index
    );

    console.log(`[Plugin] Total nodes to process: ${allSelectedNodes.length}`);

    // Step 3: Extract detailed information for all nodes
    const selectionDetails = allSelectedNodes.map(extractNodeDetails);

    // Group nodes by type for better context
    const nodesByType = allSelectedNodes.reduce((acc, node) => {
      const type = node.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(node);
      return acc;
    }, {} as Record<string, SceneNode[]>);

    console.log(
      "[Plugin] Nodes by type:",
      Object.keys(nodesByType).map(
        (type) => `${type}: ${nodesByType[type].length}`
      )
    );

    // Step 4: Build context for LLM with better structure
    const contextInfo = {
      userRequest: prompt,
      totalNodes: allSelectedNodes.length,
      nodeTypes: Object.keys(nodesByType).map((type) => ({
        type,
        count: nodesByType[type].length,
      })),
      textNodes:
        nodesByType.TEXT?.map((node) => ({
          id: node.id,
          name: node.name,
          text: (node as TextNode).characters,
        })) || [],
      frames:
        nodesByType.FRAME?.map((node) => ({
          id: node.id,
          name: node.name,
          childrenCount: "children" in node ? node.children.length : 0,
        })) || [],
      selectionDetails: selectionDetails,
    };

    const combinedPrompt = `User request: ${prompt}

Figma context:
- Total nodes selected: ${contextInfo.totalNodes}
- Node types: ${contextInfo.nodeTypes
      .map((nt) => `${nt.type} (${nt.count})`)
      .join(", ")}
- Text nodes found: ${contextInfo.textNodes.length}
- Frames found: ${contextInfo.frames.length}

Selection details:
${JSON.stringify(contextInfo, null, 2)}`;

    console.log("[Plugin] Combined prompt:", combinedPrompt);

    try {
      // Step 5: Run orchestrator (this will call agents)
      figma.notify("🤖 Processing your request...");
      const results = await agentOrchestrator(combinedPrompt);

      // Step 6: Send results back to UI
      figma.ui.postMessage({
        type: "orchestrator-results",
        results,
        nodeContext: contextInfo,
      });

      figma.notify("✅ Request completed!");
    } catch (error) {
      console.error("[Plugin] Error during orchestration:", error);
      figma.notify("❌ Something went wrong. Check console for details.");

      figma.ui.postMessage({
        type: "orchestrator-error",
        error: String(error),
      });
    }
  }
};
