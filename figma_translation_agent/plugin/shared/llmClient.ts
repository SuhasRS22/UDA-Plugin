const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const GROQ_API_KEY = "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";
// const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function llmClient(userPrompt: string): Promise<any> {
  console.log("[LLM] Sending prompt to Groq:", userPrompt);

  const systemPrompt = `
You are a task planner for a Figma plugin.

Available agents:
- lorem → fills empty/placeholder text with generated dummy text
- resize → resizes selected elements
- translate → translates text to different languages

Respond with ONLY a JSON array of tasks, no markdown formatting.
Each task should look like:
{ "agent": "<name>", "params": { ... } }

Example response:
[{"agent": "resize", "params": {"width": 100, "height": 100}}]
  `;

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get("retry-after");
          const delayMs = retryAfter
            ? parseInt(retryAfter) * 1000
            : Math.pow(2, attempt) * 1000;

          console.log(
            `[LLM] Rate limited (429). Retrying in ${delayMs}ms... (attempt ${
              attempt + 1
            }/${maxRetries})`
          );

          if (attempt < maxRetries - 1) {
            await delay(delayMs);
            attempt++;
            continue;
          }
        }
        throw new Error(
          `Groq API error: ${response.status} - ${await response.text()}`
        );
      }

      const data = await response.json();
      let text = data.choices[0].message?.content?.trim();
      console.log("[LLM] Raw response:", text);

      if (text && text.includes("```")) {
        text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
        console.log("[LLM] Cleaned response:", text);
      }

      try {
        return JSON.parse(text || "[]");
      } catch (error) {
        console.error("[LLM] Failed to parse JSON:", error);
        console.error("[LLM] Problematic text:", text);
        return [];
      }
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error("[LLM] API call failed after all retries:", error);
        return [];
      }

      console.log(
        `[LLM] Error occurred, retrying... (attempt ${
          attempt + 1
        }/${maxRetries})`
      );
      await delay(1000 * (attempt + 1));
      attempt++;
    }
  }

  return [];
}
