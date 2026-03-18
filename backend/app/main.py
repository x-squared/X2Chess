from fastapi import FastAPI

app = FastAPI(title="X2Chess")


@app.get("/health")
def health():
    return {"ok": True, "app": "X2Chess"}
