import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";

const COLORS = {
  cpu: "#00f5ff",
  memory: "#a78bfa",
  latency: "#34d399",
  error_rate: "#f87171",
};

const LABELS = {
  cpu: "CPU %",
  memory: "Memory %",
  latency: "Latency (ms)",
  error_rate: "Error Rate %",
};

export default function History() {
  const [metrics, setMetrics] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState("metrics");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const [mRes, aRes] = await Promise.all([
          fetch("http://localhost:8000/api/metrics/history?limit=100"),
          fetch("http://localhost:8000/api/alerts/history?limit=50"),
        ]);
        const mData = await mRes.json();
        const aData = await aRes.json();
        setMetrics(mData);
        setAlerts(aData);
      } catch (e) {
        console.error("Failed to fetch history", e);
      }
      setLoading(false);
    };

    fetchHistory();
  }, []);

  const tabStyle = (tab) => ({
    padding: "8px 20px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    background: activeTab === tab ? "#1e40af" : "transparent",
    color: activeTab === tab ? "#fff" : "#64748b",
  });

  if (loading) {
    return (
      <div style={{ color: "#475569", textAlign: "center", padding: 60 }}>
        Loading history...
      </div>
    );
  }

  return (
    <div>
      {/* Tab Switcher */}
      <div style={{
        display: "flex", gap: 8, marginBottom: 24,
        background: "#0f172a", padding: 6,
        borderRadius: 10, width: "fit-content",
        border: "1px solid #1e293b"
      }}>
        <button style={tabStyle("metrics")} onClick={() => setActiveTab("metrics")}>
          📈 Metrics History
        </button>
        <button style={tabStyle("alerts")} onClick={() => setActiveTab("alerts")}>
          🚨 Alerts History
        </button>
      </div>

      {/* Metrics History */}
      {activeTab === "metrics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>
            Showing last {metrics.length} recorded readings from database
          </p>
          {Object.keys(COLORS).map(metric => (
            <div key={metric} style={{
              background: "#0f172a", border: "1px solid #1e293b",
              borderRadius: 12, padding: 24,
            }}>
              <h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 16 }}>
                {LABELS[metric]}
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(t) => new Date(t).toLocaleTimeString()}
                    tick={{ fill: "#475569", fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#475569"
                    tick={{ fill: "#475569", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                    labelFormatter={(t) => new Date(t).toLocaleString()}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Line
                    type="monotone"
                    dataKey={metric}
                    stroke={COLORS[metric]}
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}

      {/* Alerts History */}
      {activeTab === "alerts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ color: "#475569", fontSize: 13, margin: "0 0 8px" }}>
            Showing last {alerts.length} alerts from database
          </p>
          {alerts.length === 0 ? (
            <div style={{ color: "#475569", textAlign: "center", padding: 40 }}>
              No alerts recorded yet ✅
            </div>
          ) : (
            alerts.map(alert => (
              <div key={alert.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: alert.severity === "critical" ? "#1c0a0a" : "#1c1505",
                border: `1px solid ${alert.severity === "critical" ? "#7f1d1d" : "#78350f"}`,
                borderRadius: 8, padding: "12px 16px",
                opacity: alert.acknowledged ? 0.5 : 1,
              }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 18 }}>
                    {alert.severity === "critical" ? "🔴" : "🟡"}
                  </span>
                  <div>
                    <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600 }}>
                      {alert.metric.toUpperCase()} — {alert.value}{alert.unit}
                      {alert.ai_detected && (
                        <span style={{
                          marginLeft: 8, background: "#1e3a5f",
                          color: "#93c5fd", fontSize: 10,
                          padding: "2px 6px", borderRadius: 10
                        }}>
                          AI Detected
                        </span>
                      )}
                      {alert.acknowledged && (
                        <span style={{
                          marginLeft: 8, background: "#1e293b",
                          color: "#64748b", fontSize: 10,
                          padding: "2px 6px", borderRadius: 10
                        }}>
                          Acknowledged
                        </span>
                      )}
                    </div>
                    <div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>
                      {new Date(alert.timestamp).toLocaleString()} — {alert.severity.toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}