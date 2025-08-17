/** Minimal snapshot of a Figma node that agents return to the orchestrator. */
export interface NodeSnapshot {
  id: string; // required (orchestrator uses this to rebuild context)
  type: string; // e.g., "TEXT", "FRAME", "RECTANGLE", "INSTANCE"
  name?: string;
 
  // geometry / layout
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  parentId?: string;
 
  // text fields (for translate/content filler)
  characters?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  textAlignHorizontal?: string;
  textAlignVertical?: string;
  letterSpacing?: number;
  lineHeight?: number;
 
  // any agent-specific metadata you want to attach
  [key: string]: any;
}
 
/** What each agent must return. This aligns with agentOrchestrator.ts usage. */
export interface AgentResponse {
  success: boolean;
  message: string;
  error?: string;
  /** Optional agent identification for UI display purposes */
  agentType?: string;
  agentName?: string;
  response?: string; // Additional response content for display
  /** Modified nodes (can be many, e.g., multiple text children in a frame). */
  updatedNodes?: NodeSnapshot[];
 
  /** Newly created nodes/frames (can be many). */
  createdNodes?: NodeSnapshot[];
 
  /** Deleted nodes by ID. */
  deletedNodeIds?: string[];
 
  /**
   * Optional snapshot of the scene/context after this agent ran.
   * The orchestrator will often rebuild this via buildFigmaContext(),
   * but agents can include a snapshot if they already have it.
   */
  frameData?: FigmaContext;
}
 
/** Single task returned by the task planner (llmClient). */
export interface AgentTask {
  agent:
    | "resize"
    | "translate"
    | "lorem"
    | "contentFiller"
    | "contrastChecker"
    | string;
  params: Record<string, any>;
}
 
/** High-level counts & flags (optional, used by some agents/LLM prompt). */
export interface FigmaSummary {
  totalNodes?: number;
  nodeTypes?: Array<{ type: string; count: number }>;
  hasText?: boolean;
  hasFrames?: boolean;
  hasInstances?: boolean;
  hasShapes?: boolean;
  lastOperation?: string;
}
 
/** Optional text analysis info. */
export interface FigmaTextAnalysis {
  totalTextNodes?: number;
  totalCharacters?: number;
  languages?: string[];
  emptyTextFields?: number;
}
 
/** Optional layout analysis info. */
export interface FigmaLayoutAnalysis {
  totalFrames?: number;
  layoutModes?: string[];
  frameHierarchy?: Array<{
    id: string;
    name?: string;
    childrenCount?: number;
    layoutMode?: string;
  }>;
}
 
/**
 * Flexible context shape that supports both your older `nodes.*`-based agents
 * and any convenience subsets your builder provides.
 */
export interface FigmaContext {
  /** Legacy/agent-friendly groupings */
  nodes?: {
    all?: NodeSnapshot[];
    text?: NodeSnapshot[];
    frames?: NodeSnapshot[];
    instances?: NodeSnapshot[];
    shapes?: NodeSnapshot[];
    byType?: Record<string, NodeSnapshot[]>;
    [key: string]: any;
  };
 
  /** Optional summaries/analyses used in prompts or UI */
  summary?: FigmaSummary;
  textAnalysis?: FigmaTextAnalysis;
  layoutAnalysis?: FigmaLayoutAnalysis;
 
  /** Convenience subsets (if your buildFigmaContext returns them) */
  allNodes?: Record<string, NodeSnapshot>;
  textNodes?: NodeSnapshot[];
  resizableNodes?: NodeSnapshot[];
  contrastCheckNodes?: NodeSnapshot[];
 
  /** Optional stringified context for LLM prompts */
  figmaContextString?: string;
 
  /** Anything else you decide to stash */
  [key: string]: any;
}
 
export interface TranslationRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
}
 
export interface TranslationResponse {
  translatedText: string;
  confidence: number;
}