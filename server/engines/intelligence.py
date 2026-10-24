import asyncio
from langchain_mistralai import ChatMistralAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_classic.chains import create_history_aware_retriever, create_retrieval_chain
from server.engines.embedding_store import acquire_vector_index

from langchain_core.chat_history import BaseChatMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.runnables import RunnableLambda

from pydantic import BaseModel, Field
from typing import List

# Conversation memory registry
_memory_registry = {}


def recall_conversation(workspace_id: str) -> BaseChatMessageHistory:
    """Retrieves or initializes conversation memory for a given workspace."""
    if workspace_id not in _memory_registry:
        _memory_registry[workspace_id] = ChatMessageHistory()
    return _memory_registry[workspace_id]


def instantiate_model(vendor: str, variant: str):
    """
    Model factory — dispatches to the correct provider SDK based on vendor/variant identifiers.
    """
    vendor_normalized = vendor.lower()
    variant_normalized = variant.lower()

    if vendor_normalized in ("google", "gemini"):
        if variant_normalized == "gemini-pro":
            return ChatGoogleGenerativeAI(model="gemini-2.5-pro", temperature=0.3)
        return ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.3)

    if vendor_normalized == "groq":
        groq_model_map = {
            "gpt-20b": "openai/gpt-oss-20b",
            "gpt-oss-20b": "openai/gpt-oss-20b",
            "gpt-oss": "openai/gpt-oss-120b",
            "gpt-oss-120b": "openai/gpt-oss-120b",
            "qwen3": "qwen/qwen3.8-27b",
            "qwen": "qwen/qwen3.8-27b",
            "qwen3.8": "qwen/qwen3.8-27b",
        }
        resolved = groq_model_map.get(variant_normalized, "openai/gpt-oss-20b")
        return ChatGroq(model=resolved, temperature=0.3)

    if vendor_normalized == "mistral":
        return ChatMistralAI(model="mistral-small-2506", temperature=0.3)

    # Fallback
    return ChatMistralAI(model="mistral-small-2506", temperature=0.3)


async def gather_relevant_fragments(inquiry: str):
    """
    Multi-query retrieval: generates query variations, searches in parallel, deduplicates results.
    """
    vector_index = acquire_vector_index()
    expansion_model = ChatGroq(model="openai/gpt-oss-20b", temperature=0.3)

    variation_prompt = ChatPromptTemplate.from_template(
        "You are a helpful study assistant. Generate 3 diverse variations of this student question "
        "to search for related study materials: {question}\n"
        "IMPORTANT: Focus purely on the core CONCEPTS. Do NOT include highly specific structural "
        "constraints like 'Chapter 6' or 'Page 42' in your variations, as these hinder semantic search.\n"
        "If the user is asking about a specific type of document (like a 'resume', 'CV', or 'syllabus'), "
        "generate variations that contain typical words found INSIDE those documents (e.g., "
        "'Experience, Education, Skills, Projects' for a resume) so the semantic search can find them.\n"
        "Output ONLY the 3 queries separated by newlines."
    )

    expansion_chain = variation_prompt | expansion_model | StrOutputParser()
    expanded_text = await expansion_chain.ainvoke({"question": inquiry})
    query_variants = [line.strip() for line in expanded_text.split("\n") if line.strip()]

    if inquiry not in query_variants:
        query_variants.append(inquiry)

    # Concurrent similarity search across all variants
    search_tasks = [vector_index.asimilarity_search(variant, k=3) for variant in query_variants]
    search_results = await asyncio.gather(*search_tasks)

    # Deduplicate by content hash
    unique_map = {}
    for result_batch in search_results:
        for fragment in result_batch:
            unique_map[fragment.page_content] = fragment

    return list(unique_map.values())


def construct_rag_pipeline(vendor: str, variant: str):
    language_model = instantiate_model(vendor, variant)

    adaptive_retriever = RunnableLambda(func=lambda x: [], afunc=gather_relevant_fragments)

    reformulation_directive = (
        "Given a chat history and the latest user question "
        "which might reference context in the chat history, "
        "formulate a standalone question which can be understood "
        "without the chat history. Do NOT answer the question, "
        "just reformulate it if needed and otherwise return it as is."
    )
    reformulation_template = ChatPromptTemplate.from_messages([
        ("system", reformulation_directive),
        ("placeholder", "{chat_history}"),
        ("human", "{input}"),
    ])

    context_aware_retriever = create_history_aware_retriever(
        language_model, adaptive_retriever, reformulation_template
    )

    response_directive = (
        "You are an expert AI study companion. Your primary directive is to maintain absolute trust with the user.\n"
        "First, analyze the provided Context to answer the user's question.\n"
        "If the Context contains the complete answer, answer directly using ONLY that information.\n"
        "If the Context only contains a partial answer (for example, if a list of steps gets cut off) "
        "or doesn't contain the answer at all, you should use your general knowledge to fully answer the question. "
        "However, you MUST be transparent. If you use outside knowledge, just naturally mention it in your response "
        "(e.g., 'The provided text mentions the first step, but based on general engineering practices, "
        "the full pipeline is...' or 'This isn't explicitly in the uploaded text, but...').\n\n"
        "Context:\n{context}"
    )
    response_template = ChatPromptTemplate.from_messages([
        ("system", response_directive),
        ("placeholder", "{chat_history}"),
        ("human", "{input}"),
    ])

    synthesis_chain = create_stuff_documents_chain(language_model, response_template)
    return create_retrieval_chain(context_aware_retriever, synthesis_chain)


def initialize_conversational_rag(vendor: str, variant: str):
    core_pipeline = construct_rag_pipeline(vendor, variant)

    return RunnableWithMessageHistory(
        core_pipeline,
        recall_conversation,
        input_messages_key="input",
        history_messages_key="chat_history",
        output_messages_key="answer",
    )


# =====================================================================
# ONTOLOGY EXTRACTION ENGINE
# =====================================================================

class Concept(BaseModel):
    id: str = Field(description="Unique identifier for the concept, typically the core term.")
    name: str = Field(description="Human-readable display name of the concept.")
    val: int = Field(default=5, description="Significance weight from 1 to 10.")
    color: str = Field(default="#818cf8", description="Hex color based on category.")

class Relationship(BaseModel):
    source: str = Field(description="The id of the origin concept.")
    target: str = Field(description="The id of the destination concept.")
    name: str = Field(description="The nature of the relationship between concepts.")

class OntologyGraph(BaseModel):
    nodes: List[Concept] = Field(description="List of key concepts extracted from the text.")
    edges: List[Relationship] = Field(description="List of relationships connecting the concepts.")


def build_ontology_extractor(vendor: str, variant: str):
    """Creates a chain that enforces structured JSON output for knowledge graph extraction."""
    if vendor.lower() == "groq" and variant.lower() in ("gpt-20b", "gpt-oss-20b", "qwen", "qwen3", "qwen3.8"):
        language_model = ChatGroq(model="openai/gpt-oss-120b", temperature=0.3)
    else:
        language_model = instantiate_model(vendor, variant)

    typed_model = language_model.with_structured_output(OntologyGraph)

    extraction_template = ChatPromptTemplate.from_messages([
        ("system",
         "You are an expert ontology extractor. Your job is to analyze the user's question and the AI's response, "
         "and extract the core concepts as nodes, and their relationships as edges. "
         "Keep it concise: extract a maximum of 3-5 highly relevant nodes per message to avoid cluttering the graph. "
         "Ensure edges strictly connect nodes that exist in your extracted list. "
         "CRITICAL GRAPH STRUCTURE RULES: "
         "1. If concepts represent a process or timeline, connect them sequentially (A -> B -> C). "
         "2. If concepts are independent members of the same category, you MUST create a central 'Parent' node "
         "and link all 'Child' nodes directly to it to form a Hub-and-Spoke star shape. "
         "Do NOT link independent children to each other."),
        ("human", "Extract the Knowledge Graph from this interaction:\n\n{text}"),
    ])

    return extraction_template | typed_model
