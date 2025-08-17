/// <reference types="@figma/plugin-typings" />

import { llmTextClient } from "../shared/llmClient";
import { AgentResponse, NodeSnapshot } from "../utils/types";

function parseJsonFromLLMResponse(response: string): any {
  let jsonText = response.trim();

  if (jsonText.includes("```json")) {
    jsonText = jsonText.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  }
  if (jsonText.includes("```")) {
    jsonText = jsonText.replace(/```\s*/g, "");
  }

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    // Continue to pattern extraction
  }

  const objectMatch = jsonText.match(/\{[\s\S]*?\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch (error) {
      // Continue to array pattern
    }
  }

  const arrayMatch = jsonText.match(/\[[\s\S]*?\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch (error) {
      // Final fallback will throw
    }
  }

  throw new Error("Could not extract valid JSON from LLM response");
}

async function getAvailableFont(
  selection: readonly SceneNode[],
  figmaContext?: any
): Promise<FontName> {
  // Try to get font from figmaContext textNodes (new structure)
  if (figmaContext?.textNodes?.length > 0) {
    for (const textNode of figmaContext.textNodes) {
      if (textNode.type === "TEXT" && typeof textNode.fontName === "object") {
        try {
          await figma.loadFontAsync(textNode.fontName as FontName);
          return textNode.fontName as FontName;
        } catch (error) {
          // Continue to try other fonts from context
        }
      }
    }
  }

  // Legacy support for old context structure
  if (figmaContext?.nodes?.text?.length > 0) {
    for (const textNode of figmaContext.nodes.text) {
      if (typeof textNode.fontName === "object") {
        try {
          await figma.loadFontAsync(textNode.fontName as FontName);
          return textNode.fontName as FontName;
        } catch (error) {
          // Continue to try other fonts from context
        }
      }
    }
  }

  let existingFont: FontName | null = null;

  function findTextFont(node: SceneNode): boolean {
    if (node.type === "TEXT") {
      const textNode = node as TextNode;
      if (textNode.fontName && typeof textNode.fontName === "object") {
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

  for (const item of selection) {
    if (findTextFont(item)) break;
  }

  if (existingFont) {
    try {
      await figma.loadFontAsync(existingFont);
      return existingFont;
    } catch (error) {
      // Fall through to Roboto default
    }
  }

  const defaultFont = { family: "Roboto", style: "Regular" };
  try {
    await figma.loadFontAsync(defaultFont);
    return defaultFont;
  } catch (error) {
    return defaultFont;
  }
}

// Extract updated node details for agent pipeline context
async function extractNodeSnapshot(nodes: TextNode[]): Promise<NodeSnapshot[]> {
  const nodeSnapshots: NodeSnapshot[] = [];

  for (const node of nodes) {
    try {
      const snapshot: NodeSnapshot = {
        id: node.id,
        name: node.name,
        type: node.type,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        characters: node.characters,
        fontSize: typeof node.fontSize === "number" ? node.fontSize : 16,
        fontFamily:
          typeof node.fontName === "object" && node.fontName
            ? node.fontName.family
            : "unknown",
        fontStyle:
          typeof node.fontName === "object" && node.fontName
            ? node.fontName.style
            : "Regular",
        textAlignHorizontal: node.textAlignHorizontal,
        textAlignVertical: node.textAlignVertical,
        parentId: node.parent?.id,
      };
      nodeSnapshots.push(snapshot);
    } catch (error) {
      console.error(
        `[ContentFiller] Error extracting snapshot for node ${node.id}:`,
        error
      );
    }
  }

  return nodeSnapshots;
}

export async function runLoremIpsumAgent(
  parameters: any,
  contextParams: any
): Promise<AgentResponse> {
  let type: string;
  let forceFill: boolean;
  let content: string | undefined;

  let figmaContext = contextParams.figmaContext || null;

  const params = parameters;
  const context = contextParams; // Use full contextParams instead of just figmaContext

  type = params.type || "paragraph";
  forceFill = params.forceFill || false;

  // Enhanced content extraction - check multiple sources
  content =
    params.content ||
    params.customContent ||
    params.prompt ||
    context?.userPrompt ||
    contextParams?.userPrompt;

  console.log("[ContentFiller] Content sources checked:");
  console.log("- params.content:", params.content);
  console.log("- params.customContent:", params.customContent);
  console.log("- params.prompt:", params.prompt);
  console.log("- context.userPrompt:", context?.userPrompt);
  console.log("- contextParams.userPrompt:", contextParams?.userPrompt);
  console.log("- Final content:", content);

  const frameAction = params.frameAction;
  if (frameAction === "update") {
    forceFill = true;
  }

  const selection = figma.currentPage.selection;

  if (content && typeof content === "string" && content.trim()) {
    try {
      return await handleAdvancedContentGeneration(
        selection,
        content,
        forceFill,
        figmaContext
      );
    } catch (error) {
      console.error(
        "[ContentFiller] Critical error during content generation:",
        error
      );
      figma.notify(
        `❌ Content generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { timeout: 4000 }
      );
      return {
        success: false,
        message: `Content generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  return {
    success: false,
    message: `No content prompt provided. Available parameters: ${Object.keys(
      params
    ).join(", ")}. Available context: ${Object.keys(contextParams).join(", ")}`,
    updatedNodes: [],
    createdNodes: [],
    deletedNodeIds: [],
  };
}

async function handleAdvancedContentGeneration(
  selection: readonly SceneNode[],
  userPrompt: string,
  forceFill: boolean,
  figmaContext?: any
): Promise<AgentResponse> {
  let frameDetails;

  // Always prioritize current selection first
  const currentSelection = figma.currentPage.selection;

  if (currentSelection.length > 0) {
    // Use current selection and analyze it directly
    frameDetails = analyzeSelection(currentSelection);
  } else if (figmaContext && figmaContext.textNodes) {
    // Use textNodes from buildFigmaContext if no current selection
    const textNodes = figmaContext.textNodes as TextNode[];

    frameDetails = {
      selectedNodes: textNodes,
      textNodes: textNodes,
      containers: [],
      nodeCount: textNodes.length,
      hasTextFields: textNodes.length > 0,
      layoutAnalysis: figmaContext.layoutAnalysis,
      textAnalysis: figmaContext.textAnalysis,
    };
  } else if (figmaContext && figmaContext.nodes) {
    // Legacy support for old context structure
    const actualTextNodes: TextNode[] = [];
    if (figmaContext.nodes.text && figmaContext.nodes.text.length > 0) {
      for (const textNodeData of figmaContext.nodes.text) {
        try {
          const actualNode = await figma.getNodeByIdAsync(textNodeData.id);
          if (actualNode && actualNode.type === "TEXT") {
            actualTextNodes.push(actualNode);
          }
        } catch (error) {
          // Node not found
        }
      }
    }

    frameDetails = {
      selectedNodes:
        figmaContext.nodes.all && figmaContext.nodes.all.length > 0
          ? figmaContext.nodes.all
          : selection,
      textNodes: actualTextNodes,
      containers: figmaContext.nodes.frames || [],
      nodeCount: figmaContext.summary?.totalNodes || selection.length,
      hasTextFields: figmaContext.summary?.hasText || false,
      layoutAnalysis: figmaContext.layoutAnalysis,
      textAnalysis: figmaContext.textAnalysis,
    };
  } else {
    frameDetails = analyzeSelection(selection);
  }

  const isReplaceRequest =
    userPrompt.toLowerCase().includes("replace") ||
    userPrompt.toLowerCase().includes("change") ||
    userPrompt.toLowerCase().includes("update") ||
    forceFill;

  const isAddRequest =
    userPrompt.toLowerCase().includes("add") ||
    userPrompt.toLowerCase().includes("also") ||
    userPrompt.toLowerCase().includes("more") ||
    userPrompt.toLowerCase().includes("additional") ||
    userPrompt.toLowerCase().includes("new") ||
    (frameDetails.textNodes.length > 0 &&
      userPrompt.toLowerCase().includes("generate") &&
      !userPrompt.toLowerCase().includes("replace") &&
      !userPrompt.toLowerCase().includes("update") &&
      !forceFill);

  if (frameDetails.selectedNodes.length === 0) {
    return {
      success: false,
      message: "No nodes available - please select frames or text areas",
    };
  }

  try {
    if (frameDetails.textNodes.length > 0 && isReplaceRequest) {
      return await performSmartTextReplacement(
        frameDetails.textNodes,
        userPrompt,
        figmaContext
      );
    }

    if (frameDetails.textNodes.length > 0 && !isAddRequest) {
      return await updateExistingContent(
        userPrompt,
        frameDetails.textNodes,
        figmaContext
      );
    } else {
      return await createNewContent(
        userPrompt,
        frameDetails,
        isAddRequest,
        figmaContext
      );
    }
  } catch (error) {
    console.error("[ContentFiller] Error:", error);
    return {
      success: false,
      message: `Content generation failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

async function performSmartTextReplacement(
  textNodes: TextNode[],
  userPrompt: string,
  figmaContext?: any
): Promise<AgentResponse> {
  let replacedCount = 0;
  const font = await getAvailableFont(textNodes, figmaContext);

  for (let i = 0; i < textNodes.length; i++) {
    const textNode = textNodes[i];

    if (!textNode) {
      continue;
    }

    const currentText = textNode.characters || "";

    const prompt = `You are a text replacement assistant. Perform the requested text transformation and return ONLY the new text.

CURRENT TEXT: "${currentText}"
USER REQUEST: "${userPrompt}"

INSTRUCTIONS:
1. If request is "update [word] to [newword]", find that word and replace it with the new word
2. If request is "change [phrase] to [newphrase]", find that phrase and replace it  
3. Preserve the original case style (UPPERCASE stays UPPERCASE, lowercase stays lowercase)
4. Return ONLY the modified text, no explanations, no quotes

EXAMPLES:
Input: "HELLO WORLD" + "update hello to hi" → Output: HI WORLD
Input: "Hello World" + "update hello to hi" → Output: Hi World
Input: "FIRST THING" + "update first to last" → Output: LAST THING
Input: "First Thing" + "update first to last" → Output: Last Thing

Your task: Transform "${currentText}" based on "${userPrompt}"
Return only the new text:`;

    try {
      const newText = await llmTextClient(prompt);

      if (newText && newText !== currentText && newText.length > 0) {
        await figma.loadFontAsync(font);
        textNode.fontName = font;
        textNode.characters = newText;
        replacedCount++;
      }
    } catch (error) {
      console.error(
        `[ContentFiller] Error processing node ${textNode.name}:`,
        error
      );
    }
  }

  if (replacedCount > 0) {
    // Don't change selection - keep the original frame selected so user can continue working with it
    // figma.currentPage.selection = textNodes;
    figma.notify(`✅ Updated ${replacedCount} text fields`, { timeout: 3000 });

    // Extract updated node details for next agent
    const updatedNodeSnapshots = await extractNodeSnapshot(textNodes);

    return {
      success: true,
      message: `Updated ${replacedCount} text fields based on your request`,
      updatedNodes: updatedNodeSnapshots,
    };
  } else {
    return {
      success: false,
      message: `No changes made to text fields`,
    };
  }
}

function analyzeSelection(selection: readonly SceneNode[]) {
  const textNodes: TextNode[] = [];
  const containers: (FrameNode | GroupNode | ComponentNode | InstanceNode)[] =
    [];

  function collectNodes(node: SceneNode) {
    if (node.type === "TEXT") {
      textNodes.push(node as TextNode);
    } else if (
      node.type === "FRAME" ||
      node.type === "GROUP" ||
      node.type === "COMPONENT" ||
      node.type === "INSTANCE"
    ) {
      containers.push(
        node as FrameNode | GroupNode | ComponentNode | InstanceNode
      );
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
    hasTextFields: textNodes.length > 0,
  };
}

function preserveAndSetText(node: TextNode, text: string | any) {
  const style = {
    fontSize: node.fontSize,
    fontName: node.fontName,
    textAlignHorizontal: node.textAlignHorizontal,
    textAlignVertical: node.textAlignVertical,
  };

  node.characters = String(text);
  Object.assign(node, style);
}

// Advanced input field detection based on visual design patterns
function detectInputField(node: TextNode, allTextNodes: TextNode[]): boolean {
  // 1. Check if the node name suggests it's an input
  const nodeName = node.name.toLowerCase();
  const isNamedAsInput =
    nodeName.includes("input") ||
    nodeName.includes("field") ||
    nodeName.includes("textbox") ||
    nodeName.includes("entry") ||
    nodeName.includes("form");

  // 2. Check if the text content is clearly placeholder-like
  const text = node.characters || "";
  const isPlaceholderContent =
    !text ||
    text.trim() === "" ||
    text === "Type something" ||
    text === "Enter text" ||
    text === "Your text here" ||
    text.toLowerCase().includes("placeholder") ||
    text.toLowerCase().includes("enter ") ||
    text.startsWith("Lorem") ||
    text === "..." ||
    text === "---";

  // 3. Check if there's a nearby text node that could be its label
  const hasNearbyLabel = allTextNodes.some((otherNode) => {
    if (otherNode === node) return false;

    // Check if it's positioned near this node (likely a label)
    const isNearby =
      Math.abs(otherNode.y - node.y) < 50 &&
      Math.abs(otherNode.x - node.x) < 200;

    // Check if the other node has label-like text
    const otherText = otherNode.characters || "";
    const isLabelLike =
      otherText.length < 20 &&
      (otherText.toLowerCase().includes("name") ||
        otherText.toLowerCase().includes("email") ||
        otherText.toLowerCase().includes("phone") ||
        otherText.toLowerCase().includes("address") ||
        otherText.endsWith(":") ||
        /^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/.test(otherText)); // Title case pattern

    return isNearby && isLabelLike;
  });

  // 4. Check visual characteristics that suggest input field
  const hasInputVisuals = (() => {
    try {
      // Check if it has a background fill (input fields often have backgrounds)
      const hasFill =
        node.fills && Array.isArray(node.fills) && node.fills.length > 0;

      // Check if it has a stroke (input fields often have borders)
      const hasStroke =
        node.strokes && Array.isArray(node.strokes) && node.strokes.length > 0;

      // Check if it's in a rectangle/frame that might be an input container
      const parentHasInputStyle =
        node.parent &&
        (node.parent.type === "RECTANGLE" || node.parent.type === "FRAME") &&
        node.parent.name.toLowerCase().includes("input");

      return hasFill || hasStroke || parentHasInputStyle;
    } catch (error) {
      return false;
    }
  })();

  // Decision logic: it's an input field if:
  // - It's explicitly named as an input, OR
  // - It has placeholder content AND (has nearby label OR has input visuals)
  const isInput =
    isNamedAsInput ||
    (isPlaceholderContent && (hasNearbyLabel || hasInputVisuals));

  console.log(
    `[InputDetection] "${text}" (${nodeName}) → ${
      isInput ? "INPUT" : "PRESERVE"
    } [named:${isNamedAsInput}, placeholder:${isPlaceholderContent}, label:${hasNearbyLabel}, visual:${hasInputVisuals}]`
  );

  return Boolean(isInput);
}

async function updateExistingContent(
  userPrompt: string,
  textNodes: TextNode[],
  figmaContext?: any
): Promise<AgentResponse> {
  const formStructure = textNodes.map((node, index) => {
    const getFontInfo = (fontName: FontName | symbol) =>
      typeof fontName === "object" ? fontName.family : "mixed";

    const getFontSize = (fontSize: number | symbol) =>
      typeof fontSize === "number" ? fontSize.toString() : "mixed";

    // Check if this is a simple content request (not a form filling request)
    const isSimpleContentRequest =
      userPrompt.toLowerCase().includes("add") ||
      userPrompt.toLowerCase().includes("put") ||
      userPrompt.toLowerCase().includes("insert") ||
      !userPrompt.toLowerCase().includes("fill") ||
      textNodes.length === 1; // Single text node requests are usually simple

    // Use different detection logic based on request type
    const shouldUpdate = isSimpleContentRequest
      ? true // For simple requests, update any text node
      : detectInputField(node, textNodes); // For form filling, use smart detection

    return {
      index,
      name: node.name,
      current: node.characters,
      isEmpty: shouldUpdate,
      fontSize: getFontSize(node.fontSize),
      fontFamily: getFontInfo(node.fontName),
    };
  });

  // Only include fields that should be updated
  const fillableFields = formStructure.filter((field) => field.isEmpty);

  console.log("[ContentFiller] Field analysis:");
  formStructure.forEach((field) => {
    console.log(
      `- Field ${field.index}: "${field.current}" (${field.name}) → ${
        field.isEmpty ? "FILLABLE" : "PRESERVE"
      }`
    );
  });

  if (fillableFields.length === 0) {
    return {
      success: false,
      message:
        "No fillable placeholder fields found. Select fields with placeholder text or empty content.",
      updatedNodes: [],
    };
  }

  let contextInfo = "";
  if (figmaContext) {
    if (figmaContext.textAnalysis) {
      contextInfo += `\nText Analysis: ${figmaContext.textAnalysis.totalTextNodes} text nodes, ${figmaContext.textAnalysis.totalCharacters} characters`;
    }
    if (figmaContext.layoutAnalysis) {
      contextInfo += `\nLayout: ${figmaContext.layoutAnalysis.totalFrames} frames`;
    }
  }

  const prompt = `USER REQUEST: "${userPrompt}"

FILLABLE FIELDS (only placeholder/empty fields):
${fillableFields
  .map(
    (field) =>
      `Field ${field.index}: "${field.name}" (current: "${field.current}")`
  )
  .join("\n")}

CRITICAL: You must respond ONLY with a JSON object. No explanations, no context, no additional text.

Examples of CORRECT responses:
{"0": "John Smith", "1": "Sarah Wilson"}
{"0": "john@email.com", "1": "sarah@company.org"}
{"0": "+1-555-0123", "1": "+1-555-0456"}

Rules:
- Only fill the placeholder/empty fields listed above
- Names request = person names only  
- Email request = email addresses only
- Phone request = phone numbers only
- Response must be valid JSON object with field indices as keys
- NO explanations, NO additional text

JSON object:`;

  const response = await llmTextClient(prompt);

  let contentMap: Record<string, string> = {};

  try {
    const parsedResponse = parseJsonFromLLMResponse(response);

    if (Array.isArray(parsedResponse)) {
      parsedResponse.forEach((item, index) => {
        contentMap[index.toString()] = String(item).trim();
      });
    } else if (typeof parsedResponse === "object" && parsedResponse !== null) {
      Object.keys(parsedResponse).forEach((key) => {
        contentMap[key] = String(parsedResponse[key]).trim();
      });
    }
  } catch (error) {
    const quotedContent = response.match(/"([^"]+)"/g);
    if (quotedContent && quotedContent.length > 0) {
      quotedContent.forEach((match, index) => {
        contentMap[index.toString()] = match.replace(/"/g, "").trim();
      });
    }
  }

  if (Object.keys(contentMap).length === 0) {
    fillableFields.forEach((field) => {
      contentMap[field.index.toString()] = `Generated Content ${
        field.index + 1
      }`;
    });
  }

  let updatedCount = 0;
  const font = await getAvailableFont(textNodes, figmaContext);
  const updatedTextNodes: TextNode[] = [];

  for (const [indexStr, content] of Object.entries(contentMap)) {
    const index = parseInt(indexStr);
    if (index >= 0 && index < textNodes.length) {
      const textNode = textNodes[index];
      const field = formStructure.find((f) => f.index === index);

      // Only update if this field was identified as fillable
      if (field && field.isEmpty) {
        try {
          await figma.loadFontAsync(font);
          textNode.fontName = font;
          textNode.characters = String(content);
          updatedCount++;
          updatedTextNodes.push(textNode);
        } catch (error) {
          console.error(`[ContentFiller] Error updating node ${index}:`, error);
        }
      }
    }
  }

  if (updatedCount > 0) {
    // Don't change selection - keep the original frame selected so user can continue working with it
    // figma.currentPage.selection = textNodes;
    figma.notify(`✅ Updated ${updatedCount} placeholder fields`, {
      timeout: 2000,
    });

    // Extract updated node details for next agent - only include actually updated nodes
    const updatedNodeSnapshots = await extractNodeSnapshot(updatedTextNodes);

    return {
      success: updatedCount > 0,
      message: `Updated ${updatedCount} placeholder fields with new content`,
      updatedNodes: updatedNodeSnapshots,
    };
  }

  return {
    success: updatedCount > 0,
    message: `Updated ${updatedCount} text fields with new content`,
  };
}

async function createNewContent(
  userPrompt: string,
  frameDetails: any,
  isAddRequest: boolean,
  figmaContext?: any
): Promise<AgentResponse> {
  let contextInfo = "";
  if (figmaContext) {
    if (figmaContext.textAnalysis) {
      contextInfo += `\nText Analysis: ${figmaContext.textAnalysis.totalTextNodes} text nodes, ${figmaContext.textAnalysis.totalCharacters} characters`;
    }
    if (figmaContext.layoutAnalysis) {
      contextInfo += `\nLayout Analysis: ${
        figmaContext.layoutAnalysis.totalFrames
      } frames, layout modes: ${
        figmaContext.layoutAnalysis.layoutModes?.join(", ") || "unknown"
      }`;
    }
    if (figmaContext.summary) {
      contextInfo += `\nNode Summary: ${
        figmaContext.summary.totalNodes
      } total nodes, types: ${
        figmaContext.summary.nodeTypes?.join(", ") || "unknown"
      }`;
    }
  }

  const prompt = `USER REQUEST: "${userPrompt}"

CRITICAL: You must respond ONLY with a JSON array. No explanations, no context, no additional text.

MIXED DATA STRATEGY - Create separate nodes for different data types:

Examples for MIXED requests:
Request: "5 names and emails" → ["John Smith", "Sarah Wilson", "Mike Davis", "john.smith@email.com", "sarah.wilson@company.org", "mike.davis@startup.io"]
Request: "names emails phone" → ["John Smith", "Sarah Wilson", "john@email.com", "sarah@company.org", "+1-555-0123", "+1-555-0456"]
Request: "person details" → ["John Smith", "john.smith@email.com", "+1-555-0123", "Software Engineer", "New York, NY"]

SINGLE DATA TYPE examples:
["John Smith", "Sarah Wilson", "Mike Davis"] (names only)
["john@email.com", "sarah@company.org", "mike@startup.io"] (emails only)
["+1-555-0123", "+1-555-0456", "+1-555-0789"] (phones only)

GROUPING STRATEGY:
- Mixed requests = group by type: [all names first, then all emails, then all phones, then all other details]
- "respectively" = alternate in pairs: ["name1", "email1", "name2", "email2"]
- Single type = just that type

Rules:
- Detect mixed requests: "names and emails", "person details", "contact info", "user data"
- Group similar data together for easier node placement
- Generate ${(() => {
    const match = userPrompt.match(/(\d+)/);
    const num = match ? parseInt(match[1]) : null;
    const isRespectively = userPrompt.toLowerCase().includes("respectively");
    const isMixed =
      /names?.*(and|&).*email|email.*(and|&).*name|person.*detail|contact.*info|user.*data|detail.*person/.test(
        userPrompt.toLowerCase()
      );

    if (num && isRespectively) {
      return (num * 2).toString();
    } else if (num && isMixed) {
      return (num * 3).toString();
    } else if (num) {
      return num.toString();
    } else if (isMixed) {
      return "15";
    } else if (userPrompt.toLowerCase().includes("more")) {
      return "8";
    } else if (userPrompt.toLowerCase().includes("many")) {
      return "10";
    } else if (userPrompt.toLowerCase().includes("lots")) {
      return "12";
    } else {
      return "6";
    }
  })()} items total
- Response must be valid JSON array
- NO explanations, NO additional text

JSON array:`;

  let response: string;
  try {
    response = await llmTextClient(prompt);
  } catch (error) {
    const errorMsg = `LLM request failed: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
    console.error("[ContentFiller]", errorMsg, error);
    throw new Error(errorMsg);
  }

  let contentItems: string[] = [];

  try {
    const parsedResponse = parseJsonFromLLMResponse(response);

    if (Array.isArray(parsedResponse)) {
      contentItems = parsedResponse.map((item) => {
        if (typeof item === "string") {
          return item.trim();
        } else {
          return String(item).trim();
        }
      });
    } else {
      contentItems = [String(parsedResponse).trim()];
    }
  } catch (error) {
    const lines = response
      .split("\n")
      .map((line) => line.trim())
      .filter(
        (line) =>
          line && !line.startsWith("Based on") && !line.startsWith("Since")
      )
      .filter((line) => line.length > 2);

    const quotedContent = response.match(/"([^"]+)"/g);
    if (quotedContent && quotedContent.length > 0) {
      contentItems = quotedContent.map((match) =>
        match.replace(/"/g, "").trim()
      );
    } else if (lines.length > 0) {
      contentItems = lines;
    } else {
      contentItems = [
        "Generated Content 1",
        "Generated Content 2",
        "Generated Content 3",
      ];
    }
  }

  if (contentItems.length === 0) {
    contentItems = [
      "Generated Content 1",
      "Generated Content 2",
      "Generated Content 3",
    ];
  }

  if (contentItems.length === 0) {
    throw new Error("No content generated by LLM");
  }

  const existingTextNodes = frameDetails.textNodes;

  let container: BaseNode & ChildrenMixin = figma.currentPage;
  let startX = 100;
  let startY = 100;

  const currentSelection = figma.currentPage.selection;

  for (const node of currentSelection) {
    if (node.type === "FRAME" && "appendChild" in node) {
      container = node as BaseNode & ChildrenMixin;
      startX = 20;
      startY = 20;
      break;
    }
  }

  if (container === figma.currentPage && frameDetails.containers.length > 0) {
    const selectedContainer = frameDetails.containers[0];

    if (
      "appendChild" in selectedContainer &&
      typeof selectedContainer.appendChild === "function"
    ) {
      container = selectedContainer as BaseNode & ChildrenMixin;
      startX = 20;
      startY = 20;
    }
  }

  if (
    container === figma.currentPage &&
    existingTextNodes.length > 0 &&
    isAddRequest
  ) {
    const firstTextNode = existingTextNodes[0];
    let parentFrame = firstTextNode.parent;

    while (
      parentFrame &&
      parentFrame.type !== "FRAME" &&
      parentFrame.type !== "GROUP"
    ) {
      parentFrame = parentFrame.parent;
    }

    if (
      parentFrame &&
      "appendChild" in parentFrame &&
      typeof parentFrame.appendChild === "function"
    ) {
      container = parentFrame as BaseNode & ChildrenMixin;
      startX = 20;
      startY = 20;
    }
  }

  let processedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];
  const createdNodes: TextNode[] = []; // Track newly created nodes
  const font = await getAvailableFont(frameDetails.selectedNodes);

  for (
    let i = 0;
    i < Math.min(contentItems.length, existingTextNodes.length);
    i++
  ) {
    const textNode = existingTextNodes[i];
    const content = contentItems[i];

    try {
      await figma.loadFontAsync(font);
      textNode.fontName = font;
      textNode.characters = content;
      processedCount++;
    } catch (error) {
      const errorMsg = `Failed to update existing node: "${content.substring(
        0,
        20
      )}..."`;
      errors.push(errorMsg);
      errorCount++;
    }
  }

  const remainingContent = contentItems.slice(existingTextNodes.length);
  let createdCount = 0;

  const dataTypes = {
    names: [] as { content: string; index: number }[],
    emails: [] as { content: string; index: number }[],
    phones: [] as { content: string; index: number }[],
    other: [] as { content: string; index: number }[],
  };

  remainingContent.forEach((content, index) => {
    const item = { content, index };

    if (content.includes("@") && content.includes(".")) {
      dataTypes.emails.push(item);
    } else if (content.match(/^\+?[\d\s\-\(\)\.]+$/) && content.length > 7) {
      dataTypes.phones.push(item);
    } else if (
      content.split(" ").length >= 2 &&
      content.split(" ").length <= 4 &&
      content.charAt(0).toUpperCase() === content.charAt(0)
    ) {
      dataTypes.names.push(item);
    } else {
      dataTypes.other.push(item);
    }
  });

  const columnWidth = 200;
  const rowHeight = 35;
  let currentColumn = 0;

  const createNodesForType = async (
    items: typeof dataTypes.names,
    typeName: string,
    column: number
  ) => {
    for (let i = 0; i < items.length; i++) {
      const { content } = items[i];

      try {
        const textNode = figma.createText();
        await figma.loadFontAsync(font);

        textNode.fontName = font;
        textNode.characters = content;
        textNode.fontSize = 16;
        textNode.name = generateSmartNodeName(
          content,
          userPrompt,
          items[i].index
        );

        textNode.x = startX + column * columnWidth;
        textNode.y = startY + i * rowHeight;

        if (container !== figma.currentPage) {
          try {
            container.appendChild(textNode);
          } catch (appendError) {
            const errorMsg = `Failed to append ${typeName} node to container`;
            errors.push(errorMsg);
            errorCount++;
          }
        }

        createdNodes.push(textNode); // Track the created node
        createdCount++;
      } catch (error) {
        const errorMsg = `Failed to create ${typeName} node: "${content.substring(
          0,
          20
        )}..."`;
        errors.push(errorMsg);
        errorCount++;
      }
    }
  };

  if (dataTypes.names.length > 0) {
    await createNodesForType(dataTypes.names, "name", currentColumn++);
  }
  if (dataTypes.emails.length > 0) {
    await createNodesForType(dataTypes.emails, "email", currentColumn++);
  }
  if (dataTypes.phones.length > 0) {
    await createNodesForType(dataTypes.phones, "phone", currentColumn++);
  }
  if (dataTypes.other.length > 0) {
    await createNodesForType(dataTypes.other, "other", currentColumn++);
  }

  const totalCount = processedCount + createdCount;

  if (errorCount === 0 && totalCount > 0) {
    figma.notify(`✅ Generated ${totalCount} content items`, { timeout: 2000 });
  } else if (totalCount > 0 && errorCount > 0) {
    figma.notify(`⚠️ Generated ${totalCount} items, ${errorCount} errors`, {
      timeout: 3000,
    });
  } else if (totalCount === 0 && errorCount > 0) {
    figma.notify(`❌ Failed to generate content`, { timeout: 4000 });
  } else {
    figma.notify(`ℹ️ No content generated`, { timeout: 2000 });
  }

  // Preserve the original frame selection so user can continue working with the frame
  if (container !== figma.currentPage && "id" in container) {
    try {
      figma.currentPage.selection = [container as SceneNode];
      console.log(
        `[ContentFiller] Preserved selection of frame: ${
          container.name || "unnamed"
        }`
      );
    } catch (error) {
      console.warn("[ContentFiller] Could not restore frame selection:", error);
    }
  }

  // Extract updated node details for next agent
  const allProcessedNodes = [...existingTextNodes, ...createdNodes]; // Include both existing and newly created nodes

  // Also include the container frame if it's not the page
  if (container !== figma.currentPage && "id" in container) {
    allProcessedNodes.push(container as BaseNode);
  }

  const updatedNodeSnapshots = await extractNodeSnapshot(allProcessedNodes);

  // Create snapshots for created nodes
  const createdNodeSnapshots = await extractNodeSnapshot(createdNodes);

  const result: AgentResponse = {
    success: totalCount > 0,
    message:
      errorCount > 0
        ? `Generated ${totalCount} content items with ${errorCount} errors: ${errors.join(
            ", "
          )}`
        : `Generated ${totalCount} content items (${processedCount} updated, ${createdCount} created)`,
    updatedNodes: updatedNodeSnapshots,
    createdNodes: createdNodeSnapshots,
  };

  // Only include error field if there are actual errors
  if (errors.length > 0) {
    result.error = errors.join("; ");
  }

  return result;
}

function generateSmartNodeName(
  content: string,
  userPrompt: string,
  index: number
): string {
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
