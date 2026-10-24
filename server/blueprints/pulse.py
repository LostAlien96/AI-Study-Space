from fastapi import APIRouter

blueprint = APIRouter()

@blueprint.get("/health")
def system_pulse():
    return {"status": "ok", "message": "Intellect Hub API Gateway operational!"}
