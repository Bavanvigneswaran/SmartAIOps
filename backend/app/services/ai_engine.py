import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LinearRegression
from collections import deque

class AnomalyDetector:
    def __init__(self, window_size=50):
        self.window_size = window_size
        self.models = {}
        self.buffers = {}
        self.trained = {}

        for metric in ["cpu", "memory", "latency", "error_rate"]:
            self.models[metric] = IsolationForest(
                contamination=0.1,
                random_state=42
            )
            self.buffers[metric] = deque(maxlen=window_size)
            self.trained[metric] = False

    def add_reading(self, metric: str, value: float):
        self.buffers[metric].append(value)
        if len(self.buffers[metric]) >= 20:
            X = np.array(self.buffers[metric]).reshape(-1, 1)
            self.models[metric].fit(X)
            self.trained[metric] = True

    def is_anomaly(self, metric: str, value: float) -> bool:
        if not self.trained[metric]:
            return False
        result = self.models[metric].predict([[value]])
        return result[0] == -1

    def forecast(self, metric: str, steps: int = 10) -> list:
        """Predict the next `steps` values using linear regression on recent data"""
        if len(self.buffers[metric]) < 10:
            return []

        data = list(self.buffers[metric])
        X = np.arange(len(data)).reshape(-1, 1)
        y = np.array(data)

        model = LinearRegression()
        model.fit(X, y)

        future_X = np.arange(len(data), len(data) + steps).reshape(-1, 1)
        predictions = model.predict(future_X)

        # Clip to realistic ranges per metric
        ranges = {
            "cpu": (0, 100),
            "memory": (0, 100),
            "latency": (0, 1000),
            "error_rate": (0, 100),
        }
        lo, hi = ranges.get(metric, (0, 1000))
        predictions = np.clip(predictions, lo, hi)

        return [round(float(p), 2) for p in predictions]

    def get_status(self) -> dict:
        return {m: len(self.buffers[m]) for m in self.buffers}


detector = AnomalyDetector()