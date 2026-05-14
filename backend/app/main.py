from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.routes import metrics, alerts
from app.database import init_db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "status": "error"}
    )

@app.on_event("startup")
def startup():
    init_db()
    logger.info("✅ Database initialized")

app.include_router(metrics.router, prefix="/api/metrics")
app.include_router(alerts.router, prefix="/api/alerts")

@app.get("/")
def root():
    return {"status": "SmartAIOps backend running"}