const OPENAI_API_KEY =
  "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";

export async function llmClient(userPrompt: string): Promise<any> {
  console.log("[LLM] Sending prompt to OpenAI:", userPrompt);

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

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    let text = data.choices[0].message?.content?.trim();
    console.log("[LLM] Raw response:", text);

    // Remove markdown code blocks if present
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
    console.error("[LLM] API call failed:", error);
    return [];
  }
}
