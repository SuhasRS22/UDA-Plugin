// agentOrchestrator.ts
import { llmClient } from "../shared/llmClient";
import { runLoremIpsumAgent } from "../agents/contentFillerAgent";
import { runResizeAgent } from "../agents/resizeAgent";
import { runChatAgent, shouldUseChatAgent } from "../agents/chatAgent";
// import translateAgent from "../agents/translationAgent";
import { runContrastCheckerAgent } from "../agents/contrastAgent";
import { AgentResponse } from "../utils/types";
import { buildFigmaContext } from "../shared/buildFigmaContext";
import { runContrastCheckerAgent } from "../agents/contrastAgent";

// Registry of all agents — orchestrator never hardcodes logic
const agentRegistry: Record<
  string,
  (params: any, context: any) => Promise<AgentResponse>
> = {
  resize: async (params, context) => runResizeAgent(params, context),
  // translate: async (params, context) =>
  //   translateAgent(params, context),
  lorem: async (params, context) => runLoremIpsumAgent(params, context),
  contentFiller: async (params, context) => runLoremIpsumAgent(params, context),
  chat: async (params, context) => runChatAgent(params, context),
  contrastChecker: async (params, context) => runContrastCheckerAgent(params, context),
};

// --- Helper: Converts figma node data into a readable LLM-friendly summary
function createLLMContext(figmaData: any): string {
  const nodes = figmaData.nodes;

  const textInfo = (nodes?.text || [])
    .map((node: any) => {
      if (!node) return null;
      return {
        text: node.text || "",
        fontSize: node.fontSize || "unknown",
        fontFamily: node.fontFamily || "unknown",
      };
    })
    .filter(Boolean);

  const frameInfo = (nodes?.frames || [])
    .map((frame: any) => {
      if (!frame) return null;
      return {
        name: frame.name || "unnamed",
        width: frame.width || 0,
        height: frame.height || 0,
      };
    })
    .filter(Boolean);

  const nodeTypes = nodes
    ? Object.keys(nodes)
        .map((type) => `${type}(${nodes[type]?.length || 0})`)
        .join(", ")
    : "unknown";

  return `
SELECTION CONTEXT:
- Node types: ${nodeTypes}

TEXT CONTENT:
${
  textInfo.length > 0
    ? textInfo
        .map(
          (t: any, i: number) =>
            `${i + 1}. "${t.text}" (${t.fontSize}px ${t.fontFamily})`
        )
        .join("\n")
    : "No text nodes"
}

FRAMES:
${
  frameInfo.length > 0
    ? frameInfo
        .map(
          (f: any, i: number) => `${i + 1}. ${f.name}: ${f.width}x${f.height}`
        )
        .join("\n")
    : "No frames"
}
`;
}

export async function agentOrchestrator(
  combinedPrompt: any
): Promise<AgentResponse[]> {
  const { userPrompt, nodes } = combinedPrompt;

  // Build summary for the LLM
  const contextSummary = createLLMContext({ nodes });

  const promptForLLM = `
User Request: ${userPrompt}

${contextSummary}
  `;

  console.log("[Orchestrator] Prompt for LLM:", promptForLLM);

  // Step 1: Ask LLM for task plan
  let tasks: any[] = [];
  try {
    tasks = await llmClient(promptForLLM);
  } catch (err) {
    console.error("[Orchestrator] LLM failed:", err);
    return [
      {
        success: false,
        message: "Failed to get plan from LLM",
        error: String(err),
      },
    ];
  }

  console.log("[Orchestrator] Task plan:", tasks);

  // Check if we should use chat agent instead
  if (shouldUseChatAgent(userPrompt, tasks)) {
    console.log("[Orchestrator] Using chat agent for informational query");

    const context: Record<string, any> = {
      figmaContext: buildFigmaContext(),
      frameId: null,
      userPrompt: userPrompt,
    };

    try {
      const chatResult = await runChatAgent({}, context);
      return [chatResult];
    } catch (err) {
      console.error("[Orchestrator] Chat agent failed:", err);
      return [
        {
          success: false,
          message: "Failed to get response from chat agent",
          error: String(err),
        },
      ];
    }
  }

  const results: AgentResponse[] = [];

  // Build initial figmaContext
  let context: Record<string, any> = {
    figmaContext: buildFigmaContext(),
    frameId: null,
    userPrompt: userPrompt, // Add the user prompt to context so agents can access it
  };

  // Step 2: Execute agents sequentially
  for (const task of tasks) {
    const { agent, params } = task;
    const runAgent = agentRegistry[agent];

    if (!runAgent) {
      console.warn(`[Orchestrator] Unknown agent: ${agent}`);
      results.push({ success: false, message: `Unknown agent: ${agent}` });
      continue;
    }

    try {
      const result = await runAgent(params, context);
      console.log("[Orchestrator] Sent to agent:", { params, context });

      if (result.success) {
        // Collect updated/created IDs
        const updatedIds = [
          ...(result.updatedNodes?.map((n) => n.id) || []),
          ...(result.createdNodes?.map((n) => n.id) || []),
        ];

        if (updatedIds.length > 0) {
          console.log(
            `[Orchestrator] Refreshing context with nodes: ${updatedIds.join(
              ", "
            )}`
          );

          // Get fresh context for the updated/created nodes
          const freshNodesContext = buildFigmaContext(updatedIds);

          // Properly merge the contexts - add new nodes to existing context
          // Merge allNodes mapping
          context.figmaContext.allNodes = {
            ...context.figmaContext.allNodes,
            ...freshNodesContext.allNodes,
          };

          // Merge arrays by combining and deduplicating
          const existingTextNodeIds = new Set(
            context.figmaContext.textNodes.map((n: any) => n.id)
          );
          const existingResizableNodeIds = new Set(
            context.figmaContext.resizableNodes.map((n: any) => n.id)
          );
          const existingContrastNodeIds = new Set(
            context.figmaContext.contrastCheckNodes.map((n: any) => n.id)
          );

          context.figmaContext.textNodes = [
            ...context.figmaContext.textNodes,
            ...freshNodesContext.textNodes.filter(
              (n: any) => !existingTextNodeIds.has(n.id)
            ),
          ];

          context.figmaContext.resizableNodes = [
            ...context.figmaContext.resizableNodes,
            ...freshNodesContext.resizableNodes.filter(
              (n: any) => !existingResizableNodeIds.has(n.id)
            ),
          ];

          context.figmaContext.contrastCheckNodes = [
            ...context.figmaContext.contrastCheckNodes,
            ...freshNodesContext.contrastCheckNodes.filter(
              (n: any) => !existingContrastNodeIds.has(n.id)
            ),
          ];

          console.log("[Orchestrator] Context updated with:", {
            totalNodes: Object.keys(context.figmaContext.allNodes).length,
            textNodes: context.figmaContext.textNodes.length,
            resizableNodes: context.figmaContext.resizableNodes.length,
            contrastCheckNodes: context.figmaContext.contrastCheckNodes.length,
          });
        }

        // Maintain change history
        if (!context.meta) context.meta = {};
        if (!context.meta.history) context.meta.history = [];
        context.meta.history.push({
          agent,
          changes: {
            updated: result.updatedNodes || [],
            created: result.createdNodes || [],
            deleted: result.deletedNodeIds || [],
            frame: result.frameData || null,
          },
        });
      }

      results.push(result);
    } catch (err) {
      console.error(`[Orchestrator] Error in agent "${agent}":`, err);
      results.push({ success: false, message: String(err) });
    }
  }

  console.log("[Orchestrator] Completed:", results);
  return results;
}
