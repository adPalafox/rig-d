# Rig D Agent

Rig D Agent is a live `1v1` web MVP where players coach flawed AI stick-fighter agents through a debate duel and try to force an upset. The point is not drafting the strongest bot. The point is making a weaker bot outperform expectation.

## Value Prop

Rig D Agent turns AI usage into a competitive game:

- Players prove skill by coaching, not by owning the best model.
- Weak-agent wins create the clip-worthy moment.
- The reveal makes overperformance legible through `Rig Score`.

## Current MVP

This repository currently ships a playable prototype with:

- Next.js web app
- private room creation and invite-code join flow
- anonymous cookie-based player sessions
- one synchronous mode: `Debate Duel`
- four archetypes: `Bruiser`, `Gremlin`, `Scholar`, `Showman`
- 60-second structured coaching phase
- three debate turns per side: `opening`, `rebuttal`, `closing`
- automated judging and reveal screen
- `Rig Score` and rubric-style scoring breakdown
- rematch support
- deterministic local arena engine by default
- optional OpenAI-backed generation and judging when configured

## Tech Notes

- Frontend and API are built with `Next.js`.
- State is currently stored in-process in memory for zero-infra local play.
- Match progress is updated by client polling rather than a realtime transport layer.
- The current API and domain model are structured so Postgres, Supabase Realtime, and a dedicated worker can replace the in-memory prototype later.

## Getting Started

### Requirements

- Node.js `24+`
- npm `11+`

### Install

```bash
npm install
```

### Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run tests

```bash
npm test
```

### Production build

```bash
npm run build
```

## Optional OpenAI Mode

If no API key is present, the app uses the built-in local arena engine so the MVP stays fully playable.

To enable server-side OpenAI generation and judging, create `.env.local`:

```bash
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4.1-mini
```

Notes:

- Keys are server-side only.
- Player-supplied API keys are not part of the current MVP.
- The local mode remains the default fallback if OpenAI is not configured or unavailable.

## Project Structure

Key areas in the current codebase:

- [app](/Users/adreanpalafox/Developer/rig_d/app): routes, pages, API handlers
- [components](/Users/adreanpalafox/Developer/rig_d/components): client UI and visual components
- [lib](/Users/adreanpalafox/Developer/rig_d/lib): game content, state engine, validation, session helpers
- [test](/Users/adreanpalafox/Developer/rig_d/test): MVP logic tests

## Roadmap Direction

The current repo is intentionally narrow. Likely next steps are:

- move state from memory to Postgres
- replace polling with realtime room updates
- add persistence for replays and match history
- harden the judge path and retries
- add richer matchmaking and moderation primitives

## Contributing

Contributions are welcome.

If you want to contribute:

1. Open an issue for substantial feature work or architecture changes before implementing them.
2. Keep pull requests focused and small enough to review cleanly.
3. Preserve the core product rule: player coaching must matter more than raw model strength.
4. Add or update tests when changing the match engine, scoring, or API behavior.
5. Verify the project with:

```bash
npm test
npm run build
```

Contribution guidelines for this stage:

- Prefer incremental improvements over broad rewrites.
- Do not introduce paid services or infrastructure assumptions into the default local flow.
- Keep the mock arena engine working even when adding provider-backed features.

## License

This project is licensed under the MIT License. That includes commercial use, private use, modification, and distribution. See [LICENSE](/Users/adreanpalafox/Developer/rig_d/LICENSE).
