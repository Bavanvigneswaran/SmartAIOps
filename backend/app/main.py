from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.routes import metrics, alerts
from app.database import init_db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="SmartAIOps API")

# CORS must be added BEFORE any other middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins permanently
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=200,  # Return 200 so CORS headers are always sent
        content={
            "timestamp": 0,
            "cpu": 0.0,
            "memory": 0.0,
            "latency": 0.0,
            "error_rate": 0.0,
            "anomalies": {},
            "forecasts": {},
            "model_status": {},
            "alert_summary": {"total": 0, "critical": 0, "warning": 0},
            "error": str(exc)
        }
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