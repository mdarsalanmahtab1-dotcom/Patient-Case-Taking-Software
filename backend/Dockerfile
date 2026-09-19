FROM python:3.11-slim

# Prevent prompts from apt and ensure unbuffered python logs
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install build essentials, curl, and Indian fonts for prescription PDF generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    fonts-noto-core \
    fonts-deva \
    fonts-beng \
    fonts-indic \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium browser and its Linux OS dependencies
RUN playwright install --with-deps chromium

COPY . .

# Ensure persistent directories exist
RUN mkdir -p uploads static/prescriptions

# Google Cloud Run injects the PORT environment variable
ENV PORT=8000
EXPOSE 8000

CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
