const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error(
    "[LLM] No GROQ_API_KEY found in environment variables. Please check your .env file."
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function llmClient(userPrompt: string): Promise<any[]> {
  console.log("[LLM] Prompt to Groq:", userPrompt);

  const systemPrompt = `You are a task planner for a Figma plugin. Analyze user requests and return a JSON array of tasks.
  Dont always rely on the rules mentioned below, just understand the nodes that are being passed and check the prompt and try to understand the context..
  you are actually intelligent , just understand what they want to do, users are dumb. there is no guarentee that they will use proper english.

AVAILABLE AGENTS:
- resize: Changes dimensions of frames/elements
- translate: Translates text content to different languages  
- lorem/contentFiller: Fills empty text fields with dummy content
- contrastChecker: Analyzes and fixes color contrast issues

WHEN TO USE EACH AGENT:

RESIZE AGENT - Use when user mentions:
- Specific dimensions: "800x600", "resize to 1000x500"
- Device sizes: "mobile", "tablet", "desktop"
- Size changes: "make bigger", "resize", "change size"

LOREM/CONTENTFILLER AGENT - Use when user wants to:
- Add text content: "add text", "fill with content", "add placeholder text"
- Add names: "add name", "add title", "add heading", "add indian names", "add fake names"
- Fill empty fields: "fill form", "add dummy data", "populate content"
- Add sample content: "lorem ipsum", "fake content", "test data"
- Replace/edit text: "change X to Y", "replace text", "update content"
- Text modifications: "change are you to am i", "replace hello with hi"
- Specific name types: "indian names", "american names", "company names"
- anything with adding or updating the text to the existing things 

TRANSLATE AGENT - Use when user mentions:
- Language changes: "translate to spanish", "convert to french"
- Language names: "spanish", "french", "german", etc.

CONTRASTCHECKER AGENT - Use when user mentions:
- Accessibility: "check contrast", "accessibility", "readable"
- Color issues: "fix colors", "contrast problems"

PARAMETER RULES:

RESIZE:
- Extract exact numbers: "1000x1000" → width: 1000, height: 1000
- Mobile: 375x812, Tablet: 768x1024, Desktop: 1440x900
- frameAction: "new" (creates copy) or "update" (modifies original)

TRANSLATE:
- Extract target language: "to spanish" → language: "spanish"
- frameAction: "update"

LOREM/CONTENTFILLER:
- type: "realistic" (names, titles), "lorem" (lorem ipsum), "form" (form fields), "replace" (text replacement)
- content: specific text to add or replacement instructions
- nameType: "indian", "american", "generic" (for name-specific requests)
- frameAction: "update"

CONTRASTCHECKER:
- mode: "check", "fix", "suggest"
- standard: "AA", "AAA"


RULES:
1. Return ONLY valid JSON array
2. No explanations or examples
3. Parse the user's exact request
4. For complex requests, use multiple agents

EXAMPLES:
- "change to mobile and add indian names" → [{"agent":"resize","params":{"width":375,"height":812,"frameAction":"new"}},{"agent":"contentFiller","params":{"type":"realistic","nameType":"indian","frameAction":"update"}}]
- "make it bigger and fill with content" → [{"agent":"resize","params":{"width":1200,"height":800,"frameAction":"update"}},{"agent":"contentFiller","params":{"type":"realistic","frameAction":"update"}}]

IMPORTANT: Return ONLY a valid JSON array. No explanations, no markdown, no extra text.


FORMAT:
[{"agent":"agentName","params":{...}}]
Examples:
[{"agent":"resize","params":{"width":800,"height":600,"frameAction":"new"}}]
[{"agent":"lorem","params":{"type":"realistic","frameAction":"update"}}]
[{"agent":"lorem","params":{"type":"replace","prompt":"change are you to am i","frameAction":"update"}}]
[{"agent":"translate","params":{"language":"spanish","frameAction":"update"}}]`;

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
        max_tokens: 500,
        top_p: 1,
        stream: false,
      };

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

      // Enhanced JSON cleaning
      content = cleanAndExtractJSON(content);

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

        // Enhanced fallback parsing
        const fallbackResult = tryFallbackParsing(content);
        if (fallbackResult.length > 0) {
          console.log("[LLM] Fallback parse successful:", fallbackResult);
          return fallbackResult;
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

// Enhanced JSON cleaning function
function cleanAndExtractJSON(content: string): string {
  // Remove markdown code blocks
  content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "");

  // Remove any leading/trailing text outside of JSON
  content = content.replace(/^[^[\{]*/, "").replace(/[^\}\]]*$/, "");

  // Find the JSON array or object - replace /s flag with [\s\S]*
  const arrayMatch = content.match(/\[[\s\S]*?\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  const objectMatch = content.match(/\{[\s\S]*?\}/);
  if (objectMatch) {
    return `[${objectMatch[0]}]`; // Wrap single object in array
  }

  return content;
}

// Enhanced fallback parsing function
function tryFallbackParsing(content: string): any[] {
  const results: any[] = [];

  try {
    // Try to find individual JSON objects
    const objectMatches = content.match(/\{[^}]*\}/g);
    if (objectMatches) {
      for (const match of objectMatches) {
        try {
          const parsed = JSON.parse(match);
          if (parsed.agent && parsed.params) {
            results.push(parsed);
          }
        } catch (e) {
          console.warn("[LLM] Skipping invalid object:", match);
        }
      }
    }

    // Try to manually construct from common patterns
    if (results.length === 0) {
      const manualResult = parseManually(content);
      if (manualResult) {
        results.push(manualResult);
      }
    }
  } catch (error) {
    console.error("[LLM] Fallback parsing failed:", error);
  }

  return results;
}

// Manual parsing for common patterns
function parseManually(content: string): any | null {
  try {
    // Look for agent and params patterns
    const agentMatch = content.match(/agent["']?\s*:\s*["']?(\w+)["']?/);
    const paramsMatch = content.match(/params["']?\s*:\s*({[^}]+})/);

    if (agentMatch && paramsMatch) {
      const agent = agentMatch[1];
      const paramsStr = paramsMatch[1];

      try {
        const params = JSON.parse(paramsStr);
        return { agent, params };
      } catch (e) {
        // Try to fix common JSON issues in params
        const fixedParams = paramsStr
          .replace(/(\w+):/g, '"$1":') // Add quotes to keys
          .replace(/:\s*(\w+)(?=[,}])/g, ':"$1"'); // Add quotes to string values

        try {
          const params = JSON.parse(fixedParams);
          return { agent, params };
        } catch (e2) {
          console.warn("[LLM] Could not fix params JSON");
        }
      }
    }
  } catch (error) {
    console.error("[LLM] Manual parsing failed:", error);
  }

  return null;
}

// Simple LLM client for direct text responses (not JSON)
export async function llmTextClient(userPrompt: string): Promise<string> {
  console.log("[LLM-Text] Prompt to Groq:", userPrompt);

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log("[LLM-Text] Sending request to Groq...");

      const requestBody = {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 150,
        top_p: 1,
        stream: false,
      };

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

      console.log("[LLM-Text] Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[LLM-Text] API Error:", errorText);

        if (response.status === 429 && attempt < maxRetries - 1) {
          const retryAfter = response.headers.get("retry-after");
          const delayMs = retryAfter
            ? parseInt(retryAfter) * 1000
            : Math.pow(2, attempt) * 1000;
          console.warn(`[LLM-Text] Rate limit. Retrying in ${delayMs}ms...`);
          await delay(delayMs);
          attempt++;
          continue;
        }

        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("[LLM-Text] Raw response:", data);

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Invalid response structure from Groq API");
      }

      let content = data.choices[0].message.content;
      if (!content) {
        throw new Error("Empty content from Groq API");
      }

      content = content.trim();
      console.log("[LLM-Text] Final content:", content);

      return content;
    } catch (error) {
      console.error(`[LLM-Text] Attempt ${attempt + 1} failed:`, error);

      if (attempt === maxRetries - 1) {
        console.error("[LLM-Text] All attempts failed, returning empty string");
        return "";
      }

      await delay(1000 * (attempt + 1));
      attempt++;
    }
  }

  return "";
}
