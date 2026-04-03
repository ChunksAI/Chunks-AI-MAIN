# ── backend/Dockerfile ────────────────────────────────────────────────────────
# Single image used for both the web server and the RQ worker.
#
# Web server (default CMD):
#   docker build -t chunks-api ./backend
#   docker run -p 5000:5000 --env-file .env chunks-api
#
# Worker (override CMD via docker-compose or at runtime):
#   docker run --env-file .env chunks-api rq worker --url $REDIS_URL default
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11.9-slim

# libgomp1 — required at runtime by NumPy (OpenMP threading)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies before copying app code for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Disable .pyc file generation and enable unbuffered stdout/stderr so logs
# appear immediately in docker logs / Cloud logging pipelines.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000

EXPOSE 5000

# Default: run the gunicorn web server (matches backend/Procfile "web" process).
# Override CMD in docker-compose to run the RQ worker instead.
CMD ["gunicorn", "server:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-w", "3", \
     "--timeout", "120", \
     "--bind", "0.0.0.0:5000", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--max-requests", "1000", \
     "--max-requests-jitter", "100"]
