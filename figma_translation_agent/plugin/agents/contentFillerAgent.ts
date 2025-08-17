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
  content = context?.userPrompt || params.customContent;
 
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
    message: "No content prompt provided in figmaContext or parameters",
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
 
  const promptLower = userPrompt.toLowerCase();
  const isReplaceRequest = promptLower.includes("replace") || promptLower.includes("change") || promptLower.includes("update") || forceFill;
  const isAddRequest = promptLower.includes("add") || promptLower.includes("also") || promptLower.includes("more") || promptLower.includes("additional") || promptLower.includes("new") || (frameDetails.textNodes.length > 0 && promptLower.includes("generate") && !promptLower.includes("replace") && !promptLower.includes("update") && !forceFill);

  if (frameDetails.selectedNodes.length === 0) {
    return {
      success: false,
      message: "No nodes available - please select frames or text areas",
    };
  }

  try {
    // If the frame is empty (no text nodes), always add new nodes
    if (frameDetails.textNodes.length === 0) {
      return await createNewContent(
        userPrompt,
        frameDetails,
        true,
        figmaContext
      );
    }


    // If prompt is add/also/more/new, add new nodes ONLY (do not update existing)
    if (isAddRequest) {
      // Remove all text nodes from frameDetails so only creation happens
      const frameDetailsForAdd = { ...frameDetails, textNodes: [] };
      return await createNewContent(
        userPrompt,
        frameDetailsForAdd,
        true,
        figmaContext
      );
    }

    // If prompt is update/replace/change, update existing nodes
    if (isReplaceRequest) {
      return await performSmartTextReplacement(
        frameDetails.textNodes,
        userPrompt,
        figmaContext
      );
    }

    // Default: update existing nodes
    return await updateExistingContent(
      userPrompt,
      frameDetails.textNodes,
      figmaContext
    );
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
 
    return {
      index,
      name: node.name,
      current: node.characters,
      isEmpty:
        !node.characters ||
        node.characters.trim() === "" ||
        node.characters === "Type something" ||
        node.characters.startsWith("Lorem"),
      fontSize: getFontSize(node.fontSize),
      fontFamily: getFontInfo(node.fontName),
    };
  });
 
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
 
EXISTING FIELDS:
${formStructure
  .map(
    (field) =>
      `Field ${field.index}: "${field.name}" (current: "${field.current}", empty: ${field.isEmpty})`
  )
  .join("\n")}
 
CRITICAL: You must respond ONLY with a JSON object. No explanations, no context, no additional text.
 
Examples of CORRECT responses:
{"0": "John Smith", "1": "Sarah Wilson"}
{"0": "john@email.com", "1": "sarah@company.org"}
{"0": "+1-555-0123", "1": "+1-555-0456"}
 
Rules:
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
    textNodes.forEach((_, index) => {
      contentMap[index.toString()] = `Generated Content ${index + 1}`;
    });
  }
 
  let updatedCount = 0;
  const font = await getAvailableFont(textNodes, figmaContext);
 
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
        console.error(`[ContentFiller] Error updating node ${index}:`, error);
      }
    }
  }
 
  if (updatedCount > 0) {
    // Don't change selection - keep the original frame selected so user can continue working with it
    // figma.currentPage.selection = textNodes;
    figma.notify(`✅ Updated ${updatedCount} text fields`, { timeout: 2000 });
 
    // Extract updated node details for next agent
    const updatedNodeSnapshots = await extractNodeSnapshot(textNodes);
 
    return {
      success: updatedCount > 0,
      message: `Updated ${updatedCount} text fields with new content`,
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
 
  // Determine if the request is for a single type (strict) or mixed
  const promptLower = userPrompt.toLowerCase();
  const isNamesOnly = /^\s*\d*\s*names?\s*$/i.test(userPrompt.trim()) || (promptLower.includes("name") && !promptLower.match(/email|phone|detail|contact|user|address|company|respectively|and|&/));
  const isEmailsOnly = /^\s*\d*\s*emails?\s*$/i.test(userPrompt.trim()) || (promptLower.includes("email") && !promptLower.match(/name|phone|detail|contact|user|address|company|respectively|and|&/));
  const isPhonesOnly = /^\s*\d*\s*phones?\s*$/i.test(userPrompt.trim()) || (promptLower.includes("phone") && !promptLower.match(/name|email|detail|contact|user|address|company|respectively|and|&/));
  const isMixed = /names?.*(and|&).*email|email.*(and|&).*name|person.*detail|contact.*info|user.*data|detail.*person|respectively/.test(promptLower);

  let strictType = null;
  if (isNamesOnly) strictType = "names";
  else if (isEmailsOnly) strictType = "emails";
  else if (isPhonesOnly) strictType = "phones";

  let prompt = "";
  if (strictType) {
    // Strict single type prompt
    prompt = `USER REQUEST: "${userPrompt}"

CRITICAL: You must respond ONLY with a JSON array of ${strictType}.
No explanations, no context, no additional text, no other data types.

Examples:
${strictType === "names" ? '["John Smith", "Sarah Wilson", "Mike Davis"]' : strictType === "emails" ? '["john@email.com", "sarah@company.org", "mike@startup.io"]' : '["+1-555-0123", "+1-555-0456", "+1-555-0789"]'}

Rules:
- Only ${strictType} in the array, no emails, phones, or other details.
- Generate ${(() => {
      const match = userPrompt.match(/(\d+)/);
      const num = match ? parseInt(match[1]) : null;
      if (num) {
        return num.toString();
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
  } else {
    // Mixed or fallback prompt
    prompt = `USER REQUEST: "${userPrompt}"

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
  }
 
  let response: string;
  let llmInProgress = (globalThis as any).__llmInProgress || false;
  if (llmInProgress) {
    figma.notify('⏳ Please wait for the previous request to finish.', { timeout: 3000 });
    return {
      success: false,
      message: 'Previous LLM request still in progress. Please wait.',
    };
  }
  (globalThis as any).__llmInProgress = true;
  try {
    try {
      response = await llmTextClient(prompt);
    } catch (error) {
      let errMsg = '';
      if (error && typeof error === 'object') {
        if ('message' in error && typeof (error as any).message === 'string') {
          errMsg = (error as any).message;
        } else if ('error' in error && typeof (error as any).error === 'string') {
          errMsg = (error as any).error;
        } else {
          errMsg = JSON.stringify(error);
        }
      } else {
        errMsg = String(error);
      }
      if (errMsg.includes('429')) {
        // Try to parse retry delay from error message
        let retryDelay = 1500; // default ms
        const match = errMsg.match(/try again in ([\d.]+)s/i);
        if (match && match[1]) {
          retryDelay = Math.ceil(parseFloat(match[1]) * 1000);
        }
        figma.notify(`⚠️ Rate limit hit. Retrying in ${retryDelay / 1000}s...`, { timeout: 2000 });
        await new Promise(res => setTimeout(res, retryDelay));
        try {
          response = await llmTextClient(prompt);
        } catch (retryError) {
          let retryMsg = '';
          if (retryError && typeof retryError === 'object') {
            if ('message' in retryError && typeof (retryError as any).message === 'string') {
              retryMsg = (retryError as any).message;
            } else if ('error' in retryError && typeof (retryError as any).error === 'string') {
              retryMsg = (retryError as any).error;
            } else {
              retryMsg = JSON.stringify(retryError);
            }
          } else {
            retryMsg = String(retryError);
          }
          if (retryMsg.includes('429')) {
            figma.notify('❌ Rate limit reached for LLM API. Please wait a few seconds and try again.', { timeout: 4000 });
            (globalThis as any).__llmInProgress = false;
            return {
              success: false,
              message: 'Rate limit reached for LLM API. Please wait and try again.',
              error: retryMsg,
            };
          }
          const errorMsg = `LLM request failed: ${retryMsg}`;
          console.error("[ContentFiller]", errorMsg, retryError);
          figma.notify(errorMsg, { timeout: 4000 });
          (globalThis as any).__llmInProgress = false;
          return {
            success: false,
            message: errorMsg,
            error: retryMsg,
          };
        }
      } else {
        const errorMsg = `LLM request failed: ${errMsg}`;
        console.error("[ContentFiller]", errorMsg, error);
        figma.notify(errorMsg, { timeout: 4000 });
        (globalThis as any).__llmInProgress = false;
        return {
          success: false,
          message: errorMsg,
          error: errMsg,
        };
      }
    }
  } finally {
    (globalThis as any).__llmInProgress = false;
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

  // Helper to get relative coordinates for placement inside a frame
  function getFrameRelativeCoords(frame: any) {
    // Figma API: x/y are relative to parent, absoluteTransform gives global
    // We'll use (0,0) as the top-left inside the frame
    return { x: 20, y: 20 };
  }

  if (currentSelection.length > 0) {
    for (const node of currentSelection) {
      if (node.type === "FRAME" && "appendChild" in node) {
        container = node as BaseNode & ChildrenMixin;
        const rel = getFrameRelativeCoords(container);
        startX = rel.x;
        startY = rel.y;
        break;
      }
    }
  }

  if (container === figma.currentPage && frameDetails.containers.length > 0) {
    const selectedContainer = frameDetails.containers[0];
    if (
      "appendChild" in selectedContainer &&
      typeof selectedContainer.appendChild === "function"
    ) {
      container = selectedContainer as BaseNode & ChildrenMixin;
      const rel = getFrameRelativeCoords(container);
      startX = rel.x;
      startY = rel.y;
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
      const rel = getFrameRelativeCoords(container);
      startX = rel.x;
      startY = rel.y;
    }
  }
 
  let processedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];
  const font = await getAvailableFont(frameDetails.selectedNodes);

  // Gather all existing text node bounding boxes in the container
  const existingBoxes: { x: number; y: number; width: number; height: number }[] = [];
  if ("children" in container) {
    for (const child of container.children) {
      if (child.type === "TEXT") {
        existingBoxes.push({ x: child.x, y: child.y, width: child.width, height: child.height });
      }
    }
  }

  // Only update existing nodes in a single batch, no parallel LLM calls
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
      const errorMsg = `Failed to update existing node: "${content.substring(0, 20)}..."`;
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


  // Helper to find the next available (x, y) position in a grid (no overlap, inside container)
  function findNextAvailablePosition(
    startX: number,
    startY: number,
    width: number,
    height: number,
    maxColumns: number = 5,
    maxRows: number = 100,
    containerBounds?: { x: number; y: number; width: number; height: number }
  ): { x: number; y: number } | null {
    for (let row = 0; row < maxRows; row++) {
      for (let col = 0; col < maxColumns; col++) {
        const x = startX + col * columnWidth;
        const y = startY + row * rowHeight;
        // Check if within container bounds (if provided)
        if (containerBounds) {
          if (
            x < containerBounds.x ||
            y < containerBounds.y ||
            x + width > containerBounds.x + containerBounds.width ||
            y + height > containerBounds.y + containerBounds.height
          ) {
            continue;
          }
        }
        const overlaps = existingBoxes.some(
          (box) =>
            x < box.x + box.width &&
            x + width > box.x &&
            y < box.y + box.height &&
            y + height > box.y
        );
        if (!overlaps) {
          return { x, y };
        }
      }
    }
    // No available position
    return null;
  }

  const createNodesForType = async (
    items: typeof dataTypes.names,
    typeName: string,
    column: number
  ) => {
    // Determine container bounds if possible
    let containerBounds: { x: number; y: number; width: number; height: number } | undefined = undefined;
    if (container !== figma.currentPage && 'x' in container && 'y' in container && 'width' in container && 'height' in container) {
      // For frames, use (0,0) as top-left inside the frame
      containerBounds = {
        x: 0,
        y: 0,
        width: (container as any).width,
        height: (container as any).height,
      };
    }
    for (let i = 0; i < items.length; i++) {
      const { content } = items[i];
      try {
        const pos = findNextAvailablePosition(
          startX + column * columnWidth,
          startY,
          150,
          rowHeight,
          5,
          100,
          containerBounds
        );
        if (!pos) {
          // No available space in container for this node
          const errorMsg = `No space to add ${typeName} node: "${content.substring(0, 20)}..."`;
          errors.push(errorMsg);
          errorCount++;
          continue;
        }
        const textNode = figma.createText();
        await figma.loadFontAsync(font);
        textNode.fontName = font;
        textNode.characters = content;
        textNode.fontSize = 16;
        textNode.name = generateSmartNodeName(content, userPrompt, items[i].index);
        textNode.x = pos.x;
        textNode.y = pos.y;
        // Add this node's box to the list so future nodes don't overlap
        existingBoxes.push({ x: textNode.x, y: textNode.y, width: 150, height: rowHeight });
        if (container !== figma.currentPage) {
          try {
            container.appendChild(textNode);
          } catch (appendError) {
            const errorMsg = `Failed to append ${typeName} node to container`;
            errors.push(errorMsg);
            errorCount++;
          }
        }
        createdCount++;
      } catch (error) {
        const errorMsg = `Failed to create ${typeName} node: "${content.substring(0, 20)}..."`;
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
    figma.notify(`⚠️ Generated ${totalCount} items, ${errorCount} errors. Some items could not be placed due to lack of space.`, {
      timeout: 3000,
    });
  } else if (totalCount === 0 && errorCount > 0) {
    figma.notify(`❌ Failed to generate content: No available space in the frame/container.`, { timeout: 4000 });
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
  const allProcessedNodes = [...existingTextNodes];
 
  // Also include the container frame if it's not the page
  if (container !== figma.currentPage && "id" in container) {
    allProcessedNodes.push(container as BaseNode);
  }
 
  const updatedNodeSnapshots = await extractNodeSnapshot(allProcessedNodes);
 
  return {
    success: totalCount > 0,
    message:
      errorCount > 0
        ? `Generated ${totalCount} content items with ${errorCount} errors: ${errors.join(
            ", "
          )}`
        : `Generated ${totalCount} content items (${processedCount} updated, ${createdCount} created)`,
    error: errors.length > 0 ? errors.join("; ") : undefined,
    updatedNodes: updatedNodeSnapshots,
  };
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