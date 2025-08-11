/// <reference types="@figma/plugin-typings" />

import { runLoremIpsumAgent } from "./agents/contentFillerAgent";

// Plugin Main Code
figma.showUI(__html__, { width: 300, height: 400 });

// Handle messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'fill-content') {
    try {
      const result = await runLoremIpsumAgent(msg.contentType || 'paragraph');
      figma.ui.postMessage({ type: 'content-filled', data: result });
    } catch (error) {
      console.error('Error running content filler:', error);
      figma.ui.postMessage({ 
        type: 'error', 
        message: 'Failed to fill content: ' + (error as Error).message 
      });
    }
  }

  if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};
