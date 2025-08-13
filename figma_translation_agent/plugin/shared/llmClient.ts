const GROQ_API_KEY =
  process.env.GROQ_API_KEY ||
  "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";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function llmClient(userPrompt: string): Promise<any[]> {
  console.log("[LLM] Prompt to Groq:", userPrompt);

  const systemPrompt = `You are a task planner for a Figma plugin. Analyze user requests and return a JSON array of tasks.

AVAILABLE AGENTS:
- resize: Changes dimensions of frames/elements
- translate: Translates text content to different languages  
- lorem/contentFiller: Fills empty text fields with dummy content
- contrastChecker: Analyzes and fixes color contrast issues

PARAMETER RULES:

RESIZE:
- Extract exact numbers: "1000x1000" → width: 1000, height: 1000
- Mobile: 375x812, Tablet: 768x1024, Desktop: 1440x900
- frameAction: "new" (creates copy) or "update" (modifies original)

TRANSLATE:
- Extract target language: "to spanish" → language: "spanish"
- frameAction: "update" (usually works on existing/new frame)

LOREM/CONTENTFILLER:
- type: "lorem", "realistic", "form"
- frameAction: "update"

CONTRASTCHECKER:
- mode: "check" (analyze only), "fix" (auto-fix), "suggest" (recommend changes)
- standard: "AA" (4.5:1 ratio), "AAA" (7:1 ratio)
- scope: "text" (text only), "all" (all elements), "backgrounds"
- autoFix: true (apply fixes), false (report only)
- minContrast: 4.5 (custom ratio)

RESPONSE FORMAT: JSON array only, no markdown, no explanation.

Examples:
User: "resize to 800x600 and translate to french"
[{"agent":"resize","params":{"width":800,"height":600,"frameAction":"new"}},{"agent":"translate","params":{"language":"french","frameAction":"update"}}]

User: "check color contrast"
[{"agent":"contrastChecker","params":{"mode":"check","standard":"AA","scope":"text"}}]

User: "fix accessibility issues"
[{"agent":"contrastChecker","params":{"mode":"fix","standard":"AA","scope":"all","autoFix":true}}]

User: "analyze contrast and suggest improvements"
[{"agent":"contrastChecker","params":{"mode":"suggest","standard":"AAA","scope":"text","autoFix":false}}]`;

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log("[LLM] Sending request to Groq...");

      const requestBody = {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
        top_p: 1,
        stream: false,
      };

      console.log("[LLM] Request body:", JSON.stringify(requestBody, null, 2));

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      console.log("[LLM] Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[LLM] API Error:", errorText);

        if (response.status === 429 && attempt < maxRetries - 1) {
          const retryAfter = response.headers.get("retry-after");
          const delayMs = retryAfter
            ? parseInt(retryAfter) * 1000
            : Math.pow(2, attempt) * 1000;
          console.warn(`[LLM] Rate limit. Retrying in ${delayMs}ms...`);
          await delay(delayMs);
          attempt++;
          continue;
        }

        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("[LLM] Raw response:", data);

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Invalid response structure from Groq API");
      }

      let content = data.choices[0].message.content;
      if (!content) {
        throw new Error("Empty content from Groq API");
      }

      content = content.trim();
      console.log("[LLM] Raw content:", content);

      // Clean up the response
      if (content.includes("```json")) {
        content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      }
      if (content.includes("```")) {
        content = content.replace(/```\s*/g, "");
      }

      // Remove any text before the JSON array
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }

      console.log("[LLM] Cleaned content:", content);

      try {
        const parsed = JSON.parse(content);
        console.log("[LLM] Parsed result:", parsed);

        if (!Array.isArray(parsed)) {
          console.warn("[LLM] Response is not an array, wrapping it");
          return [parsed];
        }

        return parsed;
      } catch (parseError) {
        console.error("[LLM] JSON parse error:", parseError);
        console.error("[LLM] Content that failed to parse:", content);

        // Fallback: try to extract valid JSON
        try {
          const fallbackMatch = content.match(/\{[^}]+\}/g);
          if (fallbackMatch) {
            const fallbackResult = fallbackMatch.map((match) =>
              JSON.parse(match)
            );
            console.log("[LLM] Fallback parse successful:", fallbackResult);
            return fallbackResult;
          }
        } catch (fallbackError) {
          console.error("[LLM] Fallback parse also failed:", fallbackError);
        }

        throw parseError;
      }
    } catch (error) {
      console.error(`[LLM] Attempt ${attempt + 1} failed:`, error);

      if (attempt === maxRetries - 1) {
        console.error("[LLM] All attempts failed, returning empty array");
        return [];
      }

      await delay(1000 * (attempt + 1));
      attempt++;
    }
  }

  return [];
}
