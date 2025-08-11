/// <reference types="@figma/plugin-typings" />

import { agentOrchestrator } from "../plugin/orchestrator/agentOrchestrator";

figma.showUI(__html__, { width: 400, height: 300 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === "run-prompt") {
    const { prompt } = msg;

    // Step 1: Extract selected node details
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify("⚠️ Please select at least one node");
      return;
    }

    const selectionDetails = selection.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      width:
        "absoluteBoundingBox" in node && node["absoluteBoundingBox"]
          ? node["absoluteBoundingBox"].width
          : undefined,
      height:
        "absoluteBoundingBox" in node && node["absoluteBoundingBox"]
          ? node["absoluteBoundingBox"].height
          : undefined,
    }));

    console.log("[Plugin] Selection details:", selectionDetails);

    // Step 2: Build context for LLM
    const combinedPrompt = `
User request: ${prompt}

Figma selection:
${JSON.stringify(selectionDetails, null, 2)}
    `;

    // Step 3: Run orchestrator (this will call agents)
    const results = await agentOrchestrator(combinedPrompt);

    // Step 4: Send results back to UI
    figma.ui.postMessage({
      type: "orchestrator-results",
      results,
    });
  }
};
