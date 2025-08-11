export async function callLLM(prompt: string, context?: string): Promise<string> {
  try {
    // This would typically call your backend API
    // For now, returning a placeholder
    return "LLM response placeholder";
  } catch (error) {
    console.error("Error calling LLM:", error);
    throw error;
  }
}