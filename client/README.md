# Orchestrator Client Webapp

A simple Node.js + React webapp for interactively testing all MCP Orchestrator API endpoints.

## Setup
1. Copy `.env.example` to `.env` and set your orchestrator server URL and API keys.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the backend proxy and React client:
   ```bash
   npm run dev
   ```

## Features
- Test `/`, `/register`, and `/message` endpoints
- Enter custom payloads and view JSON responses
- API key management via UI or .env

---
