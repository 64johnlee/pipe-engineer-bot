# engineer-bot

> Auto-comment on GitHub & Linear issues based on what you're working on — powered by screenpipe screen context.

## What it does

Engineer Bot watches your screen and detects when you're viewing a GitHub issue or Linear ticket. It then reads your recent screen + audio activity to understand what you've been working on, and generates an intelligent comment draft.

**Comment types:**
- 📋 **Update** — general status update with next steps
- 🚀 **Progress** — what has been accomplished so far
- 🚧 **Blocker** — something is blocking you, ask for help
- ❓ **Question** — ask for clarification based on what you see
- ✅ **Done** — completion summary with follow-ups

**Two modes:**
- **Manual** — open the UI, click "Detect & Generate", review the comment, post it
- **Auto** — runs every 5 minutes, sends comment drafts to your screenpipe inbox

## Setup

1. Install the pipe in screenpipe
2. Add your credentials in screenpipe settings under `customSettings.engineerBot`:
   - `githubToken` — GitHub personal access token with `repo` scope
   - `linearApiKey` — Linear API key from Linear Settings > API
3. Open any GitHub issue or Linear ticket in your browser
4. Click "Detect & Generate" in the UI

## Tech

- Next.js 14 (App Router)
- `@screenpipe/js` SDK for screen + audio context
- Vercel AI SDK (`generateText`) for comment generation
- GitHub REST API for posting GitHub comments
- Linear GraphQL API for posting Linear comments
- Tailwind CSS

## Development

```bash
bun install
bun dev
```

Open http://localhost:3002
