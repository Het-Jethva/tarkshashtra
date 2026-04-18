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
- `GET /api/auth/me`
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

## RBAC matrix (hackathon demo)

Role input (for demo):

- Send `x-user-role` and `x-user-name` headers on API requests.
- Supported roles: `support_executive`, `quality_assurance`, `operations_manager`.
- For browser download/SSE links, fallback query params are supported: `asRole`, `asName`.

Role labels used in UI:

- `support_executive` -> Customer Support Executive
- `quality_assurance` -> Quality Assurance Team
- `operations_manager` -> Operations Manager

Endpoint access matrix:

| Endpoint | Support Executive | QA Team | Operations Manager |
| --- | --- | --- | --- |
| `GET /api/auth/me` | Yes | Yes | Yes |
| `POST /api/complaints` | Yes | No | No |
| `POST /api/complaints/customer-direct` | Public (no role required) | Public | Public |
| `GET /api/complaints` | Yes | Yes | No |
| `GET /api/complaints/:id` | Yes | Yes | No |
| `PATCH /api/complaints/:id/status` | Yes | No | No |
| `POST /api/complaints/:id/retry-triage` | Yes | Yes | No |
| `GET /api/complaints/queue/stats` | Yes | Yes | No |
| `GET /api/dashboard/summary` | No | Yes | Yes |
| `GET /api/dashboard/sla-overview` | No | Yes | Yes |
| `GET /api/dashboard/workload` | No | Yes | Yes |
| `GET /api/dashboard/stream` | No | Yes | Yes |
| `GET /api/reports/export.csv` | No | Yes | Yes |
| `GET /api/reports/export.pdf` | No | Yes | Yes |

## 60-second demo script

1. Open the frontend and switch role to **Customer Support Executive** in the admin sidebar.
2. Go to `/admin/complaints/new`, submit a complaint, and show that complaint status can be updated in details.
3. Switch role to **Quality Assurance Team** and show:
   - complaint list/details are visible,
   - status update is read-only,
   - dashboard and exports are available.
4. Switch role to **Operations Manager** and show:
   - dashboard/SLA/workload are visible,
   - export links work,
   - complaint queue/detail routes are blocked by RBAC.
5. Optional API proof (Postman/curl): call `GET /api/auth/me` with each `x-user-role` value and show permission differences.

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
