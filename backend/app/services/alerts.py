from datetime import datetime
from collections import deque

SEVERITY_RULES = {
    "cpu":        {"warning": 70, "critical": 88},
    "memory":     {"warning": 70, "critical": 85},
    "latency":    {"warning": 300, "critical": 450},
    "error_rate": {"warning": 5,  "critical": 8},
}

UNITS = {
    "cpu": "%",
    "memory": "%",
    "latency": "ms",
    "error_rate": "%",
}

class AlertsManager:
    def __init__(self, max_alerts=100):
        self.alerts = deque(maxlen=max_alerts)
        self.alert_id = 0

    def evaluate(self, metric: str, value: float, is_ai_anomaly: bool, db=None):
        rules = SEVERITY_RULES.get(metric, {})
        severity = None

        if value >= rules.get("critical", float("inf")):
            severity = "critical"
        elif value >= rules.get("warning", float("inf")):
            severity = "warning"
        elif is_ai_anomaly:
            severity = "warning"

        if severity:
            self.alert_id += 1
            alert = {
                "id": self.alert_id,
                "metric": metric,
                "value": value,
                "unit": UNITS.get(metric, ""),
                "severity": severity,
                "ai_detected": is_ai_anomaly,
                "timestamp": datetime.utcnow().isoformat(),
                "acknowledged": False,
            }
            self.alerts.appendleft(alert)

            # Save to database if session provided
            if db:
                from app.database import AlertRecord
                record = AlertRecord(
                    metric=metric,
                    value=value,
                    unit=UNITS.get(metric, ""),
                    severity=severity,
                    ai_detected=is_ai_anomaly,
                    acknowledged=False,
                )
                db.add(record)
                db.commit()

    def get_alerts(self, limit: int = 20) -> list:
        return list(self.alerts)[:limit]

    def acknowledge(self, alert_id: int) -> bool:
        for alert in self.alerts:
            if alert["id"] == alert_id:
                alert["acknowledged"] = True
                return True
        return False

    def get_summary(self) -> dict:
        total = len(self.alerts)
        critical = sum(1 for a in self.alerts if a["severity"] == "critical" and not a["acknowledged"])
        warning  = sum(1 for a in self.alerts if a["severity"] == "warning"  and not a["acknowledged"])
        return {"total": total, "critical": critical, "warning": warning}


alerts_manager = AlertsManager()