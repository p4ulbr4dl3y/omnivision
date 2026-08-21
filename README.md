# omnivision

Fast, universal MCP server for multimodal image analysis using any vision LLM.

## Tools

- `analyze_image`: Analyze and describe single or multiple images (local files, URLs, base64 data URIs).
  - `image` *(string | string[], required)*: File path, URL, or base64 data URI.
  - `prompt` *(string, optional)*: Question or instruction (default: detailed description).

## Config

```json
{
  "mcpServers": {
    "omnivision": {
      "command": "npx",
      "args": ["-y", "omnivision"],
      "env": {
        "API_KEY": "your-api-key",
        "DEFAULT_MODEL": "your-model-name",
        "SDK": "openai",
        "BASE_URL": "optional-base-url",
        "DEFAULT_MAX_TOKENS": "4096",
        "DEFAULT_SYSTEM_PROMPT": "You are an expert multimodal computer vision assistant...",
        "MAX_RETRIES": "3",
        "RETRY_DELAY_MS": "1000",
        "REQUEST_TIMEOUT_MS": "120000"
      }
    }
  }
}
```

### Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `DEFAULT_MODEL` | *(required)* | Model name (e.g. `gpt-4o`, `claude-3-5-sonnet-20241022`, `gemini-1.5-flash`, `llava`) |
| `API_KEY` | *(required\**)* | API key for LLM provider (*not required if `BASE_URL` is provided) |
| `SDK` | `openai` | SDK provider: `openai`, `anthropic`, `google` |
| `BASE_URL` | *(none)* | Custom base URL (e.g. `https://openrouter.ai/api/v1` or `http://localhost:11434/v1`) |
| `DEFAULT_MAX_TOKENS` | `4096` | Max output tokens |
| `DEFAULT_SYSTEM_PROMPT` | `"You are an expert multimodal computer vision assistant..."` | Default system prompt |
| `MAX_RETRIES` | `3` | Max retry attempts on transient errors (network, 5xx, 429, invalid JSON) |
| `RETRY_DELAY_MS` | `1000` | Initial exponential backoff delay in ms |
| `REQUEST_TIMEOUT_MS` | `120000` | Request timeout in ms (120s) |

### Examples

#### OpenRouter
```json
"env": {
  "API_KEY": "sk-or-v1-...",
  "BASE_URL": "https://openrouter.ai/api/v1",
  "DEFAULT_MODEL": "meta-llama/llama-3.2-11b-vision-instruct:free"
}
```

#### Ollama / Local Models (No API Key Required)
```json
"env": {
  "BASE_URL": "http://localhost:11434/v1",
  "DEFAULT_MODEL": "llava"
}
```

#### Anthropic Claude
```json
"env": {
  "SDK": "anthropic",
  "API_KEY": "sk-ant-...",
  "DEFAULT_MODEL": "claude-3-5-sonnet-20241022"
}
```

#### Google Gemini
```json
"env": {
  "SDK": "google",
  "API_KEY": "AIzaSy...",
  "DEFAULT_MODEL": "gemini-1.5-flash"
}
```
