import os
from langchain_community.document_loaders import (
    PyPDFLoader,
    Docx2txtLoader,
    WebBaseLoader,
    UnstructuredPowerPointLoader,
)
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from server.foundation.environment import STORAGE_DIRECTORY
import pytesseract
from PIL import Image


class OCRDocumentExtractor:
    """Extracts textual content from image files using optical character recognition."""

    def __init__(self, artifact_path: str):
        self.artifact_path = artifact_path

    def load(self):
        try:
            image_data = Image.open(self.artifact_path)
            recognized_text = pytesseract.image_to_string(image_data)
            return [
                Document(
                    page_content=recognized_text,
                    metadata={"source": self.artifact_path},
                )
            ]
        except Exception as exc:
            raise RuntimeError(
                f"OCR extraction failed for {self.artifact_path}: {str(exc)}"
            )


def resolve_artifact_path(artifact_name: str) -> str:
    return os.path.join(STORAGE_DIRECTORY, artifact_name)


def select_extraction_engine(artifact_path: str):
    _, extension = os.path.splitext(artifact_path)
    extension = extension.lower()

    extraction_map = {
        ".pdf": lambda p: PyPDFLoader(p),
        ".docx": lambda p: Docx2txtLoader(p),
        ".doc": lambda p: Docx2txtLoader(p),
        ".pptx": lambda p: UnstructuredPowerPointLoader(p),
        ".ppt": lambda p: UnstructuredPowerPointLoader(p),
        ".png": lambda p: OCRDocumentExtractor(p),
        ".jpg": lambda p: OCRDocumentExtractor(p),
        ".jpeg": lambda p: OCRDocumentExtractor(p),
    }

    factory = extraction_map.get(extension)
    if factory is None:
        raise ValueError(f"No extraction engine available for: {extension}")
    return factory(artifact_path)


def fragment_document(artifact_path: str = None, web_url: str = None):
    """Loads a document from file or URL, then segments it into retrievable fragments."""
    if web_url:
        extraction_engine = WebBaseLoader(web_url)
    elif artifact_path:
        extraction_engine = select_extraction_engine(artifact_path)
    else:
        raise ValueError("Either artifact_path or web_url must be provided")

    raw_pages = extraction_engine.load()

    segmenter = RecursiveCharacterTextSplitter(
        chunk_size=2000,
        chunk_overlap=300,
        length_function=len,
    )
    fragments = segmenter.split_documents(raw_pages)

    return raw_pages, fragments
