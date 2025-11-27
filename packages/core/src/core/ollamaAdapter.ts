/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GenerateContentResponse,
  FinishReason,
  type GenerateContentParameters,
  type Content,
  type Part,
  type Candidate,
  type CountTokensParameters,
  type CountTokensResponse,
} from '@google/genai';
import type {
  ChatRequest,
  ChatResponse,
  Message as OllamaMessage,
  Tool as OllamaTool,
} from 'ollama';

type PartWithText = Part & { text: string };
type PartWithFunctionCall = Part & {
  functionCall: { name: string; args: unknown };
};
type PartWithFunctionResponse = Part & {
  functionResponse: unknown;
};

/**
 * Converts Gemini Content format to Ollama Message format
 */
export function contentToOllamaMessage(content: Content): OllamaMessage {
  const role = content.role === 'model' ? 'assistant' : content.role;
  const parts = content.parts || [];
  const textParts = parts
    .filter((p): p is PartWithText => 'text' in p)
    .map((p) => p.text);
  const content_text = textParts.join('\n');

  // Handle function calls
  const functionCallParts = parts.filter(
    (p): p is PartWithFunctionCall => 'functionCall' in p,
  );
  if (functionCallParts.length > 0) {
    const toolCalls = functionCallParts.map((p) => {
      const fc = p.functionCall;
      return {
        function: {
          name: fc.name,
          arguments: fc.args,
        },
      };
    });
    return {
      role,
      content: content_text,
      tool_calls: toolCalls,
    } as OllamaMessage;
  }

  // Handle function responses
  const functionResponseParts = parts.filter(
    (p): p is PartWithFunctionResponse => 'functionResponse' in p,
  );
  if (functionResponseParts.length > 0) {
    // Ollama expects tool responses in a specific format
    return {
      role: 'tool',
      content: JSON.stringify(
        functionResponseParts.map((p) => p.functionResponse),
      ),
    } as OllamaMessage;
  }

  return {
    role,
    content: content_text,
  } as OllamaMessage;
}

/**
 * Converts Gemini GenerateContentParameters to Ollama ChatRequest
 */
export function geminiToOllamaRequest(
  params: GenerateContentParameters,
): ChatRequest {
  const messages: OllamaMessage[] = [];

  // Add system instruction if present in config
  const config = params.config as {
    systemInstruction?: string | { parts?: Part[] };
    tools?: Array<{
      functionDeclarations?: Array<{
        name: string;
        description: string;
        parameters: unknown;
      }>;
    }>;
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
  };

  const systemInstruction = config?.systemInstruction;
  if (systemInstruction) {
    const systemContent =
      typeof systemInstruction === 'string'
        ? systemInstruction
        : systemInstruction.parts
            ?.filter((p): p is PartWithText => 'text' in p)
            .map((p) => p.text)
            .join('\n');

    if (systemContent) {
      messages.push({
        role: 'system',
        content: systemContent,
      });
    }
  }

  // Convert message history
  const contents = Array.isArray(params.contents)
    ? params.contents
    : [params.contents];
  for (const content of contents) {
    if (typeof content === 'string') {
      messages.push({
        role: 'user',
        content,
      });
    } else {
      messages.push(contentToOllamaMessage(content as Content));
    }
  }

  const request: ChatRequest = {
    model: params.model,
    messages,
    stream: false,
    options: {},
  };

  // Map config options
  if (params.config) {
    if (config.temperature !== undefined) {
      request.options!.temperature = config.temperature;
    }
    if (config.topP !== undefined) {
      request.options!.top_p = config.topP;
    }
    if (config.topK !== undefined) {
      request.options!.top_k = config.topK;
    }
    if (config.maxOutputTokens !== undefined) {
      request.options!.num_predict = config.maxOutputTokens;
    }

    // Convert tools/functions to Ollama format
    if (config.tools && config.tools.length > 0) {
      request.tools = config.tools.map((tool) => {
        const functionDeclaration = tool.functionDeclarations?.[0];
        if (functionDeclaration) {
          return {
            type: 'function',
            function: {
              name: functionDeclaration.name,
              description: functionDeclaration.description,
              parameters: functionDeclaration.parameters,
            },
          } as OllamaTool;
        }
        return tool as OllamaTool;
      });
    }
  }

  return request;
}

/**
 * Converts Ollama ChatResponse to Gemini GenerateContentResponse
 */
export function ollamaToGeminiResponse(
  response: ChatResponse,
  model: string,
): GenerateContentResponse {
  const parts: Part[] = [];

  // Add text content
  if (response.message.content) {
    parts.push({ text: response.message.content });
  }

  // Handle tool calls
  if (response.message.tool_calls && response.message.tool_calls.length > 0) {
    for (const toolCall of response.message.tool_calls) {
      parts.push({
        functionCall: {
          name: toolCall.function.name,
          args: toolCall.function.arguments,
        },
      } as Part);
    }
  }

  const candidate: Candidate = {
    content: {
      role: 'model',
      parts,
    },
    finishReason: response.done ? FinishReason.STOP : FinishReason.OTHER,
    index: 0,
  };

  // Map usage metadata if available
  const usageMetadata: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  } = {};
  if (response.prompt_eval_count !== undefined) {
    usageMetadata.promptTokenCount = response.prompt_eval_count;
  }
  if (response.eval_count !== undefined) {
    usageMetadata.candidatesTokenCount = response.eval_count;
  }
  if (
    response.prompt_eval_count !== undefined &&
    response.eval_count !== undefined
  ) {
    usageMetadata.totalTokenCount =
      response.prompt_eval_count + response.eval_count;
  }

  const responseData = {
    candidates: [candidate],
    usageMetadata:
      Object.keys(usageMetadata).length > 0 ? usageMetadata : undefined,
    modelVersion: model,
  };

  return Object.setPrototypeOf(responseData, GenerateContentResponse.prototype);
}

/**
 * Converts Gemini CountTokensParameters to a simple token count estimate
 * Note: Ollama doesn't have a direct token counting API, so we estimate
 */
export function estimateTokenCount(
  params: CountTokensParameters,
): CountTokensResponse {
  const contents = Array.isArray(params.contents)
    ? params.contents
    : [params.contents];

  let totalChars = 0;
  for (const content of contents) {
    if (typeof content === 'string') {
      totalChars += content.length;
    } else if (content && typeof content === 'object') {
      const contentObj = content as { parts?: Part[] };
      if ('parts' in contentObj && contentObj.parts) {
        const parts = contentObj.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (typeof part === 'string') {
              totalChars += part.length;
            } else if (part && typeof part === 'object' && 'text' in part) {
              const partWithText = part as PartWithText;
              totalChars += partWithText.text.length;
            }
          }
        }
      }
    }
  }

  // Rough estimate: ~4 characters per token
  const estimatedTokens = Math.ceil(totalChars / 4);

  return {
    totalTokens: estimatedTokens,
  };
}
