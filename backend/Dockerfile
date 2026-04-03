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
#
# GUNICORN_WORKERS — number of gunicorn worker processes per container.
# Default is 1 so that Kubernetes scales horizontally (more pods, not more
# workers per pod).  Set to 3 or higher in docker-compose for local dev where
# there is only a single container acting as the whole backend.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000 \
    GUNICORN_WORKERS=1

EXPOSE 5000

# Default: run the gunicorn web server (matches backend/Procfile "web" process).
# Override CMD in docker-compose to run the RQ worker instead.
# Shell form is required here so that ${GUNICORN_WORKERS} and ${PORT} are
# expanded at container startup from the environment.
# The string is kept on one line inside the JSON array to avoid any ambiguity
# with backslash-newline handling inside quoted shell strings.
CMD ["sh", "-c", \
     "exec gunicorn server:app -k uvicorn.workers.UvicornWorker -w ${GUNICORN_WORKERS} --timeout 120 --bind 0.0.0.0:${PORT} --access-logfile - --error-logfile - --max-requests 1000 --max-requests-jitter 100"]
