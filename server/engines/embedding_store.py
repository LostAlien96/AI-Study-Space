import os
import asyncio
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
from langchain_pinecone import PineconeVectorStore

# Lightweight ONNX embedding model (all-MiniLM-L6-v2, 384 dimensions)
vector_encoder = FastEmbedEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

pinecone_namespace = os.getenv("PINECONE_INDEX_NAME", "second-brain-index")


class ThreadSafePineconeStore(PineconeVectorStore):
    """Routes async similarity searches through a background thread to avoid session closure bugs."""

    async def asimilarity_search(self, query: str, k: int = 4, **kwargs):
        return await asyncio.to_thread(self.similarity_search, query, k=k, **kwargs)


def acquire_vector_index():
    return ThreadSafePineconeStore(
        index_name=pinecone_namespace, embedding=vector_encoder
    )


def commit_to_vector_index(fragments):
    return ThreadSafePineconeStore.from_documents(
        documents=fragments,
        embedding=vector_encoder,
        index_name=pinecone_namespace,
    )
