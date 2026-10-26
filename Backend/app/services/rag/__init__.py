"""Document chat: retrieval-augmented generation with a tool-using agent.

splitter      text -> passages with character offsets
embeddings    passages -> vectors (Hugging Face models via fastembed, local)
vector_store  Qdrant: store and search passage vectors
indexer       ties the three together for one document
tools         what the agent can do: search, exact find, read, report
agent         the Gemini tool-calling loop that answers a question
"""
