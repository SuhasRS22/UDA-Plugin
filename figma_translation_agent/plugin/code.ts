/// <reference types="@figma/plugin-typings" />

// Show the HTML page in a window
figma.showUI(__html__, { width: 400, height: 600 });

// Handle messages from the UI
figma.ui.onmessage = (msg) => {
  if (msg.type === 'translate-selection') {
    translateSelectedText(msg.targetLanguage);
  } else if (msg.type === 'resize-plugin') {
    figma.ui.resize(msg.width, msg.height);
  } else if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
};

// Function to translate selected text nodes
async function translateSelectedText(targetLanguage: string) {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'error',
      message: 'Please select at least one text element'
    });
    return;
  }

  const textNodes: TextNode[] = [];
  
  // Find all text nodes in selection
  for (const node of selection) {
    if (node.type === 'TEXT') {
      textNodes.push(node);
    } else {
      // Search for text nodes within groups/frames
      findTextNodes(node, textNodes);
    }
  }

  if (textNodes.length === 0) {
    figma.ui.postMessage({
      type: 'error',
      message: 'No text elements found in selection'
    });
    return;
  }

  // Process each text node
  for (const textNode of textNodes) {
    try {
      await figma.loadFontAsync(textNode.fontName as FontName);
      
      const originalText = textNode.characters;
      
      // Send text to backend for translation
      const translatedText = await translateText(originalText, targetLanguage);
      
      if (translatedText) {
        textNode.characters = translatedText;
        
        figma.ui.postMessage({
          type: 'translation-success',
          original: originalText,
          translated: translatedText
        });
      }
    } catch (error) {
      figma.ui.postMessage({
        type: 'error',
        message: `Failed to translate text: ${error}`
      });
    }
  }
}

// Helper function to find text nodes recursively
function findTextNodes(node: SceneNode, textNodes: TextNode[]) {
  if (node.type === 'TEXT') {
    textNodes.push(node);
  } else if ('children' in node) {
    for (const child of node.children) {
      findTextNodes(child, textNodes);
    }
  }
}

// Function to call translation API
async function translateText(text: string, targetLanguage: string): Promise<string | null> {
  try {
    const response = await fetch('http://localhost:8000/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        target_language: targetLanguage
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.translated_text;
  } catch (error) {
    console.error('Translation API error:', error);
    return null;
  }
}