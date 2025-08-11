/// <reference types="@figma/plugin-typings" />

import { callLLM } from "../shared/llmClient";
import { AgentResponse } from "../utils/types";

export async function runLoremIpsumAgent(type: string = "paragraph"): Promise<AgentResponse> {
  const selection = figma.currentPage.selection;
  let filledCount = 0;

  console.log(`Processing ${selection.length} selected items`);

  async function processNode(node: SceneNode) {
    console.log(`Checking node: ${node.type}, name: ${node.name}`);
    
    if (node.type === "TEXT" && !node.locked) {
      const textNode = node as TextNode;
      console.log(`Text content: "${textNode.characters}", length: ${textNode.characters.length}, locked: ${textNode.locked}`);
      
      // More flexible condition: fill if empty, whitespace only, or placeholder text
      const shouldFill = (
        textNode.characters === "" || 
        textNode.characters.trim() === "" ||
        textNode.characters === "Type something" ||
        textNode.characters.startsWith("Lorem ipsum") ||
        textNode.characters.length < 5
      ) && !textNode.locked;
      
      if (shouldFill) {
        try {
          await figma.loadFontAsync(textNode.fontName as FontName);

          const prompt = generatePrompt(type);
          const generatedText = await callLLM(prompt);

          preserveAndSetText(textNode, generatedText);
          filledCount++;
          console.log(`Filled text node: ${textNode.name}`);
        } catch (error) {
          console.error(`Error filling text node: ${error}`);
        }
      } else {
        console.log(`Skipped text node (content: "${textNode.characters}")`);
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

  figma.notify(`✅ Filled ${filledCount} text layer(s).`);

  return {
    success: true,
    message: `Filled ${filledCount} text layer(s).`,
  };
}

// Generate prompt based on data type
function generatePrompt(type: string): string {
  switch (type) {
    case "name":
      return "Give me a realistic human name.";
    case "email":
      return "Generate a dummy but realistic email address.";
    case "address":
      return "Generate a dummy street address.";
    case "product":
      return "Give a short fictional product name.";
    default:
      return "Write a realistic dummy paragraph for a UI mockup.";
  }
}

// Preserves text styles and sets content
function preserveAndSetText(node: TextNode, text: string) {
  const style = {
    fontSize: node.fontSize,
    fontName: node.fontName,
    textAlignHorizontal: node.textAlignHorizontal,
    textAlignVertical: node.textAlignVertical,
  };

  node.characters = text;
  Object.assign(node, style);
}
