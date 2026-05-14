from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
import time
import psutil

from app.services.ai_engine import detector
from app.services.alerts import alerts_manager
from app.database import get_db, MetricRecord

router = APIRouter()

def safe_cpu():
    try:
        return round(psutil.cpu_percent(interval=0.1), 2)
    except:
        return 50.0

def safe_memory():
    try:
        return round(psutil.virtual_memory().percent, 2)
    except:
        return 50.0

def safe_latency():
    try:
        load = psutil.getloadavg()[0]
        return round(50 + (load * 50), 2)
    except:
        return 100.0

def safe_error_rate():
    try:
        net = psutil.net_io_counters()
        total = net.packets_sent + net.packets_recv
        if total == 0:
            return 0.0
        errors = net.errin + net.errout + net.dropin + net.dropout
        return round(min((errors / total) * 100, 100), 2)
    except:
        return 0.0

@router.get("/live")
def get_live_metrics(db: Session = Depends(get_db)):
    cpu        = safe_cpu()
    memory     = safe_memory()
    latency    = safe_latency()
    error_rate = safe_error_rate()

    metrics = {
        "cpu": cpu,
        "memory": memory,
        "latency": latency,
        "error_rate": error_rate,
    }

    # Save to DB
    db.add(MetricRecord(
        timestamp=datetime.utcnow(),
        cpu=cpu, memory=memory,
        latency=latency, error_rate=error_rate,
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
            "cpu": r.cpu,
            "memory": r.memory,
            "latency": r.latency,
            "error_rate": r.error_rate,
        }
        for r in reversed(records)
    ]

@router.get("/status")
def get_model_status():
    return {"trained": detector.trained, "data_points": detector.get_status()}