"""Product Forge AI - Intake to Estimate Pipeline"""
import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Product Forge AI")
client = Anthropic()

SYSTEM_PROMPTS = {
    "refine": (
        "You are an expert Product Strategist. Your goal is to take a raw idea "
        "and refine it into a clear product definition. Output these sections in Markdown:\n"
        "- **Core Value Proposition**: What problem does this solve and why it matters\n"
        "- **Target Audience**: Who are the primary users\n"
        "- **Key Success Metrics**: How we measure success\n"
        "- **Missing Information**: What questions need answering before moving forward"
    ),
    "prd": (
        "You are an expert Product Owner. Convert the refined product definition "
        "into a Product Requirements Document (PRD). Use Markdown with these sections:\n"
        "- **Executive Summary**\n"
        "- **User Stories** (use 'As a [user], I want [goal], so that [benefit]' format)\n"
        "- **Functional Requirements** (numbered list)\n"
        "- **Non-Functional Requirements** (performance, security, scalability)"
    ),
    "techspec": (
        "You are a Senior Solution Architect. Based on the PRD, create a Technical "
        "Specification. Use Markdown with these sections:\n"
        "- **Architecture Pattern** (e.g., microservices, monolith, serverless)\n"
        "- **Tech Stack Recommendation** (Frontend, Backend, Database, Infrastructure)\n"
        "- **Data Model Schema** (key entities and relationships)\n"
        "- **API Strategy** (REST/GraphQL, key endpoints)"
    ),
    "estimate": (
        "You are a Technical Project Manager. Based on the Technical Specification, "
        "create a Cost & Time Estimate. Use Markdown with these sections:\n"
        "- **Timeline Breakdown** (phases in weeks)\n"
        "- **Resource Requirements** (roles and headcount)\n"
        "- **Estimated Cost** (range in USD)\n"
        "- **Confidence Score** (Low/Medium/High with explanation)"
    ),
}


class GenerateRequest(BaseModel):
    stage: str  # refine, prd, techspec, estimate
    input_text: str


@app.post("/api/generate")
async def generate(req: GenerateRequest):
    if req.stage not in SYSTEM_PROMPTS:
        raise HTTPException(400, f"Unknown stage: {req.stage}")
    if not req.input_text.strip():
        raise HTTPException(400, "Input text is required")

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            system=SYSTEM_PROMPTS[req.stage],
            messages=[{"role": "user", "content": req.input_text}],
        )
        return {"output": message.content[0].text}
    except Exception as e:
        raise HTTPException(500, str(e))


app.mount("/", StaticFiles(directory="static", html=True), name="static")
