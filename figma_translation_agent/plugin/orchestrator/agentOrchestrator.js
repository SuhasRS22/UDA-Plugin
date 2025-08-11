var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { askLLM } from "../shared/llmClient";
// TEMP: Minimal translation agent
function handleTranslation(frames, params) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            console.log("Running translation agent with params:", params);
            figma.notify("Translating to: ".concat(((_a = params.languages) === null || _a === void 0 ? void 0 : _a.join(", ")) || "Unknown"));
            return [2 /*return*/];
        });
    });
}
// Agent registry
var agentRegistry = {
    translation: handleTranslation,
    // resize: handleResize,
    // lorem: handleLoremIpsum,
    // contrast: handleContrast,
};
export function orchestrateAgents(userPrompt, selectedFrames) {
    return __awaiter(this, void 0, void 0, function () {
        var systemPrompt, llmResponse, tasks, _i, tasks_1, task, agentFn;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    systemPrompt = "\n    You are an orchestration engine for a Figma plugin.\n    Available agents: translation, resize, content filler, contrast.\n    Based on the user prompt, return ONLY a JSON array of tasks in the correct order.\n    Example output:\n    [\n      { \"agent\": \"translation\", \"params\": { \"languages\": [\"Finnish\", \"Spanish\"] } },\n      { \"agent\": \"resize\", \"params\": { \"width\": 1920, \"height\": 1080 } }\n    ]\n  ";
                    return [4 /*yield*/, askLLM(systemPrompt, JSON.stringify({
                            prompt: userPrompt,
                            frames: selectedFrames,
                        }))];
                case 1:
                    llmResponse = _a.sent();
                    try {
                        tasks = JSON.parse(llmResponse);
                    }
                    catch (err) {
                        console.error("Failed to parse LLM response:", llmResponse);
                        figma.notify("❌ Orchestration failed: invalid JSON from LLM");
                        return [2 /*return*/];
                    }
                    _i = 0, tasks_1 = tasks;
                    _a.label = 2;
                case 2:
                    if (!(_i < tasks_1.length)) return [3 /*break*/, 6];
                    task = tasks_1[_i];
                    agentFn = agentRegistry[task.agent];
                    if (!agentFn) return [3 /*break*/, 4];
                    return [4 /*yield*/, agentFn(selectedFrames, task.params || {})];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    console.warn("No registered agent for \"".concat(task.agent, "\""));
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 2];
                case 6: return [2 /*return*/];
            }
        });
    });
}
