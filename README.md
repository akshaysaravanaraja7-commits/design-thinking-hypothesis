# HYPOTHESIS — AI Investigation & Evidence-Based Reasoning Engine

> **Better questions. Clearer evidence. Smarter reasoning.**

HYPOTHESIS is an evidence-first AI investigation workspace. Rather than returning an opaque chatbot reply, HYPOTHESIS decomposes complex questions into competing hypotheses, gathers independent web sources in parallel, classifies claims into **Known**, **Inferred**, and **Speculative**, surfaces **contradictions** across sources, and lets humans stay in control.

---

## Core Investigation Workflow

```
Question
  → Research Plan & Sub-questions
  → Competing Hypotheses
  → Parallel Multi-Query Web Search (SearchProvider abstraction)
  → Deduplication & Authority Ranking
  → Structured Evidence & Claim Extraction (JSON Schema)
  → Contradiction Detection & Uncertainty Audit
  → Interactive Research Tree + Investigation Graph + Evidence Inspector
  → Streamed Conversational Conclusion with Inline Citations
```

## Key Features

- **Natural Conversational Research Partner**: Direct, non-robotic synthesis with streaming Server-Sent Events (SSE) and clickable inline citations (`[1]`, `[2]`).
- **Research Tree**: Interactive hierarchy from Root Question → Competing Hypotheses → Supporting & Challenging Claims → Linked Sources.
- **Investigation Graph**: Interactive SVG relationship canvas visualizing `SUPPORTS`, `CONTRADICTS`, `DERIVED_FROM`, and `RELATED_TO` links with zoom, filtering, and click-to-inspect nodes.
- **Evidence Inspector & Transparent Source Quality**: Classifies every claim (`Known`, `Inferred`, `Speculative`) with confidence, reasoning, uncertainty, and multi-factor source quality explanations (no opaque arbitrary trust scores).
- **Contradiction Detection**: Side-by-side `Source A` vs `Source B` disagreement analysis with possible methodological, dataset, or timeframe reasons.
- **Human Control**: Add or remove custom hypotheses, challenge specific claims, request opposing evidence, hunt for primary sources, regenerate conclusions, or stop generation at any time.
- **Demo Investigation**: Includes a pre-seeded, clearly labeled `DEMO / ILLUSTRATIVE` case (*"Why does Model X fail on Dataset Y?"*) so every feature can be explored immediately without configuration.
- **Persistent History & Dual Theme**: Searchable recent/saved investigations persisted on disk, plus Light and Dark modes (`Cmd/Ctrl + Shift + L`).

---

## Architecture & Runtime Modes

This repository provides **two aligned backend implementations** sharing the exact same REST & SSE API contract:

1. **Live Node.js + Express + Vite Full-Stack Runtime (Root directory — Active in AI Studio Preview)**
   - Runs immediately on port `3000` (`npm run dev` / `tsx server.ts`).
   - Uses `@google/genai` (`gemini-4-hydrogen`) strictly server-side (`process.env.GEMINI_API_KEY`).
   - Implements the pluggable `SearchProvider` layer (`server/search/searchProvider.ts`):
     - Default: **Parallel Gemini Google Search Grounding** (runs multiple investigative queries concurrently and extracts only genuinely returned web citations).
     - Optional external search providers via env vars: `google_cse`, `tavily`, `brave`.
     - If live search is unavailable, explicitly notifies the user and never fabricates URLs.
   - Persists investigations atomically to `./data/investigations.json` behind a replaceable `InvestigationRepository` interface.

2. **Java 21 + Spring Boot 3.3 + Maven Backend (`/backend/`)**
   - Production reference backend structured with `controller/`, `service/`, `repository/`, `model/`, `search/`, and `ai/` packages.
   - Uses Spring Web, Spring Data JPA (PostgreSQL in production via `docker-compose.yml`, H2 locally), Bean Validation, virtual-thread async parallel search (`CompletableFuture`), and `SseEmitter` streaming.
   - *(Note: The AI Studio container runs Node.js without a JDK/Maven toolchain, so the live preview executes via `server.ts` while `/backend/` provides the complete Java Spring Boot codebase ready to build with `mvn spring-boot:run`.)*

---

## Environment Variables

Copy `.env.example` to `.env` (never commit real secrets):

```bash
GEMINI_API_KEY=          # Required server-side Gemini API key
SEARCH_PROVIDER=         # gemini_grounding (default), google_cse, tavily, or brave
SEARCH_API_KEY=          # Required when using google_cse, tavily, or brave
SEARCH_ENGINE_ID=        # Required only when SEARCH_PROVIDER=google_cse
DATABASE_URL=            # PostgreSQL JDBC URL for Spring Boot deployment
APP_URL=                 # Public base URL
```

---

## Running Locally

### Frontend + Node/Express Full-Stack (Port 3000)

```bash
npm install
npm run dev
```

Run unit tests and production build:

```bash
npm test
npm run lint
npm run build
```

### Java Spring Boot + PostgreSQL (Optional Local / Production)

```bash
docker compose up --build
```

Or run the Spring Boot backend directly with Java 21 + Maven:

```bash
cd backend
mvn spring-boot:run
```

---

## REST & SSE API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/investigations` | List recent & saved investigation summaries |
| `POST` | `/api/investigations` | Create a new investigation |
| `GET` | `/api/investigations/:id` | Retrieve complete investigation state |
| `PATCH` | `/api/investigations/:id` | Toggle saved status or rename |
| `DELETE` | `/api/investigations/:id` | Delete an investigation |
| `POST` | `/api/investigations/:id/research` | Stream multi-source investigation progress & conclusion (SSE) |
| `POST` | `/api/investigations/:id/message` | Stream context-aware conversational follow-up (SSE) |
| `POST` | `/api/investigations/:id/hypotheses` | Add a user-proposed hypothesis |
| `DELETE` | `/api/investigations/:id/hypotheses/:hypothesisId` | Remove a hypothesis |
| `POST` | `/api/investigations/:id/challenge` | Challenge a specific claim and search opposing evidence (SSE) |
| `POST` | `/api/investigations/:id/deeper` | Investigate deeper / primary sources / opposing evidence (SSE) |
| `GET` | `/api/investigations/:id/graph` | Fetch investigation graph nodes and relationships |
| `GET` | `/api/investigations/:id/sources` | Fetch retrieved sources and quality metadata |
| `GET` | `/api/investigations/:id/claims` | Fetch extracted claims and contradictions |

---

## Security & Anti-Hallucination Safeguards

- **Server-Side Secrets Only**: `GEMINI_API_KEY` and `SEARCH_API_KEY` never enter frontend JavaScript bundles.
- **Anti-Hallucination Grounding**: The backend validates every AI-extracted claim and contradiction against the exact set of retrieved source IDs, strips phantom citations, and downgrades unsupported `"Known"` claims automatically.
- **Safe URL & Prose Rendering**: External URLs are strictly validated for `http:` / `https:` schemes only, and conversational Markdown is rendered through a pure React AST renderer with zero `dangerouslySetInnerHTML`.
- **Input Validation & Rate Limiting**: All REST endpoints validate identifier formats, cap payload sizes, apply sliding-window rate limits, and return human-friendly error messages without exposing stack traces.
