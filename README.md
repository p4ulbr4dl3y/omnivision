# omnivision

Fast, universal MCP server for multimodal image analysis using any vision LLM.

## Tools

- `analyze_image`: Analyze and describe single or multiple images (local files, URLs, base64 data URIs).
  - `image` *(string | string[], required)*: File path, URL, or base64 data URI.
  - `prompt` *(string, optional)*: Question or instruction (default: detailed description).

## Build

```bash
npm install
npm run build
```

## Config

```json
{
  "mcpServers": {
    "omnivision": {
      "command": "node",
      "args": ["/path/to/omnivision/dist/index.js"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```
