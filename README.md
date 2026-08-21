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
        "PROVIDER": "openrouter | openai | anthropic | google | ollama | custom",
        "DEFAULT_MODEL": "optional-model-name",
        "BASE_URL": "optional-base-url",
        "DEFAULT_MAX_TOKENS": "4096",
        "DEFAULT_SYSTEM_PROMPT": "optional-system-prompt"
      }
    }
  }
}
```
