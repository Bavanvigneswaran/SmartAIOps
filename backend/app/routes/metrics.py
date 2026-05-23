from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
import time
from pydantic import BaseModel

from app.services.ai_engine import detector
from app.services.alerts import alerts_manager
from app.database import get_db, MetricRecord

router = APIRouter()

class MetricsPayload(BaseModel):
    cpu: float
    memory: float
    latency: float
    error_rate: float

@router.post("/live")
def post_live_metrics(payload: MetricsPayload, db: Session = Depends(get_db)):
    metrics = {
        "cpu":        payload.cpu,
        "memory":     payload.memory,
        "latency":    payload.latency,
        "error_rate": payload.error_rate,
    }

    try:
        db.add(MetricRecord(timestamp=datetime.utcnow(), **metrics))
        db.commit()
    except Exception:
        db.rollback()

    anomalies = {}
    for metric, value in metrics.items():
        try:
            detector.add_reading(metric, value)
            is_anomaly = detector.is_anomaly(metric, value)
            anomalies[metric] = is_anomaly
            alerts_manager.evaluate(metric, value, is_anomaly, db=db)
        except Exception:
            anomalies[metric] = False

    try:
        forecasts = {m: detector.forecast(m, steps=10) for m in metrics}
    except Exception:
        forecasts = {m: [] for m in metrics}

    return {
        "timestamp": time.time(),
        **metrics,
        "anomalies": anomalies,
        "forecasts": forecasts,
        "model_status": detector.get_status(),
        "alert_summary": alerts_manager.get_summary(),
    }

@router.get("/history")
def get_metric_history(limit: int = 100, db: Session = Depends(get_db)):
    try:
        records = db.query(MetricRecord)\
                    .order_by(MetricRecord.timestamp.desc())\
                    .limit(limit).all()
        return [
            {
                "timestamp": r.timestamp.isoformat(),
                "cpu":        r.cpu,
                "memory":     r.memory,
                "latency":    r.latency,
                "error_rate": r.error_rate,
            }
            for r in reversed(records)
        ]
    except Exception:
        return []

@router.get("/status")
def get_model_status():
    try:
        return {"trained": detector.trained, "data_points": detector.get_status()}
    except Exception:
        return {"trained": {}, "data_points": {}}