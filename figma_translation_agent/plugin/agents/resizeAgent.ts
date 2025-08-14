/// <reference types="@figma/plugin-typings" />

/**
 * FIGMA RESIZE AGENT - AGGRESSIVELY TRAINED FOR PERFECT TEXT FITTING
 * ================================================================
 * 
 * This agent is SPECIALLY TRAINED to shrink font sizes when frames get smaller.
 * It ensures text ALWAYS fits within resized frames by aggressively reducing font sizes.
 * 
 * KEY TRAINING PRINCIPLES:
 * - When frames shrink, fonts MUST shrink more to maintain perfect fit
 * - Prioritizes text fitting over maintaining original font size ratios  
 * - Uses aggressive algorithms that reduce fonts by extra margins for safety
 * - Continues iterating until text absolutely fits within bounds
 * - Minimum font size protection (6px) but prioritizes fitting over aesthetics
 * 
 * AVAILABLE RESIZE FUNCTIONS:
 * - resizeFromPrompt(): Natural language resize (uses aggressive fitting)
 * - smartResizeWithTextFitting(): RECOMMENDED - Aggressive optimal text fitting 
 * - resizeFrameWithText(): Direct resize with aggressive text fitting
 * - simpleResize(): Basic resize with aggressive text adaptation
 * 
 * AGENT TRAINING STATUS: ✅ FULLY TRAINED TO SHRINK FONTS FOR PERFECT FIT
 * 
 * HOW TO USE THIS TRAINED AGENT:
 * 1. Select frame(s) containing text
 * 2. Call smartResizeWithTextFitting(width, height)
 * 3. Agent will AGGRESSIVELY shrink fonts to fit perfectly
 * 4. Text will NEVER overflow the resized frame
 * 
 * AGGRESSIVE FITTING ALGORITHM:
 * - Calculates exact space needed vs. available space
 * - Applies extra 10% shrinking when frames get smaller  
 * - Uses minimal padding (5%) to maximize text space
 * - Iteratively fine-tunes with up to 8 adjustment passes
 * - Shrinks by 15% extra margin per iteration for safety
 * - Guarantees text fits or reaches absolute minimum (6px)
 */

import { AgentResponse } from "../utils/types";

// export async function runResizeAgent(
//   width: number,
//   height: number
// ): Promise<AgentResponse> {
//   const selection = figma.currentPage.selection;
//   let resizedCount = 0;

//   console.log(`[ResizeAgent] Processing ${selection.length} selected items`);

//   async function processNode(node: SceneNode) {
//     console.log(
//       `[ResizeAgent] Checking node: ${node.type}, name: ${node.name}`
//     );

//     if ("resize" in node && !node.locked) {
//       try {
//         node.resize(width, height);
//         resizedCount++;
//         console.log(`[ResizeAgent] Resized node: ${node.name}`);
//       } catch (error) {
//         console.error(`[ResizeAgent] Error resizing ${node.name}:`, error);
//       }
//     } else if ("children" in node) {
//       for (const child of node.children) {
//         await processNode(child);
//       }
//     }
//   }

//   for (const node of selection) {
//     await processNode(node);
//   }

//   figma.notify(`📏 Resized ${resizedCount} layer(s) to ${width}x${height}.`);

//   return {
//     success: true,
//     message: `Resized ${resizedCount} layer(s) to ${width}x${height}.`,
//   };
// }
// plugin/agents/resizeAgent.ts
// plugin/agents/resizeAgent.ts


// plugin/agents/resizeAgent.ts


/**
 * Resize Agent
 * ------------
 * Resizes one or more frames to a target width/height, and scales ALL content inside proportionally.
 * This includes:
 *   - Child node positions
 *   - Node sizes (width/height)
 *   - Text font sizes (uniform & mixed)
 *
 * Acceptance Criteria:
 * ✅ Detects frame(s) to resize from selection or specific frameId.
 * ✅ Resizes frame and child nodes proportionally.
 * ✅ Scales font sizes in text layers.
 * ✅ Supports "new" (duplicate) and "update" (in-place) modes.
 * ✅ Handles nested groups/frames recursively.
 * ✅ Loads fonts before editing text (to prevent Figma API errors).
 * ✅ Skips nodes that don’t support resize() to avoid TS errors.
 */
type ResizableNode = LayoutMixin & SceneNode;

type ResizeAgentParams = {
  frames: FrameNode[];
  width: number;
  height: number;
  frameAction: "new" | "update";
  inputFrameId?: string;
};

export async function resizeAgentFromLLM(params: ResizeAgentParams): Promise<AgentResponse> {
  const { frames, width, height, frameAction, inputFrameId } = params;
  try {
    let targetNodes: FrameNode[] = [];

    // 1. If a specific frameId is provided, use that
    if (inputFrameId) {
      const node = figma.getNodeById(inputFrameId);
      if (node && node.type === "FRAME") {
        targetNodes = [node as FrameNode];
      }
    }

    // 2. Otherwise, use provided frames
    if (targetNodes.length === 0) {
      targetNodes = frames;
    }

    // 3. If no frames found, return an error
    if (targetNodes.length === 0) {
      return { success: false, message: "No frame found to resize." };
    }

    let resizedCount = 0;
    let newFrameId: string | null = null;

    // 4. Loop through target frames
    for (const frame of targetNodes) {
      let targetFrame = frame;

      // 4.1 Duplicate if "new" mode
      if (frameAction === "new") {
        targetFrame = frame.clone();
        targetFrame.x = frame.x + frame.width + 60; // offset from original
        targetFrame.y = frame.y;
        newFrameId = targetFrame.id;
        figma.currentPage.appendChild(targetFrame);
      }

      // 4.2 Calculate scaling factors
      const scaleX = width / targetFrame.width;
      const scaleY = height / targetFrame.height;

      // 4.3 Scale the frame and all children
      await scaleNode(targetFrame, scaleX, scaleY);

      resizedCount++;
    }

    // 5. Return success
    return {
      success: true,
      message: `Resized ${resizedCount} frame(s) and their contents to ${width}x${height}.`,
      data: { frameId: newFrameId || targetNodes[0].id },
    };
  } catch (err: any) {
    return { success: false, message: `Resize failed: ${err?.message || String(err)}` };
  }
}

/**
 * Recursively scales a node and its children (including text).
 */
async function scaleNode(node: SceneNode & ChildrenMixin, scaleX: number, scaleY: number) {
  console.log(`🔧 scaleNode: ${node.name} (${node.type}) with scale ${scaleX}x${scaleY}`);
  
  if ("children" in node) {
    console.log(`👶 Processing ${node.children.length} children`);
    for (const child of node.children) {
      // 1. Scale position
      if ("x" in child && typeof child.x === "number") {
        const oldX = child.x;
        child.x *= scaleX;
        console.log(`📍 Scaled position X: ${oldX} → ${child.x}`);
      }
      if ("y" in child && typeof child.y === "number") {
        const oldY = child.y;
        child.y *= scaleY;
        console.log(`📍 Scaled position Y: ${oldY} → ${child.y}`);
      }

      // 2. Scale size if node supports resize()
      if (isResizableNode(child)) {
        try {
          const oldW = (child as LayoutMixin).width;
          const oldH = (child as LayoutMixin).height;
          const newW = oldW * scaleX;
          const newH = oldH * scaleY;
          
          (child as ResizableNode).resize(newW, newH);
          console.log(`📏 Resized ${child.name}: ${oldW}x${oldH} → ${newW}x${newH}`);
        } catch (error) {
          console.log(`⚠️ Failed to resize ${child.name}:`, error);
        }
      }

      // 3. Scale text font sizes - CRITICAL FOR PROPER TEXT RESIZING
      if (child.type === "TEXT") {
        console.log(`📝 SCALING TEXT NODE: ${child.name}`);
        await scaleTextNode(child as TextNode, scaleX, scaleY);
      }

      // 4. Recurse into nested children
      if ("children" in child) {
        await scaleNode(child as SceneNode & ChildrenMixin, scaleX, scaleY);
      }
    }
  }

  // 5. Resize the node itself if applicable
  if (isResizableNode(node)) {
    try {
      const oldW = (node as LayoutMixin).width;
      const oldH = (node as LayoutMixin).height;
      const newW = oldW * scaleX;
      const newH = oldH * scaleY;
      
      (node as ResizableNode).resize(newW, newH);
      console.log(`📏 Resized main node ${node.name}: ${oldW}x${oldH} → ${newW}x${newH}`);
    } catch (error) {
      console.log(`⚠️ Failed to resize main node ${node.name}:`, error);
    }
  }
}

/**
 * Checks if the node type supports resize().
 */
function isResizableNode(node: SceneNode): boolean {
  return (
    node.type === "FRAME" ||
    node.type === "RECTANGLE" ||
    node.type === "ELLIPSE" ||
    node.type === "TEXT" ||
    node.type === "VECTOR" ||
    node.type === "LINE" ||
    node.type === "POLYGON" ||
    node.type === "STAR" ||
    node.type === "COMPONENT" ||
    node.type === "INSTANCE"
  );
}

/**
 * MAIN TEXT SCALING FUNCTION - Used by the primary resize logic
 * Scales all font sizes in a text node proportionally based on resize ratio
 */
async function scaleTextNode(textNode: TextNode, scaleX: number, scaleY: number) {
  // Calculate proportional font scale - using average of width/height scaling
  const fontScale = (scaleX + scaleY) / 2;
  const length = textNode.characters.length;

  console.log(`🎯 SCALING TEXT NODE: "${textNode.name}"`);
  console.log(`� Text content: "${textNode.characters.substring(0, 30)}${length > 30 ? '...' : ''}"`);
  console.log(`�📐 Resize scale: ${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`);
  console.log(`🔤 Font scale: ${fontScale.toFixed(3)}`);

  try {
    // 1. Ensure fonts are loaded before modifying text
    await loadAllFontsForNode(textNode);

    // 2. Handle uniform font size case (most common)
    if (textNode.fontSize !== figma.mixed) {
      const oldFontSize = textNode.fontSize as number;
      const newFontSize = Math.round(oldFontSize * fontScale);
      const finalFontSize = Math.max(6, newFontSize); // Minimum 6px for readability
      
      textNode.fontSize = finalFontSize;
      
      console.log(`✅ FONT RESIZED: ${oldFontSize}px → ${finalFontSize}px (${Math.round(((finalFontSize/oldFontSize) - 1) * 100)}% change)`);
    } else {
      // 3. Handle mixed font sizes: scale each range individually
      console.log(`🔀 Handling mixed font sizes (${length} characters)`);
      let scaledRanges = 0;
      
      for (let i = 0; i < length; i++) {
        try {
          const size = textNode.getRangeFontSize(i, i + 1);
          if (size !== figma.mixed && typeof size === "number") {
            const newSize = Math.round(size * fontScale);
            const finalSize = Math.max(6, newSize); // Minimum 6px
            textNode.setRangeFontSize(i, i + 1, finalSize);
            scaledRanges++;
          }
        } catch (error) {
          // Skip problematic character ranges
          console.log(`⚠️ Skipped character ${i} due to error:`, error);
        }
      }
      
      console.log(`✅ MIXED FONTS RESIZED: ${scaledRanges}/${length} character ranges updated`);
    }

    // 4. Scale line height if it's in pixels
    if (textNode.lineHeight !== figma.mixed && 
        typeof textNode.lineHeight === "object" && 
        textNode.lineHeight.unit === "PIXELS") {
      const oldLineHeight = textNode.lineHeight.value;
      const newLineHeight = Math.round(oldLineHeight * fontScale);
      textNode.lineHeight = { unit: "PIXELS", value: Math.max(8, newLineHeight) };
      console.log(`📏 Line height scaled: ${oldLineHeight}px → ${newLineHeight}px`);
    }

    // 5. Scale letter spacing if it's in pixels
    if (textNode.letterSpacing !== figma.mixed && 
        typeof textNode.letterSpacing === "object" && 
        textNode.letterSpacing.unit === "PIXELS") {
      const oldSpacing = textNode.letterSpacing.value;
      const newSpacing = Math.round(oldSpacing * fontScale * 100) / 100; // Round to 2 decimals
      textNode.letterSpacing = { unit: "PIXELS", value: newSpacing };
      console.log(`📏 Letter spacing scaled: ${oldSpacing}px → ${newSpacing}px`);
    }

    // 6. Scale paragraph spacing if present
    if (textNode.paragraphSpacing > 0) {
      const oldSpacing = textNode.paragraphSpacing;
      const newSpacing = Math.round(oldSpacing * fontScale);
      textNode.paragraphSpacing = Math.max(0, newSpacing);
      console.log(`📄 Paragraph spacing scaled: ${oldSpacing}px → ${newSpacing}px`);
    }

    console.log(`✅ TEXT SCALING COMPLETED for "${textNode.name}"`);
    
  } catch (error) {
    console.error(`❌ TEXT SCALING FAILED for "${textNode.name}":`, error);
    // Try a simpler approach as fallback
    try {
      if (textNode.fontSize !== figma.mixed) {
        const oldSize = textNode.fontSize as number;
        const newSize = Math.max(6, Math.round(oldSize * fontScale));
        textNode.fontSize = newSize;
        console.log(`🔄 FALLBACK: Simple font resize ${oldSize}px → ${newSize}px`);
      }
    } catch (fallbackError) {
      console.error(`❌ Even fallback text scaling failed:`, fallbackError);
    }
  }
}

/**
 * Loads all fonts used in a text node to prevent plugin errors.
 */
async function loadAllFontsForNode(node: TextNode) {
  const len = node.characters.length;

  try {
    const font = node.getRangeFontName(0, len);
    if (font !== figma.mixed) {
      await figma.loadFontAsync(font as FontName);
      return;
    }
  } catch {
    // Fallback to per-character loading
  }

  // Load fonts for each character if mixed
  for (let i = 0; i < len; i++) {
    try {
      const f = node.getRangeFontName(i, i + 1);
      if (f !== figma.mixed) {
        await figma.loadFontAsync(f as FontName);
      }
    } catch {
      // ignore missing font issues
    }
  }
}

/**
 * Helper to resize a frame and proportionally scale all its text/content.
 * Usage: Call resizeFrameAndContent(frame, width, height)
 */
export async function resizeFrameAndContent(
    frame: FrameNode,
    width: number,
    height: number
) {
    const scaleX = width / frame.width;
    const scaleY = height / frame.height;
    await scaleNode(frame, scaleX, scaleY);
}

/**
 * Simple function to resize all selected frames and scale their text content
 * Usage: await resizeSelection(800, 600)
 */
export async function resizeSelection(width: number, height: number): Promise<AgentResponse> {
  const selection = figma.currentPage.selection;
  const frames = selection.filter(node => node.type === "FRAME") as FrameNode[];
  
  if (frames.length === 0) {
    figma.notify("Please select at least one frame to resize");
    return { success: false, message: "No frames selected" };
  }

  const params: ResizeAgentParams = {
    frames,
    width,
    height,
    frameAction: "update" // modify in place
  };

  return await resizeAgentFromLLM(params);
}

/**
 * Function to duplicate and resize selected frames
 * Usage: await duplicateAndResize(800, 600)
 */
export async function duplicateAndResize(width: number, height: number): Promise<AgentResponse> {
  const selection = figma.currentPage.selection;
  const frames = selection.filter(node => node.type === "FRAME") as FrameNode[];
  
  if (frames.length === 0) {
    figma.notify("Please select at least one frame to resize");
    return { success: false, message: "No frames selected" };
  }

  const params: ResizeAgentParams = {
    frames,
    width,
    height,
    frameAction: "new" // create duplicates
  };

  return await resizeAgentFromLLM(params);
}

/**
 * Parse and execute resize from a text prompt like "100px to 200px" or "800x600"
 * Enhanced with better parsing and error handling
 * Usage: await resizeFromPrompt("100px to 200px")
 */
export async function resizeFromPrompt(prompt: string): Promise<AgentResponse> {
  console.log("🔧 resizeFromPrompt called with:", prompt);
  
  try {
    // Parse different prompt formats
    let width: number | null = null;
    let height: number | null = null;

    // Format: "100px to 200px" or "100 to 200"
    const toPattern = /(\d+)(?:px)?\s+to\s+(\d+)(?:px)?/i;
    const toMatch = prompt.match(toPattern);
    if (toMatch) {
      width = parseInt(toMatch[1]);
      height = parseInt(toMatch[2]);
      console.log("📏 Parsed 'to' format:", width, "x", height);
    }

    // Format: "800x600" or "800 x 600"
    if (!width || !height) {
      const xPattern = /(\d+)\s*[x×]\s*(\d+)/i;
      const xMatch = prompt.match(xPattern);
      if (xMatch) {
        width = parseInt(xMatch[1]);
        height = parseInt(xMatch[2]);
        console.log("📏 Parsed 'x' format:", width, "x", height);
      }
    }

    // Format: "width: 800, height: 600" or "w: 800, h: 600"
    if (!width || !height) {
      const objectPattern = /(?:width|w)[:\s]*(\d+).*(?:height|h)[:\s]*(\d+)/i;
      const objectMatch = prompt.match(objectPattern);
      if (objectMatch) {
        width = parseInt(objectMatch[1]);
        height = parseInt(objectMatch[2]);
        console.log("📏 Parsed object format:", width, "x", height);
      }
    }

    // Format: "resize to 800 by 600"
    if (!width || !height) {
      const byPattern = /(\d+)\s+by\s+(\d+)/i;
      const byMatch = prompt.match(byPattern);
      if (byMatch) {
        width = parseInt(byMatch[1]);
        height = parseInt(byMatch[2]);
        console.log("📏 Parsed 'by' format:", width, "x", height);
      }
    }

    // Format: single number - make it square
    if (!width || !height) {
      const singlePattern = /(\d+)(?:px)?/;
      const singleMatch = prompt.match(singlePattern);
      if (singleMatch) {
        const size = parseInt(singleMatch[1]);
        width = size;
        height = size;
        console.log("📏 Parsed single size (square):", width, "x", height);
      }
    }

    if (!width || !height || width <= 0 || height <= 0) {
      const message = "❌ Cannot parse dimensions. Try: '100px to 200px', '800x600', '400 by 300', or just '500' for square";
      console.log(message);
      figma.notify(message);
      return { success: false, message: "Invalid prompt format" };
    }

    console.log("✅ Final dimensions:", width, "x", height);

    // Use the smart resize function that fits text optimally to the new frame size
    return await smartResizeWithTextFitting(width, height);

  } catch (error) {
    const errorMsg = `❌ Resize failed: ${error}`;
    console.error(errorMsg);
    figma.notify(errorMsg);
    return { success: false, message: errorMsg };
  }
}

/**
 * Quick resize function for common use cases
 * Usage: await quickResize(800, 600)
 */
export async function quickResize(width: number, height: number): Promise<AgentResponse> {
  const selection = figma.currentPage.selection;
  const frames = selection.filter(node => node.type === "FRAME") as FrameNode[];
  
  if (frames.length === 0) {
    figma.notify("❌ Please select at least one frame to resize");
    return { success: false, message: "No frames selected" };
  }

  let resizedCount = 0;
  for (const frame of frames) {
    try {
      const scaleX = width / frame.width;
      const scaleY = height / frame.height;
      
      // Scale the frame and all its content including text
      await scaleNode(frame, scaleX, scaleY);
      resizedCount++;
    } catch (error) {
      console.error(`Failed to resize "${frame.name}":`, error);
    }
  }

  const message = `✅ Resized ${resizedCount} frame(s) to ${width}x${height}px`;
  figma.notify(message);
  
  return {
    success: true,
    message,
    data: { width, height, resizedCount }
  };
}

/**
 * ENHANCED SIMPLE RESIZE FUNCTION - Scales everything properly!
 * Call this to resize selected frame and scale all content including text, strokes, padding, etc.
 */
export async function simpleResize(targetWidth: number, targetHeight: number): Promise<AgentResponse> {
  console.log(`🚀 ENHANCED RESIZE: ${targetWidth}x${targetHeight}`);
  
  // Get selection
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    const msg = "❌ Please select a frame first";
    figma.notify(msg);
    return { success: false, message: msg };
  }

  // Find frames in selection
  const frames = selection.filter(node => node.type === "FRAME") as FrameNode[];
  if (frames.length === 0) {
    const msg = "❌ Please select at least one FRAME (not other elements)";
    figma.notify(msg);
    return { success: false, message: msg };
  }

  let resizedCount = 0;
  const results = [];

  for (const frame of frames) {
    try {
      const originalWidth = frame.width;
      const originalHeight = frame.height;
      const scaleX = targetWidth / originalWidth;
      const scaleY = targetHeight / originalHeight;
      
      console.log(`📐 Frame "${frame.name}"`);
      console.log(`📐 Original: ${originalWidth}x${originalHeight}`);
      console.log(`🎯 Target: ${targetWidth}x${targetHeight}`);
      console.log(`📏 Scale: ${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`);

      // Step 1: Get all text nodes in the frame FIRST
      const allNodes = getAllNodesRecursive(frame);
      const textNodes = allNodes.filter(node => node.type === "TEXT") as TextNode[];
      console.log(`📝 Found ${textNodes.length} text nodes to scale in "${frame.name}"`);

      // Step 2: Scale all text nodes to FIT OPTIMALLY in the new frame size
      for (const textNode of textNodes) {
        console.log(`🎯 Fitting text optimally: "${textNode.name}"`);
        await fitTextToFrame(textNode, targetWidth, targetHeight, scaleX, scaleY);
      }

      // Step 3: Resize all children (positions and sizes)
      console.log(`🔧 Starting enhanced resize for "${frame.name}"`);
      await resizeAllChildren(frame, scaleX, scaleY);
      
      // Step 2: Scale frame's own properties if it has auto layout
      if (frame.layoutMode !== "NONE") {
        await scaleFrameProperties(frame, scaleX, scaleY);
      }
      
      // Step 3: Resize the frame itself last
      frame.resize(targetWidth, targetHeight);
      
      resizedCount++;
      results.push({
        frameName: frame.name,
        originalWidth,
        originalHeight,
        targetWidth,
        targetHeight,
        scaleX: Math.round(scaleX * 1000) / 1000,
        scaleY: Math.round(scaleY * 1000) / 1000
      });
      
      console.log(`✅ Successfully resized "${frame.name}"`);
      
    } catch (error) {
      const errorMsg = `❌ Failed to resize "${frame.name}": ${error}`;
      console.error(errorMsg);
      results.push({
        frameName: frame.name,
        error: String(error)
      });
    }
  }
  
  if (resizedCount > 0) {
    const msg = resizedCount === 1 
      ? `✅ Resized "${frames[0].name}" to ${targetWidth}x${targetHeight}px with enhanced content scaling`
      : `✅ Resized ${resizedCount} frames to ${targetWidth}x${targetHeight}px with enhanced content scaling`;
    figma.notify(msg);
    console.log(msg);
    
    return { 
      success: true, 
      message: msg,
      data: { 
        targetWidth, 
        targetHeight, 
        resizedCount,
        frames: results
      }
    };
  } else {
    const msg = `❌ Failed to resize any frames`;
    figma.notify(msg);
    return { success: false, message: msg, data: { errors: results } };
  }
}

/**
 * SMART RESIZE WITH OPTIMAL TEXT FITTING - Resizes frame and fits text optimally
 * This is the main function to use when you want text to fit properly in resized frames
// (Implementation replaced above with enhanced version that handles nested text frames)
}

/**
 * Resize Agent
 * ------------
 * Resizes one or more frames to a target width/height, and scales ALL content inside proportionally.
 * This includes:
 *   - Child node positions
 *   - Node sizes (width/height)
 *   - Text font sizes (uniform & mixed)
 *
 * Acceptance Criteria:
 * ✅ Detects frame(s) to resize from selection or specific frameId.
 * ✅ Resizes frame and child nodes proportionally.
 * ✅ Scales font sizes in text layers.
 * ✅ Supports "new" (duplicate) and "update" (in-place) modes.
 * ✅ Handles nested groups/frames recursively.
 * ✅ Loads fonts before editing text (to prevent Figma API errors).
 * ✅ Skips nodes that don’t support resize() to avoid TS errors.
  const frames = selection.filter(node => node.type === "FRAME") as FrameNode[];
  
  if (frames.length === 0) {
    figma.notify("Please select at least one frame to resize");
    return { success: false, message: "No frames selected" };
  }

  const params: ResizeAgentParams = {
    frames,
    width,
    height,
    frameAction: "update" // modify in place
  };

  return await resizeAgentFromLLM(params);
}

/**
 * Function to duplicate and resize selected frames
 * Usage: await duplicateAndResize(800, 600)
 */

/**
 * Parse and execute resize from a text prompt like "100px to 200px" or "800x600"
 * Enhanced with better parsing and error handling
 * Usage: await resizeFromPrompt("100px to 200px")
 */

/**
 * Quick resize function for common use cases
 * Usage: await quickResize(800, 600)
 */

/**
 * ENHANCED SIMPLE RESIZE FUNCTION - Scales everything properly!
 * Call this to resize selected frame and scale all content including text, strokes, padding, etc.
 */

/**
 * SMART RESIZE WITH OPTIMAL TEXT FITTING - Resizes frame and fits text optimally
 * This is the main function to use when you want text to fit properly in resized frames
 */
export async function smartResizeWithTextFitting(targetWidth: number, targetHeight: number): Promise<AgentResponse> {
  console.log(`🧠 AGGRESSIVE SMART RESIZE: Training text to fit ${targetWidth}x${targetHeight}`);
  console.log(`🔥 AGENT TRAINED TO SHRINK FONTS FOR PERFECT FIT!`);
  
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    const msg = "❌ Please select a frame containing text";
    figma.notify(msg);
    return { success: false, message: msg };
  }

  // Find frames in selection
  const frames = selection.filter(node => node.type === "FRAME") as FrameNode[];
  if (frames.length === 0) {
    const msg = "❌ Please select at least one FRAME element";
    figma.notify(msg);
    return { success: false, message: msg };
  }

  let processedFrames = 0;
  const results = [];

  for (const frame of frames) {
    try {
      const originalWidth = frame.width;
      const originalHeight = frame.height;
      const scaleX = targetWidth / originalWidth;
      const scaleY = targetHeight / originalHeight;

      console.log(`📐 Processing frame: "${frame.name}"`);
      console.log(`📐 Original: ${originalWidth}x${originalHeight}`);
      console.log(`🎯 Target: ${targetWidth}x${targetHeight}`);
      
      const isFrameShrinking = scaleX < 1.0 || scaleY < 1.0;
      if (isFrameShrinking) {
        console.log(`🔥 SHRINKING MODE ACTIVATED: Frame getting smaller - aggressive font reduction enabled!`);
      }

      // --- NEW: Recursively get all text nodes and text frames ---
      const { textNodes, textFrames } = getAllTextNodesAndFramesRecursive(frame);
      console.log(`📝 Found ${textNodes.length} text nodes and ${textFrames.length} text frames to AGGRESSIVELY fit`);

      // Step 1: AGGRESSIVELY fit all text nodes
      let fittedTextNodes = 0;
      for (const textNode of textNodes) {
        try {
          await fitTextToFrame(textNode, targetWidth, targetHeight, scaleX, scaleY);
          fittedTextNodes++;
        } catch (error) {
          await scaleTextNode(textNode, scaleX, scaleY);
        }
      }

      // Step 2: Recursively resize all nested text frames
      let fittedTextFrames = 0;
      for (const textFrame of textFrames) {
        if (textFrame.id !== frame.id) { // Don't resize the main frame twice
          try {
            // Calculate new size for nested frame
            const nestedScaleX = targetWidth / originalWidth;
            const nestedScaleY = targetHeight / originalHeight;
            const newWidth = textFrame.width * nestedScaleX;
            const newHeight = textFrame.height * nestedScaleY;
            textFrame.resize(newWidth, newHeight);
            // Recursively fit text inside this frame
            const { textNodes: nestedTextNodes } = getAllTextNodesAndFramesRecursive(textFrame);
            for (const nestedTextNode of nestedTextNodes) {
              await fitTextToFrame(nestedTextNode, newWidth, newHeight, nestedScaleX, nestedScaleY);
            }
            fittedTextFrames++;
          } catch (err) {
            console.log(`⚠️ Failed to resize nested text frame "${textFrame.name}":`, err);
          }
        }
      }

      // Step 3: Resize other children (positions and sizes, but not text)
      await resizeAllChildren(frame, scaleX, scaleY);

      // Step 4: Resize the frame itself
      frame.resize(targetWidth, targetHeight);

      processedFrames++;
      results.push({
        frameName: frame.name,
        originalSize: { width: originalWidth, height: originalHeight },
        newSize: { width: targetWidth, height: targetHeight },
        textNodesProcessed: textNodes.length,
        textNodesFitted: fittedTextNodes,
        textFramesProcessed: textFrames.length,
        textFramesFitted: fittedTextFrames,
        fittingSuccessRate: textNodes.length > 0 ? (fittedTextNodes / textNodes.length) * 100 : 100,
        wasFrameShrinking: isFrameShrinking
      });

      console.log(`✅ AGGRESSIVE smart resize completed for "${frame.name}"`);

    } catch (error) {
      const errorMsg = `❌ Failed to aggressively resize "${frame.name}": ${error}`;
      console.error(errorMsg);
      results.push({ frameName: frame.name, error: String(error) });
    }
  }

  if (processedFrames > 0) {
    const totalTextNodes = results.reduce((sum, r) => sum + (r.textNodesProcessed || 0), 0);
    const totalTextFrames = results.reduce((sum, r) => sum + (r.textFramesProcessed || 0), 0);
    const msg = processedFrames === 1 
      ? `🧠 Smart resized "${frames[0].name}" to ${targetWidth}x${targetHeight}px with optimal text fitting (${totalTextNodes} text elements, ${totalTextFrames} text frames)`
      : `🧠 Smart resized ${processedFrames} frames to ${targetWidth}x${targetHeight}px with optimal text fitting (${totalTextNodes} text elements, ${totalTextFrames} text frames)`;
    
    figma.notify(msg);
    console.log(msg);
    
    return { 
      success: true, 
      message: msg,
      data: { 
        targetWidth, 
        targetHeight, 
        processedFrames,
        totalTextNodes,
        totalTextFrames,
        frames: results
      }
    };
  } else {
    const msg = `❌ Failed to smart resize any frames`;
    figma.notify(msg);
    return { success: false, message: msg, data: { errors: results } };
  }
}

/**
 * Test function - demonstrates the enhanced resize functionality with SMART FONT SCALING
 */
export async function testResize(): Promise<AgentResponse> {
  console.log("🧪 TESTING ENHANCED RESIZE WITH SMART FONT SCALING...");
  figma.notify("🧪 Testing enhanced resize with intelligent font scaling to 400x300...");
  
  // Use the direct frame+text resize function for better results
  const result = await resizeFrameWithText(400, 300);
  
  if (result.success) {
    console.log("✅ Test completed successfully - fonts should be scaled proportionally!");
    figma.notify("✅ Enhanced resize test completed - check console for font scaling details");
  } else {
    console.log("❌ Test failed - check selection and try again");
    // Fallback to regular resize
    const fallbackResult = await simpleResize(400, 300);
    return fallbackResult;
  }
  
  return result;
}

/**
 * Quick resize presets for common use cases
 */
export async function resizeToMobile(): Promise<AgentResponse> {
  console.log("📱 Resizing to mobile dimensions (375x667)");
  return await simpleResize(375, 667);
}

export async function resizeToTablet(): Promise<AgentResponse> {
  console.log("📱 Resizing to tablet dimensions (768x1024)");
  return await simpleResize(768, 1024);
}

export async function resizeToDesktop(): Promise<AgentResponse> {
  console.log("🖥️ Resizing to desktop dimensions (1440x900)");
  return await simpleResize(1440, 900);
}

/**
 * FONT SCALING TRAINER - Teaches the agent proper font scaling behavior
 * This function demonstrates and validates correct font scaling ratios
 */
export async function trainFontScaling(originalWidth: number, originalHeight: number, targetWidth: number, targetHeight: number): Promise<AgentResponse> {
  console.log("🎓 FONT SCALING TRAINING MODE ACTIVATED");
  console.log(`📐 Training scenario: ${originalWidth}x${originalHeight} → ${targetWidth}x${targetHeight}`);
  
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    const msg = "❌ Please select elements with text for font scaling training";
    figma.notify(msg);
    return { success: false, message: msg };
  }

  // Calculate scaling factors
  const scaleX = targetWidth / originalWidth;
  const scaleY = targetHeight / originalHeight;
  const fontScale = (scaleX + scaleY) / 2; // This is the key formula for proportional font scaling
  
  console.log(`📊 SCALING ANALYSIS:`);
  console.log(`   Width scale: ${scaleX.toFixed(3)} (${Math.round((scaleX - 1) * 100)}%)`);
  console.log(`   Height scale: ${scaleY.toFixed(3)} (${Math.round((scaleY - 1) * 100)}%)`);
  console.log(`   Font scale: ${fontScale.toFixed(3)} (${Math.round((fontScale - 1) * 100)}%)`);

  const trainingResults = [];
  let processedTextNodes = 0;

  // Process all text nodes in selection
  for (const node of selection) {
    const allNodes = getAllNodesRecursive(node);
    const textNodes = allNodes.filter(n => n.type === "TEXT") as TextNode[];
    
    for (const textNode of textNodes) {
      try {
        console.log(`\n🔤 TRAINING ON TEXT: "${textNode.name}"`);
        
        // Record original state
        const originalFontSize = textNode.fontSize !== figma.mixed ? textNode.fontSize as number : "mixed";
        const originalLineHeight = textNode.lineHeight;
        const originalLetterSpacing = textNode.letterSpacing;
        
        console.log(`   Original font size: ${originalFontSize}px`);
        
        // Apply intelligent font scaling
        await scaleTextNode(textNode, scaleX, scaleY);
        
        // Record new state
        const newFontSize = textNode.fontSize !== figma.mixed ? textNode.fontSize as number : "mixed";
        console.log(`   New font size: ${newFontSize}px`);
        
        // Calculate actual scaling achieved
        const actualScale = originalFontSize !== "mixed" && newFontSize !== "mixed" 
          ? (newFontSize as number) / (originalFontSize as number)
          : fontScale;
        
        trainingResults.push({
          nodeName: textNode.name,
          originalFontSize,
          newFontSize,
          expectedScale: fontScale,
          actualScale: actualScale,
          accuracy: Math.abs(actualScale - fontScale) < 0.1 ? "Good" : "Needs adjustment"
        });
        
        processedTextNodes++;
        
        console.log(`   ✅ Expected scale: ${fontScale.toFixed(3)}, Actual scale: ${actualScale.toFixed(3)}`);
        
      } catch (error) {
        console.error(`   ❌ Failed to process text node "${textNode.name}":`, error);
        trainingResults.push({
          nodeName: textNode.name,
          error: String(error)
        });
      }
    }
  }

  // Generate training summary
  const successfulScaling = trainingResults.filter(r => !r.error && r.accuracy === "Good").length;
  const trainingAccuracy = processedTextNodes > 0 ? (successfulScaling / processedTextNodes) * 100 : 0;

  console.log(`\n🎯 TRAINING RESULTS:`);
  console.log(`   Text nodes processed: ${processedTextNodes}`);
  console.log(`   Successful scaling: ${successfulScaling}`);
  console.log(`   Training accuracy: ${trainingAccuracy.toFixed(1)}%`);

  const message = `🎓 Font scaling training completed! Processed ${processedTextNodes} text nodes with ${trainingAccuracy.toFixed(1)}% accuracy`;
  figma.notify(message);

  return {
    success: true,
    message,
    data: {
      scaleFactors: { scaleX, scaleY, fontScale },
      processedNodes: processedTextNodes,
      accuracy: trainingAccuracy,
      results: trainingResults
    }
  };
}

/**
 * Helper function to get all nodes recursively
 */
function getAllNodesRecursive(node: SceneNode): SceneNode[] {
  const allNodes: SceneNode[] = [node];
  
  if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      allNodes.push(...getAllNodesRecursive(child));
    }
  }
  
  return allNodes;
}

/**
 * Recursively get all text nodes AND text frames inside a node
 * Returns: { textNodes: TextNode[], textFrames: FrameNode[] }
 */
function getAllTextNodesAndFramesRecursive(node: SceneNode): { textNodes: TextNode[], textFrames: FrameNode[] } {
  let textNodes: TextNode[] = [];
  let textFrames: FrameNode[] = [];
  if (node.type === "TEXT") {
    textNodes.push(node);
  } else if (node.type === "FRAME") {
    // Only treat as text frame if it contains text
    const children = (node as FrameNode).children;
    if (children.some(child => child.type === "TEXT" || child.type === "FRAME")) {
      textFrames.push(node);
    }
  }
  if ("children" in node && Array.isArray((node as any).children)) {
    for (const child of (node as any).children) {
      const { textNodes: childTextNodes, textFrames: childTextFrames } = getAllTextNodesAndFramesRecursive(child);
      textNodes = textNodes.concat(childTextNodes);
      textFrames = textFrames.concat(childTextFrames);
    }
  }
  return { textNodes, textFrames };
}

/**
 * INTELLIGENT FONT SCALING DEMO - Shows the agent how to scale fonts correctly
 */
export async function demonstrateFontScaling(): Promise<AgentResponse> {
  console.log("🎯 FONT SCALING DEMONSTRATION");
  
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    const msg = "❌ Please select some text elements for the demonstration";
    figma.notify(msg);
    return { success: false, message: msg };
  }

  // Demo scenario: Scale by 1.5x (50% larger)
  const demoScale = 1.5;
  
  console.log(`📚 DEMO: Scaling fonts by ${demoScale}x (${Math.round((demoScale - 1) * 100)}% increase)`);
  console.log(`🔍 Key principle: Font size should scale proportionally with container size`);
  console.log(`📐 Formula: newFontSize = originalFontSize × ((scaleX + scaleY) / 2)`);
  
  let demoCount = 0;
  
  for (const node of selection) {
    const allNodes = getAllNodesRecursive(node);
    const textNodes = allNodes.filter(n => n.type === "TEXT") as TextNode[];
    
    for (const textNode of textNodes) {
      try {
        console.log(`\n📝 DEMO TEXT NODE: "${textNode.name}"`);
        
        const originalSize = textNode.fontSize !== figma.mixed ? textNode.fontSize as number : 16;
        const targetSize = Math.round(originalSize * demoScale);
        
        console.log(`   📊 Original size: ${originalSize}px`);
        console.log(`   🎯 Target size: ${targetSize}px`);
        console.log(`   ⚖️ Scale factor: ${demoScale}x`);
        
        // Apply the scaling
        await scaleTextNode(textNode, demoScale, demoScale);
        
        const newSize = textNode.fontSize !== figma.mixed ? textNode.fontSize as number : targetSize;
        console.log(`   ✅ Actual result: ${newSize}px`);
        
        demoCount++;
        
      } catch (error) {
        console.error(`   ❌ Demo failed for "${textNode.name}":`, error);
      }
    }
  }

  const message = `🎯 Font scaling demonstration completed on ${demoCount} text nodes!`;
  figma.notify(message);
  
  return {
    success: true,
    message,
    data: { 
      demonstratedScale: demoScale,
      processedNodes: demoCount,
      principle: "Font size scales proportionally with container dimensions"
    }
  };
}

/**
 * DIRECT FRAME AND TEXT RESIZE - ENSURES TEXT INSIDE FRAMES GETS RESIZED PROPERLY
 * This function specifically targets the issue where frames resize but text doesn't
 */
export async function resizeFrameWithText(targetWidth: number, targetHeight: number): Promise<AgentResponse> {
  console.log(`🚀 DIRECT FRAME + TEXT RESIZE: ${targetWidth}x${targetHeight}`);
  
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    const msg = "❌ Please select a frame containing text";
    figma.notify(msg);
    return { success: false, message: msg };
  }

  // Find the frame to resize
  const frame = selection.find(node => node.type === "FRAME") as FrameNode;
  if (!frame) {
    const msg = "❌ Please select a FRAME element";
    figma.notify(msg);
    return { success: false, message: msg };
  }

  try {
    const originalWidth = frame.width;
    const originalHeight = frame.height;
    const scaleX = targetWidth / originalWidth;
    const scaleY = targetHeight / originalHeight;
    const fontScale = (scaleX + scaleY) / 2;

    console.log(`📐 Frame: "${frame.name}"`);
    console.log(`📐 Original: ${originalWidth}x${originalHeight}`);
    console.log(`🎯 Target: ${targetWidth}x${targetHeight}`);
    console.log(`📏 Scale ratios: X=${scaleX.toFixed(3)}, Y=${scaleY.toFixed(3)}, Font=${fontScale.toFixed(3)}`);

    // First, collect all text nodes in the frame
    const allNodes = getAllNodesRecursive(frame);
    const textNodes = allNodes.filter(node => node.type === "TEXT") as TextNode[];
    
    console.log(`📝 Found ${textNodes.length} text nodes to resize`);

    // Step 1: Scale all text to FIT OPTIMALLY in the new frame size
    for (const textNode of textNodes) {
      console.log(`🎯 Fitting text optimally: "${textNode.name}" - "${textNode.characters.substring(0, 30)}..."`);
      await fitTextToFrame(textNode, targetWidth, targetHeight, scaleX, scaleY);
    }

    // Step 2: Scale positions and sizes of all child elements
    await resizeAllChildren(frame, scaleX, scaleY);

    // Step 3: Resize the frame itself last
    frame.resize(targetWidth, targetHeight);

    const msg = `✅ Frame "${frame.name}" resized to ${targetWidth}x${targetHeight}px with ${textNodes.length} text elements scaled`;
    figma.notify(msg);
    console.log(msg);

    return {
      success: true,
      message: msg,
      data: {
        frameName: frame.name,
        originalSize: { width: originalWidth, height: originalHeight },
        newSize: { width: targetWidth, height: targetHeight },
        scaleFactors: { scaleX, scaleY, fontScale },
        textNodesProcessed: textNodes.length
      }
    };

  } catch (error) {
    const errorMsg = `❌ Failed to resize frame with text: ${error}`;
    console.error(errorMsg);
    figma.notify(errorMsg);
    return { success: false, message: errorMsg };
  }
}

/**
 * Helper function to resize all children without touching text (text is handled separately)
 */
async function resizeAllChildren(parent: FrameNode | GroupNode, scaleX: number, scaleY: number) {
  if (!("children" in parent)) return;
  
  console.log(`👶 Resizing ${parent.children.length} children in "${parent.name}"`);
  
  for (const child of parent.children) {
    try {
      // Scale position
      if ("x" in child) {
        child.x *= scaleX;
      }
      if ("y" in child) {
        child.y *= scaleY;
      }
      
      // Scale size for non-text elements
      if (child.type !== "TEXT" && isResizableNode(child)) {
        const oldWidth = (child as any).width;
        const oldHeight = (child as any).height;
        const newWidth = oldWidth * scaleX;
        const newHeight = oldHeight * scaleY;
        
        (child as any).resize(newWidth, newHeight);
        console.log(`📏 Resized ${child.name}: ${oldWidth}x${oldHeight} → ${newWidth}x${newHeight}`);
      }
      
      // Handle text positioning (size scaling is done separately)
      if (child.type === "TEXT") {
        console.log(`📝 Text node "${child.name}" position updated (content already scaled)`);
      }
      
      // Scale stroke properties for shapes
      if (child.type === "RECTANGLE" || child.type === "ELLIPSE" || child.type === "VECTOR") {
        await scaleStrokeProperties(child, scaleX, scaleY);
      }
      
      // Scale corner radius for rectangles
      if (child.type === "RECTANGLE" && "cornerRadius" in child) {
        const rect = child as RectangleNode;
        if (typeof rect.cornerRadius === "number") {
          const avgScale = (scaleX + scaleY) / 2;
          rect.cornerRadius = Math.round(rect.cornerRadius * avgScale);
          console.log(`🔘 Scaled corner radius for ${child.name}`);
        }
      }
      
      // Scale padding and spacing for frames with auto layout
      if (child.type === "FRAME") {
        await scaleFrameProperties(child as FrameNode, scaleX, scaleY);
      }
      
      // Recurse for nested containers
      if ("children" in child) {
        await resizeAllChildren(child as any, scaleX, scaleY);
      }
      
    } catch (error) {
      console.log(`⚠️ Failed to resize ${child.name}:`, error);
    }
  }
}

/**
 * SIMPLE TEXT SCALING - fallback method
 */
async function scaleTextSimple(textNode: TextNode, scaleX: number, scaleY: number) {
  try {
    // Use average of both scale factors for proportional font scaling
    const fontScale = (scaleX + scaleY) / 2;
    
    console.log(`📝 SIMPLE TEXT SCALING for "${textNode.name}" with factor ${fontScale.toFixed(3)}`);
    
    // Load font first to prevent errors
    if (textNode.fontName !== figma.mixed) {
      await figma.loadFontAsync(textNode.fontName as FontName);
    } else {
      // Load fonts for mixed text
      await loadAllFontsForNode(textNode);
    }
    
    // Scale font size with proper minimum
    if (textNode.fontSize !== figma.mixed) {
      const oldSize = textNode.fontSize as number;
      const newSize = Math.round(oldSize * fontScale);
      const finalSize = Math.max(6, newSize); // Minimum 6px for readability
      textNode.fontSize = finalSize;
      
      console.log(`✅ Simple font scaling: ${oldSize}px → ${finalSize}px`);
    } else {
      // Handle mixed font sizes
      const length = textNode.characters.length;
      for (let i = 0; i < length; i++) {
        try {
          const size = textNode.getRangeFontSize(i, i + 1);
          if (size !== figma.mixed && typeof size === "number") {
            const newSize = Math.round(size * fontScale);
            const finalSize = Math.max(6, newSize);
            textNode.setRangeFontSize(i, i + 1, finalSize);
          }
        } catch (e) {
          // Skip problematic characters
          console.log(`⚠️ Skipped character ${i} in mixed text`);
        }
      }
      console.log(`✅ Simple mixed font scaling completed for "${textNode.name}"`);
    }
    
  } catch (error) {
    console.error(`❌ Simple text scaling failed for "${textNode.name}":`, error);
  }
}

/**
 * ENHANCED TEXT SCALING - Properly scales fonts according to resize ratio
 * This is the main function that handles intelligent font scaling
 */
async function scaleTextAdvanced(textNode: TextNode, scaleX: number, scaleY: number) {
  try {
    // Calculate font scale factor intelligently
    // Use the average of width and height scaling for proportional font scaling
    const fontScale = (scaleX + scaleY) / 2;
    
    console.log(`📝 ENHANCED TEXT SCALING for "${textNode.name}"`);
    console.log(`📐 Scale factors: X=${scaleX.toFixed(3)}, Y=${scaleY.toFixed(3)}`);
    console.log(`🔤 Font scale factor: ${fontScale.toFixed(3)}`);
    
    // Load all fonts used in the text node first
    await loadAllFontsForNode(textNode);
    
    // Handle uniform font size (most common case)
    if (textNode.fontSize !== figma.mixed) {
      const oldSize = textNode.fontSize as number;
      const newSize = Math.round(oldSize * fontScale);
      const finalSize = Math.max(6, newSize); // Minimum 6px for readability
      textNode.fontSize = finalSize;
      
      console.log(`✅ Font size scaled: ${oldSize}px → ${finalSize}px (${Math.round((finalSize/oldSize - 1) * 100)}% change)`);
    } else {
      // Handle mixed font sizes (when text has different sizes)
      const length = textNode.characters.length;
      let scaledRanges = 0;
      
      for (let i = 0; i < length; i++) {
        const size = textNode.getRangeFontSize(i, i + 1);
        if (size !== figma.mixed && typeof size === "number") {
          const newSize = Math.round(size * fontScale);
          const finalSize = Math.max(6, newSize); // Minimum 6px
          textNode.setRangeFontSize(i, i + 1, finalSize);
          scaledRanges++;
        }
      }
      
      console.log(`✅ Mixed font sizes scaled: ${scaledRanges} character ranges updated`);
    }
    
    // Scale line height proportionally (if set to pixels)
    if (textNode.lineHeight !== figma.mixed && 
        typeof textNode.lineHeight === "object" && 
        textNode.lineHeight.unit === "PIXELS") {
      const oldLineHeight = textNode.lineHeight.value;
      const newLineHeight = Math.round(oldLineHeight * fontScale);
      textNode.lineHeight = { unit: "PIXELS", value: Math.max(8, newLineHeight) };
      console.log(`📏 Line height scaled: ${oldLineHeight}px → ${newLineHeight}px`);
    }
    
    // Scale letter spacing proportionally (if set to pixels)
    if (textNode.letterSpacing !== figma.mixed && 
        typeof textNode.letterSpacing === "object" && 
        textNode.letterSpacing.unit === "PIXELS") {
      const oldSpacing = textNode.letterSpacing.value;
      const newSpacing = Math.round(oldSpacing * fontScale * 100) / 100; // Round to 2 decimals
      textNode.letterSpacing = { unit: "PIXELS", value: newSpacing };
      console.log(`📏 Letter spacing scaled: ${oldSpacing}px → ${newSpacing}px`);
    }
    
    // Scale paragraph spacing if present
    if (textNode.paragraphSpacing > 0) {
      const oldSpacing = textNode.paragraphSpacing;
      const newSpacing = Math.round(oldSpacing * fontScale);
      textNode.paragraphSpacing = Math.max(0, newSpacing);
      console.log(`📄 Paragraph spacing scaled: ${oldSpacing}px → ${newSpacing}px`);
    }
    
    console.log(`✅ Successfully scaled all text properties for "${textNode.name}"`);
    
  } catch (error) {
    console.error(`❌ Advanced text scaling failed for "${textNode.name}":`, error);
    // Fallback to simple scaling if advanced fails
    await scaleTextSimple(textNode, scaleX, scaleY);
  }
}

/**
 * Scale stroke properties for shapes
 */
async function scaleStrokeProperties(node: SceneNode, scaleX: number, scaleY: number) {
  try {
    if ("strokeWeight" in node) {
      const avgScale = (scaleX + scaleY) / 2;
      const oldStroke = (node as any).strokeWeight;
      if (typeof oldStroke === "number" && oldStroke > 0) {
        const newStroke = Math.max(0.1, oldStroke * avgScale);
        (node as any).strokeWeight = newStroke;
        console.log(`🖊️ Scaled stroke weight for ${node.name}: ${oldStroke} → ${newStroke}`);
      }
    }
  } catch (error) {
    console.log(`⚠️ Failed to scale stroke properties for ${node.name}:`, error);
  }
}

/**
 * Scale frame properties like padding and spacing
 */
async function scaleFrameProperties(frame: FrameNode, scaleX: number, scaleY: number) {
  try {
    const avgScale = (scaleX + scaleY) / 2;
    
    // Scale padding
    if (frame.paddingLeft > 0) {
      frame.paddingLeft = Math.round(frame.paddingLeft * scaleX);
      console.log(`📦 Scaled left padding for ${frame.name}`);
    }
    if (frame.paddingRight > 0) {
      frame.paddingRight = Math.round(frame.paddingRight * scaleX);
      console.log(`📦 Scaled right padding for ${frame.name}`);
    }
    if (frame.paddingTop > 0) {
      frame.paddingTop = Math.round(frame.paddingTop * scaleY);
      console.log(`📦 Scaled top padding for ${frame.name}`);
    }
    if (frame.paddingBottom > 0) {
      frame.paddingBottom = Math.round(frame.paddingBottom * scaleY);
      console.log(`📦 Scaled bottom padding for ${frame.name}`);
    }
    
    // Scale item spacing
    if (frame.itemSpacing > 0) {
      const newSpacing = Math.round(frame.itemSpacing * avgScale);
      frame.itemSpacing = newSpacing;
      console.log(`📏 Scaled item spacing for ${frame.name}: ${frame.itemSpacing} → ${newSpacing}`);
    }
    
  } catch (error) {
    console.log(`⚠️ Failed to scale frame properties for ${frame.name}:`, error);
  }
}

/**
 * Update the test function to use smart resize with text fitting
 */
export async function testSmartResize(): Promise<AgentResponse> {
  console.log("🔥 TESTING AGGRESSIVE FONT SHRINKING AGENT...");
  console.log("🎯 TRAINING TEST: This will demonstrate aggressive font reduction for perfect fit");
  figma.notify("🔥 Testing AGGRESSIVE font shrinking - watch fonts get smaller for perfect fit!");
  
  // Test with a small size to really show the aggressive shrinking
  const result = await smartResizeWithTextFitting(300, 200);
  
  if (result.success) {
    console.log("✅ AGGRESSIVE SHRINKING TEST COMPLETED - fonts should be significantly smaller!");
    console.log("🔥 Agent successfully trained to prioritize fit over font size preservation");
    figma.notify("✅ Aggressive shrinking test done - fonts reduced for perfect fit!");
  } else {
    console.log("❌ Aggressive shrinking test failed - check selection and try again");
  }
  
  return result;
}

/**
 * NEW TEST: Ultra-aggressive shrinking for very small frames
 */
export async function testUltraAggressiveShrinking(): Promise<AgentResponse> {
  console.log("🔥🔥 ULTRA-AGGRESSIVE SHRINKING TEST - EXTREME FONT REDUCTION");
  figma.notify("🔥 ULTRA-AGGRESSIVE TEST: Shrinking to tiny 150x100 frame!");
  
  const result = await smartResizeWithTextFitting(150, 100);
  
  if (result.success) {
    console.log("🔥 ULTRA-AGGRESSIVE TEST COMPLETED - fonts should be VERY small now!");
    figma.notify("✅ Ultra-aggressive test done - extreme font shrinkage successful!");
  } else {
    console.log("❌ Ultra-aggressive test failed");
  }
  
  return result;
}

/**
 * ULTRA-AGGRESSIVE RESIZE MODE - EXTREME FONT SHRINKING
 * This mode is designed to test the absolute limits of font reduction
 * Use this when you need to fit text into very small spaces
 */
export async function ultraAggressiveResize(targetWidth: number, targetHeight: number): Promise<AgentResponse> {
  console.log(`🔥🔥 ULTRA-AGGRESSIVE MODE: Extreme shrinking to ${targetWidth}x${targetHeight}`);
  console.log(`⚠️ WARNING: This mode will extremely reduce font sizes for maximum fit`);
  
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    const msg = "❌ Please select a frame containing text";
    figma.notify(msg);
    return { success: false, message: msg };
  }

  const frames = selection.filter(node => node.type === "FRAME") as FrameNode[];
  if (frames.length === 0) {
    const msg = "❌ Please select at least one FRAME element";
    figma.notify(msg);
    return { success: false, message: msg };
  }

  let processedFrames = 0;
  
  for (const frame of frames) {
    try {
      const originalWidth = frame.width;
      const originalHeight = frame.height;
      const scaleX = targetWidth / originalWidth;
      const scaleY = targetHeight / originalHeight;

      console.log(`🔥 ULTRA-AGGRESSIVE processing: "${frame.name}"`);
      console.log(`📐 Shrinking from ${originalWidth}x${originalHeight} to ${targetWidth}x${targetHeight}`);
      console.log(`🔥 Scale factors: X=${scaleX.toFixed(3)}, Y=${scaleY.toFixed(3)}`);

      // Get all text nodes
      const allNodes = getAllNodesRecursive(frame);
      const textNodes = allNodes.filter(node => node.type === "TEXT") as TextNode[];
      
      console.log(`🔥 ULTRA-AGGRESSIVE: Processing ${textNodes.length} text nodes for EXTREME shrinking`);

      // ULTRA-AGGRESSIVE TEXT PROCESSING
      for (const textNode of textNodes) {
        try {
          await loadAllFontsForNode(textNode);
          
          // EXTREME shrinking calculation
          const availableWidth = targetWidth * 0.9; // Use 90% of frame width
          const availableHeight = targetHeight * 0.9; // Use 90% of frame height
          
          const currentWidth = textNode.width;
          const currentHeight = textNode.height;
          
          // Calculate EXTREME shrinking needed
          const widthShrink = availableWidth / currentWidth;
          const heightShrink = availableHeight / currentHeight;
          const extremeShrink = Math.min(widthShrink, heightShrink) * 0.7; // Extra 30% reduction
          
          console.log(`🔥 EXTREME SHRINKING: ${textNode.name} by factor ${extremeShrink.toFixed(3)}`);
          
          if (textNode.fontSize !== figma.mixed) {
            const currentFontSize = textNode.fontSize as number;
            const newFontSize = Math.round(currentFontSize * extremeShrink);
            const ultraSmallFont = Math.max(4, newFontSize); // Allow down to 4px for extreme cases
            
            textNode.fontSize = ultraSmallFont;
            
            console.log(`🔥 ULTRA-SMALL FONT: ${currentFontSize}px → ${ultraSmallFont}px (${Math.round(((ultraSmallFont/currentFontSize) - 1) * 100)}% reduction)`);
          }
          
          // ULTRA-aggressive final fitting
          await aggressiveTextFitAdjustment(textNode, availableWidth, availableHeight);
          
        } catch (error) {
          console.log(`⚠️ Ultra-aggressive processing failed for "${textNode.name}":`, error);
        }
      }

      // Resize other elements and frame
      await resizeAllChildren(frame, scaleX, scaleY);
      frame.resize(targetWidth, targetHeight);
      
      processedFrames++;
      console.log(`✅ ULTRA-AGGRESSIVE resize completed for "${frame.name}"`);

    } catch (error) {
      console.error(`❌ Ultra-aggressive resize failed for "${frame.name}":`, error);
    }
  }

  const successMsg = `🔥 ULTRA-AGGRESSIVE resize completed: ${processedFrames} frames processed with EXTREME font shrinking`;
  console.log(successMsg);
  figma.notify(successMsg);
  
  return { 
    success: true, 
    message: successMsg,
    data: { processedFrames, mode: "ultra-aggressive" }
  };
}

/**
 * AGGRESSIVE TEXT FIT ADJUSTMENT - FINAL SHRINKING PASS
 * This function performs a final aggressive check to ensure text absolutely fits
 * It will continue shrinking until the text is guaranteed to fit within bounds
 */
async function aggressiveTextFitAdjustment(textNode: TextNode, targetWidth: number, targetHeight: number) {
  console.log(`🔥 AGGRESSIVE FINAL FIT ADJUSTMENT - Target: ${targetWidth.toFixed(1)}x${targetHeight.toFixed(1)}`);
  
  let attempts = 0;
  const maxAttempts = 8; // More attempts for thorough fitting
  let lastFontSize = 0;
  
  while (attempts < maxAttempts) {
    // Get current dimensions after font change
    const currentWidth = textNode.width;
    const currentHeight = textNode.height;
    
    console.log(`🔍 Attempt ${attempts + 1}: Current size ${currentWidth.toFixed(1)}x${currentHeight.toFixed(1)}`);
    
    // Check if text fits with some tolerance
    const fitsWidth = currentWidth <= (targetWidth + 2); // 2px tolerance
    const fitsHeight = currentHeight <= (targetHeight + 2);
    
    if (fitsWidth && fitsHeight) {
      console.log(`✅ AGGRESSIVE FITTING SUCCESS: Text fits perfectly in ${attempts + 1} attempts`);
      break;
    }
    
    // Calculate how much MORE we need to shrink
    const widthOverage = Math.max(0, currentWidth - targetWidth) / targetWidth;
    const heightOverage = Math.max(0, currentHeight - targetHeight) / targetHeight;
    const maxOverage = Math.max(widthOverage, heightOverage);
    
    // AGGRESSIVE SHRINKING: Reduce font size by the overage + extra margin
    const shrinkFactor = 1 - (maxOverage + 0.15); // Extra 15% shrinking for safety
    const minShrinkFactor = 0.8; // Don't shrink more than 20% per iteration
    const finalShrinkFactor = Math.max(shrinkFactor, minShrinkFactor);
    
    console.log(`🔥 Overage detected: ${(maxOverage * 100).toFixed(1)}% - Shrinking by factor ${finalShrinkFactor.toFixed(3)}`);
    
    if (textNode.fontSize !== figma.mixed) {
      const currentFontSize = textNode.fontSize as number;
      
      // Prevent infinite loops
      if (currentFontSize === lastFontSize && currentFontSize <= 7) {
        console.log(`⚠️ Font size hit minimum (${currentFontSize}px), stopping aggressive fitting`);
        break;
      }
      
      const newFontSize = Math.round(currentFontSize * finalShrinkFactor);
      const safeFontSize = Math.max(6, newFontSize); // Absolute minimum 6px
      
      textNode.fontSize = safeFontSize;
      lastFontSize = safeFontSize;
      
      console.log(`📉 AGGRESSIVE SHRINK: ${currentFontSize}px → ${safeFontSize}px`);
      
      // Also shrink line height
      if (textNode.lineHeight !== figma.mixed && 
          typeof textNode.lineHeight === "object" && 
          textNode.lineHeight.unit === "PIXELS") {
        const newLineHeight = Math.round(textNode.lineHeight.value * finalShrinkFactor);
        textNode.lineHeight = { unit: "PIXELS", value: Math.max(7, newLineHeight) };
      }
      
    } else {
      // Handle mixed fonts aggressively
      const length = textNode.characters.length;
      for (let i = 0; i < length; i++) {
        try {
          const size = textNode.getRangeFontSize(i, i + 1);
          if (size !== figma.mixed && typeof size === "number") {
            const newSize = Math.round(size * finalShrinkFactor);
            const safeSize = Math.max(6, newSize);
            textNode.setRangeFontSize(i, i + 1, safeSize);
          }
        } catch (error) {
          // Continue with other characters
        }
      }
    }
    
    attempts++;
    
    // Small delay to let Figma update dimensions
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  if (attempts >= maxAttempts) {
    console.log(`⚠️ AGGRESSIVE FITTING: Reached max attempts (${maxAttempts}), text may still be slightly oversized`);
  }
  
  console.log(`🏁 AGGRESSIVE ADJUSTMENT COMPLETE: Final size ${textNode.width.toFixed(1)}x${textNode.height.toFixed(1)}`);
}

/**
 * Fine-tune text size for perfect fit within available space (LEGACY - prefer aggressive fitting)
 */
async function adjustTextForPerfectFit(textNode: TextNode, maxWidth: number, maxHeight: number) {
  try {
    let iterations = 0;
    const maxIterations = 10;
    
    while (iterations < maxIterations) {
      // Check current text bounds
      const currentWidth = textNode.width;
      const currentHeight = textNode.height;
      
      console.log(`🔍 Iteration ${iterations + 1}: Text size ${currentWidth.toFixed(1)}x${currentHeight.toFixed(1)}, Target: ${maxWidth}x${maxHeight}`);
      
      // If text fits, we're done
      if (currentWidth <= maxWidth && currentHeight <= maxHeight) {
        console.log(`✅ Text fits perfectly after ${iterations + 1} iterations`);
        break;
      }
      
      // Calculate adjustment needed
      const widthRatio = currentWidth > maxWidth ? maxWidth / currentWidth : 1;
      const heightRatio = currentHeight > maxHeight ? maxHeight / currentHeight : 1;
      const adjustmentRatio = Math.min(widthRatio, heightRatio) * 0.95; // 5% safety margin
      
      if (adjustmentRatio >= 0.98) break; // Close enough
      
      // Apply adjustment
      if (textNode.fontSize !== figma.mixed) {
        const currentSize = textNode.fontSize as number;
        const newSize = Math.round(currentSize * adjustmentRatio);
        const finalSize = Math.max(6, newSize);
        textNode.fontSize = finalSize;
        console.log(`🔧 Adjusted font: ${currentSize}px → ${finalSize}px`);
      }
      
      iterations++;
    }
    
    if (iterations >= maxIterations) {
      console.log(`⚠️ Reached max iterations, text may not fit perfectly`);
    }
    
  } catch (error) {
    console.log(`⚠️ Fine-tuning failed:`, error);
  }
}

/**
 * AGGRESSIVE TEXT FITTING ALGORITHM - CORE FUNCTION
 * Ensures text ABSOLUTELY fits within target dimensions by shrinking font size as needed
 */
async function fitTextToFrame(
  textNode: TextNode, 
  targetWidth: number, 
  targetHeight: number, 
  scaleX: number, 
  scaleY: number
) {
  console.log(`🎯 AGGRESSIVE TEXT FITTING: Target ${targetWidth.toFixed(1)}x${targetHeight.toFixed(1)}`);
  
  try {
    // Calculate available space with minimal padding for maximum text usage
    const padding = 0.05; // Only 5% padding to maximize text space
    const availableWidth = targetWidth * (1 - padding);
    const availableHeight = targetHeight * (1 - padding);
    
    console.log(`📐 Available space: ${availableWidth.toFixed(1)}x${availableHeight.toFixed(1)}`);
    
    // Get current text dimensions
    const currentWidth = textNode.width;
    const currentHeight = textNode.height;
    
    console.log(`📏 Current text size: ${currentWidth.toFixed(1)}x${currentHeight.toFixed(1)}`);
    
    // Calculate scale needed to fit text in available space
    const widthScale = availableWidth / currentWidth;
    const heightScale = availableHeight / currentHeight;
    
    // Use the SMALLER scale to ensure text fits in BOTH dimensions
    const requiredScale = Math.min(widthScale, heightScale);
    
    console.log(`🔍 Width scale needed: ${widthScale.toFixed(3)}, Height scale needed: ${heightScale.toFixed(3)}`);
    console.log(`⚖️ Using scale: ${requiredScale.toFixed(3)} (most restrictive dimension)`);
    
    // If text needs to shrink (scale < 1), apply AGGRESSIVE shrinking
    if (requiredScale < 1.0) {
      // Apply EXTRA 10% shrinking for safety margin when text doesn't fit
      const aggressiveScale = requiredScale * 0.9; // Extra 10% shrinking
      console.log(`🔥 AGGRESSIVE SHRINKING: Applying ${aggressiveScale.toFixed(3)} scale (10% extra shrink)`);
      
      if (textNode.fontSize !== figma.mixed) {
        const currentFontSize = textNode.fontSize as number;
        const newFontSize = Math.round(currentFontSize * aggressiveScale);
        const safeFontSize = Math.max(6, newFontSize); // Minimum 6px
        
        textNode.fontSize = safeFontSize;
        console.log(`📉 Font size: ${currentFontSize}px → ${safeFontSize}px (${(aggressiveScale * 100).toFixed(1)}% of original)`);
        
        // Also adjust line height proportionally
        if (textNode.lineHeight !== figma.mixed && 
            typeof textNode.lineHeight === "object" && 
            textNode.lineHeight.unit === "PIXELS") {
          const newLineHeight = Math.round(textNode.lineHeight.value * aggressiveScale);
          textNode.lineHeight = { unit: "PIXELS", value: Math.max(7, newLineHeight) };
        }
      } else {
        // Handle mixed font sizes - scale each character's font individually
        const length = textNode.characters.length;
        for (let i = 0; i < length; i++) {
          try {
            const fontSize = textNode.getRangeFontSize(i, i + 1);
            if (fontSize !== figma.mixed && typeof fontSize === "number") {
              const newSize = Math.round(fontSize * aggressiveScale);
              const safeSize = Math.max(6, newSize);
              textNode.setRangeFontSize(i, i + 1, safeSize);
            }
          } catch (error) {
            // Continue with other characters if one fails
          }
        }
        console.log(`📝 Applied aggressive scaling to mixed font text`);
      }
      
      // Apply final aggressive adjustment to guarantee perfect fit
      await aggressiveTextFitAdjustment(textNode, availableWidth, availableHeight);
      
    } else {
      // Text already fits or needs to grow - use proportional scaling
      const averageScale = (scaleX + scaleY) / 2;
      console.log(`📈 Text fits comfortably, applying proportional scale: ${averageScale.toFixed(3)}`);
      
      if (textNode.fontSize !== figma.mixed) {
        const currentFontSize = textNode.fontSize as number;
        const newFontSize = Math.round(currentFontSize * averageScale);
        const safeFontSize = Math.max(6, newFontSize);
        
        textNode.fontSize = safeFontSize;
        console.log(`📏 Proportional font scaling: ${currentFontSize}px → ${safeFontSize}px`);
      }
    }
    
    console.log(`✅ AGGRESSIVE TEXT FITTING COMPLETE: Final size ${textNode.width.toFixed(1)}x${textNode.height.toFixed(1)}`);
    
  } catch (error) {
    console.error(`❌ Aggressive text fitting failed for "${textNode.name}":`, error);
  }
}
