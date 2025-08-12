import { llmClient } from "../shared/llmClient";
import { runLoremIpsumAgent } from "../agents/contentFillerAgent";
import { runResizeAgent } from "../agents/resizeAgent";
import { AgentResponse } from "../utils/types";

export async function agentOrchestrator(
  contextPrompt: string
): Promise<AgentResponse[]> {
  console.log("[Orchestrator] Prompt received:", contextPrompt);

  const tasks = await llmClient(contextPrompt);
  console.log("[Orchestrator] Tasks to run:", tasks);

  const results: AgentResponse[] = [];

  for (const task of tasks) {
    const { agent, params } = task;

    try {
      let result: AgentResponse;

      if (agent === "lorem") {
        result = await runLoremIpsumAgent(params?.type || "paragraph");
      } else if (agent === "resize") {
        result = await runResizeAgent(
          (params && params?.width) || 800,
          (params && params?.height) || 600
        );
      } else {
        console.warn(`[Orchestrator] Unknown agent: ${agent}`);
        result = { success: false, message: `Unknown agent: ${agent}` };
      }

      results.push(result);
    } catch (error) {
      console.error(`[Orchestrator] Error running agent "${agent}":`, error);
      results.push({ success: false, message: String(error) });
    }
  }

  console.log("[Orchestrator] All tasks complete:", results);
  return results;
}
