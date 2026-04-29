from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

try:
    from ._analysis_core import run_analysis
except ImportError:
    from _analysis_core import run_analysis


class AnalysisRequest(BaseModel):
    analysis: str
    table: str | None = None
    column: str
    second_column: str | None = None
    group_by: str | None = None


class AnalysisPayload(BaseModel):
    request: AnalysisRequest
    rows: list[dict[str, Any]] = Field(default_factory=list)


app = FastAPI()


def verify_bearer_token(authorization: str | None) -> None:
    expected_token = os.getenv("ANALYSIS_API_KEY")

    if not expected_token:
        return

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")

    supplied_token = authorization.removeprefix("Bearer ").strip()
    if supplied_token != expected_token:
        raise HTTPException(status_code=401, detail="Invalid bearer token.")


@app.get("/")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/")
def analyze(
    payload: AnalysisPayload,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    verify_bearer_token(authorization)

    try:
        return run_analysis(payload.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {error}") from error
