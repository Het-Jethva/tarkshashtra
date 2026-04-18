# Complaint Triage Backend

Production-ready TypeScript backend for AI-powered complaint classification, priority tagging, SLA tracking, and reporting.

## Stack

- Express + TypeScript
- Postgres + Drizzle ORM
- DigitalOcean Gradient AI Platform Serverless Inference (single LLM call for triage)
- Node cron for SLA scans

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start Postgres with Docker:

   ```bash
   docker compose up -d
   ```

3. Create env file:

   ```bash
   copy .env.example .env
   ```

4. Set `GRADIENT_MODEL_ACCESS_KEY` in `.env`.

   Optional tuning:

   - `GRADIENT_MODEL` (default: `llama3.3-70b-instruct`)
   - `GRADIENT_TIMEOUT_MS` (default: `15000`)
   - `GRADIENT_BASE_URL` (default: `https://inference.do-ai.run/v1`)

   Optional agent endpoint mode (preferred when you have a deployed Gradient Agent):

   - `GRADIENT_AGENT_ENDPOINT` (for example: `https://<agent-id>.agents.do-ai.run`)
   - `GRADIENT_AGENT_ACCESS_KEY` (endpoint access key)
   - `GRADIENT_AGENT_CHATBOT_ID` (optional metadata only)

   When both `GRADIENT_AGENT_ENDPOINT` and `GRADIENT_AGENT_ACCESS_KEY` are set,
   triage uses the agent endpoint `POST /api/v1/chat/completions?agent=true`.

5. Run migrations:

   ```bash
   npm run db:migrate
   ```

6. Start API server:

   ```bash
   npm run dev
   ```

## Key API routes

- `GET /api/health`
- `POST /api/complaints`
- `POST /api/complaints/customer-direct`
- `GET /api/complaints`
- `GET /api/complaints/:id`
- `PATCH /api/complaints/:id/status`
- `POST /api/complaints/:id/retry-triage`
- `GET /api/complaints/queue/stats`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/sla-overview`
- `GET /api/dashboard/workload`
- `GET /api/dashboard/stream` (SSE)
- `GET /api/reports/export.csv`
- `GET /api/reports/export.pdf`

## Operational notes

- Triage classification and priority are LLM-only with strict schema validation.
- Category is constrained to `Product | Packaging | Trade`.
- If triage parsing fails, complaint is marked `TriageFailed` and can be retried.
- `POST /api/complaints/customer-direct` creates complaints with source `direct` and runs the same triage + SLA workflow as internal intake.
- SLA scan runs once per minute when `ENABLE_SLA_JOB=true`.

## Gradient API details

- Triage requests are sent to `POST /v1/chat/completions` on Gradient Serverless Inference.
- Authorization uses `Bearer <GRADIENT_MODEL_ACCESS_KEY>`.
- Request includes `model`, `messages`, `temperature`, and `max_completion_tokens`.

## Gradient Agent endpoint details

- If agent endpoint env vars are present, triage requests are sent to `POST /api/v1/chat/completions?agent=true` on your agent URL.
- Authorization uses `Bearer <GRADIENT_AGENT_ACCESS_KEY>`.
- In agent endpoint mode, the request model field is sent as `ignored` (as recommended by DigitalOcean docs).
