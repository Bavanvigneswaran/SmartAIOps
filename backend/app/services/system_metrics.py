import time
import logging

logger = logging.getLogger(__name__)

try:
    import psutil
    PSUTIL_AVAILABLE = True
    logger.info("✅ psutil loaded successfully")
except Exception as e:
    PSUTIL_AVAILABLE = False
    logger.warning(f"⚠️ psutil not available: {e}")


def get_cpu() -> float:
    try:
        if PSUTIL_AVAILABLE:
            return round(psutil.cpu_percent(interval=0.1), 2)
    except Exception as e:
        logger.warning(f"CPU read failed: {e}")
    return 45.0


def get_memory() -> float:
    try:
        if PSUTIL_AVAILABLE:
            return round(psutil.virtual_memory().percent, 2)
    except Exception as e:
        logger.warning(f"Memory read failed: {e}")
    return 55.0


def get_latency() -> float:
    try:
        if PSUTIL_AVAILABLE:
            load = psutil.getloadavg()[0]
            return round(50 + (load * 50), 2)
    except Exception as e:
        logger.warning(f"Latency read failed: {e}")
    return 100.0


def get_error_rate() -> float:
    try:
        if PSUTIL_AVAILABLE:
            net = psutil.net_io_counters()
            total = net.packets_sent + net.packets_recv
            if total == 0:
                return 0.0
            errors = net.errin + net.errout + net.dropin + net.dropout
            return round(min((errors / total) * 100, 100), 2)
    except Exception as e:
        logger.warning(f"Error rate read failed: {e}")
    return 0.0


def get_all_metrics() -> dict:
    return {
        "cpu":        get_cpu(),
        "memory":     get_memory(),
        "latency":    get_latency(),
        "error_rate": get_error_rate(),
    }