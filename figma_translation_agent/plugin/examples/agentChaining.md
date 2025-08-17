# Agent Orchestration - Current Implementation

## Overview

The agent orchestrator manages sequential execution of agents with proper context passing and data merging. Each agent operates on the most current state of Figma nodes, with the orchestrator handling context refresh between agents.

## How It Works

### 1. AgentResponse Interface

Each agent returns a standardized `AgentResponse` structure:

```typescript
interface AgentResponse {
  success: boolean;
  message: string;
  updatedNodes?: NodeSnapshot[]; // Nodes that were modified
  createdNodes?: NodeSnapshot[]; // Nodes that were created
  deletedNodeIds?: string[]; // IDs of nodes that were deleted
  error?: string;
}
```

### 2. Context Management Flow

The orchestrator follows this pattern for each agent:

1. **Execute Agent**: Call agent with current context
2. **Collect Changes**: Extract `updatedNodes`, `createdNodes`, `deletedNodeIds`
3. **Refresh Context**: Call `buildFigmaContext(nodeIds)` to get fresh data from Figma
4. **Smart Merge**: Combine new nodes with existing context without duplicates
5. **Pass to Next**: Give updated context to subsequent agents

### 3. Context Structure

```typescript
let context = {
  figmaContext: {
    allNodes: Record<string, BaseNode>,      // Quick ID lookup
    textNodes: BaseNode[],                   // For content/translation agents
    resizableNodes: BaseNode[],              // For resize agent
    contrastCheckNodes: BaseNode[]           // For contrast checker
  },
  userPrompt: string,                        // Original user request
  frameId: string | null,
  meta: {
    history: [{                              // Track what each agent did
      agent: string,
      changes: {
        updated: NodeSnapshot[],
        created: NodeSnapshot[],
        deleted: string[]
      }
    }]
  }
};
```

### 4. Smart Context Merging

When agents return modified nodes, the orchestrator:

```typescript
// Get fresh data from Figma for modified nodes
const freshNodesContext = buildFigmaContext(updatedIds);

// Merge new nodes into existing context
context.figmaContext.allNodes = {
  ...context.figmaContext.allNodes,
  ...freshNodesContext.allNodes,
};

// Deduplicate and add to type-specific arrays
const existingTextNodeIds = new Set(
  context.figmaContext.textNodes.map((n) => n.id)
);
context.figmaContext.textNodes = [
  ...context.figmaContext.textNodes,
  ...freshNodesContext.textNodes.filter((n) => !existingTextNodeIds.has(n.id)),
];
```

## Updated Agents

### ResizeAgent

**Input**: Width, height parameters
**Behavior**:

- Creates new frame if no selection
- Resizes existing frame and scales content proportionally if frame selected
  **Output**: `createdNodes` (new frame) OR `updatedNodes` (resized frame)

```typescript
return {
  success: true,
  message: `Created new mobile frame with dimensions 375x667`,
  updatedNodes: [],
  createdNodes: [frameSnapshot],
  deletedNodeIds: [],
};
```

### ContentFillerAgent

**Input**: User prompt for content generation
**Behavior**:

- Finds selected frame or creates content in context frames
- Preserves frame selection after content creation
  **Output**: `updatedNodes` with created text nodes and container frame

```typescript
return {
  success: true,
  message: `Generated 5 content items`,
  updatedNodes: [...textNodeSnapshots, frameSnapshot],
  createdNodes: [],
  deletedNodeIds: [],
};
```

## Example Scenarios

### Scenario 1: "Create 300x300 frame and fill with Indian names"

1. **LLM Planning**: Parses request → `[{agent: "resize", params: {width: 300, height: 300}}, {agent: "contentFiller", params: {type: "names"}}]`
2. **Resize Agent**: Creates 300x300 frame → Returns `createdNodes: [newFrame]`
3. **Orchestrator**: Calls `buildFigmaContext([newFrame.id])` → Updates context with new frame
4. **Content Agent**: Receives context with new frame → Fills frame with Indian names → Returns `updatedNodes: [textNodes, frame]`

### Scenario 2: "Make selected frame mobile view"

1. **LLM Planning**: Detects resize request → `[{agent: "resize", params: {width: 375, height: 667}}]`
2. **Resize Agent**: Detects existing frame selection → Resizes frame and scales content → Returns `updatedNodes: [resizedFrame]`
3. **Orchestrator**: Updates context with resized frame data

## Key Benefits

1. **Fresh Data**: Always works with current Figma node state via `buildFigmaContext()`
2. **No Duplicates**: Smart merging prevents duplicate nodes in context arrays
3. **Type Safety**: Proper `NodeSnapshot` interface for consistent data structure
4. **Selection Preservation**: Agents maintain frame selection for user workflow
5. **Full Traceability**: Complete history of what each agent modified
6. **Context Continuity**: Each agent gets complete updated context from previous agents

## Implementation Details

### buildFigmaContext Function

```typescript
export function buildFigmaContext(nodeIds?: string[]): FigmaContext {
  if (nodeIds && nodeIds.length > 0) {
    // Get specific nodes and their children
    const specificNodes = nodeIds
      .map((id) => figma.getNodeById(id))
      .filter((n): n is BaseNode => n !== null);

    nodes = [];
    for (const node of specificNodes) {
      nodes.push(node);
      if ("children" in node) {
        const children = node.findAll(() => true);
        nodes.push(...children);
      }
    }
  } else {
    // Get currently selected nodes and their children
    const selectedNodes = figma.currentPage.selection;
    // ... process selection
  }
}
```

### Orchestrator Error Handling

```typescript
try {
  const result = await runAgent(params, context);
  if (result.success) {
    // Update context and continue
  }
  results.push(result);
} catch (err) {
  console.error(`[Orchestrator] Error in agent "${agent}":`, err);
  results.push({ success: false, message: String(err) });
}
```

This implementation ensures robust, sequential agent execution with proper data flow and error handling.
