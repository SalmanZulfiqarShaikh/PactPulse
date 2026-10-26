# Pact Pulse: one image with the API and the built frontend.

# --- 1. Build the frontend ---------------------------------------------------
FROM node:22-slim AS frontend
WORKDIR /build
COPY Frontend/package.json Frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY Frontend/ ./
# Empty API URL: the app calls the API on its own domain.
ENV VITE_API_URL=""
RUN npm run build

# --- 2. The API --------------------------------------------------------------
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FASTEMBED_CACHE_PATH=/opt/models

WORKDIR /srv
COPY Backend/requirements.txt Backend/requirements.txt
RUN pip install -r Backend/requirements.txt

# Download the embedding model now, so a cold start doesn't wait for it.
ARG EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('${EMBEDDING_MODEL}')"

COPY Backend/app Backend/app
COPY --from=frontend /build/dist Frontend/dist

# One worker on purpose: background jobs and the embedded vector store live in
# this process.
EXPOSE 8080
CMD ["uvicorn", "Backend.app.main:app", "--host", "0.0.0.0", "--port", "8080"]
