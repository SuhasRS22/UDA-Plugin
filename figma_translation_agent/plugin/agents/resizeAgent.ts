/// <reference types="@figma/plugin-typings" />

import { AgentResponse } from "../utils/types";

export async function runResizeAgent(
  width: number,
  height: number
): Promise<AgentResponse> {
  const selection = figma.currentPage.selection;
  let resizedCount = 0;

  console.log(`[ResizeAgent] Processing ${selection.length} selected items`);

  async function processNode(node: SceneNode) {
    console.log(
      `[ResizeAgent] Checking node: ${node.type}, name: ${node.name}`
    );

    if ("resize" in node && !node.locked) {
      try {
        node.resize(width, height);
        resizedCount++;
        console.log(`[ResizeAgent] Resized node: ${node.name}`);
      } catch (error) {
        console.error(`[ResizeAgent] Error resizing ${node.name}:`, error);
      }
    } else if ("children" in node) {
      for (const child of node.children) {
        await processNode(child);
      }
    }
  }

  for (const node of selection) {
    await processNode(node);
  }

  figma.notify(`📏 Resized ${resizedCount} layer(s) to ${width}x${height}.`);

  return {
    success: true,
    message: `Resized ${resizedCount} layer(s) to ${width}x${height}.`,
  };
}
