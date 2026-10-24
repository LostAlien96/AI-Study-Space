import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv, find_dotenv
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from functools import reduce

from server.blueprints import pulse, ingest, dialogue, metrics, ontology, assessment

load_dotenv(find_dotenv())

MONGO_CONN_STR = os.getenv("MONGODB_URL")
DB_LABEL = "IntellectHubDB"

@asynccontextmanager
async def lifecycle(application: FastAPI):
    """Manage database connection lifecycle via async context manager."""
    if MONGO_CONN_STR:
        try:
            application.state.mongo_driver = AsyncIOMotorClient(MONGO_CONN_STR)
            application.state.datastore = application.state.mongo_driver[DB_LABEL]
            print(f"[OK] MongoDB Atlas linked — Database: {DB_LABEL}")
        except Exception as exc:
            print(f"[FAIL] MongoDB connection error: {exc}")
    else:
        print("[WARN] MONGODB_URL missing from environment configuration!")

    yield

    if hasattr(application.state, "mongo_driver"):
        application.state.mongo_driver.close()
        print("[STOP] MongoDB connection terminated.")


application = FastAPI(title="Intellect Hub API Gateway", lifespan=lifecycle)

application.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        "https://ai-study-space-2.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all blueprint routers
blueprint_registry = [
    pulse.blueprint,
    ingest.blueprint,
    dialogue.blueprint,
    metrics.blueprint,
    ontology.blueprint,
    assessment.blueprint,
]
for bp in blueprint_registry:
    application.include_router(bp)

# =====================================================================
# WORKSPACE DATA CONTRACTS
# =====================================================================

class AttachmentMeta(BaseModel):
    fileName: str
    fileUrl: Optional[str] = None
    extractedText: Optional[str] = None

class ConversationEntry(BaseModel):
    role: str
    content: str

class TopologyPayload(BaseModel):
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

class Workspace(BaseModel):
    sessionId: str
    userEmail: str
    topic: str = "Untitled Workspace"
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    durationMinutes: int = 0
    documents: List[AttachmentMeta] = []
    chatTranscript: List[ConversationEntry] = []
    knowledgeGraph: TopologyPayload = TopologyPayload()

# =====================================================================
# TWO-TIER WORKSPACE API
# =====================================================================

@application.get("/api/sessions/metadata/{user_email}")
async def retrieve_workspace_summaries(user_email: str, request: Request):
    try:
        datastore = request.app.state.datastore
        projection_fields = {
            "_id": 0,
            "sessionId": 1,
            "topic": 1,
            "createdAt": 1,
            "durationMinutes": 1,
            "documents": 1,
        }
        cursor = datastore.sessions.find(
            {"userEmail": user_email}, projection_fields
        ).sort("createdAt", -1)

        summaries = await cursor.to_list(length=100)
        return {"status": "success", "data": summaries}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@application.get("/api/sessions/{session_id}")
async def retrieve_full_workspace(session_id: str, user_email: str, request: Request):
    try:
        datastore = request.app.state.datastore
        workspace_record = await datastore.sessions.find_one(
            {"sessionId": session_id, "userEmail": user_email}, {"_id": 0}
        )
        if workspace_record is None:
            raise HTTPException(status_code=404, detail="Workspace not located")
        return {"status": "success", "data": workspace_record}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@application.post("/api/sessions/save")
async def persist_workspace(workspace: Workspace, request: Request):
    try:
        datastore = request.app.state.datastore
        serialized = workspace.model_dump()
        serialized.pop("createdAt", None)

        await datastore.sessions.update_one(
            {"sessionId": workspace.sessionId, "userEmail": workspace.userEmail},
            {
                "$set": serialized,
                "$setOnInsert": {"createdAt": datetime.now(timezone.utc)},
            },
            upsert=True,
        )
        return {"status": "success", "message": "Workspace persisted"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
