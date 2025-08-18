// translationAgent.ts
import { AgentResponse, NodeSnapshot } from "../utils/types";
import { llmClient } from "../shared/llmClient";
 
// Simple fallback translation using LLM
async function translateWithLLM(
  text: string,
  targetLang: string
): Promise<string> {
  try {
    // Clean the text first - remove any existing [DA] prefixes
    const cleanText = text.replace(/^\[DA\]\s*/g, "").trim();
 
    const languageMap: { [key: string]: string } = {
      da: "Danish",
      sv: "Swedish",
      no: "Norwegian",
      fi: "Finnish",
      de: "German",
      fr: "French",
      es: "Spanish",
      it: "Italian",
      pt: "Portuguese",
      nl: "Dutch",
    };
 
    const fullLanguageName =
      languageMap[targetLang.toLowerCase()] || targetLang;
 
    const prompt = `Translate this text to ${fullLanguageName}. Return ONLY the translated text with no extra formatting or explanations:
 
"${cleanText}"
 
Translated text:`;
 
    console.log("[Translation Agent] LLM Prompt:", prompt);
    const response = await llmClient(prompt);
    console.log("[Translation Agent] LLM Response:", response);
 
    if (response && response.length > 0) {
      const firstResponse = response[0];
      let translatedText = "";
 
      if (typeof firstResponse === "string") {
        translatedText = firstResponse;
      } else if (firstResponse && firstResponse.content) {
        translatedText = firstResponse.content;
      } else if (firstResponse && firstResponse.text) {
        translatedText = firstResponse.text;
      }
 
      // Clean up the response - remove any quotes, prefixes, or explanations
      translatedText = translatedText
        .replace(/^["']|["']$/g, "") // Remove quotes
        .replace(/^Translated text:\s*/i, "") // Remove "Translated text:" prefix
        .replace(/^\[.*?\]\s*/, "") // Remove any bracketed prefixes
        .trim();
 
      if (translatedText && translatedText !== cleanText) {
        console.log(
          `[Translation Agent] LLM translation successful: "${translatedText}"`
        );
        return translatedText;
      }
    }
 
    console.warn("[Translation Agent] LLM returned no valid translation");
    return ""; // Return empty to indicate failure
  } catch (error) {
    console.warn("[Translation Agent] LLM fallback failed:", error);
    return ""; // Return empty to indicate failure
  }
}
 
export async function runTranslationAgent(
  parameters: any,
  contextParams: any
): Promise<AgentResponse> {
  try {
    // Extract parameters
    const params = parameters;
    const figmaContext = contextParams.figmaContext || null;
 
    console.log(params);

    // Get target languages from parameters
    const languages = params.languages || ["da"]; // Default to Danish
    const useSlang = params.useSlang !== undefined ? params.useSlang : true;
    
    // Get text nodes from context (compatible with orchestrator structure)
    const textNodes = figmaContext?.textNodes || [];
    if (false) {
      return {
        success: false,
        message:
          "No text nodes found to translate. Please select frames or text elements with text content.",
        agentType: "translation",
        agentName: "Translation Agent",
        error: "No text content available for translation",
      };
    }
 
    const backendUrl = "http://127.0.0.1:8000/translate";
    const updatedNodes: NodeSnapshot[] = [];
    let totalTranslated = 0;
    let totalAttempted = 0;
 
    console.log(
      `[Translation Agent] Found ${textNodes.length} text nodes to process`
    );
 
    // Process each language
    for (const lang of languages) {
      console.log(languages)

      console.log(`[Translation Agent] Translating to ${lang}...`);
 
      for (const textNode of textNodes) {
        // Ensure this is a text node with content
        if (textNode.type !== "TEXT") {
          console.log(
            `[Translation Agent] Skipping non-text node: ${textNode.type}`
          );
          continue;
        }
        const node = textNode as TextNode;
 
        // if (!node.characters || node.characters.trim() === "") {
        //   console.log(
        //     `[Translation Agent] Skipping empty text node: ${node.id}`
        //   );
        //   continue; // Skip empty text nodes
        // }
 
        totalAttempted++;
        console.log(
          `[Translation Agent] Processing node ${
            node.id
          }: "${node.characters.substring(0, 50)}..."`
        );
 
        try {
          const body = {
            text: node.characters,
            lang_short: lang,
            // use_slang: useSlang,
          };
 
          console.log(
            `[Translation Agent] Sending request to ${backendUrl}:`,
            body
          );
 
          let translatedText = "";
          let usedBackend = false;
 
          
          try {
            const resp = await fetch(backendUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true",
              },
              body: JSON.stringify(body),
            });
 
            console.log(`[Translation Agent] Response status: ${resp.status}`);
            console.log(`[Translation Agent] Response body: ${await resp.text()}`);
            // ✅ FIXED CODE:
            if (resp.ok) {
            const responseText = await resp.text(); // ✅ Call text() only once
            console.log(`[Translation Agent] Response body: ${responseText}`);
            
            try {
                const translatedData = JSON.parse(responseText); // ✅ Parse the JSON
                console.log('[Translation Agent] Parsed data:', translatedData);
                
                // ✅ Extract the translatedText from your JSON response
                translatedText = translatedData.translatedText || "";
                
                console.log(`[Translation Agent] Extracted translation: ${translatedText}`);
                
                if (translatedText) {
                usedBackend = true;
                console.log(`[Translation Agent] Backend translation successful: "${translatedText.substring(0, 50)}..."`);
                }
            } catch (parseError) {
                console.error('[Translation Agent] Failed to parse JSON response:', parseError);
                console.log('[Translation Agent] Raw response:', responseText);
            }
            } else {
            const errorText = await resp.text();
            console.warn(`[Translation Agent] Backend failed: ${resp.status} - ${errorText}`);
            }
          } catch (backendError) {
            console.warn(`[Translation Agent] Backend request failed:`, backendError);
          }
          
          // Skip backend for now since it's returning 404 - use LLM directly
        //   console.log(
        //     `[Translation Agent] Skipping backend (404 error), using LLM directly for: "${node.characters.substring(
        //       0,
        //       50
        //     )}..."`
        //   );
        //   translatedText = await translateWithLLM(node.characters, lang);
 
          // Old backend code (commented out due to 404 errors):
          
 
          // Skip if still no translation (don't use mock unless debugging)
          if (!translatedText) {
            console.warn(
              `[Translation Agent] All translation methods failed for node ${node.id}: "${node.characters}"`
            );
            continue; // Skip this node instead of using mock translation
          }
 
          console.log(
            `[Translation Agent] Final translation result: "${translatedText}"`
          );
 
          // Update the actual Figma node
          try {
            // Handle font loading safely
            if (
              node.fontName !== figma.mixed &&
              typeof node.fontName === "object"
            ) {
              await figma.loadFontAsync(node.fontName);
            }
          } catch (fontError) {
            console.warn(`Font loading failed for node ${node.id}:`, fontError);
          }
 
          const originalText = node.characters;
          node.characters = translatedText;
 
          console.log(
            `[Translation Agent] Updated node ${node.id}: "${originalText}" → "${translatedText}"`
          );
 
          // Create updated node snapshot for orchestrator
          updatedNodes.push({
            id: node.id,
            type: "TEXT",
            characters: translatedText,
            // Preserve other properties
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
            fontSize: (node.fontSize as number) || 12,
            fontFamily: (node.fontName as FontName)?.family || "Inter",
            // Add translation metadata
            translatedTo: lang,
            originalText: originalText,
          });
 
          totalTranslated++;
        } catch (nodeError: any) {
          console.warn(
            `Translation error for node ${node.id}:`,
            nodeError.message
          );
          continue;
        }
      }
    }
 
    console.log(
      `[Translation Agent] Summary - Attempted: ${totalAttempted}, Translated: ${totalTranslated}`
    );
 
    // Create success response
    const successMessage =
      totalTranslated > 0
        ? `Successfully translated ${totalTranslated} of ${totalAttempted} text elements into ${languages.join(
            ", "
          )}`
        : totalAttempted > 0
        ? `Found ${totalAttempted} text elements but translation failed for all`
        : "No processable text elements found in selection";
 
    return {
      success: totalTranslated > 0,
      message: successMessage,
      agentType: "translation",
      agentName: "Translation Agent",
      response: `Translation Summary:\n• Languages: ${languages.join(
        ", "
      )}\n• Text elements found: ${
        textNodes.length
      }\n• Text elements attempted: ${totalAttempted}\n• Text elements translated: ${totalTranslated}\n• Backend URL: ${backendUrl}`,
      updatedNodes: updatedNodes,
      frameData: {
        totalTranslated,
        totalAttempted,
        totalFound: textNodes.length,
        languages,
        backendUrl,
      },
    };
  } catch (err: any) {
    console.error("[Translation Agent] Error:", err);
    return {
      success: false,
      message: "Translation failed due to an error",
      agentType: "translation",
      agentName: "Translation Agent",
      error: err.message || "Unknown translation error",
      frameData: {
        error: err.message,
        attempted: true,
      },
    };
  }
}
 
 