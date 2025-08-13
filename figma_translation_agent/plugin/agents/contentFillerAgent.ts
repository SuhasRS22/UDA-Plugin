/// <reference types="@figma/plugin-typings" />

import { llmClient } from "../shared/llmClient";
import { AgentResponse } from "../utils/types";

// Helper function to detect available font or use fallback
async function getAvailableFont(selection: readonly SceneNode[]): Promise<FontName> {
  // Check if there are existing text nodes with fonts
  let existingFont: FontName | null = null;

  function findTextFont(node: SceneNode): boolean {
    if (node.type === "TEXT") {
      const textNode = node as TextNode;
      if (textNode.fontName && typeof textNode.fontName === 'object') {
        existingFont = textNode.fontName as FontName;
        return true;
      }
    } else if ("children" in node) {
      for (const child of node.children) {
        if (findTextFont(child)) return true;
      }
    }
    return false;
  }

  // Look for existing fonts in selection
  for (const item of selection) {
    if (findTextFont(item)) break;
  }

  // If we found an existing font, try to use it
  if (existingFont) {
    try {
      await figma.loadFontAsync(existingFont);
      return existingFont;
    } catch (error) {
      // Fall through to fallbacks
    }
  }

  // Fallback fonts in order of preference
  const fallbackFonts: FontName[] = [
    { family: "Roboto", style: "Regular" },
    { family: "Inter", style: "Regular" },
    { family: "Arial", style: "Regular" },
    { family: "Helvetica", style: "Regular" }
  ];

  for (const font of fallbackFonts) {
    try {
      await figma.loadFontAsync(font);
      return font;
    } catch (error) {
      // Try next font
    }
  }

  // Ultimate fallback
  const ultimateFont = { family: "Roboto", style: "Regular" };
  await figma.loadFontAsync(ultimateFont);
  return ultimateFont;
}

/**
 * Enhanced Content Filler Agent - Main Entry Point
 * 
 * Supports dual parameter formats:
 * 1. Legacy: runLoremIpsumAgent(type, forceFill, customContent)
 * 2. Orchestrator: runLoremIpsumAgent(params, context)
 * 
 * Orchestrator params object supports:
 * - type: string (content type like "paragraph", "name", "email")
 * - forceFill: boolean (force content replacement)
 * - customContent: string (specific content to use)
 * - frameAction: string ("update", "fill" - implies forceFill)
 * 
 * Context object contains:
 * - figmaContext: rich analysis with nodes, layout, text analysis
 * - frameId: target frame identifier
 */
export async function runLoremIpsumAgent(
  parameters: any,
  contextParams: any, 
  customContent?: string
): Promise<AgentResponse> {
  
  // Handle orchestrator format: runLoremIpsumAgent(params, context)
  let type: string;
  let forceFill: boolean;
  let content: string | undefined;
  let figmaContext: any = null;
  let selection: readonly SceneNode[];
  console.log("[ContentFiller] Orchestrator mode - params:", parameters);
  console.log("[ContentFiller] Context received:", contextParams);

  if (typeof parameters === 'object' && contextParams && typeof contextParams === 'object') {
    // Orchestrator format: (params, context)
    const params = parameters;
    const context = contextParams;
    
    // Extract from params - handle various parameter combinations
    type = params.type || "paragraph";
    forceFill = params.forceFill || false;
    content = params.customContent;
    
    // Handle frameAction parameter for frame-specific operations
    const frameAction = params.frameAction;
    if (frameAction === "update" || frameAction === "fill") {
      forceFill = true; // frameAction "update" implies we should fill/update content
    }
    
    // Extract figmaContext and selection from context
    figmaContext = context.figmaContext;
    if (figmaContext && figmaContext.nodes && figmaContext.nodes.all) {
      selection = figmaContext.nodes.all;
    } else {
      selection = figma.currentPage.selection;
    }
    
    // Use userPrompt from figmaContext if no custom content
    if (!content && figmaContext && figmaContext.userPrompt) {
      content = figmaContext.userPrompt;
    }
    
    console.log("[ContentFiller] Orchestrator mode - params:", params);
    console.log("[ContentFiller] Context received:", {
      hasContext: !!figmaContext,
      nodeCount: figmaContext?.nodes?.all?.length || 0,
      textNodes: figmaContext?.nodes?.text?.length || 0,
      userPrompt: figmaContext?.userPrompt,
      frameAction: frameAction
    });
    
  } else {
    // Legacy format: (type, forceFill, customContent)
    type = typeof parameters === 'string' ? parameters : "paragraph";
    forceFill = typeof contextParams === 'boolean' ? contextParams : false;
    content = customContent;
    selection = figma.currentPage.selection;
    
    console.log("[ContentFiller] Legacy mode - type:", type, "forceFill:", forceFill);
  }

  // Enhanced parameter handling combining both approaches
  if (content && content.trim()) {
    return await handleAdvancedContentGeneration(selection, content, forceFill, figmaContext);
  }

  // Legacy type-based content generation with enhanced intelligence
  return await handleTypedContentGeneration(selection, type, forceFill);
}

/**
 * Advanced content generation combining best approaches from both agents
 */
async function handleAdvancedContentGeneration(
  selection: readonly SceneNode[], 
  userPrompt: string, 
  forceFill: boolean, 
  figmaContext?: any
): Promise<AgentResponse> {
  // Use figmaContext data if available for enhanced analysis
  let frameDetails;
  if (figmaContext && figmaContext.nodes) {
    frameDetails = {
      selectedNodes: figmaContext.nodes.all || selection,
      textNodes: figmaContext.nodes.text || [],
      containers: figmaContext.nodes.frames || [],
      nodeCount: figmaContext.summary?.totalNodes || selection.length,
      hasTextFields: figmaContext.summary?.hasText || false,
      // Additional context from figmaContext
      layoutAnalysis: figmaContext.layoutAnalysis,
      textAnalysis: figmaContext.textAnalysis
    };
    
    console.log("[ContentFiller] Using figmaContext analysis:", {
      totalNodes: frameDetails.nodeCount,
      textNodes: frameDetails.textNodes.length,
      hasLayout: !!frameDetails.layoutAnalysis,
      hasTextAnalysis: !!frameDetails.textAnalysis
    });
  } else {
    frameDetails = analyzeSelection(selection);
  }
  
  // Enhanced logic to detect user intent (from newContentFillerAgent)
  const isReplaceRequest = userPrompt.toLowerCase().includes('replace') ||
      userPrompt.toLowerCase().includes('change') ||
      userPrompt.toLowerCase().includes('update') ||
      forceFill; // forceFill implies replace

  const isAddRequest = userPrompt.toLowerCase().includes('add') ||
      userPrompt.toLowerCase().includes('also') ||
      userPrompt.toLowerCase().includes('more') ||
      userPrompt.toLowerCase().includes('additional') ||
      userPrompt.toLowerCase().includes('new') ||
      // If there's existing content and user says "generate" something different, treat as add
      (frameDetails.textNodes.length > 0 && userPrompt.toLowerCase().includes('generate') && 
       !userPrompt.toLowerCase().includes('replace') && !userPrompt.toLowerCase().includes('update') && !forceFill);

  // Validation
  if (selection.length === 0) {
    return {
      success: false,
      message: "Please select frames or text areas to generate content"
    };
  }

  try {
    // Decide action based on intent and existing content
    if (isReplaceRequest && frameDetails.textNodes.length > 0) {
      return await updateExistingContent(userPrompt, frameDetails.textNodes, figmaContext);
    } else if (frameDetails.textNodes.length > 0 && !isAddRequest && !forceFill) {
      return await updateExistingContent(userPrompt, frameDetails.textNodes, figmaContext);
    } else {
      return await createNewContent(userPrompt, frameDetails, isAddRequest, figmaContext);
    }
  } catch (error) {
    console.error("[MergedContentFiller] Error:", error);
    return {
      success: false,
      message: `Content generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}/**
 * Analyze selection to extract frame details
 */
function analyzeSelection(selection: readonly SceneNode[]) {
  const textNodes: TextNode[] = [];
  const containers: (FrameNode | GroupNode | ComponentNode | InstanceNode)[] = [];

  function collectNodes(node: SceneNode) {
    if (node.type === "TEXT") {
      textNodes.push(node as TextNode);
    } else if (node.type === "FRAME" || node.type === "GROUP" ||
      node.type === "COMPONENT" || node.type === "INSTANCE") {
      containers.push(node as FrameNode | GroupNode | ComponentNode | InstanceNode);
    }

    if ("children" in node) {
      for (const child of node.children) {
        collectNodes(child);
      }
    }
  }

  for (const node of selection) {
    collectNodes(node);
  }

  return {
    selectedNodes: Array.from(selection),
    textNodes,
    containers,
    nodeCount: selection.length,
    hasTextFields: textNodes.length > 0
  };
}

/**
 * Handle typed content generation (legacy approach with enhancements)
 */
async function handleTypedContentGeneration(selection: readonly SceneNode[], type: string, forceFill: boolean): Promise<AgentResponse> {
  let filledCount = 0;

  async function processNode(node: SceneNode) {
    if (node.type === "TEXT" && !node.locked) {
      const textNode = node as TextNode;

      // Enhanced condition: fill if empty, whitespace only, placeholder text, or forceFill
      const shouldFill = forceFill || (
        textNode.characters === "" ||
        textNode.characters.trim() === "" ||
        textNode.characters === "Type something" ||
        textNode.characters.startsWith("Lorem ipsum") ||
        textNode.characters.length < 5
      );

      if (shouldFill) {
        try {
          await figma.loadFontAsync(textNode.fontName as FontName);
          const prompt = generatePrompt(type);
          const generatedText = await llmClient(prompt);

          // Enhanced content processing with validation
          let textContent: string;
          if (Array.isArray(generatedText)) {
            textContent = generatedText[0] ? String(generatedText[0]) : "Professional Sample Content";
          } else {
            textContent = String(generatedText);
          }

          // Content quality validation
          if (textContent.length === 0) {
            textContent = "Quality Content Generated";
          }

          preserveAndSetText(textNode, textContent);
          filledCount++;
        } catch (error) {
          console.error(`[MergedContentFiller] Error filling text node: ${error}`);
        }
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

  figma.notify(`✅ Filled ${filledCount} text fields`, { timeout: 2000 });

  return {
    success: true,
    message: `Filled ${filledCount} text fields with intelligent content.`,
  };
}

// Enhanced prompt generation with advanced intelligence
function generatePrompt(type: string): string {
  switch (type) {
    case "name":
      return "Generate a realistic human name that sounds natural and professional. Examples: Sarah Johnson, Michael Chen, David Wilson. Respond with just the name.";
    case "email":
      return "Generate a realistic professional email address with a believable domain. Examples: sarah.j@company.com, michael@tech.io, david@startup.co. Respond with just the email.";
    case "address":
      return "Generate a realistic street address with proper formatting. Examples: 123 Main Street, New York, NY 10001. Respond with just the address.";
    case "product":
      return "Generate a realistic, modern product name that sounds professional and marketable. Examples: UltraPhone Pro, SecureVault, CloudSync. Respond with just the product name.";
    default:
      return "Generate realistic, professional content appropriate for UI mockups. Make it look natural and believable, not templated. Examples: Project Alpha, Marketing Team, Sales Report.";
  }
}

// Preserves text styles and sets content
function preserveAndSetText(node: TextNode, text: string | any) {
  const style = {
    fontSize: node.fontSize,
    fontName: node.fontName,
    textAlignHorizontal: node.textAlignHorizontal,
    textAlignVertical: node.textAlignVertical,
  };

  // Ensure we always set a string
  node.characters = String(text);
  Object.assign(node, style);
}

/**
 * Update existing text nodes with new content (enhanced with figmaContext)
 */
async function updateExistingContent(userPrompt: string, textNodes: TextNode[], figmaContext?: any): Promise<AgentResponse> {
  // Create form structure for LLM with enhanced context
  const formStructure = textNodes.map((node, index) => ({
    index,
    name: node.name,
    current: node.characters,
    isEmpty: node.characters.trim() === "" || node.characters === "Type something" || node.characters.startsWith("Lorem"),
    fontSize: typeof node.fontSize === 'symbol' ? String(node.fontSize) : node.fontSize,
    fontFamily: typeof node.fontName === 'object' ? (node.fontName as FontName).family : 'Unknown'
  }));

  // Add context information if available
  let contextInfo = "";
  if (figmaContext) {
    if (figmaContext.textAnalysis) {
      contextInfo += `\nText Analysis: ${figmaContext.textAnalysis.totalTextNodes} text nodes, ${figmaContext.textAnalysis.totalCharacters} characters`;
    }
    if (figmaContext.layoutAnalysis) {
      contextInfo += `\nLayout: ${figmaContext.layoutAnalysis.totalFrames} frames`;
    }
  }

  // Generate content using LLM with enhanced context
  const prompt = `Generate content for existing text fields based on user request and context.

USER REQUEST: "${userPrompt}"

EXISTING FIELDS:
${formStructure.map(field =>
    `Field ${field.index}: "${field.name}" (current: "${field.current}", empty: ${field.isEmpty}, font: ${field.fontFamily}, size: ${field.fontSize})`
  ).join('\n')}${contextInfo}

INSTRUCTIONS:
- Consider the context analysis to match existing style and patterns
- Generate content that fits the layout and text analysis
- If they ask for "email" or "emails" ONLY, generate ONLY email addresses
- If they ask for "email" or "emails" ONLY, generate ONLY email addresses like "john.smith@company.com", "sarah.jones@techcorp.com"
- If they ask for "names" ONLY, generate ONLY person names like "John Smith", "Sarah Jones" - NO emails, NO phones
- If they ask for "names and emails" or "emails and names", generate MATCHING pairs where names and emails correspond (John Smith → john.smith@domain.com)
- IMPORTANT: For name+email requests, ensure email matches the name structure
- Make content natural and professional
- Don't use artificial patterns like "AI Generated" or "example.com"
- For emails, use realistic domains like .com, .org, .io, .co

RESPONSE FORMAT:
Return JSON object with field indices as keys:
{"0": "content for field 0", "1": "content for field 1"}

Generate content for all fields that should be updated.`;

  const response = await llmClient(prompt);

  // Parse LLM response - handle array return type
  let contentMap: Record<string, string> = {};
  if (Array.isArray(response) && response.length > 0) {
    // Convert array to indexed object
    contentMap = {};
    response.forEach((item, index) => {
      contentMap[index.toString()] = String(item);
    });
  } else {
    // Fallback to default content
    textNodes.forEach((_, index) => {
      contentMap[index.toString()] = `Generated Content ${index + 1}`;
    });
  }

  // Apply content to text nodes
  let updatedCount = 0;
  const font = await getAvailableFont(textNodes);

  for (const [indexStr, content] of Object.entries(contentMap)) {
    const index = parseInt(indexStr);
    if (index >= 0 && index < textNodes.length) {
      const textNode = textNodes[index];

      try {
        await figma.loadFontAsync(font);
        textNode.fontName = font;
        textNode.characters = String(content);
        updatedCount++;
      } catch (error) {
        console.error(`[MergedContentFiller] Error updating node ${index}:`, error);
      }
    }
  }

  // Select updated nodes and notify
  if (updatedCount > 0) {
    figma.currentPage.selection = textNodes;
    figma.notify(`✅ Updated ${updatedCount} text fields`, { timeout: 2000 });
  }

  return {
    success: updatedCount > 0,
    message: `Updated ${updatedCount} text fields with new content`
  };
}

/**
 * Create new content (enhanced with figmaContext)
 */
async function createNewContent(userPrompt: string, frameDetails: any, isAddRequest: boolean, figmaContext?: any): Promise<AgentResponse> {
  // Enhanced context information from figmaContext
  let contextInfo = "";
  if (figmaContext) {
    if (figmaContext.textAnalysis) {
      contextInfo += `\nText Analysis: ${figmaContext.textAnalysis.totalTextNodes} text nodes, ${figmaContext.textAnalysis.totalCharacters} characters`;
    }
    if (figmaContext.layoutAnalysis) {
      contextInfo += `\nLayout Analysis: ${figmaContext.layoutAnalysis.totalFrames} frames, layout modes: ${figmaContext.layoutAnalysis.layoutModes?.join(', ') || 'unknown'}`;
    }
    if (figmaContext.summary) {
      contextInfo += `\nNode Summary: ${figmaContext.summary.totalNodes} total nodes, types: ${figmaContext.summary.nodeTypes?.join(', ') || 'unknown'}`;
    }
  }

  // Generate content using LLM with enhanced context
  const prompt = `Generate content based on user request with rich context awareness.

USER REQUEST: "${userPrompt}"

CONTEXT:
- Existing text nodes: ${frameDetails.textNodes.length}
- Selected containers: ${frameDetails.containers.length}
- Mode: ${isAddRequest ? 'Add to existing' : 'Create new'}${contextInfo}

INSTRUCTIONS:
- Consider the layout analysis and text context for better content generation
- Generate content that fits the existing design patterns and constraints
- If they ask for "email" or "emails" ONLY, generate ONLY email addresses
- If they ask for "names" ONLY, generate ONLY person names - NO emails, NO phones  
- If they ask for "names and emails", generate MATCHING pairs
- If they ask for "phone numbers", generate phone numbers like "+1-555-0123"
- Make content natural and professional
- Use realistic domains like .com, .org, .io, .co for emails

RESPONSE FORMAT:
Return JSON array of strings:
["item1", "item2", "item3"]

Generate ${userPrompt.toLowerCase().includes('more') ? '6-12' : userPrompt.toLowerCase().includes('many') ? '8-15' : userPrompt.toLowerCase().includes('lots') ? '10-20' : '5-10'} items that match the request exactly.`;

  const response = await llmClient(prompt);

  // Parse LLM response - handle array return type
  let contentItems: string[] = [];
  if (Array.isArray(response)) {
    contentItems = response.map(item => String(item));
  } else {
    contentItems = ["Generated Content 1", "Generated Content 2", "Generated Content 3"];
  }

  if (contentItems.length === 0) {
    throw new Error("No content generated by LLM");
  }

  // Check if we have existing text nodes to work with
  const existingTextNodes = frameDetails.textNodes;

  // Find best container for new nodes
  let container: BaseNode & ChildrenMixin = figma.currentPage;
  let startX = 100;
  let startY = 100;

  // Priority 1: Use explicitly selected frame/container
  if (frameDetails.containers.length > 0) {
    container = frameDetails.containers[0] as BaseNode & ChildrenMixin;
    startX = 20;
    startY = 20;
  }
  // Priority 2: Use parent frame of existing text nodes
  else if (existingTextNodes.length > 0 && isAddRequest) {
    const firstTextNode = existingTextNodes[0];
    let parentFrame = firstTextNode.parent;

    while (parentFrame && parentFrame.type !== "FRAME" && parentFrame.type !== "GROUP") {
      parentFrame = parentFrame.parent;
    }

    if (parentFrame && 'children' in parentFrame) {
      container = parentFrame as BaseNode & ChildrenMixin;
      startX = 20;
      startY = 20;
    }
  }

  // Apply content to existing nodes first
  let processedCount = 0;
  const font = await getAvailableFont(frameDetails.selectedNodes);

  for (let i = 0; i < Math.min(contentItems.length, existingTextNodes.length); i++) {
    const textNode = existingTextNodes[i];
    const content = contentItems[i];

    try {
      await figma.loadFontAsync(font);
      textNode.fontName = font;
      textNode.characters = content;
      processedCount++;
    } catch (error) {
      console.error(`[MergedContentFiller] Error updating existing node:`, error);
    }
  }

  // Create new nodes for remaining content
  const remainingContent = contentItems.slice(existingTextNodes.length);
  let createdCount = 0;

  for (let i = 0; i < remainingContent.length; i++) {
    const content = remainingContent[i];

    try {
      const textNode = figma.createText();
      await figma.loadFontAsync(font);

      textNode.fontName = font;
      textNode.characters = content;
      textNode.fontSize = 16;
      textNode.name = generateSmartNodeName(content, userPrompt, i);

      // Position the node
      textNode.x = startX;
      textNode.y = startY + (i * 35);

      // Add to container
      if (container !== figma.currentPage) {
        container.appendChild(textNode);
      }

      createdCount++;
    } catch (error) {
      console.error(`[MergedContentFiller] Error creating new node:`, error);
    }
  }

  const totalCount = processedCount + createdCount;
  if (totalCount > 0) {
    figma.notify(`✅ Generated ${totalCount} content items`, { timeout: 2000 });
  }

  return {
    success: totalCount > 0,
    message: `Generated ${totalCount} content items (${processedCount} updated, ${createdCount} created)`
  };
}

/**
 * Generate smart node names based on content and request
 */
function generateSmartNodeName(content: string, userPrompt: string, index: number): string {
  const prompt = userPrompt.toLowerCase();

  if (prompt.includes("email")) {
    return `Email ${index + 1}`;
  } else if (prompt.includes("name")) {
    return `Name ${index + 1}`;
  } else if (prompt.includes("phone")) {
    return `Phone ${index + 1}`;
  } else if (prompt.includes("address")) {
    return `Address ${index + 1}`;
  } else {
    return `Content ${index + 1}`;
  }
}


