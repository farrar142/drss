# ===== Build Stage =====
FROM python:3.13-slim AS builder

WORKDIR /usr/src/app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies
COPY ./pyproject.toml ./pyproject.toml
RUN pip install --no-cache-dir --upgrade pip && \
  pip install --no-cache-dir .

# ===== Production Stage =====
FROM python:3.13-slim AS production

WORKDIR /usr/src/app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
  libpq5 \
  && rm -rf /var/lib/apt/lists/* \
  && apt-get clean

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code
COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash appuser && \
  chown -R appuser:appuser /usr/src/app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

EXPOSE 8000

# Use gunicorn with uvicorn workers for production
ENTRYPOINT ["gunicorn", "base.asgi:application", "-k", "uvicorn.workers.UvicornWorker"]
CMD ["--bind", "0.0.0.0:8000", "--workers", "4", "--threads", "2", "--worker-connections", "1000"]
