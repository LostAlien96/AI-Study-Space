import os
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from langchain_core.prompts import ChatPromptTemplate
from server.engines.intelligence import instantiate_model
from server.engines.content_processor import resolve_artifact_path, select_extraction_engine

blueprint = APIRouter()

# =====================================================================
# ASSESSMENT CONTRACTS
# =====================================================================

class QuizItem(BaseModel):
    id: int = Field(description="Sequential question index starting from 1")
    question: str = Field(description="The multiple-choice question text")
    options: List[str] = Field(description="Exactly 4 answer options")
    correct_answer: str = Field(description="The exact text of the correct option")
    explanation: str = Field(description="Brief rationale for the correct answer")

class AssessmentBundle(BaseModel):
    questions: List[QuizItem]

class GenerateAssessmentPayload(BaseModel):
    session_id: str
    user_email: str
    provider: str
    model: str

class RecordOutcomePayload(BaseModel):
    session_id: str
    user_email: str
    score: int
    total_questions: int
    incorrect_questions: List[dict]

# =====================================================================
# ASSESSMENT ENDPOINTS
# =====================================================================

@blueprint.post("/api/exam/generate")
async def generate_assessment(payload: GenerateAssessmentPayload, request: Request):
    """Generates a 5-question MCQ assessment from workspace documents."""
    datastore = getattr(request.app.state, "datastore", None)
    if datastore is None:
        raise HTTPException(status_code=500, detail="Datastore unavailable")

    workspace = await datastore.sessions.find_one(
        {"sessionId": payload.session_id, "userEmail": payload.user_email}
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    artifact_list = workspace.get("documents", [])
    if not artifact_list:
        raise HTTPException(
            status_code=400,
            detail="No artifacts uploaded to this workspace for assessment generation.",
        )

    aggregated_content = ""
    for artifact in artifact_list:
        artifact_name = artifact.get("fileName")
        if not artifact_name:
            continue

        artifact_path = resolve_artifact_path(artifact_name)
        if not os.path.exists(artifact_path):
            continue

        try:
            engine = select_extraction_engine(artifact_path)
            pages = engine.load()
            artifact_text = "\n".join(page.page_content for page in pages)
            aggregated_content += f"\n\n--- Artifact: {artifact_name} ---\n{artifact_text}"
        except Exception as exc:
            print(f"Artifact text extraction error: {exc}")

    if not aggregated_content.strip():
        aggregated_content = f"Study Topic: {workspace.get('topic', 'General Knowledge')}"

    CHARACTER_CEILING = 20000
    if len(aggregated_content) > CHARACTER_CEILING:
        aggregated_content = aggregated_content[:CHARACTER_CEILING] + "\n...[truncated]..."

    language_model = instantiate_model(payload.provider, payload.model)
    typed_model = language_model.with_structured_output(AssessmentBundle)

    assessment_prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are an elite academic examiner. "
         "Analyze the provided study context text and generate a 5-question multiple choice quiz. "
         "Each question must have exactly 4 choices. Make the questions challenging but fair. "
         "Ensure the correct_answer matches one of the options exactly. "
         "Provide a concise explanation for the correct answer."),
        ("human", "Generate a quiz for this study content:\n\n{text}"),
    ])

    chain = assessment_prompt | typed_model

    try:
        assessment_data = await chain.ainvoke({"text": aggregated_content})
        return assessment_data
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Assessment generation failed: {str(exc)}"
        )


@blueprint.post("/api/exam/record")
async def record_assessment_outcome(payload: RecordOutcomePayload, request: Request):
    """Saves assessment results and logs incorrect answers for spaced repetition."""
    datastore = getattr(request.app.state, "datastore", None)
    if datastore is None:
        return {"status": "ignored"}

    if payload.incorrect_questions:
        for item in payload.incorrect_questions:
            await datastore["idk_tracker"].update_one(
                {
                    "user_email": payload.user_email,
                    "question": item.get("question"),
                },
                {
                    "$set": {
                        "options": item.get("options"),
                        "correct_answer": item.get("correct_answer"),
                        "explanation": item.get("explanation"),
                        "user_answer": item.get("user_answer"),
                        "session_id": payload.session_id,
                        "last_tested": datetime.utcnow(),
                        "box": 1,
                    }
                },
                upsert=True,
            )

    return {"status": "success", "message": "Assessment logged and review deck updated"}


@blueprint.get("/api/exam/idk/{user_email}")
async def retrieve_review_items(user_email: str, request: Request):
    """Fetches all pending review items for spaced repetition practice."""
    if not user_email or user_email.lower() in ("guest", "undefined", "null"):
        return {"questions": []}

    datastore = getattr(request.app.state, "datastore", None)
    if datastore is None:
        return {"questions": []}

    cursor = datastore["idk_tracker"].find({"user_email": user_email})
    items = await cursor.to_list(length=100)

    for item in items:
        item["id"] = str(item.pop("_id"))

    return {"questions": items}


class ResolveReviewPayload(BaseModel):
    user_email: str
    question: str


@blueprint.post("/api/exam/idk/resolve")
async def resolve_review_item(payload: ResolveReviewPayload, request: Request):
    """Removes a mastered question from the review deck."""
    datastore = getattr(request.app.state, "datastore", None)
    if datastore is None:
        return {"status": "ignored"}

    await datastore["idk_tracker"].delete_one(
        {"user_email": payload.user_email, "question": payload.question}
    )
    return {"status": "success", "message": "Review item resolved and removed"}
