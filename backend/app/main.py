from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import metrics, alerts
from app.database import init_db

app = FastAPI(title="SmartAIOps API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://frontend-production-cf46.up.railway.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()
    print("✅ Database initialized")

app.include_router(metrics.router, prefix="/api/metrics")
app.include_router(alerts.router, prefix="/api/alerts")

@app.get("/")
def root():
    return {"status": "SmartAIOps backend running"}