FROM python:3.12-slim
WORKDIR /app

# Install uv menggunakan binary terbaru dari astral
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

COPY pyproject.toml uv.lock ./
RUN uv sync

EXPOSE 8000

# Gunakan flag --reload untuk development
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]