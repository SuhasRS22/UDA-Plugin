export interface AgentResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  frameData?: any;
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
