"""Unit tests for the in-memory LatencyMetrics ring buffer."""
from services.latency_metrics import LatencyMetrics, LATENCY_BUDGET_MS


def test_records_and_groups_by_route():
    m = LatencyMetrics(max_per_route=10)
    m.record("GET /a", 100)
    m.record("GET /a", 50)
    m.record("GET /b", 250)  # over budget

    snap = m.snapshot()
    assert snap["total_requests"] == 3
    assert snap["violations"] == 1
    assert snap["violation_pct"] == round(1 / 3 * 100, 2)

    routes = {r["route"]: r for r in snap["routes"]}
    assert routes["GET /a"]["samples"] == 2
    assert routes["GET /a"]["avg_ms"] == 75.0
    assert routes["GET /b"]["violations"] == 1


def test_ring_buffer_caps_per_route():
    m = LatencyMetrics(max_per_route=5)
    for i in range(20):
        m.record("GET /x", float(i + 1))
    snap = m.snapshot()
    route = snap["routes"][0]
    assert route["samples"] == 5
    # Last 5 values are 16,17,18,19,20 -> avg 18
    assert route["avg_ms"] == 18.0


def test_percentile_picks_correct_index():
    m = LatencyMetrics(max_per_route=200)
    for v in range(1, 101):
        m.record("GET /p", float(v))
    snap = m.snapshot()
    route = snap["routes"][0]
    # P50 of 1..100 -> ~50, P95 -> ~95.
    assert 49 <= route["p50_ms"] <= 51
    assert 94 <= route["p95_ms"] <= 96


def test_reset_clears_state():
    m = LatencyMetrics()
    m.record("GET /a", 100)
    m.record("GET /b", 250)
    m.reset()
    snap = m.snapshot()
    assert snap["total_requests"] == 0
    assert snap["violations"] == 0
    assert snap["routes"] == []


def test_budget_constant_matches_sla():
    # The middleware logs a violation at 200ms — keep these in sync.
    assert LATENCY_BUDGET_MS == 200
