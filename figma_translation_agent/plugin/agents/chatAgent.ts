/// <reference types="@figma/plugin-typings" />

import { llmTextClient } from "../shared/llmClient";
import { AgentResponse, NodeSnapshot } from "../utils/types";
import { buildFigmaContext } from "../shared/buildFigmaContext";

// Main chat agent function - serves as backup for informational queries
export async function runChatAgent(
  parameters: any,
  contextParams: any
): Promise<AgentResponse> {
  const userPrompt = contextParams.userPrompt || parameters.prompt || "";
  const figmaContext = contextParams.figmaContext || null;

  console.log(`[ChatAgent] Handling informational query: "${userPrompt}"`);

  try {
    // Build context information about selected elements
    const contextInfo = buildContextSummary(figmaContext);

    // Create a focused prompt for the LLM
    const chatPrompt = `
You are a helpful assistant for a Figma plugin that has specialized agents for different tasks:

- **Resize Agent**: Handles resizing frames, creating new frames, converting to mobile/tablet/desktop views
- **Content Filler Agent**: Generates and fills text content (names, emails, lorem ipsum, etc.)
- **Translation Agent**: Translates text content to different languages
- **Contrast Checker Agent**: Checks and adjusts color contrast for accessibility

The user has asked: "${userPrompt}"

Current Figma Context:
${contextInfo}

Since this question doesn't require performing actions on Figma elements, please provide a helpful informational response. Be concise but informative. If the user is asking about capabilities, explain what our agents can do. If they're asking for guidance, provide clear next steps.

Keep your response under 200 to 220 words and focus on being helpful and actionable.
`;

    console.log("[ChatAgent] Sending query to LLM for informational response");

    const response = await llmTextClient(chatPrompt);

    console.log("[ChatAgent] Received response from LLM");

    // Format the response nicely
    const formattedResponse = response.trim();

    // Show the response to the user
    figma.notify(`💬 ${formattedResponse}`, { timeout: 8000 });

    return {
      success: true,
      message: formattedResponse,
      agentType: "chat",
      agentName: "Chat Agent",
      response: formattedResponse,
      updatedNodes: [],
      createdNodes: [],
      deletedNodeIds: [],
    };
  } catch (error) {
    console.error("[ChatAgent] Error:", error);

    const fallbackMessage =
      "I'm here to help! Ask me about resizing frames, generating content, translations, or checking contrast. What would you like to know?";

    figma.notify(`💬 ${fallbackMessage}`, { timeout: 5000 });

    return {
      success: false,
      message: fallbackMessage,
      agentType: "chat",
      agentName: "Chat Agent",
      response: fallbackMessage,
      error: error instanceof Error ? error.message : "Unknown error",
      updatedNodes: [],
      createdNodes: [],
      deletedNodeIds: [],
    };
  }
}

// Helper function to build a summary of the current context
function buildContextSummary(figmaContext: any): string {
  if (!figmaContext) {
    return "No elements are currently selected.";
  }

  const summary = [];

  // Count different types of nodes
  const textNodeCount = figmaContext.textNodes?.length || 0;
  const resizableNodeCount = figmaContext.resizableNodes?.length || 0;
  const totalNodeCount = Object.keys(figmaContext.allNodes || {}).length;

  if (totalNodeCount === 0) {
    return "No elements are currently selected.";
  }

  summary.push(`${totalNodeCount} element(s) selected`);

  if (resizableNodeCount > 0) {
    summary.push(`${resizableNodeCount} resizable frame(s)/shape(s)`);
  }

  if (textNodeCount > 0) {
    summary.push(`${textNodeCount} text element(s)`);
  }

  // Get info about the first few nodes
  const nodeNames = Object.values(figmaContext.allNodes || {})
    .slice(0, 3)
    .map((node: any) => `"${node.name || "Unnamed"}"`)
    .join(", ");

  if (nodeNames) {
    summary.push(`Including: ${nodeNames}`);
    if (totalNodeCount > 3) {
      summary.push(`and ${totalNodeCount - 3} more`);
    }
  }

  return summary.join(", ");
}

// Helper function to determine if a query should be handled by chat agent
export function shouldUseChatAgent(
  userPrompt: string,
  taskPlan: any[]
): boolean {
  const prompt = userPrompt.toLowerCase();

  // Check if LLM planning resulted in no actionable tasks
  const hasActionableTasks =
    taskPlan &&
    taskPlan.length > 0 &&
    taskPlan.some((task) =>
      [
        "resize",
        "lorem",
        "contentFiller",
        "translate",
        "contrastChecker",
      ].includes(task.agent)
    );

  if (!hasActionableTasks) {
    return true;
  }

  // Check for question patterns that don't require actions
  const questionPatterns = [
    "what",
    "how",
    "why",
    "when",
    "where",
    "which",
    "who",
    "can you",
    "could you",
    "would you",
    "should i",
    "do you",
    "tell me",
    "explain",
    "describe",
    "help me understand",
    "?",
  ];

  const isQuestion = questionPatterns.some((pattern) =>
    prompt.includes(pattern)
  );

  // Check for informational keywords
  const informationalKeywords = [
    "help",
    "guide",
    "tutorial",
    "how to",
    "what is",
    "what are",
    "capabilities",
    "features",
    "options",
    "possible",
    "available",
    "recommend",
    "suggest",
    "advice",
    "best practice",
    "tip",
  ];

  const isInformational = informationalKeywords.some((keyword) =>
    prompt.includes(keyword)
  );

  return isQuestion || isInformational;
}
