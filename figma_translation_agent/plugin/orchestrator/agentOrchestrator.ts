// agentOrchestrator.ts
import { llmClient } from "../shared/llmClient";
import { runLoremIpsumAgent } from "../agents/contentFillerAgent";
import { runResizeAgent } from "../agents/resizeAgent";
// import translateAgent from "../agents/translationAgent";
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
  //   lorem: async (params, context) =>
  //     runLoremIpsumAgent({
  //       ...params,
  //       frameId: params.frameId || context.frameId,
  //     }),
  //   contentFiller: async (params, context) =>
  //     runLoremIpsumAgent({
  //       ...params,
  //       frameId: params.frameId || context.frameId,
  //     }),
  //   contrastChecker: async (params, context) =>
  //     runContrastCheckerAgent({
  //       ...params,
  //       frameId: params.frameId || context.frameId,
  //     }),
};

export async function agentOrchestrator(
  combinedPrompt: any
): Promise<AgentResponse[]> {
  // LLM decides the plan — sequence & parameters
  const userPrompt = combinedPrompt.userPrompt;
  console.log("[Orchestrator] Prompt:", userPrompt);

  // Send only userPrompt string to LLM
  const tasks = await llmClient(userPrompt);
  console.log("[Orchestrator] Task plan:", tasks);

  const results: AgentResponse[] = [];
  let context: Record<string, any> = {
    figmaContext: combinedPrompt,
    frameId: null,
  };

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
      console.log("details sent to agent:", { params, context });

      // Merge returned data into shared context for next agent
      if (result.data) {
        context = { ...context, ...result.data };
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
