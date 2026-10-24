from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from typing import List
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from server.engines.intelligence import instantiate_model

blueprint = APIRouter()


class TopologyNode(BaseModel):
    id: str = Field(description="Short unique identifier (e.g., 'TCP', 'OSPF')")
    name: str = Field(description="Full readable label (e.g., 'Transmission Control Protocol')")
    val: int = Field(description="Significance weight (usually 5 to 10)")
    color: str = Field(description="Hex color code based on domain (e.g., networking is #0ea5e9)")


class TopologyEdge(BaseModel):
    source: str = Field(description="ID of the origin node")
    target: str = Field(description="ID of the destination node")


class TopologyStructure(BaseModel):
    nodes: List[TopologyNode]
    links: List[TopologyEdge]


class ExtractionPayload(BaseModel):
    text: str
    provider: str
    model: str


class TopologyPersistPayload(BaseModel):
    nodes: list
    links: list


@blueprint.post("/api/graph/extract")
async def extract_topology(payload: ExtractionPayload):
    if payload.provider.lower() == "groq" and payload.model.lower() in (
        "gpt-20b", "gpt-oss-20b", "qwen", "qwen3", "qwen3.8"
    ):
        language_model = ChatGroq(model="openai/gpt-oss-120b", temperature=0.3)
    else:
        language_model = instantiate_model(payload.provider, payload.model)

    typed_model = language_model.with_structured_output(TopologyStructure)

    extraction_prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are an expert knowledge graph extractor. "
         "Analyze the user's study text. Extract 2 to 5 key educational concepts as nodes, "
         "and map the relationships between them as links. "
         "Make the colors match the subject category."),
        ("human", "{text}"),
    ])

    chain = extraction_prompt | typed_model

    try:
        result = await chain.ainvoke({"text": payload.text})
        return result
    except Exception:
        return {"nodes": [], "links": []}


@blueprint.get("/api/graph/{user_email}")
async def retrieve_user_topology(user_email: str, request: Request):
    if not user_email or user_email.lower() in ("guest", "undefined", "null"):
        return {"nodes": [], "links": []}

    datastore = getattr(request.app.state, "datastore", None)
    if datastore is None:
        return {"nodes": [], "links": []}

    topology = await datastore["user_graphs"].find_one({"user_email": user_email})
    if topology:
        return {
            "nodes": topology.get("nodes", []),
            "links": topology.get("links", []),
        }
    return {"nodes": [], "links": []}


@blueprint.post("/api/graph/{user_email}")
async def persist_user_topology(
    user_email: str, payload: TopologyPersistPayload, request: Request
):
    if not user_email or user_email.lower() in ("guest", "undefined", "null"):
        return {"status": "ignored"}

    datastore = getattr(request.app.state, "datastore", None)
    if datastore is not None:
        await datastore["user_graphs"].update_one(
            {"user_email": user_email},
            {"$set": {"nodes": payload.nodes, "links": payload.links}},
            upsert=True,
        )
    return {"status": "success"}
