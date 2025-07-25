# OllamaContentGenerator

This module enables Gemini CLI to use local models via [Ollama](https://ollama.com/).

## Usage

1. **Start Ollama locally**
   ```bash
   ollama serve
   ```
2. **Pull a model**
   ```bash
   ollama pull llama2
   ```
3. **Configure Gemini CLI**
   In your config (e.g., `settings.json`):
   ```json
   {
     "model": "ollama:llama2"
   }
   ```
   Or via CLI:
   ```bash
   gemini --model ollama:llama2
   ```
4. **Run the CLI**
   All queries will use the specified Ollama model.

## Implementation
- Implements the `ContentGenerator` interface.
- Uses Ollama's HTTP API (`http://localhost:11434`).
- Supports basic text generation.
- Token counting is estimated by word count.
- Embeddings are not supported (returns empty array).

## Advanced
- You can override the Ollama endpoint by setting the `proxy` config property.
- Model switching is supported at runtime.

## Example
```typescript
import { OllamaContentGenerator } from './ollamaContentGenerator.js';
const ollama = new OllamaContentGenerator('llama2');
const result = await ollama.generateContent({ contents: [{ parts: [{ text: 'Hello!' }] }] });
console.log(result.candidates[0].content.parts[0].text);
```

## References
- [Ollama API docs](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli)
