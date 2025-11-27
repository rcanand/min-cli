/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GenerateContentResponse,
  FinishReason,
  type CountTokensParameters,
  type CountTokensResponse,
  type EmbedContentParameters,
  type EmbedContentResponse,
  type GenerateContentParameters,
  type Part,
} from '@google/genai';
import { Ollama } from 'ollama';
import type { ContentGenerator } from './contentGenerator.js';
import {
  geminiToOllamaRequest,
  ollamaToGeminiResponse,
  estimateTokenCount,
} from './ollamaAdapter.js';

export type OllamaConfig = {
  host?: string;
};

type PartWithText = Part & { text: string };

/**
 * ContentGenerator implementation that uses Ollama for local model inference
 */
export class OllamaContentGenerator implements ContentGenerator {
  private ollama: Ollama;

  constructor(config: OllamaConfig = {}) {
    this.ollama = new Ollama({
      host:
        config.host || process.env['OLLAMA_HOST'] || 'http://localhost:11434',
    });
  }

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const ollamaRequest = geminiToOllamaRequest(request);

    try {
      const response = await this.ollama.chat({
        ...ollamaRequest,
        stream: false,
      });
      return ollamaToGeminiResponse(response, request.model);
    } catch (error) {
      throw new Error(
        `Ollama API error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const ollamaRequest = geminiToOllamaRequest(request);
    const ollama = this.ollama;

    const generator =
      async function* (): AsyncGenerator<GenerateContentResponse> {
        try {
          const stream = await ollama.chat({
            ...ollamaRequest,
            stream: true,
          });

          let promptTokens = 0;
          let completionTokens = 0;

          for await (const chunk of stream) {
            // Update token counts if available
            if (chunk.prompt_eval_count !== undefined) {
              promptTokens = chunk.prompt_eval_count;
            }
            if (chunk.eval_count !== undefined) {
              completionTokens = chunk.eval_count;
            }

            // Yield a streaming response
            const responseData = {
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ text: chunk.message?.content || '' }],
                  },
                  finishReason: chunk.done
                    ? FinishReason.STOP
                    : FinishReason.OTHER,
                  index: 0,
                },
              ],
              usageMetadata:
                promptTokens > 0 || completionTokens > 0
                  ? {
                      promptTokenCount: promptTokens,
                      candidatesTokenCount: completionTokens,
                      totalTokenCount: promptTokens + completionTokens,
                    }
                  : undefined,
              modelVersion: request.model,
            };

            yield Object.setPrototypeOf(
              responseData,
              GenerateContentResponse.prototype,
            );

            if (chunk.done) {
              break;
            }
          }
        } catch (error) {
          throw new Error(
            `Ollama streaming error: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      };

    return generator();
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // Ollama doesn't have a native token counting API
    // We provide an estimate based on character count
    return estimateTokenCount(request);
  }

  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Extract text content from the request
    const contents = Array.isArray(request.contents)
      ? request.contents
      : [request.contents];

    const textContent = contents
      .flatMap((c: { parts?: Part[] }) => {
        const parts = c.parts || [];
        return parts
          .filter((p): p is PartWithText => 'text' in p)
          .map((p) => p.text);
      })
      .join(' ');

    try {
      const response = await this.ollama.embeddings({
        model: request.model,
        prompt: textContent,
      });

      return {
        embeddings: [
          {
            values: response.embedding,
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `Ollama embedding error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
