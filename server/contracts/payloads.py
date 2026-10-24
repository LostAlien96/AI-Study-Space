from pydantic import BaseModel

class DialogueRequest(BaseModel):
    query: str
    session_id: str = "default_learner"
    provider: str = "mistral"
    model: str = "mistral-small"
    user_id: str = "guest"

class WebLinkRequest(BaseModel):
    url: str
