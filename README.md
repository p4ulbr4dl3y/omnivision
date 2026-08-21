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
        "SDK": "openai | anthropic | google",
        "BASE_URL": "optional-base-url",
        "DEFAULT_MODEL": "optional-model-name",
        "DEFAULT_MAX_TOKENS": "4096",
        "DEFAULT_SYSTEM_PROMPT": "optional-system-prompt"
      }
    }
  }
}
```

### Examples

#### OpenRouter (Auto-detected from `sk-or-` key)
```json
"env": {
  "API_KEY": "sk-or-v1-..."
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
  "API_KEY": "sk-ant-...",
  "DEFAULT_MODEL": "claude-3-5-sonnet-20241022"
}
```

#### Google Gemini
```json
"env": {
  "API_KEY": "AIzaSy...",
  "DEFAULT_MODEL": "gemini-1.5-flash"
}
```
