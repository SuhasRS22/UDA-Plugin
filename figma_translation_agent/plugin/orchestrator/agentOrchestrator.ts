// agentOrchestrator.ts
import { llmClient } from "../shared/llmClient";
import { runLoremIpsumAgent } from "../agents/contentFillerAgent";
import { 
  resizeFromPrompt, 
  simpleResize, 
  resizeFrameWithText,
  smartResizeWithTextFitting,
  resizeToMobile, 
  resizeToTablet, 
  resizeToDesktop 
} from "../agents/resizeAgent";
import { AgentResponse } from "../utils/types";
// import { runContrastCheckerAgent } from "../agents/contrastAgent";

// Registry of all agents — no more hardcoding in logic
const agentRegistry: Record<
  string,
  (params: any, context: any) => Promise<AgentResponse>
> = {
  //   resize: async (params, context) =>
  //     runResizeAgent(
  //       params.width,
  //       params.height,
  //       params.frameAction,
  //       params.frameId || context.frameId
  //     ),
  //   translate: async (params, context) =>
  // translateAgent({ ...params, frameId: params.frameId || context.frameId }),
  lorem: async (params, context) =>
    runLoremIpsumAgent(
      params, context
    ),
  contentFiller: async (params, context) =>
    runLoremIpsumAgent(
      params, context
    ),
  //   contrastChecker: async (params, context) =>
  //     runContrastCheckerAgent({
  //       ...params,
  //       frameId: params.frameId || context.frameId,
  //     }),
};


export async function agentOrchestrator(
  combinedPrompt: any
): Promise<AgentResponse[]> {
  console.log("[Orchestrator] Starting with prompt:", combinedPrompt);

  try {
    // Extract user prompt
    const userPrompt = typeof combinedPrompt === "string" ? combinedPrompt : combinedPrompt?.userRequest || combinedPrompt;
    console.log("[Orchestrator] User prompt:", userPrompt);

    // Get tasks from LLM
    const tasks = await llmClient(userPrompt);
    console.log("[Orchestrator] Task plan:", tasks);

    const results: AgentResponse[] = [];

  for (const task of tasks) {
    const { agent = "lorem", params } = task;
    const runAgent = agentRegistry[agent];

    if (!runAgent) {
      console.warn(`[Orchestrator] Unknown agent: ${agent}`);
      results.push({ success: false, message: `Unknown agent: ${agent}` });
      continue;
    }

    try {
      console.log("details sent to agent:", { params, context });
      const result = await runAgent(params, context);

      // Merge returned data into shared context for next agent
      if (result.data) {
        context = { ...context, ...result.data };
      }

        results.push(result);
        console.log(`[Orchestrator] Agent "${agent}" completed:`, result);

      } catch (err) {
        console.error(`[Orchestrator] Error in agent "${agent}":`, err);
        results.push({ success: false, message: `Error in ${agent}: ${String(err)}` });
      }
    }

    console.log("[Orchestrator] All tasks completed:", results);
    return results;

  } catch (error) {
    console.error("[Orchestrator] Critical error:", error);
    return [{ success: false, message: `Orchestrator failed: ${String(error)}` }];
  }
}
