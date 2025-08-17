import { AgentResponse } from "../utils/types";
import { llmTextClient } from "../shared/llmClient";
 
// WCAG contrast ratio calculation functions
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
 
function getContrastRatio(color1: RGB, color2: RGB): number {
  const lum1 = getLuminance(color1.r * 255, color1.g * 255, color1.b * 255);
  const lum2 = getLuminance(color2.r * 255, color2.g * 255, color2.b * 255);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}
 
function getRating(wcagAA: boolean, wcagAAA: boolean): "Fail" | "AA" | "AAA" {
  if (wcagAAA) return "AAA";
  if (wcagAA) return "AA";
  return "Fail";
}
 
function generateBetterColors(
  textColor: RGB,
  backgroundColor: RGB,
  targetRatio: number
): { newText?: RGB; newBackground?: RGB } {
  const currentRatio = getContrastRatio(textColor, backgroundColor);
 
  if (currentRatio >= targetRatio) {
    return {}; // Already meets requirements
  }
 
  // Try darkening text or lightening background
  const darkerText = {
    r: Math.max(0, textColor.r - 0.3),
    g: Math.max(0, textColor.g - 0.3),
    b: Math.max(0, textColor.b - 0.3),
  };
  const lighterBackground = {
    r: Math.min(1, backgroundColor.r + 0.3),
    g: Math.min(1, backgroundColor.g + 0.3),
    b: Math.min(1, backgroundColor.b + 0.3),
  };
 
  const ratioWithDarkerText = getContrastRatio(darkerText, backgroundColor);
  const ratioWithLighterBg = getContrastRatio(textColor, lighterBackground);
 
  if (ratioWithDarkerText >= targetRatio) {
    return { newText: darkerText };
  } else if (ratioWithLighterBg >= targetRatio) {
    return { newBackground: lighterBackground };
  }
 
  // If neither works, go to high contrast
  const luminance = getLuminance(
    backgroundColor.r * 255,
    backgroundColor.g * 255,
    backgroundColor.b * 255
  );
  if (luminance > 0.5) {
    // Light background, use dark text
    return { newText: { r: 0, g: 0, b: 0 } };
  } else {
    // Dark background, use light text
    return { newText: { r: 1, g: 1, b: 1 } };
  }
}
 
interface RGB {
  r: number;
  g: number;
  b: number;
}
 
interface ContrastResult {
  elementId: string;
  elementType: string;
  currentRatio: number;
  wcagAA: boolean;
  wcagAAA: boolean;
  apcaScore?: number;
  rating: "Fail" | "AA" | "AAA";
  textColor: RGB;
  backgroundColor: RGB;
  fontSize?: number;
  recommendations?: string[];
  actuallyFixed?: boolean;
}
 
export async function runContrastCheckerAgent(
  parameters: any,
  contextParams: any
): Promise<AgentResponse> {
  console.log("[ContrastAgent] CALLED with parameters:", parameters);
  console.log("[ContrastAgent] CALLED with contextParams:", contextParams);
 
  try {
    const {
      mode = "check",
      standard = "AA",
      targetNodes,
      visualFeedback = false,
      useAPCA = false,
    } = parameters;
 
    // Get figma context from contextParams
    const figmaContext = contextParams.figmaContext;
    const results: ContrastResult[] = [];
 
    // Get nodes to analyze from context data
    let nodesToCheck: any[] = [];
 
    console.log("[ContrastAgent] ===== DETAILED CONTEXT DEBUG =====");
    console.log(
      "[ContrastAgent] Raw figmaContext:",
      JSON.stringify(figmaContext, null, 2)
    );
    console.log("[ContrastAgent] figmaContext type:", typeof figmaContext);
    console.log(
      "[ContrastAgent] ContextParams keys:",
      contextParams ? Object.keys(contextParams) : "no contextParams"
    );
 
    if (figmaContext) {
      console.log(
        "[ContrastAgent] figmaContext keys:",
        Object.keys(figmaContext)
      );
      if (figmaContext.textNodes) {
        console.log(
          "[ContrastAgent] textNodes type:",
          typeof figmaContext.textNodes
        );
        console.log(
          "[ContrastAgent] textNodes length:",
          figmaContext.textNodes.length
        );
        console.log(
          "[ContrastAgent] first text node:",
          figmaContext.textNodes[0]
        );
      }
    }
 
    // Extract nodes from figmaContext data
    if (
      figmaContext &&
      figmaContext.textNodes &&
      Array.isArray(figmaContext.textNodes)
    ) {
      nodesToCheck = figmaContext.textNodes;
      console.log(
        `[ContrastAgent] Found ${nodesToCheck.length} text nodes in figmaContext data`
      );
    } else {
      console.log(
        `[ContrastAgent] No figmaContext data available for analysis`
      );
      return {
        success: false,
        message:
          "❌ No text nodes available for analysis. Please ensure you have text selected in Figma.",
        agentType: "contrast",
        agentName: "Contrast Checker Agent",
        response:
          "No text nodes found to analyze. Please select text elements and try again.",
        updatedNodes: [],
        createdNodes: [],
        deletedNodeIds: [],
      };
    }
 
    for (const node of nodesToCheck) {
      const isContextNode = !node.type;
      const nodeType = isContextNode ? node.nodeType || "TEXT" : node.type;
 
      console.log(
        `[ContrastAgent] Processing node: ${node.name} (type: ${nodeType}, isContext: ${isContextNode})`
      );
 
      if (nodeType === "TEXT") {
        let textNode = node;
        const textColor = extractTextColor(textNode);
        const backgroundColor = extractBackgroundColor(textNode);
        if (!textColor || !backgroundColor) {
          console.log(
            `[ContrastAgent] Could not extract colors for "${textNode.name}", skipping`
          );
          continue;
        }
        const ratio = getContrastRatio(textColor, backgroundColor);
        const fontSize =
          typeof textNode.fontSize === "number" ? textNode.fontSize : 16;
        const isLargeText =
          fontSize >= 18 ||
          (fontSize >= 14 &&
            textNode.fontWeight &&
            parseInt(textNode.fontWeight.toString()) >= 700);
        // WCAG requirements
        const aaRequirement = isLargeText ? 3 : 4.5;
        const aaaRequirement = isLargeText ? 4.5 : 7;
        const wcagAA = ratio >= aaRequirement;
        const wcagAAA = ratio >= aaaRequirement;
        const rating = getRating(wcagAA, wcagAAA);
        const result: ContrastResult = {
          elementId: textNode.name || `Text Element`,
          elementType: "TEXT",
          currentRatio: Math.round(ratio * 100) / 100,
          wcagAA,
          wcagAAA,
          rating,
          textColor,
          backgroundColor,
          fontSize,
          recommendations: [],
          actuallyFixed: false,
        };
        // Provide fix recommendations and apply actual fixes for failed contrast
        if (!(standard === "AAA" ? wcagAAA : wcagAA)) {
          const targetRequirement =
            standard === "AAA" ? aaaRequirement : aaRequirement;
          const fixedColors = generateBetterColors(
            textColor,
            backgroundColor,
            targetRequirement
          );
          if (fixedColors.newText || fixedColors.newBackground) {
            // Calculate what the new ratio would be
            const newTextColor = fixedColors.newText || textColor;
            const newBackgroundColor =
              fixedColors.newBackground || backgroundColor;
            const newRatio = getContrastRatio(newTextColor, newBackgroundColor);
            try {
              // Robust node lookup: by ID, by name in selection, by name in all text nodes, and by traversing parent/children
              let actualNode: TextNode | null = null;
              if (textNode.id) {
                try {
                  const foundNode = await figma.getNodeByIdAsync(textNode.id);
                  if (foundNode && foundNode.type === "TEXT") {
                    actualNode = foundNode as TextNode;
                  }
                } catch (e) {
                  console.log(
                    `[ContrastAgent] Could not find node by ID: ${textNode.id}`
                  );
                }
              }
              if (!actualNode) {
                const selection = figma.currentPage.selection;
                actualNode =
                  (selection.find(
                    (node) =>
                      node.type === "TEXT" && node.name === textNode.name
                  ) as TextNode | undefined) || null;
              }
              if (!actualNode) {
                const allTextNodes = figma.currentPage.findAll(
                  (node) => node.type === "TEXT"
                ) as TextNode[];
                actualNode =
                  allTextNodes.find((node) => node.name === textNode.name) ||
                  null;
              }
              // Traverse parent/children for even more robustness
              if (!actualNode && textNode.parent) {
                const parent = textNode.parent;
                if (parent && parent.findAll) {
                  const found = parent.findAll(
                    (n: any) => n.type === "TEXT" && n.name === textNode.name
                  );
                  if (found && found.length > 0)
                    actualNode = found[0] as TextNode;
                }
              }
              // Check node state: locked/hidden
              if (actualNode && !actualNode.locked && actualNode.visible) {
                console.log(`[ContrastAgent] [DEBUG] About to update node:`, {
                  id: actualNode.id,
                  name: actualNode.name,
                  type: actualNode.type,
                  locked: actualNode.locked,
                  visible: actualNode.visible,
                  parentId: actualNode.parent && actualNode.parent.id,
                  parentType: actualNode.parent && actualNode.parent.type,
                });
                await figma.loadFontAsync(actualNode.fontName as FontName);
                let fixed = false;
                // Apply text color fix if needed
                if (fixedColors.newText) {
                  try {
                    actualNode.fills = [
                      {
                        type: "SOLID",
                        color: fixedColors.newText,
                        opacity: 1,
                      },
                    ];
                    fixed = true;
                    console.log(
                      `[ContrastAgent] ✅ Applied new text color to "${actualNode.name}" (id: ${actualNode.id})`
                    );
                  } catch (err) {
                    console.error(
                      `[ContrastAgent] ❌ Failed to apply text color to "${actualNode.name}" (id: ${actualNode.id}):`,
                      err
                    );
                  }
                }
                // Apply background color fix if needed (if parent is RECTANGLE/FRAME/other shape)
                if (
                  fixedColors.newBackground &&
                  actualNode.parent &&
                  (actualNode.parent.type === "RECTANGLE" ||
                    actualNode.parent.type === "FRAME")
                ) {
                  const parentNode = actualNode.parent as any;
                  if (parentNode.fills && Array.isArray(parentNode.fills)) {
                    try {
                      parentNode.fills = [
                        {
                          type: "SOLID",
                          color: fixedColors.newBackground,
                          opacity: 1,
                        },
                      ];
                      fixed = true;
                      console.log(
                        `[ContrastAgent] ✅ Applied new background color to parent of "${actualNode.name}" (parent id: ${parentNode.id})`
                      );
                    } catch (err) {
                      console.error(
                        `[ContrastAgent] ❌ Failed to apply background color to parent of "${actualNode.name}" (parent id: ${parentNode.id}):`,
                        err
                      );
                    }
                  }
                }
                // After applying, re-calculate the contrast
                const finalRatio = getContrastRatio(
                  fixedColors.newText || textColor,
                  fixedColors.newBackground || backgroundColor
                );
                result.currentRatio = Math.round(finalRatio * 100) / 100;
                result.wcagAA = finalRatio >= aaRequirement;
                result.wcagAAA = finalRatio >= aaaRequirement;
                result.rating = getRating(result.wcagAA, result.wcagAAA);
                result.textColor = fixedColors.newText || textColor;
                result.backgroundColor =
                  fixedColors.newBackground || backgroundColor;
                if (
                  fixed &&
                  (standard === "AAA" ? result.wcagAAA : result.wcagAA)
                ) {
                  result.actuallyFixed = true;
                  result.recommendations?.push(
                    `🔧 APPLIED: Colors updated to achieve ${result.currentRatio}:1 ratio`
                  );
                  console.log(
                    `[ContrastAgent] [DEBUG] Node update successful and contrast now meets WCAG.`
                  );
                } else if (fixed) {
                  result.recommendations?.push(
                    `⚠️ FIX APPLIED BUT CONTRAST STILL INSUFFICIENT: ${result.currentRatio}:1`
                  );
                  console.log(
                    `[ContrastAgent] [DEBUG] Node update applied but contrast still insufficient.`
                  );
                } else {
                  console.log(
                    `[ContrastAgent] [DEBUG] No update was actually applied to node: ${actualNode.id}`
                  );
                }
              } else if (
                actualNode &&
                (actualNode.locked || !actualNode.visible)
              ) {
                result.recommendations?.push(
                  `⚠️ NODE LOCKED OR HIDDEN: Could not apply fix to "${textNode.name}"`
                );
              } else {
                // Fallback to recommendations if node not found
                if (fixedColors.newText) {
                  const rgbText = `rgb(${Math.round(
                    fixedColors.newText.r * 255
                  )}, ${Math.round(fixedColors.newText.g * 255)}, ${Math.round(
                    fixedColors.newText.b * 255
                  )})`;
                  result.recommendations?.push(
                    `🎨 RECOMMENDED TEXT COLOR: ${rgbText}`
                  );
                }
                if (fixedColors.newBackground) {
                  const rgbBg = `rgb(${Math.round(
                    fixedColors.newBackground.r * 255
                  )}, ${Math.round(
                    fixedColors.newBackground.g * 255
                  )}, ${Math.round(fixedColors.newBackground.b * 255)})`;
                  result.recommendations?.push(
                    `🎨 RECOMMENDED BACKGROUND COLOR: ${rgbBg}`
                  );
                }
                result.recommendations?.push(
                  `📈 EXPECTED RATIO: ${
                    Math.round(newRatio * 100) / 100
                  }:1 (meets WCAG ${standard})`
                );
                result.recommendations?.push(
                  `⚠️ NODE NOT FOUND: Could not automatically apply fix - please apply manually`
                );
              }
            } catch (error) {
              console.error(
                `[ContrastAgent] Error applying fix to "${textNode.name}":`,
                error
              );
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              result.recommendations?.push(`❌ FIX FAILED: ${errorMessage}`);
            }
          } else {
            result.recommendations?.push(
              `⚠️ COMPLEX CASE: Consider using high contrast colors (black text on white background or vice versa)`
            );
          }
        }
        results.push(result);
      }
    }
 
    // Calculate original failure count before any fixes were applied
    const totalChecked = results.length;
    const originalFailCount = results.filter(
      (r) => r.recommendations && r.recommendations.length > 0
    ).length; // Elements that had issues
    const currentPassCount = results.filter((r) =>
      standard === "AAA" ? r.wcagAAA : r.wcagAA
    ).length;
    const currentFailCount = totalChecked - currentPassCount;
    const appliedFixCount = results.filter((r) => r.actuallyFixed).length;
    const needsManualFixCount = results.filter((r) =>
      r.recommendations?.some(
        (rec) =>
          rec.includes("🎨 RECOMMENDED") || rec.includes("⚠️ NODE NOT FOUND")
      )
    ).length;
 
    let message = `🔍 Enhanced Contrast Analysis Complete:\n`;
    message += `• Analyzed: ${totalChecked} text elements\n`;
    message += `• ✅ Passed WCAG ${standard}: ${currentPassCount}\n`;
    message += `• ❌ Originally Failed: ${originalFailCount}\n`;
    if (appliedFixCount > 0) {
      message += `• 🔧 Auto-Fixed: ${appliedFixCount} elements\n`;
      // Cluster log of auto-fixed elements
      const autoFixed = results.filter((r) => r.actuallyFixed);
      if (autoFixed.length > 0) {
        message += `\n🔧 Auto-Fixed Elements:\n`;
        autoFixed.forEach((r) => {
          // Try to extract the before/after ratio from recommendations if possible
          const appliedRec = r.recommendations?.find((rec) =>
            rec.includes("🔧 APPLIED")
          );
          let beforeRatio = "";
          if (appliedRec) {
            // Try to extract the previous ratio from the recommendation string if present
            // (If not present, fallback to just showing the new ratio)
            beforeRatio = "";
          }
          // For now, just show the new ratio
          message += `• ${r.elementId} (now ${r.currentRatio}:1)\n`;
        });
      }
    }
    if (currentFailCount > 0) {
      message += `• ❌ Still Failed: ${currentFailCount}\n`;
    }
    if (needsManualFixCount > 0) {
      message += `• 🎨 Needs Manual Fix: ${needsManualFixCount} elements\n`;
    }
 
    // Add detailed results list
    if (totalChecked > 0) {
      message += `\n📊 Detailed Results:\n`;
      results.forEach((r) => {
        const status = (standard === "AAA" ? r.wcagAAA : r.wcagAA)
          ? "✅"
          : "❌";
        // Only show indicators for failed elements that need manual fixes
        const needsManualFix =
          !(standard === "AAA" ? r.wcagAAA : r.wcagAA) &&
          r.recommendations?.some(
            (rec) =>
              rec.includes("🎨 RECOMMENDED") ||
              rec.includes("⚠️ NODE NOT FOUND")
          );
        const indicator = needsManualFix ? " 🎨" : "";
        message += `${status} ${r.elementId}: ${r.currentRatio}:1${indicator}\n`;
      });
    }
 
    // Add recommendations for failed elements
    if (currentFailCount > 0 || needsManualFixCount > 0) {
      message += `\n🎨 Color Recommendations:\n`;
      results
        .filter(
          (r) =>
            !(standard === "AAA" ? r.wcagAAA : r.wcagAA) ||
            r.recommendations?.some((rec) => rec.includes("🎨 RECOMMENDED"))
        )
        .forEach((r) => {
          message += `\n• ${r.elementId}:\n`;
          if (r.recommendations && r.recommendations.length > 0) {
            r.recommendations.forEach((rec) => {
              message += `  ${rec}\n`;
            });
          }
        });
    }
 
    // Generate detailed response for UI output field using LLM enhancement
    const responseContent = await generateLLMContrastReport(results, {
      totalChecked,
      passCount: currentPassCount,
      originalFailCount,
      currentFailCount,
      appliedFixCount,
      standard,
    });
 
    return {
      success: true,
      message,
      agentType: "contrast",
      agentName: "Contrast Checker Agent",
      response: responseContent,
      updatedNodes: [], // Could be populated if we implement auto-fixing
      createdNodes: [],
      deletedNodeIds: [],
    };
  } catch (error) {
    console.error("[ContrastAgent] Error:", error);
    return {
      success: false,
      message: `Contrast check failed: ${error}`,
      agentType: "contrast",
      agentName: "Contrast Checker Agent",
      response: `Error during contrast analysis: ${error}`,
      updatedNodes: [],
      createdNodes: [],
      deletedNodeIds: [],
    };
  }
}
 
function extractTextColor(textNode: any): RGB | null {
  console.log("[ContrastAgent] Extracting color from node:", {
    name: textNode.name,
    hasFills: !!textNode.fills,
    hasTextFills: !!textNode.textFills,
    nodeType: textNode.type || textNode.nodeType,
  });
 
  // Handle context nodes with textFills
  if (
    textNode.textFills &&
    Array.isArray(textNode.textFills) &&
    textNode.textFills.length > 0
  ) {
    const fill = textNode.textFills[0];
    if (fill.type === "SOLID" && fill.color) {
      console.log("[ContrastAgent] Found textFills color:", fill.color);
      return {
        r: fill.color.r,
        g: fill.color.g,
        b: fill.color.b,
      };
    }
  }
 
  // Handle regular Figma nodes with fills
  if (
    textNode.fills &&
    Array.isArray(textNode.fills) &&
    textNode.fills.length > 0
  ) {
    const fill = textNode.fills[0];
    if (fill.type === "SOLID" && fill.color) {
      console.log("[ContrastAgent] Found fills color:", fill.color);
      return {
        r: fill.color.r,
        g: fill.color.g,
        b: fill.color.b,
      };
    }
  }
 
  console.log("[ContrastAgent] No text color found, using default black");
  return { r: 0, g: 0, b: 0 }; // Default to black text
}
 
function extractBackgroundColor(textNode: any): RGB | null {
  console.log("[ContrastAgent] Extracting background color from node:", {
    name: textNode.name,
    hasBackgroundFills: !!textNode.backgroundFills,
    hasBackground: !!textNode.background,
  });
 
  // Handle context nodes with backgroundFills
  if (
    textNode.backgroundFills &&
    Array.isArray(textNode.backgroundFills) &&
    textNode.backgroundFills.length > 0
  ) {
    const fill = textNode.backgroundFills[0];
    if (fill.type === "SOLID" && fill.color) {
      console.log("[ContrastAgent] Found backgroundFills color:", fill.color);
      return {
        r: fill.color.r,
        g: fill.color.g,
        b: fill.color.b,
      };
    }
  }
 
  // Handle context nodes with background property
  if (textNode.background && textNode.background.color) {
    console.log(
      "[ContrastAgent] Found background color:",
      textNode.background.color
    );
    return {
      r: textNode.background.color.r,
      g: textNode.background.color.g,
      b: textNode.background.color.b,
    };
  }
 
  console.log("[ContrastAgent] No background color found, using default white");
  return { r: 1, g: 1, b: 1 }; // Default to white background
}
 
// Enhanced LLM-powered contrast report generator
async function generateLLMContrastReport(
  results: ContrastResult[],
  summary: any
): Promise<string> {
  const {
    totalChecked,
    passCount,
    originalFailCount,
    currentFailCount,
    appliedFixCount,
    standard,
  } = summary;
 
  // Prepare detailed data for LLM analysis
  const analysisData = {
    summary: {
      totalChecked,
      passCount,
      failCount: currentFailCount,
      appliedFixCount,
      standard,
      successRate: totalChecked > 0 ? ((passCount / totalChecked) * 100).toFixed(1) : 0
    },
    elements: results.map((result, index) => ({
      id: result.elementId || `Element ${index + 1}`,
      type: result.elementType,
      ratio: result.currentRatio.toFixed(2),
      wcagAA: result.wcagAA,
      wcagAAA: result.wcagAAA,
      rating: result.rating,
      fontSize: result.fontSize,
      textColorRGB: `rgb(${Math.round(result.textColor.r * 255)}, ${Math.round(result.textColor.g * 255)}, ${Math.round(result.textColor.b * 255)})`,
      backgroundColorRGB: `rgb(${Math.round(result.backgroundColor.r * 255)}, ${Math.round(result.backgroundColor.g * 255)}, ${Math.round(result.backgroundColor.b * 255)})`,
      recommendations: result.recommendations || []
    }))
  };
 
  const prompt = `You are a web accessibility expert specializing in WCAG contrast compliance. Analyze the following contrast check results and provide a comprehensive, actionable report in HTML format.
 
CONTRAST ANALYSIS DATA:
${JSON.stringify(analysisData, null, 2)}
 
REQUIREMENTS:
1. Create a professional HTML report with proper structure and styling
2. Provide expert insights beyond the raw numbers
3. Give specific, actionable recommendations for failing elements
4. Explain accessibility impact for users with visual impairments
5. Include priority levels for fixes (Critical, High, Medium, Low)
6. Suggest specific color adjustments when possible
7. Keep tone professional but approachable
 
RESPONSE FORMAT:
- Use HTML with inline CSS for styling
- Include proper headings, lists, and emphasis
- Use emojis sparingly but effectively
- Color-code results (green for pass, yellow for warnings, red for failures)
- Make it visually scannable with good typography
- Include a summary section and detailed breakdown
 
HTML STRUCTURE EXAMPLE:
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
  <h3 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">🎯 Accessibility Contrast Report</h3>
  [Your detailed analysis here]
</div>
 
Provide the complete HTML report:`;
 
  try {
    const llmResponse = await llmTextClient(prompt);
    return llmResponse.trim();
  } catch (error) {
    console.error("[ContrastAgent] LLM analysis failed:", error);
    // Fallback to basic report if LLM fails
    return generateBasicContrastReport(results, summary);
  }
}
 
// Fallback basic report generator (original functionality)
function generateBasicContrastReport(
  results: ContrastResult[],
  summary: any
): string {
  const {
    totalChecked,
    passCount,
    originalFailCount,
    currentFailCount,
    appliedFixCount,
    standard,
  } = summary;
 
  let report = `<h4>🎯 Contrast Analysis Complete</h4>`;
  report += `<p><strong>Standard:</strong> WCAG ${standard}</p>`;
  report += `<p><strong>Elements Checked:</strong> ${totalChecked}</p>`;
  report += `<p><strong>Passed:</strong> ${passCount} • <strong>Failed:</strong> ${currentFailCount}</p>`;
 
  if (appliedFixCount > 0) {
    report += `<p><strong>Auto-Fixed:</strong> ${appliedFixCount}</p>`;
  }
 
  if (results.length > 0) {
    report += `<h4>📊 Detailed Results:</h4>`;
    report += `<ul>`;
 
    results.slice(0, 5).forEach((result, index) => {
      const status = result.wcagAA
        ? result.wcagAAA
          ? "✅ AAA"
          : "✅ AA"
        : "❌ Fail";
      report += `<li><strong>${
        result.elementId || `Element ${index + 1}`
      }:</strong> ${status} (Ratio: ${result.currentRatio.toFixed(2)})</li>`;
    });
 
    if (results.length > 5) {
      report += `<li><em>... and ${results.length - 5} more elements</em></li>`;
    }
 
    report += `</ul>`;
  }
 
  return report;
}