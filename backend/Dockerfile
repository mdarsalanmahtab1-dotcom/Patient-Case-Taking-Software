# MediKiosk — Backend Dockerfile
# Multi-stage build: installs Tesseract OCR + Python deps cleanly

FROM python:3.11-bookworm

# Install system dependencies (Tesseract + language packs, curl for healthcheck)
# Split into multiple RUN commands to prevent 'runc process is already dead' errors on Railway build nodes
RUN apt-get update
RUN apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-hin \
    libgl1 \
    curl
RUN rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Install Python dependencies first (layer cache efficiency)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend source files
COPY . .

# Expose the port Railway will route to
EXPOSE 8000

# Start with uvicorn — single worker is fine for WebSockets
# Railway injects PORT env var; we fall back to 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --log-level info"]
