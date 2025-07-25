/**
 * OllamaContentGenerator: Implements ContentGenerator for local Ollama models
 */

// Minimal local type definitions for compatibility
export interface GenerateContentParameters {
  contents?: Array<{ parts?: Array<{ text?: string }> }>;
}
export interface GenerateContentResponse {
  candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
}
export interface CountTokensParameters {
  contents?: Array<{ parts?: Array<{ text?: string }> }>;
}
export interface CountTokensResponse {
  totalTokens: number;
}
export interface EmbedContentParameters {}
export interface EmbedContentResponse {
  embeddings: any[];
}

import type { ContentGenerator } from '../core/contentGenerator.js';

export class OllamaContentGenerator implements ContentGenerator {
  userTier?: import('../code_assist/types.js').UserTierId;
  private model: string;
  private endpoint: string;

  constructor(model: string, endpoint: string = 'http://localhost:11434') {
    this.model = model;
    this.endpoint = endpoint;
  }

  async generateContent(request: GenerateContentParameters): Promise<GenerateContentResponse> {
    // Only supports basic text generation for now
    const prompt = request.contents?.[0]?.parts?.[0]?.text ?? '';
    const res = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt }),
    });
    if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);
    const data = await res.json();
    return {
      candidates: [{ content: { parts: [{ text: data.response }] } }],
    };
  }

  async generateContentStream(request: GenerateContentParameters): Promise<AsyncGenerator<GenerateContentResponse>> {
    // Not implemented: fallback to single response
    const response = await this.generateContent(request);
    async function* gen() { yield response; }
    return gen();
  }

  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    // Ollama does not provide token counting; return length as a proxy
    const text = request.contents?.[0]?.parts?.[0]?.text ?? '';
    return { totalTokens: text.split(' ').length };
  }

  async embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse> {
    // Ollama does not support embeddings; return empty
    return { embeddings: [] };
  }
}
