# Python Analysis Service

This folder is intended to be deployed as a separate Vercel project.

## Endpoints

- `GET /api/health`
- `POST /api/analyze`

## Environment variables

- `ANALYSIS_API_KEY`
  Optional shared secret. If set, the service requires `Authorization: Bearer <ANALYSIS_API_KEY>`.

## Vercel setup

1. Create a new Vercel project from this same repository.
2. Set the project root directory to `python-analysis`.
3. Deploy.
4. Copy the deployed `https://.../api/analyze` URL into the main chatbot project's `ANALYSIS_API_URL`.
5. If you set `ANALYSIS_API_KEY` on the Python project, set the same value on the chatbot project too.

## Local development

From this folder:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
fastapi dev api/analyze.py
```
