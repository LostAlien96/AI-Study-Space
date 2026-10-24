import json
import traceback
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from server.contracts.payloads import DialogueRequest
from server.engines.intelligence import initialize_conversational_rag, build_ontology_extractor

blueprint = APIRouter()


@blueprint.post("/chat/stream")
async def stream_dialogue(payload: DialogueRequest, http_request: Request):
    conversational_chain = initialize_conversational_rag(payload.provider, payload.model)
    datastore = getattr(http_request.app.state, "datastore", None)

    async def emit_response():
        referenced_materials = set()
        accumulated_answer = ""

        try:
            async for fragment in conversational_chain.astream(
                {"input": payload.query},
                config={"configurable": {"session_id": payload.session_id}},
            ):
                if "answer" in fragment:
                    text_piece = fragment["answer"]
                    accumulated_answer += text_piece
                    yield json.dumps({"type": "text", "content": text_piece}) + "\n"

                if "context" in fragment:
                    for doc in fragment["context"]:
                        origin = doc.metadata.get("source", "Unknown Document")
                        cleaned = (
                            origin
                            if origin.startswith("http://") or origin.startswith("https://")
                            else origin.split("/")[-1].split("\\")[-1]
                        )
                        referenced_materials.add(cleaned)

            derived_topic = payload.query[:50].strip().capitalize()

            # Ontology extraction and persistence
            extracted_concepts = []
            extracted_relations = []

            try:
                ontology_chain = build_ontology_extractor(payload.provider, payload.model)
                merged_text = f"User Question: {payload.query}\nAnswer: {accumulated_answer}"

                ontology_result = await asyncio.to_thread(
                    ontology_chain.invoke, {"text": merged_text}
                )

                extracted_concepts = [c.model_dump() for c in ontology_result.nodes]
                extracted_relations = [r.model_dump() for r in ontology_result.edges]

                if payload.user_id != "guest" and datastore is not None:
                    user_entry = {"role": "user", "content": payload.query}
                    assistant_entry = {"role": "assistant", "content": accumulated_answer}
                    material_refs = [{"fileName": m} for m in referenced_materials]

                    await datastore["sessions"].update_one(
                        {"sessionId": payload.session_id},
                        {
                            "$set": {
                                "userEmail": payload.user_id,
                                "topic": derived_topic,
                            },
                            "$push": {
                                "chatTranscript": {"$each": [user_entry, assistant_entry]},
                                "knowledgeGraph.nodes": {"$each": extracted_concepts},
                                "knowledgeGraph.edges": {"$each": extracted_relations},
                            },
                            "$addToSet": {"documents": {"$each": material_refs}},
                        },
                        upsert=True,
                    )
                    print(f"[OK] Workspace {payload.session_id} updated with ontology.")
            except Exception as exc:
                print(f"[WARN] Ontology/persistence failed: {exc}")

            # Emit metadata packet
            terminal_packet = {
                "type": "metadata",
                "topic": derived_topic,
                "sources": list(referenced_materials),
                "model": payload.model,
                "provider": payload.provider,
                "nodes": extracted_concepts,
                "links": extracted_relations,
            }
            yield json.dumps(terminal_packet) + "\n"

        except Exception as exc:
            print("========== FULL TRACEBACK ==========")
            traceback.print_exc()
            print("====================================")
            yield json.dumps(
                {
                    "type": "error",
                    "content": f"\n\n⚠️ Error during generation: {str(exc)}",
                }
            ) + "\n"

    return StreamingResponse(emit_response(), media_type="application/x-ndjson")
