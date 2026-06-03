import History from "./History";
import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// Track JS errors globally
window.__errorCount__ = 0;
window.onerror = () => { window.__errorCount__++; };

const API_URL = "https://backend-production-1db6.up.railway.app";

const METRICS = ["cpu", "memory", "latency", "error_rate"];

const COLORS = {
  cpu: "#00f5ff",
  memory: "#a78bfa",
  latency: "#34d399",
  error_rate: "#f87171",
};

const LABELS = {
  cpu: "CPU Usage %",
  memory: "Memory %",
  latency: "Latency (ms)",
  error_rate: "Error Rate %",
};

function MetricCard({ name, value, history, anomalies, forecasts }) {
  const isAnomaly = anomalies?.[name] === true;

  const forecastPoints = (forecasts?.[name] || []).map((v, i) => ({
    [name]: v,
    isForecast: true,
    index: (history.length) + i,
  }));

  const historyPoints = history.map((h, i) => ({
    [name]: h[name],
    isForecast: false,
    index: i,
  }));

  const chartData = [...historyPoints, ...forecastPoints];

  return (
    <div style={{
      background: "#0f172a",
      border: `1px solid ${isAnomaly ? "#f87171" : "#1e293b"}`,
      borderRadius: 12,
      padding: 20,
      boxShadow: isAnomaly ? "0 0 20px rgba(248,113,113,0.3)" : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ color: "#94a3b8", fontSize: 13, fontFamily: "monospace" }}>{LABELS[name]}</span>
        {isAnomaly && (
          <span style={{ background: "#7f1d1d", color: "#fca5a5", fontSize: 11, padding: "2px 8px", borderRadius: 20 }}>
            ⚠ ANOMALY
          </span>
        )}
      </div>
      <div style={{ color: COLORS[name], fontSize: 32, fontWeight: 700, marginBottom: 12 }}>
        {value}<span style={{ fontSize: 14, color: "#475569" }}>
          {name === "latency" ? "ms" : "%"}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={60}>
        <LineChart data={chartData}>
          <Line type="monotone" dataKey={name} stroke={COLORS[name]} dot={false} strokeWidth={2} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

async function collectSystemMetrics(apiUrl) {
  // CPU — measure JS thread delay over 100ms
  const cpuStart = performance.now();
  await new Promise(r => setTimeout(r, 100));
  const elapsed = performance.now() - cpuStart;
  const cpuLoad = Math.min(((elapsed - 100) / 100) * 100, 100);
  const cores = navigator.hardwareConcurrency || 4;
  const cpu = Math.max(5, Math.min(95, cpuLoad + (100 / cores)));

  // Memory — use Chrome API or deviceMemory fallback
  let memory = 50;
  if (performance.memory) {
    const used = performance.memory.usedJSHeapSize;
    const total = performance.memory.jsHeapSizeLimit;
    memory = Math.round((used / total) * 100);
  } else if (navigator.deviceMemory) {
    memory = Math.max(20, Math.min(90, Math.round(100 - (navigator.deviceMemory / 32) * 100)));
  }

  // Latency — ping the backend and measure round trip
  let latency = 100;
  try {
    const pingStart = performance.now();
    await fetch(`${apiUrl}/`, { method: "GET", cache: "no-store" });
    latency = Math.round(performance.now() - pingStart);
  } catch {
    latency = 999;
  }

  // Error rate — count JS errors on the page
  const error_rate = Math.min((window.__errorCount__ || 0) * 2, 100);

  return {
    cpu:        Math.round(cpu * 10) / 10,
    memory:     Math.round(memory * 10) / 10,
    latency:    latency,
    error_rate: error_rate,
  };
}

export default function App() {
  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState({ cpu: 0, memory: 0, latency: 0, error_rate: 0 });
  const [connected, setConnected] = useState(false);
  const [wakingUp, setWakingUp] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [alertSummary, setAlertSummary] = useState({ critical: 0, warning: 0 });
  const [page, setPage] = useState("dashboard");

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const localMetrics = await collectSystemMetrics(API_URL);
        const res = await fetch(`${API_URL}/api/metrics/live`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(localMetrics),
        });
        const data = await res.json();
        setLatest(data);
        setConnected(true);
        setWakingUp(false);
        // Fetch alerts
        const alertRes = await fetch(`${API_URL}/api/alerts/`);
        const alertData = await alertRes.json();
        setAlerts(alertData.alerts);
        setAlertSummary(alertData.summary);
        setHistory(prev => {
          const updated = [...prev, data].slice(-30); // keep last 30 points
          return updated;
        });
      } catch (e) {
        setConnected(false);
        setWakingUp(true);
        setTimeout(fetchMetrics, 5000);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);

    // Keep Railway backend alive every 4 minutes
    const keepAlive = setInterval(async () => {
      try {
        await fetch(`${API_URL}/`, { method: "GET", cache: "no-store" });
      } catch {}
    }, 4 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearInterval(keepAlive);
    };
  }, []);

  const acknowledgeAlert = async (id) => {
    await fetch(`${API_URL}/api/alerts/${id}/acknowledge`, { method: "POST" });
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  return (
    <div style={{ minHeight: "100vh", background: "#020617", padding: 32, fontFamily: "system-ui" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ color: "#f1f5f9", fontSize: 24, fontWeight: 700, margin: 0 }}>
            ⚡ SmartAIOps
          </h1>
          <p style={{ color: "#475569", fontSize: 13, margin: "4px 0 0" }}>
            Real-Time AI Predictive IT Operations Monitor
          </p>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            {["dashboard", "history"].map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  padding: "6px 16px", borderRadius: 8, border: "none",
                  cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: page === p ? "#1e40af" : "#0f172a",
                  color: page === p ? "#fff" : "#64748b",
                  textTransform: "capitalize",
                }}
              >
                {p === "dashboard" ? "⚡ Dashboard" : "📂 History"}
              </button>
            ))}
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#0f172a", padding: "8px 16px", borderRadius: 20,
          border: "1px solid #1e293b"
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: connected ? "#34d399" : "#f87171",
            boxShadow: connected ? "0 0 8px #34d399" : "0 0 8px #f87171"
          }} />
          <span style={{ color: "#94a3b8", fontSize: 13 }}>
            {connected ? "Live" : wakingUp ? "Waking up... ⏳" : "Disconnected"}
          </span>
        </div>
      </div>
      {page === "history" && <History />}
      {page === "dashboard" && <>
      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 32 }}>
        {METRICS.map(m => (
          <MetricCard key={m} name={m} value={latest[m]} history={history} anomalies={latest.anomalies} forecasts={latest.forecasts} />
        ))}
      </div>

      {/* Full Width Chart */}
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 24 }}>
        <h2 style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 600, marginBottom: 20, marginTop: 0 }}>
          System Overview — Last 30 Readings
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="timestamp" hide />
            <YAxis stroke="#475569" tick={{ fill: "#475569", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
              labelStyle={{ color: "#94a3b8" }}
            />
            {METRICS.map(m => (
              <Line key={m} type="monotone" dataKey={m} stroke={COLORS[m]} dot={false} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
            {/* AI Model Status */}
<div style={{ marginTop: 20, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 20 }}>
  <h2 style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 600, marginBottom: 16, marginTop: 0 }}>
    🤖 AI Model Status
  </h2>
  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
    {METRICS.map(m => {
      const points = latest.model_status?.[m] ?? 0;
      const trained = points >= 20;
      return (
        <div key={m} style={{ textAlign: "center" }}>
          <div style={{ color: trained ? "#34d399" : "#f59e0b", fontSize: 13, marginBottom: 4 }}>
            {trained ? "✅ Trained" : "⏳ Learning"}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "monospace" }}>
            {LABELS[m]}
          </div>
          <div style={{ color: "#475569", fontSize: 11 }}>
            {points}/20 readings
          </div>
        </div>
      );
    })}
  </div>
</div>

{/* Alerts Feed */}
<div style={{ marginTop: 20, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 24 }}>
  <h2 style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 600, marginBottom: 16, marginTop: 0 }}>
    🚨 Live Alerts Feed
  </h2>
  {alerts.length === 0 ? (
    <div style={{ color: "#475569", textAlign: "center", padding: 24 }}>
      No alerts yet — system looks healthy ✅
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto" }}>
      {alerts.map(alert => (
        <div key={alert.id} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: alert.acknowledged ? "#0f172a" : alert.severity === "critical" ? "#1c0a0a" : "#1c1505",
          border: `1px solid ${alert.acknowledged ? "#1e293b" : alert.severity === "critical" ? "#7f1d1d" : "#78350f"}`,
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
                  <span style={{ marginLeft: 8, background: "#1e3a5f", color: "#93c5fd", fontSize: 10, padding: "2px 6px", borderRadius: 10 }}>
                    AI Detected
                  </span>
                )}
              </div>
              <div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>
                {new Date(alert.timestamp).toLocaleTimeString()} — {alert.severity.toUpperCase()}
              </div>
            </div>
          </div>
          {!alert.acknowledged && (
            <button
              onClick={() => acknowledgeAlert(alert.id)}
              style={{
                background: "transparent", border: "1px solid #334155",
                color: "#94a3b8", borderRadius: 6, padding: "4px 12px",
                cursor: "pointer", fontSize: 12,
              }}
            >
              Dismiss
            </button>
          )}
        </div>
      ))}
    </div>
  )}
</div>

{/* Forecast Chart */}
<div style={{ marginTop: 20, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 24 }}>
  <h2 style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 600, marginBottom: 4, marginTop: 0 }}>
    🔮 AI Forecast — Next 10 Readings
  </h2>
  <p style={{ color: "#475569", fontSize: 12, marginBottom: 16, marginTop: 0 }}>
    Dashed lines show predicted future values based on current trend
  </p>
  <ResponsiveContainer width="100%" height={220}>
    <LineChart>
      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
      <XAxis hide />
      <YAxis stroke="#475569" tick={{ fill: "#475569", fontSize: 11 }} />
      <Tooltip
        contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
        labelStyle={{ color: "#94a3b8" }}
      />
      {METRICS.map(m => {
        const historyPoints = history.map((h, i) => ({ index: i, [m]: h[m] }));
        const forecastPoints = (latest.forecasts?.[m] || []).map((v, i) => ({
          index: history.length + i,
          [m]: v,
        }));
        return [
          <Line
            key={`${m}-history`}
            data={historyPoints}
            type="monotone"
            dataKey={m}
            stroke={COLORS[m]}
            dot={false}
            strokeWidth={2}
          />,
          <Line
            key={`${m}-forecast`}
            data={forecastPoints}
            type="monotone"
            dataKey={m}
            stroke={COLORS[m]}
            dot={false}
            strokeWidth={2}
            strokeDasharray="5 5"
            opacity={0.6}
          />
        ];
      })}
    </LineChart>
  </ResponsiveContainer>
  <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
    {METRICS.map(m => (
      <div key={m} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 24, height: 2, background: COLORS[m] }} />
        <span style={{ color: "#64748b", fontSize: 11 }}>{LABELS[m]}</span>
      </div>
    ))}
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {alertSummary.critical > 0 && (
            <div style={{ background: "#7f1d1d", color: "#fca5a5", padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
              🔴 {alertSummary.critical} Critical
            </div>
          )}
          {alertSummary.warning > 0 && (
            <div style={{ background: "#78350f", color: "#fcd34d", padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
              🟡 {alertSummary.warning} Warning
            </div>
          )}
        </div>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 24, height: 2, background: "#94a3b8", borderTop: "2px dashed #94a3b8" }} />
      <span style={{ color: "#64748b", fontSize: 11 }}>Forecast</span>
    </div>
  </div>
</div>
</>}
    </div>
  );
}