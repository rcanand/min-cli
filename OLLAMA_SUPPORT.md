# Ollama Support

This fork of gemini-cli has been enhanced to support Ollama local models
alongside the existing Gemini integration.

## Prerequisites

1. **Install Ollama**: Download and install Ollama from
   [ollama.ai](https://ollama.ai)
2. **Pull a model**: Run `ollama pull llama3.2` (or any other supported model)
3. **Start Ollama server**: Ollama typically runs on `http://localhost:11434` by
   default

## Configuration

To use Ollama with this CLI, you need to configure the authentication type to
use Ollama.

### Environment Variables

Set the following environment variable to configure Ollama:

```bash
# Optional: Set custom Ollama host (defaults to http://localhost:11434)
export OLLAMA_HOST=http://localhost:11434
```

### Using Ollama

To use Ollama, you'll need to pass the Ollama auth type when starting the CLI.
The exact method depends on how the CLI is configured, but typically you would:

1. Set the auth type to `ollama` in your configuration
2. Specify the model you want to use (e.g., `llama3.2`, `llama3.1`, `mistral`,
   `codellama`, `deepseek-coder`)

## Supported Models

The following Ollama models have been pre-configured:

- `llama3.2` - Latest Llama 3.2 model (default)
- `llama3.1` - Llama 3.1 model
- `mistral` - Mistral model
- `codellama` - Code-specialized Llama model
- `deepseek-coder` - DeepSeek Coder model

You can use any model available in Ollama by specifying its name.

## How It Works

### Architecture

The Ollama integration is implemented through:

1. **OllamaContentGenerator**
   (`packages/core/src/core/ollamaContentGenerator.ts`): Implements the
   `ContentGenerator` interface to interact with Ollama's API
2. **Ollama Adapter** (`packages/core/src/core/ollamaAdapter.ts`): Converts
   between Gemini's request/response format and Ollama's format
3. **Auth Type**: New `USE_OLLAMA` authentication type in the configuration
   system

### Request Flow

1. User input → Gemini `GenerateContentParameters` format
2. Adapter converts to Ollama `ChatRequest` format
3. Ollama API processes the request
4. Response is converted back to Gemini `GenerateContentResponse` format
5. Response is returned to the user

### Features Supported

- ✅ Text generation (streaming and non-streaming)
- ✅ Chat conversations with history
- ✅ System instructions
- ✅ Tool/function calling (basic support)
- ✅ Token counting (estimated)
- ✅ Embeddings
- ✅ Temperature, top_p, top_k parameters
- ✅ Max output tokens configuration

## Examples

### Basic Usage

```bash
# Start Ollama server (if not already running)
ollama serve

# Pull a model
ollama pull llama3.2

# Use the CLI with Ollama
# (specific command depends on CLI implementation)
```

### Using Different Models

```bash
# Use Mistral
# --model mistral

# Use CodeLlama for coding tasks
# --model codellama

# Use DeepSeek Coder
# --model deepseek-coder
```

## Configuration

Model-specific configurations can be found in
`packages/core/src/config/defaultModelConfigs.ts`. All Ollama models extend the
`ollama-base` configuration which sets reasonable defaults:

- Temperature: 0.8
- Top P: 0.9
- Top K: 40

## Limitations

1. **Token Counting**: Ollama doesn't provide a native token counting API, so
   token counts are estimated based on character count (approximately 4
   characters per token)
2. **Tool Calling**: Basic tool/function calling support is provided, but may
   differ from Gemini's implementation
3. **Embeddings**: Uses Ollama's embedding API, which may have different
   characteristics than Gemini's embeddings

## Troubleshooting

### Connection Issues

If you encounter connection errors:

1. Verify Ollama is running: `ollama list`
2. Check the Ollama host: `echo $OLLAMA_HOST`
3. Test Ollama directly: `ollama run llama3.2 "Hello"`

### Model Not Found

If you get a "model not found" error:

1. List available models: `ollama list`
2. Pull the model: `ollama pull <model-name>`

### Performance Issues

For better performance:

1. Use smaller models like `llama3.2` for faster responses
2. Use specialized models like `codellama` for code generation
3. Ensure Ollama has sufficient system resources (RAM, CPU/GPU)

## Development

To extend Ollama support:

1. **Add new models**: Update `packages/core/src/config/models.ts` and
   `defaultModelConfigs.ts`
2. **Modify adapter**: Edit `packages/core/src/core/ollamaAdapter.ts` to handle
   additional Ollama features
3. **Update generator**: Modify
   `packages/core/src/core/ollamaContentGenerator.ts` for new capabilities

## Switching Between Gemini and Ollama

This implementation preserves full Gemini functionality. You can switch between
Gemini and Ollama by changing the auth type configuration:

- For Gemini: Use `gemini-api-key`, `vertex-ai`, or `oauth-personal` auth types
- For Ollama: Use `ollama` auth type

Both integrations can coexist in the same installation.
