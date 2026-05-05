# Data Analytic Chatbot

A Next.js workspace for AI-assisted analytics on approved database tables, with Supabase authentication, schema-aware query planning, and `base_account`-driven RBAC.

## Key Features
- AI chat with Gemini or a localhost-only OpenAI-compatible API such as Ollama or LM Studio
- Structured analytics pipeline that validates model output before any query runs
- Built-in analysis modes for `trend`, `comparison`, `distribution`, `composition`, `outlier`, `correlation`, `period_change`, and `data_quality`
- Role-aware workspace shell with chat, data browsing, history, settings, and a super-admin user-role dashboard
- RBAC derived from `base_account` boolean flags instead of legacy profile roles
- Schema registry support through Supabase tables with `.env` fallback via `CHATBOT_ALLOWED_SCHEMA`
- Conversation history with persisted request/response diagnostics when the database schema supports them
- Username, email, and Google sign-in backed by Supabase Auth

## Tech Stack
- Framework: Next.js 16 (App Router)
- Database/Auth: Supabase PostgreSQL + Supabase Auth
- AI: Gemini plus optional local OpenAI-compatible inference
- Validation: Zod
- UI: React, Tailwind CSS, shadcn/ui-style components, Lucide React
- Analysis: JavaScript runtime by default, optional Python or remote analysis service

## Project Structure
- `/app`: Pages, API routes, and client components
- `/lib`: Access control, schema registry, query planning, controller, AI, and analysis helpers
- `/python-analysis`: Optional standalone Python analysis service
- `/artifacts`: SQL setup, constraints, triggers, and seed files
- `/public`: Static assets

## Setup

### Environment Variables
Create `.env.local` and configure:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key

# Optional: default model label shown for Gemini mode
NEXT_PUBLIC_AI_MODEL_NAME=gemini-3-flash-preview

# Optional: declare allowed schema when Supabase registry tables are unavailable
CHATBOT_ALLOWED_SCHEMA=[{"name":"sales","provider":"supabase","columns":[{"name":"region","type":"string"},{"name":"revenue","type":"number"},{"name":"sale_date","type":"date"}]}]

# Optional: mysql-backed schema sources
AZURE_MYSQL_HOST=your-server.mysql.database.azure.com
AZURE_MYSQL_PORT=3306
AZURE_MYSQL_USER=your_user
AZURE_MYSQL_PASSWORD=your_password
AZURE_MYSQL_DATABASE=your_database
AZURE_MYSQL_SSL=true

# Optional: choose analysis runtime behavior
CHATBOT_ANALYSIS_RUNTIME=python
CHATBOT_PYTHON_BIN=python3

# Optional: offload analysis to a remote service instead of local runtime/Python
ANALYSIS_API_URL=https://your-analysis-service.example.com
ANALYSIS_API_KEY=your_optional_bearer_token
ANALYSIS_API_TIMEOUT_MS=20000
```

### Database Setup
Run the SQL artifacts you need in Supabase SQL Editor. The important groups are:
- `artifacts/base_account_auth_user_trigger.sql`
- `artifacts/base_account_teacher_scope_constraint.sql`
- `artifacts/chatbot_schema_registry_from_env_seed.sql`

If you use the role dashboard, make sure `base_account` is populated and linked to `auth.users` through `auth_user_id`.

### Username Login
Username login resolves through server-side lookups against `base_account` and `profiles`, then signs in with the matching Supabase Auth account. `SUPABASE_SERVICE_ROLE_KEY` must be configured for that flow.

### Local LLM Mode
The Settings page can switch the chat client to a local OpenAI-compatible endpoint. The server only accepts loopback hosts such as `localhost`, `127.0.0.1`, or `::1`.

## Routing Notes
- Unauthenticated users who visit `/` are redirected to `/welcome`
- `/onboarding` requires an authenticated session unless opened in preview mode
- Users without a completed profile are routed through onboarding
- Users with linked `base_account.is_active = false` are signed out and sent back to login

## Learn More
- Architecture overview: [ARCHITECTURE.md](./ARCHITECTURE.md)
- SQL setup and sample datasets: [`artifacts/`](./artifacts)
