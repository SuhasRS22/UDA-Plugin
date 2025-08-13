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

export async function runLoremIpsumAgent(type: string = "paragraph", forceFill: boolean = false, customContent?: string): Promise<AgentResponse> {
  const selection = figma.currentPage.selection;
  let filledCount = 0;

  console.log(`[AdvancedContentFiller] Processing ${selection.length} selected items with advanced AI (type: ${type})`);

  // Handle direct LLM requests with advanced intelligence - create text nodes as needed
  if (type === "llm-direct" && customContent) {
    console.log("[AdvancedContentFiller] Advanced LLM-direct mode detected - deploying intelligent content strategy");
    return await handleSmartTextCreation(selection, customContent);
  }

  // Enhanced legacy processing for non-LLM requests with improved intelligence

  async function processNode(node: SceneNode) {
    if (node.type === "TEXT" && !node.locked) {
      const textNode = node as TextNode;
      
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
          const generatedText = await llmClient(prompt, 'content');
          
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
          console.log(`[AdvancedContentFiller] Enhanced content: "${textContent}"`);
        } catch (error) {
          console.error(`[AdvancedContentFiller] Error filling text node: ${error}`);
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

// Smart text creation - creates text nodes as needed and fills them with advanced intelligence
async function handleSmartTextCreation(selection: readonly SceneNode[], userRequest: string): Promise<AgentResponse> {
  console.log(`[AdvancedSmartText] Creating intelligent content for: "${userRequest}"`);
  console.log(`[AdvancedSmartText] Selection length: ${selection.length}`);
  
  try {
    // Enhanced text node collection with metadata analysis
    let textNodes: TextNode[] = [];
    
    function collectTextNodes(node: SceneNode) {
      if (node.type === "TEXT" && !node.locked) {
        textNodes.push(node as TextNode);
      } else if ("children" in node) {
        for (const child of node.children) {
          collectTextNodes(child);
        }
      }
    }

    // Collect from selection with enhanced analysis
    if (selection.length > 0) {
      for (const item of selection) {
        collectTextNodes(item);
      }
      console.log(`[AdvancedSmartText] Found ${textNodes.length} text nodes in selection for advanced processing`);
    } else {
      console.log(`[AdvancedSmartText] No selection - will create new intelligent content nodes`);
    }

    // Advanced LLM decision making - let AI decide EVERYTHING with sophisticated analysis
    if (textNodes.length > 0) {
      console.log(`[AdvancedSmartText] Deploying advanced AI for form filling with ${textNodes.length} existing nodes`);
      return await handleLLMDrivenFormFilling(textNodes, userRequest);
    } else {
      console.log(`[AdvancedSmartText] Deploying advanced AI for intelligent content creation`);
      return await handleLLMDrivenContentCreation(selection, userRequest);
    }

  } catch (error) {
    console.error("[AdvancedSmartText] Error in advanced text creation:", error);
    return {
      success: false,
      message: `Advanced content creation failed: ${error instanceof Error ? error.message : 'Unknown error'} - Please try a different approach`
    };
  }
}

// Handle contextual form filling based on existing text node structure
async function handleLLMDrivenFormFilling(textNodes: TextNode[], userRequest: string): Promise<AgentResponse> {
  console.log(`[AdvancedFormFilling] LLM analyzing ${textNodes.length} text nodes for: "${userRequest}"`);
  
  // Enhanced form structure analysis with positioning and styling context
  const formStructure = textNodes.map((node, index) => ({
    index,
    name: node.name,
    currentText: node.characters,
    isEmpty: node.characters.trim() === "" || 
             node.characters === "Type something" ||
             node.characters.startsWith("Lorem ipsum") ||
             node.characters.length < 5,
    fontSize: node.fontSize,
    position: { x: node.x, y: node.y },
    width: node.width,
    height: node.height
  }));

  // Check if user wants to change/update existing content
  const isUpdateRequest = userRequest.toLowerCase().includes('change') || 
                         userRequest.toLowerCase().includes('update') || 
                         userRequest.toLowerCase().includes('replace') ||
                         userRequest.toLowerCase().includes('new') ||
                         formStructure.every(field => !field.isEmpty); // All fields filled, so they want to update

  // Simple, direct prompt that responds to exactly what the user asks for
  const prompt = `Generate realistic, professional content based on the user's request. Create content that looks natural and believable.

USER REQUEST: "${userRequest}"
UPDATE MODE: ${isUpdateRequest ? 'Yes - can update existing content' : 'No - only fill empty fields'}

FIELDS TO FILL:
${formStructure.map(field => 
    `Field ${field.index}: name="${field.name}", current="${field.currentText}", isEmpty=${field.isEmpty}`
  ).join('\n')}

INSTRUCTIONS:
- Generate realistic, professional content that matches the user's request exactly
- Make content look natural and believable (not templated or artificial)
- If they ask for "contact info" or "contact details", generate complete, consistent contact information (names should match emails)
- If they ask for multiple people's contact info, create related data sets for each person
- If they ask for "medical data", generate realistic medical content
- If they ask for "names", generate normal human names
- If they ask for "emails", generate realistic email addresses that could match the names
- If they ask generally, generate simple, natural content
- Don't use patterns like "AI Generated X" or "example.com" - make it realistic
- Keep related data consistent (if name is "John Smith", email should be "john.smith@..." or "j.smith@...")

EXAMPLES OF GOOD CONTENT:
- For contact info requests: {"0": "John Smith", "1": "john.smith@company.com", "2": "+1-555-0123", "3": "Sarah Johnson", "4": "sarah.j@tech.io"}
- Names: "Sarah Johnson", "Michael Chen", "David Wilson"
- Emails: "sarah.j@company.com", "michael@tech.io", "david@startup.co"
- Medical: "Blood Type: A+", "Patient ID: MD-2024-1847", "Dr. Sarah Johnson"
- General: "Project Alpha", "Marketing Team", "Sales Report"

RESPONSE FORMAT:
Provide a JSON object with field indices as keys and generated content as values:
{"0": "content for field 0", "1": "content for field 1", etc.}

${isUpdateRequest ? 'Fill all suitable fields (including non-empty ones).' : 'Only fill empty fields and generate exactly what was requested.'}`;

  console.log(`[AdvancedFormFilling] Sending advanced form analysis to LLM...`);
  const response = await llmClient(prompt, 'content');
  console.log(`[AdvancedFormFilling] LLM response:`, response);

  let fillInstructions: Record<string, string> = {};

  // Parse LLM response with enhanced error handling
  if (typeof response === 'string') {
    try {
      fillInstructions = JSON.parse(response);
    } catch {
      console.error("[AdvancedFormFilling] Failed to parse LLM response as JSON, attempting fallback");
      // Fallback: try to extract content between braces
      const jsonMatch = response.match(/\{[^{}]*\}/);
      if (jsonMatch) {
        try {
          fillInstructions = JSON.parse(jsonMatch[0]);
        } catch {
          return {
            success: false,
            message: "LLM response could not be parsed - please try again with a clearer request"
          };
        }
      } else {
        return {
          success: false,
          message: "LLM response was not in expected JSON format"
        };
      }
    }
  } else if (typeof response === 'object') {
    fillInstructions = response as Record<string, string>;
  }

  // Apply the LLM's filling instructions
  let filledCount = 0;
  const availableFont = await getAvailableFont([]);

  for (const [indexStr, newContent] of Object.entries(fillInstructions)) {
    const index = parseInt(indexStr);
    const shouldFill = index >= 0 && index < textNodes.length && 
                      (formStructure[index].isEmpty || isUpdateRequest);
                      
    if (shouldFill) {
      const textNode = textNodes[index];
      
      try {
        // Load font and set content
        let fontToUse: FontName;
        
        if (textNode.fontName && typeof textNode.fontName === 'object') {
          try {
            await figma.loadFontAsync(textNode.fontName as FontName);
            fontToUse = textNode.fontName as FontName;
          } catch (fontError) {
            fontToUse = availableFont;
          }
        } else {
          fontToUse = availableFont;
        }
        
        textNode.fontName = fontToUse;
        textNode.characters = String(newContent);
        filledCount++;
        
          console.log(`[AdvancedFormFilling] Filled "${textNode.name}" with: "${newContent}"`);
        
      } catch (error) {
        console.error(`[AdvancedFormFilling] Error filling node ${index}: ${error}`);
      }
    }
  }

  // Select the filled nodes with simplified feedback
  if (filledCount > 0) {
    figma.currentPage.selection = textNodes;
    // Removed aggressive viewport manipulation
    
    // Single clean notification
    figma.notify(`✅ Filled ${filledCount} fields`, { timeout: 2000 });
  }

  console.log(`[AdvancedFormFilling] Successfully filled ${filledCount} form fields`);
  
  return {
    success: filledCount > 0,
    message: filledCount > 0 
      ? `${isUpdateRequest ? 'Updated' : 'Filled'} ${filledCount} form fields with contextual content`
      : isUpdateRequest 
        ? "No suitable fields found to update" 
        : "No empty form fields found to fill - try 'update' or 'change' to modify existing content"
  };
}

// Handle creating new content when no existing nodes - completely LLM driven with advanced intelligence
async function handleLLMDrivenContentCreation(selection: readonly SceneNode[], userRequest: string): Promise<AgentResponse> {
  console.log(`[AdvancedContentCreation] LLM creating intelligent content for: "${userRequest}"`);
  
  // Simple, direct prompt that generates exactly what the user asks for
  const prompt = `Generate realistic, professional content based on the user's request. Create content that looks natural and believable.

USER REQUEST: "${userRequest}"

INSTRUCTIONS:
- Generate realistic, professional content that matches the user's request exactly (Nothing more, Nothing less)
- Make content look natural and believable (not templated or artificial)
- If they ask for "contact info" or "contact details", generate complete sets of related information (name + email + phone for each person)
- If they ask for multiple people's contact info, create consistent, related data for each person
- If they ask for "medical data", generate realistic medical content like "Blood Type: O+", "Patient ID: MD-2024-1847"
- If they ask for "doctors", generate realistic doctor names like "Dr. Sarah Johnson", "Dr. Michael Chen"
- If they ask for "names", generate normal human names like "Sarah Johnson", "Michael Chen", "David Wilson"
- If they ask for "emails", generate realistic emails like "sarah.j@company.com", "michael@tech.io"
- If they ask generally, generate simple, natural content like "Project Alpha", "Marketing Team"
- Don't use artificial patterns like "AI Generated X" or "example.com" - make it realistic
- Keep related data consistent (if name is "John Smith", email should be "john.smith@..." or "j.smith@...")

EXAMPLES OF GOOD CONTENT:
- "contact info of 3 people" → ["John Smith - john.smith@company.com - +1-555-0123", "Sarah Johnson - sarah.j@tech.io - +1-555-0124", "Mike Davis - mike.d@startup.co - +1-555-0125"]
- "add names" → ["Sarah Johnson", "Michael Chen", "David Wilson"]
- "add doctors" → ["Dr. Sarah Johnson", "Dr. Michael Chen", "Dr. David Wilson"]
- "add medical data" → ["Blood Type: A+", "Patient ID: MD-2024-1847", "Allergies: None"]
- "add emails" → ["sarah.j@company.com", "michael@tech.io", "david@startup.co"]
- "add some content" → ["Project Alpha", "Marketing Team", "Sales Report"]

Generate 3-6 realistic items that directly match the request. If asking for contact info of multiple people, provide complete contact details for each person. Respond with ONLY a JSON array:
["item1", "item2", "item3"]`;

  console.log(`[AdvancedContentCreation] Sending advanced content strategy to LLM...`);
  const response = await llmClient(prompt, 'content');
  console.log(`[AdvancedContentCreation] LLM response:`, response);

  let generatedItems: string[] = [];

  // Enhanced response parsing with fallback strategies
  if (Array.isArray(response)) {
    generatedItems = response.map(item => String(item));
    console.log(`[AdvancedContentCreation] LLM provided direct array: ${generatedItems.length} items`);
  } else if (typeof response === 'string') {
    try {
      const parsed = JSON.parse(response);
      if (Array.isArray(parsed)) {
        generatedItems = parsed.map(item => String(item));
        console.log(`[AdvancedContentCreation] LLM provided JSON array: ${generatedItems.length} items`);
      } else {
        // Fallback: treat as single item
        generatedItems = [response];
        console.log(`[AdvancedContentCreation] LLM provided single string, treating as single item`);
      }
    } catch {
      // Advanced fallback: try to extract array pattern from text
      const arrayMatch = response.match(/\[(.*?)\]/);
      if (arrayMatch) {
        try {
          const extractedArray = JSON.parse(arrayMatch[0]);
          if (Array.isArray(extractedArray)) {
            generatedItems = extractedArray.map(item => String(item));
            console.log(`[AdvancedContentCreation] Extracted array from LLM text: ${generatedItems.length} items`);
          } else {
            generatedItems = [response];
          }
        } catch {
          generatedItems = [response];
        }
      } else {
        generatedItems = [response];
        console.log(`[AdvancedContentCreation] Using raw LLM response as single item`);
      }
    }
  } else {
    generatedItems = [String(response)];
    console.log(`[AdvancedContentCreation] Converting LLM response to string`);
  }

  if (generatedItems.length === 0) {
    console.error(`[AdvancedContentCreation] LLM generated no content!`);
    return {
      success: false,
      message: "Advanced AI could not generate content - please try rephrasing your request"
    };
  }

  console.log(`[AdvancedContentCreation] LLM strategically decided to create:`, generatedItems);

  // Enhanced text node creation with intelligent positioning and styling
  const availableFont = await getAvailableFont(selection);
  let textNodes: TextNode[] = [];
  
  // Find the best container for text nodes
  let container: BaseNode & ChildrenMixin = figma.currentPage;
  let startX = 100;
  let startY = 100;
  
  // If there's a frame/group in selection, use it as container
  if (selection.length > 0) {
    for (const item of selection) {
      if (("children" in item) && (item.type === "FRAME" || item.type === "GROUP" || item.type === "COMPONENT" || item.type === "INSTANCE")) {
        container = item as BaseNode & ChildrenMixin;
        // Position relative to the container's bounds
        startX = 20; // 20px padding from left edge of container
        startY = 20; // 20px padding from top edge of container
        console.log(`[AdvancedContentCreation] Using ${item.type} "${item.name}" as container`);
        break;
      }
    }
    
    // If no suitable container found, position near the first selected item
    if (container === figma.currentPage && "x" in selection[0] && "y" in selection[0]) {
      const refNode = selection[0] as any;
      startX = refNode.x + 20;
      startY = refNode.y + 20;
    }
  }
  
  for (let i = 0; i < generatedItems.length; i++) {
    const textNode = figma.createText();
    
    // Generate realistic node names based on content
    const content = String(generatedItems[i]);
    let nodeName = "Text";
    
    // Detect content type and give appropriate names
    if (content.includes("@")) {
      nodeName = "Email";
    } else if (content.match(/^\+?\d[\d\s\-\(\)]+/)) {
      nodeName = "Phone";
    } else if (content.includes("Dr.") || content.includes("Prof.")) {
      nodeName = "Doctor Name";
    } else if (content.includes("Patient ID") || content.includes("Blood Type")) {
      nodeName = "Medical Info";
    } else if (content.includes("Project") || content.includes("Team")) {
      nodeName = "Project Name";
    } else if (content.includes(" ") && !content.includes(":") && !content.includes("#")) {
      nodeName = "Name";
    } else if (content.includes("SKU") || content.includes("$")) {
      nodeName = "Product Info";
    } else {
      nodeName = "Label";
    }
    
    // Add number if multiple of same type
    const existingCount = textNodes.filter(node => node.name.startsWith(nodeName)).length;
    if (existingCount > 0) {
      nodeName = `${nodeName} ${existingCount + 1}`;
    }
    
    textNode.name = nodeName;
    
    // Position within the container
    textNode.x = startX;
    textNode.y = startY + (i * 40); // 40px spacing between items
    
    // Enhanced font and styling with content-aware sizing
    try {
      await figma.loadFontAsync(availableFont);
      textNode.fontName = availableFont;
      
      // Intelligent font sizing based on content type
      const content = String(generatedItems[i]);
      if (content.includes("Dr.") || content.includes("Prof.") || content.includes("CEO")) {
        textNode.fontSize = 18; // Larger for titles/roles
      } else if (content.includes("@") || content.includes("+")) {
        textNode.fontSize = 14; // Smaller for contact info
      } else if (content.length > 30) {
        textNode.fontSize = 12; // Smaller for long content
      } else {
        textNode.fontSize = 16; // Standard size
      }
      
      textNode.characters = content;
      // Removed excessive logging to reduce console noise
    } catch (error) {
      console.error(`[AdvancedContentCreation] Error setting up node ${i}: ${error}`);
      textNode.fontSize = 14;
      textNode.characters = String(generatedItems[i]);
    }
    
    // Add to the appropriate container (frame or page)
    container.appendChild(textNode);
    textNodes.push(textNode);
  }
  
  // Simplified selection and viewport management - no aggressive resizing
  if (textNodes.length > 0) {
    figma.currentPage.selection = textNodes;
    // Removed aggressive viewport scrolling that was causing frame resizing
    
    // Single, clean notification instead of multiple
    figma.notify(`✅ Created ${textNodes.length} content elements`, { timeout: 2000 });
  }

  console.log(`[AdvancedContentCreation] Successfully created ${textNodes.length} text nodes`);

  return {
    success: textNodes.length > 0,
    message: `Created ${textNodes.length} content elements with intelligent design`
  };
}


