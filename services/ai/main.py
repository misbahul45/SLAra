from fastapi import FastAPI

from app.config.init_model import Models

app = FastAPI(title="SLAra AI Service")


@app.get("/health")
def health():
    loaded = [name for name, m in Models.items() if m["model"] is not None]
    return {
        "status": "ok",
        "service": "ai",
        "models_loaded": loaded,
        "models_total": len(Models),
    }
