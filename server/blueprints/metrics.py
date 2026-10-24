from fastapi import APIRouter, Request
from pydantic import BaseModel

blueprint = APIRouter()


class MetricsPayload(BaseModel):
    studyData: list
    studyHistory: list
    currentStreak: int
    sessionsCompleted: int
    goals: list = []


@blueprint.get("/api/analytics/{user_email}")
async def retrieve_metrics(user_email: str, request: Request):
    if not user_email or user_email.lower() in ("guest", "undefined", "null"):
        return None

    datastore = getattr(request.app.state, "datastore", None)
    if datastore is None:
        return None

    record = await datastore["user_analytics"].find_one({"user_email": user_email})
    if record:
        record.pop("_id", None)
        return record
    return None


@blueprint.post("/api/analytics/{user_email}")
async def persist_metrics(user_email: str, payload: MetricsPayload, request: Request):
    if not user_email or user_email.lower() in ("guest", "undefined", "null"):
        return {"status": "ignored"}

    datastore = getattr(request.app.state, "datastore", None)
    if datastore is not None:
        await datastore["user_analytics"].update_one(
            {"user_email": user_email},
            {"$set": payload.model_dump()},
            upsert=True,
        )
    return {"status": "success"}
