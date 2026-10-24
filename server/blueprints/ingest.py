import os
from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from server.contracts.payloads import WebLinkRequest
from server.engines.content_processor import resolve_artifact_path, fragment_document, select_extraction_engine
from server.engines.embedding_store import commit_to_vector_index
from server.foundation.environment import STORAGE_DIRECTORY
from groq import Groq

blueprint = APIRouter()

# =============================================
# ARTIFACT VIEWING ENDPOINTS
# =============================================

@blueprint.get("/files/text/{filename}")
async def extract_artifact_text(filename: str):
    """Returns extracted text content of a stored artifact."""
    sanitized = os.path.basename(filename)
    full_path = resolve_artifact_path(sanitized)

    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Artifact not found")

    try:
        engine = select_extraction_engine(full_path)
        pages = engine.load()
        combined_text = "\n\n".join(page.page_content for page in pages)
        return {"filename": sanitized, "text": combined_text}
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Text extraction failed: {str(exc)}"
        )


@blueprint.get("/files/list")
async def enumerate_artifacts():
    """Returns metadata for all stored artifacts."""
    try:
        if not os.path.exists(STORAGE_DIRECTORY):
            return {"files": []}

        catalog = [
            {
                "filename": entry,
                "size": os.path.getsize(os.path.join(STORAGE_DIRECTORY, entry)),
                "type": os.path.splitext(entry)[1].lower().replace(".", ""),
                "modified": os.path.getmtime(os.path.join(STORAGE_DIRECTORY, entry)),
            }
            for entry in os.listdir(STORAGE_DIRECTORY)
            if os.path.isfile(os.path.join(STORAGE_DIRECTORY, entry))
        ]

        catalog.sort(key=lambda item: item["modified"], reverse=True)
        return {"files": catalog}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@blueprint.get("/files/view/{filename}")
async def serve_artifact(filename: str):
    """Serves an artifact file for viewing or download."""
    sanitized = os.path.basename(filename)
    full_path = os.path.join(STORAGE_DIRECTORY, sanitized)

    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Artifact not found")

    extension = os.path.splitext(sanitized)[1].lower()
    mime_registry = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc": "application/msword",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".ppt": "application/vnd.ms-powerpoint",
    }

    content_type = mime_registry.get(extension, "application/octet-stream")
    inline_viewable = {".pdf", ".png", ".jpg", ".jpeg"}

    disposition = "inline" if extension in inline_viewable else "attachment"
    return FileResponse(
        full_path,
        media_type=content_type,
        filename=sanitized if disposition == "attachment" else None,
        content_disposition_type=disposition,
    )


# Whisper transcription client
_whisper_client = Groq()

PERMITTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".pptx", ".ppt", ".png", ".jpg", ".jpeg"}


@blueprint.post("/upload")
async def receive_artifact(file: UploadFile = File(...)):
    extension = os.path.splitext(file.filename)[1].lower()

    if extension not in PERMITTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File type not supported")

    destination = resolve_artifact_path(file.filename)
    raw_bytes = await file.read()
    with open(destination, "wb") as handle:
        handle.write(raw_bytes)

    return {"filename": file.filename, "message": "Artifact stored successfully!"}


@blueprint.post("/process/file/{filename}")
def vectorize_artifact(filename: str):
    artifact_path = resolve_artifact_path(filename)
    if not os.path.exists(artifact_path):
        raise HTTPException(status_code=404, detail="Artifact not located.")

    try:
        _, fragments = fragment_document(artifact_path=artifact_path)
        commit_to_vector_index(fragments)

        return {
            "filename": filename,
            "total_chunks_processed": len(fragments),
            "message": "Artifact processed, embedded, and committed to Pinecone!",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@blueprint.post("/process/url")
def vectorize_web_resource(payload: WebLinkRequest):
    try:
        _, fragments = fragment_document(web_url=payload.url)
        commit_to_vector_index(fragments)

        return {
            "source": payload.url,
            "total_chunks_processed": len(fragments),
            "message": "Web resource scraped, embedded, and committed to Pinecone!",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@blueprint.post("/voice/transcribe")
async def transcribe_audio_input(file: UploadFile = File(...)):
    """Transcribes audio input using Groq Whisper."""
    try:
        audio_bytes = await file.read()

        transcription = _whisper_client.audio.transcriptions.create(
            file=(file.filename, audio_bytes),
            model="whisper-large-v3",
            prompt="Specify terms related to computer science, engineering, or equations if needed.",
            response_format="json",
        )

        return {"text": transcription.text}
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Transcription failed: {str(exc)}"
        )
