# Product Forge AI

**From idea to buildable prototype in minutes, not months.**

Live: [product-forge-ai.netlify.app](https://product-forge-ai.netlify.app)

---

## The Problem This Solves

Every technology organization faces the same bottleneck: turning a product idea into something an engineering team can actually build. The journey from "I have an idea" to "here's a spec, a cost estimate, and a prototype" traditionally involves weeks of meetings, document drafts, stakeholder reviews, and back-and-forth between product managers, architects, and project managers.

A typical intake-to-estimate cycle looks like this:

1. **Someone has an idea** — described in an email, a Slack message, or a meeting
2. **A product manager refines it** — 1-2 weeks of interviews, competitive research, and scope definition
3. **A PM writes a PRD** — another 1-2 weeks of user stories, requirements gathering, and internal review
4. **An architect creates a tech spec** — 1-2 weeks of architecture decisions, data modeling, and API design
5. **A project manager estimates cost and timeline** — 1 week of spreadsheet work, rate cards, and risk analysis
6. **Someone briefs the dev team** — more meetings, more documents, more context lost in translation

That's **4-8 weeks** of skilled labor before a single line of code is written. And the output — a stack of documents — still needs to be interpreted by engineers who weren't in the room when decisions were made.

## What Product Forge Does

Product Forge AI compresses this entire pipeline into a **single interactive session**. You type your product idea in plain language, and the system walks you through seven stages — each powered by a specialized AI agent with deep domain expertise:

| Stage | Traditional Role | What the AI Does | Traditional Time |
|-------|-----------------|-------------------|-----------------|
| **Intake** | You | You describe your idea | — |
| **Refine** | Product Strategist | Structures the idea into a formal product definition with market context, competitive landscape, and success metrics — using real company names, real market data, and real benchmarks | 1-2 weeks |
| **PRD** | Product Owner | Generates a complete Product Requirements Document with user stories, functional requirements, non-functional requirements, and acceptance criteria | 1-2 weeks |
| **Tech Spec** | Solution Architect | Produces an architecture document with specific technology recommendations (versions, pricing tiers), data models, API designs, and security architecture | 1-2 weeks |
| **Estimate** | Project Manager | Creates a three-point cost estimate (optimistic/likely/pessimistic) with real salary data, real cloud pricing, phased timelines, and risk assessment | 1 week |
| **Prototype Prompt** | Tech Lead | Generates a comprehensive prompt for Claude Code that specifies exactly how to build a working prototype using Supabase and Netlify | New capability |
| **Build** | Developer | Provides the prompt with copy-to-clipboard and download, plus step-by-step instructions to execute it in Claude Code | New capability |

Every stage output can be **reviewed, manually edited, or revised with AI feedback** before advancing. When you edit a stage, downstream stages are marked stale so you know what needs regenerating.

## Time and Cost Impact

Conservative estimates based on typical enterprise product development:

- **Traditional pipeline**: 4-8 weeks, involving 3-5 specialized roles at $150-300/hr
- **With Product Forge**: 30-60 minutes of interactive refinement, plus human review time
- **Cost reduction**: The AI handles the first-draft labor that typically costs $20,000-$60,000 per product initiative
- **Quality baseline**: Every output follows a structured format grounded in real data — no synthetic statistics, no fake company names, every number cited to its source

The tool doesn't replace human judgment — it replaces the blank page. Product managers, architects, and PMs still review and refine every stage. But they're editing a substantive first draft instead of starting from scratch, and the entire team works from a single, consistent pipeline instead of a chain of handoffs.

## Who This Is For

- **Product managers** who need to evaluate ideas quickly and produce structured documentation
- **Engineering leaders** who want consistent, data-grounded estimates instead of gut-feel guesses
- **Innovation teams** who need to move from concept to prototype without a 6-week planning cycle
- **Consultants and agencies** who produce proposals, RFPs, and technical assessments for clients
- **Anyone** who has said "I have an idea for a product" and then spent months trying to get it specified

---

## Technical Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Single-page React 18 (UMD/CDN), Tailwind CSS, Babel standalone, Marked.js — no build step |
| **Backend** | Netlify Functions (TypeScript `.mts`) |
| **Database** | Supabase (PostgreSQL via Neon) |
| **AI** | Anthropic Claude API (Haiku 4.5 for all generation stages) |
| **PDF** | jsPDF + html2canvas (browser-side) |
| **Hosting** | Netlify |

### Project Structure

```
product-forge/
├── netlify.toml                    # Netlify config (publish dir, functions, headers)
├── static/
│   └── index.html                  # Entire frontend — React app, styles, all components
└── netlify/
    └── functions/
        ├── generate.mts            # AI generation endpoint (/api/generate)
        ├── pipeline.mts            # CRUD for pipeline runs (/api/pipeline)
        └── integrations.mts        # External integrations (/api/integrations)
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate` | POST | Generate AI content for a pipeline stage. Body: `{ stage, input_text }` |
| `/api/pipeline` | GET | List recent pipeline runs (last 20) |
| `/api/pipeline?id=<uuid>` | GET | Load a specific pipeline run |
| `/api/pipeline` | POST | Create a new pipeline run. Body: `{ intake }` |
| `/api/pipeline?id=<uuid>` | PATCH | Update a pipeline run with stage outputs |
| `/api/integrations` | GET | Check integration status (Wrike, WAVE, Jellyfish) |
| `/api/integrations` | POST | Push data to or pull data from an integration |

### Database Schema

**Table: `pipeline_runs`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `intake` | TEXT | Raw product idea (stage 1) |
| `refined` | TEXT | Refined product definition (stage 2) |
| `prd` | TEXT | Product Requirements Document (stage 3) |
| `tech_spec` | TEXT | Technical Specification (stage 4) |
| `estimate` | TEXT | Cost & Timeline Estimate (stage 5) |
| `proto_prompt` | TEXT | Claude Code build prompt (stage 6) |
| `build_status` | TEXT | Build stage status/timestamp (stage 7) |
| `current_stage` | INTEGER | Current pipeline stage (1-7) |
| `status` | TEXT | "in_progress" or "completed" |
| `created_at` | TIMESTAMPTZ | Auto-generated |
| `updated_at` | TIMESTAMPTZ | Updated on PATCH |

### AI System Prompts

Each stage uses a specialized system prompt with a shared **Research Directive** that enforces:

- **No synthetic data** — every statistic must come from real sources
- **No fake names** — only real companies, products, and frameworks
- **Inline citations** — `(Source: Gartner, 2024)` format
- **Competitive research** — reference real alternatives and market data
- **Dual perspective** — every stage includes a "Traditional vs. AI-Augmented" comparison
- **Uncertainty flagging** — unverified estimates marked with a warning

### Features

**Human-in-the-Loop Editing**
- **Edit Text** — directly edit the raw markdown of any stage output
- **Revise with AI** — provide feedback and the AI regenerates incorporating your changes
- **Regenerate** — re-run a stage fresh from its upstream input
- **Stale tracking** — editing a stage marks all downstream stages with amber indicators

**Export**
- **Print** — individual stages, full report, or formatted RFP document
- **PDF** — browser-side PDF generation for individual stages or full report
- **Copy/Download** — prototype prompt available as clipboard copy or `.md` file download

**Integrations**
- **Wrike** — push pipeline outputs as a Wrike project with tasks (stubbed, ready for API token)
- **McKinsey WAVE** — create WAVE initiatives with business cases and artifacts (stubbed)
- **Jellyfish** — pull real engineering allocation, delivery velocity, and productivity metrics to ground cost estimates in actual team data

**Pipeline Management**
- **Save/Load** — pipeline runs persist to Supabase, loadable from the sidebar
- **Progress tracking** — visual progress bar and stage indicators

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `JELLYFISH_API_TOKEN` | No | Jellyfish API token (contact api@jellyfish.co) |
| `JELLYFISH_BASE_URL` | No | Jellyfish API base URL (default: https://app.jellyfish.co) |
| `WRIKE_API_TOKEN` | No | Wrike OAuth2 token |
| `WRIKE_BASE_URL` | No | Wrike API URL (default: https://www.wrike.com/api/v4) |
| `WRIKE_FOLDER_ID` | No | Wrike parent folder for new projects |
| `WAVE_API_KEY` | No | McKinsey WAVE API key |
| `WAVE_BASE_URL` | No | WAVE API endpoint |

### Local Development

The frontend is a single HTML file with no build step. For local development:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Link to the Netlify site
netlify link --name product-forge-ai

# Run locally with Netlify Functions
netlify dev
```

Set environment variables in a `.env` file or via `netlify env:set`.

### Deployment

Push to GitHub and deploy via Netlify:

```bash
git push origin master
netlify deploy --prod
```

Or deploy directly from the Netlify dashboard by linking the GitHub repository.

---

Built with Claude Code.
