import psutil
import time


def get_cpu() -> float:
    """Real CPU usage percentage"""
    return round(psutil.cpu_percent(interval=0.1), 2)


def get_memory() -> float:
    """Real RAM usage percentage"""
    return round(psutil.virtual_memory().percent, 2)


def get_latency() -> float:
    """
    Simulates network latency based on real network stats.
    Uses bytes sent/received to estimate activity.
    """
    net1 = psutil.net_io_counters()
    time.sleep(0.1)
    net2 = psutil.net_io_counters()

    bytes_delta = (net2.bytes_sent + net2.bytes_recv) - \
                  (net1.bytes_sent + net1.bytes_recv)

    # Map network activity to a latency estimate (50ms base + activity)
    latency = 50 + min(bytes_delta / 1000, 450)
    return round(latency, 2)


def get_error_rate() -> float:
    """
    Real error rate based on network packet errors and drops.
    """
    net = psutil.net_io_counters()
    total_packets = net.packets_sent + net.packets_recv

    if total_packets == 0:
        return 0.0

    errors = net.errin + net.errout + net.dropin + net.dropout
    rate = (errors / total_packets) * 100
    return round(min(rate, 100), 2)


def get_all_metrics() -> dict:
    return {
        "cpu":        get_cpu(),
        "memory":     get_memory(),
        "latency":    get_latency(),
        "error_rate": get_error_rate(),
    }