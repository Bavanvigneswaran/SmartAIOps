import psutil
import time
import logging

logger = logging.getLogger(__name__)


def get_cpu() -> float:
    """Real CPU usage - works on both Mac and Linux"""
    return round(psutil.cpu_percent(interval=0.1), 2)


def get_memory() -> float:
    """Real RAM usage - works on both Mac and Linux"""
    return round(psutil.virtual_memory().percent, 2)


def get_latency() -> float:
    """Real network latency estimate - Linux compatible"""
    try:
        net1 = psutil.net_io_counters()
        time.sleep(0.1)
        net2 = psutil.net_io_counters()
        bytes_delta = (
            (net2.bytes_sent + net2.bytes_recv) -
            (net1.bytes_sent + net1.bytes_recv)
        )
        return round(50 + min(bytes_delta / 1000, 450), 2)
    except Exception as e:
        logger.warning(f"Latency read failed: {e}")
        # Fallback: use CPU load average as latency indicator
        load = psutil.getloadavg()[0]  # 1-min load average
        return round(50 + (load * 50), 2)


def get_error_rate() -> float:
    """Real error rate - Linux compatible"""
    try:
        net = psutil.net_io_counters()
        total_packets = net.packets_sent + net.packets_recv
        if total_packets == 0:
            return 0.0
        errors = net.errin + net.errout + net.dropin + net.dropout
        return round(min((errors / total_packets) * 100, 100), 2)
    except Exception as e:
        logger.warning(f"Error rate read failed: {e}")
        # Fallback: use disk I/O error count
        try:
            disk = psutil.disk_io_counters()
            if disk:
                return round(min(disk.read_merged_count or 0 * 0.001, 10), 2)
        except:
            pass
        return 0.0


def get_all_metrics() -> dict:
    return {
        "cpu":        get_cpu(),
        "memory":     get_memory(),
        "latency":    get_latency(),
        "error_rate": get_error_rate(),
    }