from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.services.alerts import alerts_manager
from app.database import get_db, AlertRecord

router = APIRouter()

@router.get("/")
def get_alerts(limit: int = 20):
    return {
        "alerts": alerts_manager.get_alerts(limit),
        "summary": alerts_manager.get_summary(),
    }

@router.get("/history")
def get_alert_history(limit: int = 50, db: Session = Depends(get_db)):
    records = db.query(AlertRecord)\
                .order_by(AlertRecord.timestamp.desc())\
                .limit(limit).all()
    return [
        {
            "id": r.id,
            "metric": r.metric,
            "value": r.value,
            "unit": r.unit,
            "severity": r.severity,
            "ai_detected": r.ai_detected,
            "acknowledged": r.acknowledged,
            "timestamp": r.timestamp.isoformat(),
        }
        for r in records
    ]

@router.post("/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int):
    success = alerts_manager.acknowledge(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True}