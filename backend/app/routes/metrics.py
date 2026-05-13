from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
import time

from app.services.ai_engine import detector
from app.services.alerts import alerts_manager
from app.services.system_metrics import get_all_metrics
from app.database import get_db, MetricRecord

router = APIRouter()

@router.get("/live")
def get_live_metrics(db: Session = Depends(get_db)):
    # Get REAL metrics from your Mac
    metrics = get_all_metrics()

    cpu        = metrics["cpu"]
    memory     = metrics["memory"]
    latency    = metrics["latency"]
    error_rate = metrics["error_rate"]

    # Save to DB
    db.add(MetricRecord(
        timestamp=datetime.utcnow(),
        cpu=cpu,
        memory=memory,
        latency=latency,
        error_rate=error_rate,
    ))
    db.commit()

    # AI anomaly detection
    anomalies = {}
    for metric, value in metrics.items():
        detector.add_reading(metric, value)
        is_anomaly = detector.is_anomaly(metric, value)
        anomalies[metric] = is_anomaly
        alerts_manager.evaluate(metric, value, is_anomaly, db=db)

    # Forecasting
    forecasts = {m: detector.forecast(m, steps=10) for m in metrics}

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


@router.get("/status")
def get_model_status():
    return {
        "trained":     detector.trained,
        "data_points": detector.get_status()
    }