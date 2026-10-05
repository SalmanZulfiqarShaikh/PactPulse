from fastapi import FastAPI

app = FastAPI(
    title="Pact Pulse - Legal AI",
    description="An AI powered legal AI services application.",
    version="1.0.0",
)


@app.get("/")
async def root():
    return {
    "message": "Welcome to Pact Pulse - Legal AI. This is an AI powered legal services application.",
    "endpoints": {
        "POST /contracts/upload": "Upload a contract for analysis.",
        "GET /contracts/{contract_id}/summary": "Get a summary of the uploaded contract.",
        "GET /contracts": "List all uploaded contracts.",
        "POST /analysis/analyze/{contract_id}": "Analyze the uploaded contract and provide insights.",
        "GET /analysis/{contract_id}/insights": "Get insights from the analyzed contract.",
    }
    }
