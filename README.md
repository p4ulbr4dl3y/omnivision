# omnivision

[![npm version](https://img.shields.io/npm/v/omnivision.svg)](https://www.npmjs.com/package/omnivision)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Universal, token-efficient MCP (Model Context Protocol) server for multimodal image analysis using any vision LLM (OpenRouter, OpenAI, Anthropic, Google Gemini, Ollama, or custom OpenAI-compatible endpoints).

## Quickstart (Recommended)

Add `omnivision` directly to your MCP client configuration using `npx`:

```json
{
  "mcpServers": {
    "omnivision": {
      "command": "npx",
      "args": ["-y", "omnivision"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

## Tools

### `analyze_image`
Analyzes, describes, or extracts structured information from one or multiple images.

**Parameters:**
- `image` *(string | string[], required)*: Local file path (`/path/to/image.png`), URL (`https://...`), or base64 data URI (`data:image/jpeg;base64,...`). Up to 10 images.
- `prompt` *(string, optional)*: Question or instruction (default: `"Describe this image in detail."`).

## Configuration & Providers

`omnivision` automatically detects your provider from your `API_KEY` or `DEFAULT_MODEL`, or you can set it explicitly via `PROVIDER`.

| Provider | `PROVIDER` | Default Model | Notes / Key Prefix |
|---|---|---|---|
| **OpenRouter** *(default)* | `openrouter` | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | Keys start with `sk-or-` |
| **OpenAI** | `openai` | `gpt-4o` | Keys start with `sk-` |
| **Anthropic** | `anthropic` | `claude-3-5-sonnet-20241022` | Keys start with `sk-ant-` |
| **Google Gemini** | `google` | `gemini-1.5-flash` | Keys start with `AIza` |
| **Ollama** | `ollama` | `llava` | `BASE_URL="http://localhost:11434/v1"` (no API key needed) |
| **Custom** | `custom` | `default` | Any OpenAI-compatible vision endpoint |

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `API_KEY` | API key for the chosen LLM provider | Required (except for Ollama) |
| `PROVIDER` | Provider name (`openrouter`, `openai`, `anthropic`, `google`, `ollama`, `custom`) | Auto-detected |
| `DEFAULT_MODEL` | Override default vision model | Provider default |
| `BASE_URL` | Custom API base URL | Provider default |
| `DEFAULT_MAX_TOKENS`| Maximum output tokens for response | `4096` |
| `DEFAULT_SYSTEM_PROMPT` | Custom system prompt for analysis | Built-in vision expert prompt |

### Example Configurations

#### OpenAI (GPT-4o)
```json
{
  "mcpServers": {
    "omnivision": {
      "command": "npx",
      "args": ["-y", "omnivision"],
      "env": {
        "PROVIDER": "openai",
        "API_KEY": "sk-...",
        "DEFAULT_MODEL": "gpt-4o"
      }
    }
  }
}
```

#### Anthropic (Claude 3.5 Sonnet)
```json
{
  "mcpServers": {
    "omnivision": {
      "command": "npx",
      "args": ["-y", "omnivision"],
      "env": {
        "PROVIDER": "anthropic",
        "API_KEY": "sk-ant-...",
        "DEFAULT_MODEL": "claude-3-5-sonnet-20241022"
      }
    }
  }
}
```

#### Google Gemini
```json
{
  "mcpServers": {
    "omnivision": {
      "command": "npx",
      "args": ["-y", "omnivision"],
      "env": {
        "PROVIDER": "google",
        "API_KEY": "AIzaSy...",
        "DEFAULT_MODEL": "gemini-1.5-flash"
      }
    }
  }
}
```

#### Local Ollama
```json
{
  "mcpServers": {
    "omnivision": {
      "command": "npx",
      "args": ["-y", "omnivision"],
      "env": {
        "PROVIDER": "ollama",
        "DEFAULT_MODEL": "llava",
        "BASE_URL": "http://localhost:11434/v1"
      }
    }
  }
}
```

## Local Development

```bash
git clone https://github.com/p4ulbr4dl3y/omnivision.git
cd omnivision
npm install
npm run build
npm test
```

## License

MIT
