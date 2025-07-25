/**
 * Tests for OllamaContentGenerator
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OllamaContentGenerator } from './ollamaContentGenerator.js';

globalThis.fetch = vi.fn();

describe('OllamaContentGenerator', () => {
  const model = 'llama2';
  const endpoint = 'http://localhost:11434';
  let generator: OllamaContentGenerator;

  beforeEach(() => {
    generator = new OllamaContentGenerator(model, endpoint);
    vi.clearAllMocks();
  });

  it('should generate content from Ollama', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Ollama says hi!' }),
    });
    const result = await generator.generateContent({ contents: [{ parts: [{ text: 'Hello?' }] }] });
    expect(result.candidates[0].content.parts[0].text).toBe('Ollama says hi!');
  });

  it('should throw on failed fetch', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 500 });
    await expect(
      generator.generateContent({ contents: [{ parts: [{ text: 'fail' }] }] })
    ).rejects.toThrow('Ollama API error: 500');
  });

  it('should estimate token count by word count', async () => {
    const result = await generator.countTokens({ contents: [{ parts: [{ text: 'one two three' }] }] });
    expect(result.totalTokens).toBe(3);
  });

  it('should return empty embeddings', async () => {
    const result = await generator.embedContent({});
    expect(result.embeddings).toEqual([]);
  });
});
