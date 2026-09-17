# Meeting scribe: the LiveKit real-time SDK only ships for glibc, hence a
# Debian image apart from the Alpine Hub backend.
FROM python:3.13-slim AS base

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS test
COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt
COPY . .
CMD ["sh", "-c", "ruff check . && ruff format --check . && pytest"]

FROM base AS production
RUN pip uninstall -y pip
COPY scribe.py .
USER 1000
CMD ["python", "scribe.py"]
