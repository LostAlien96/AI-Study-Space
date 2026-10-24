import os
from dotenv import load_dotenv

load_dotenv()

STORAGE_DIRECTORY = "artifact_storage"
VECTOR_DB_DIRECTORY = "chroma_persistence"

os.makedirs(STORAGE_DIRECTORY, exist_ok=True)
os.makedirs(VECTOR_DB_DIRECTORY, exist_ok=True)
