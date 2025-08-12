(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // shared/llmClient.ts
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function llmClient(userPrompt) {
    return __async(this, null, function* () {
      var _a, _b;
      console.log("[LLM] Sending prompt to Groq:", userPrompt);
      const systemPrompt = `
You are a task planner for a Figma plugin.

Available agents:
- lorem \u2192 fills empty/placeholder text with generated dummy text
- resize \u2192 resizes selected elements
- translate \u2192 translates text to different languages

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
          const response = yield fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${GROQ_API_KEY}`
              },
              body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userPrompt }
                ],
                temperature: 0
              })
            }
          );
          if (!response.ok) {
            if (response.status === 429) {
              const retryAfter = response.headers.get("retry-after");
              const delayMs = retryAfter ? parseInt(retryAfter) * 1e3 : Math.pow(2, attempt) * 1e3;
              console.log(
                `[LLM] Rate limited (429). Retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`
              );
              if (attempt < maxRetries - 1) {
                yield delay(delayMs);
                attempt++;
                continue;
              }
            }
            throw new Error(
              `Groq API error: ${response.status} - ${yield response.text()}`
            );
          }
          const data = yield response.json();
          let text = (_b = (_a = data.choices[0].message) == null ? void 0 : _a.content) == null ? void 0 : _b.trim();
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
            `[LLM] Error occurred, retrying... (attempt ${attempt + 1}/${maxRetries})`
          );
          yield delay(1e3 * (attempt + 1));
          attempt++;
        }
      }
      return [];
    });
  }
  var GROQ_API_KEY;
  var init_llmClient = __esm({
    "shared/llmClient.ts"() {
      GROQ_API_KEY = "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";
    }
  });

  // agents/contentFillerAgent.ts
  function runLoremIpsumAgent(type = "paragraph") {
    return __async(this, null, function* () {
      const selection = figma.currentPage.selection;
      let filledCount = 0;
      console.log(`Processing ${selection.length} selected items`);
      function processNode(node) {
        return __async(this, null, function* () {
          console.log(`Checking node: ${node.type}, name: ${node.name}`);
          if (node.type === "TEXT" && !node.locked) {
            const textNode = node;
            console.log(
              `Text content: "${textNode.characters}", length: ${textNode.characters.length}, locked: ${textNode.locked}`
            );
            const shouldFill = (textNode.characters === "" || textNode.characters.trim() === "" || textNode.characters === "Type something" || textNode.characters.startsWith("Lorem ipsum") || textNode.characters.length < 5) && !textNode.locked;
            if (shouldFill) {
              try {
                yield figma.loadFontAsync(textNode.fontName);
                const prompt = generatePrompt(type);
                const generatedText = yield llmClient(prompt);
                preserveAndSetText(textNode, generatedText);
                filledCount++;
                console.log(`Filled text node: ${textNode.name}`);
              } catch (error) {
                console.error(`Error filling text node: ${error}`);
              }
            } else {
              console.log(`Skipped text node (content: "${textNode.characters}")`);
            }
          } else if ("children" in node) {
            for (const child of node.children) {
              yield processNode(child);
            }
          }
        });
      }
      for (const node of selection) {
        yield processNode(node);
      }
      figma.notify(`\u2705 Filled ${filledCount} text layer(s).`);
      return {
        success: true,
        message: `Filled ${filledCount} text layer(s).`
      };
    });
  }
  function generatePrompt(type) {
    switch (type) {
      case "name":
        return "Give me a realistic human name.";
      case "email":
        return "Generate a dummy but realistic email address.";
      case "address":
        return "Generate a dummy street address.";
      case "product":
        return "Give a short fictional product name.";
      default:
        return "Write a realistic dummy paragraph for a UI mockup.";
    }
  }
  function preserveAndSetText(node, text) {
    const style = {
      fontSize: node.fontSize,
      fontName: node.fontName,
      textAlignHorizontal: node.textAlignHorizontal,
      textAlignVertical: node.textAlignVertical
    };
    node.characters = text;
    Object.assign(node, style);
  }
  var init_contentFillerAgent = __esm({
    "agents/contentFillerAgent.ts"() {
      init_llmClient();
    }
  });

  // agents/resizeAgent.ts
  function runResizeAgent(width, height) {
    return __async(this, null, function* () {
      const selection = figma.currentPage.selection;
      let resizedCount = 0;
      console.log(`[ResizeAgent] Processing ${selection.length} selected items`);
      function processNode(node) {
        return __async(this, null, function* () {
          console.log(
            `[ResizeAgent] Checking node: ${node.type}, name: ${node.name}`
          );
          if ("resize" in node && !node.locked) {
            try {
              node.resize(width, height);
              resizedCount++;
              console.log(`[ResizeAgent] Resized node: ${node.name}`);
            } catch (error) {
              console.error(`[ResizeAgent] Error resizing ${node.name}:`, error);
            }
          } else if ("children" in node) {
            for (const child of node.children) {
              yield processNode(child);
            }
          }
        });
      }
      for (const node of selection) {
        yield processNode(node);
      }
      figma.notify(`\u{1F4CF} Resized ${resizedCount} layer(s) to ${width}x${height}.`);
      return {
        success: true,
        message: `Resized ${resizedCount} layer(s) to ${width}x${height}.`
      };
    });
  }
  var init_resizeAgent = __esm({
    "agents/resizeAgent.ts"() {
    }
  });

  // orchestrator/agentOrchestrator.ts
  function agentOrchestrator(contextPrompt) {
    return __async(this, null, function* () {
      console.log("[Orchestrator] Prompt received:", contextPrompt);
      const tasks = yield llmClient(contextPrompt);
      console.log("[Orchestrator] Tasks to run:", tasks);
      const results = [];
      for (const task of tasks) {
        const { agent, params } = task;
        try {
          let result;
          if (agent === "lorem") {
            result = yield runLoremIpsumAgent((params == null ? void 0 : params.type) || "paragraph");
          } else if (agent === "resize") {
            result = yield runResizeAgent(
              params && (params == null ? void 0 : params.width) || 800,
              params && (params == null ? void 0 : params.height) || 600
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
    });
  }
  var init_agentOrchestrator = __esm({
    "orchestrator/agentOrchestrator.ts"() {
      init_llmClient();
      init_contentFillerAgent();
      init_resizeAgent();
    }
  });

  // code.ts
  var require_code = __commonJS({
    "code.ts"(exports) {
      init_agentOrchestrator();
      figma.showUI(__html__, { width: 400, height: 300 });
      function getAllNodesInFrame(node) {
        const allNodes = [node];
        if ("children" in node && node.children) {
          for (const child of node.children) {
            allNodes.push(...getAllNodesInFrame(child));
          }
        }
        return allNodes;
      }
      function extractNodeDetails(node) {
        const details = {
          id: node.id,
          name: node.name,
          type: node.type,
          width: "absoluteBoundingBox" in node && node.absoluteBoundingBox ? node.absoluteBoundingBox.width : void 0,
          height: "absoluteBoundingBox" in node && node.absoluteBoundingBox ? node.absoluteBoundingBox.height : void 0
        };
        if (node.type === "TEXT" && "characters" in node) {
          details.text = node.characters;
          details.fontSize = node.fontSize;
          details.fontFamily = node.fontName;
        }
        if (node.type === "RECTANGLE" || node.type === "ELLIPSE") {
          details.fills = "fills" in node ? node.fills : void 0;
        }
        if (node.type === "FRAME") {
          details.childrenCount = "children" in node ? node.children.length : 0;
        }
        return details;
      }
      figma.ui.onmessage = (msg) => __async(null, null, function* () {
        var _a, _b;
        if (msg.type === "run-prompt") {
          const { prompt } = msg;
          const selection = figma.currentPage.selection;
          if (selection.length === 0) {
            figma.notify("\u26A0\uFE0F Please select at least one node");
            return;
          }
          let allSelectedNodes = [];
          for (const selectedNode of selection) {
            if (selectedNode.type === "FRAME" || selectedNode.type === "GROUP" || selectedNode.type === "COMPONENT") {
              const nodesInContainer = getAllNodesInFrame(selectedNode);
              allSelectedNodes.push(...nodesInContainer);
              console.log(
                `[Plugin] Frame "${selectedNode.name}" contains ${nodesInContainer.length} nodes (including itself)`
              );
            } else {
              allSelectedNodes.push(selectedNode);
            }
          }
          allSelectedNodes = allSelectedNodes.filter(
            (node, index, array) => array.findIndex((n) => n.id === node.id) === index
          );
          console.log(`[Plugin] Total nodes to process: ${allSelectedNodes.length}`);
          const selectionDetails = allSelectedNodes.map(extractNodeDetails);
          const nodesByType = allSelectedNodes.reduce((acc, node) => {
            const type = node.type;
            if (!acc[type]) acc[type] = [];
            acc[type].push(node);
            return acc;
          }, {});
          console.log(
            "[Plugin] Nodes by type:",
            Object.keys(nodesByType).map(
              (type) => `${type}: ${nodesByType[type].length}`
            )
          );
          const contextInfo = {
            userRequest: prompt,
            totalNodes: allSelectedNodes.length,
            nodeTypes: Object.keys(nodesByType).map((type) => ({
              type,
              count: nodesByType[type].length
            })),
            textNodes: ((_a = nodesByType.TEXT) == null ? void 0 : _a.map((node) => ({
              id: node.id,
              name: node.name,
              text: node.characters
            }))) || [],
            frames: ((_b = nodesByType.FRAME) == null ? void 0 : _b.map((node) => ({
              id: node.id,
              name: node.name,
              childrenCount: "children" in node ? node.children.length : 0
            }))) || [],
            selectionDetails
          };
          const combinedPrompt = `User request: ${prompt}

Figma context:
- Total nodes selected: ${contextInfo.totalNodes}
- Node types: ${contextInfo.nodeTypes.map((nt) => `${nt.type} (${nt.count})`).join(", ")}
- Text nodes found: ${contextInfo.textNodes.length}
- Frames found: ${contextInfo.frames.length}

Selection details:
${JSON.stringify(contextInfo, null, 2)}`;
          console.log("[Plugin] Combined prompt:", combinedPrompt);
          try {
            figma.notify("\u{1F916} Processing your request...");
            const results = yield agentOrchestrator(combinedPrompt);
            figma.ui.postMessage({
              type: "orchestrator-results",
              results,
              nodeContext: contextInfo
            });
            figma.notify("\u2705 Request completed!");
          } catch (error) {
            console.error("[Plugin] Error during orchestration:", error);
            figma.notify("\u274C Something went wrong. Check console for details.");
            figma.ui.postMessage({
              type: "orchestrator-error",
              error: String(error)
            });
          }
        }
      });
    }
  });
  require_code();
})();
