"""
Marionette supervisor configuration.

Production watchdog for the SOMA <-> MAX pair. Pure stdlib, zero deps, so a
broken npm/pip install can never take the supervisor down with it.
"""
import os

CONFIG = {
    # ── Supervisor HTTP API ────────────────────────────────────────────────
    "HOST": "127.0.0.1",          # localhost-only; not exposed to the network
    "PORT": 9000,

    # ── Loop timing (seconds) ──────────────────────────────────────────────
    "PING_INTERVAL_SECONDS": 5,        # how often we health-check each service
    "HEALTH_TIMEOUT_SECONDS": 4,       # per-ping HTTP timeout
    "FAILS_TO_STUCK": 2,               # consecutive fails -> "stuck" (warn)
    "FAILS_TO_DEAD": 4,                # consecutive fails -> "dead" (recover)

    # ── Crash-loop circuit breaker ─────────────────────────────────────────
    "MAX_RESTARTS_IN_WINDOW": 3,       # restarts allowed within the window...
    "RESTART_WINDOW_SECONDS": 600,     # ...before the circuit opens (10 min)
    "CIRCUIT_COOLDOWN_SECONDS": 900,   # how long the circuit stays open (15 min)

    # ── Discord alerting (independent of SOMA being up) ────────────────────
    # Set MARIONETTE_DISCORD_WEBHOOK to get posts when Marionette takes action.
    # Falls back to file-only logging if unset.
    "DISCORD_WEBHOOK": os.getenv("MARIONETTE_DISCORD_WEBHOOK", ""),

    # ── Audit log ──────────────────────────────────────────────────────────
    "ACTION_LOG": os.path.join(os.path.dirname(__file__), "marionette_actions.jsonl"),

    # ── Supervised services ────────────────────────────────────────────────
    # boot_grace_s: how long to leave a freshly-started service alone before
    #   health-checking it (SOMA loads heavy systems 60-90s AFTER binding 3001).
    # start_dir/start_cmd: the canonical, correct way to (re)launch each service.
    "SERVICES": {
        "soma": {
            "health_url": "http://localhost:3001/health",
            "port": 3001,
            "boot_grace_s": 130,
            "start_dir": r"C:\Users\barry\Desktop\The Stack\SOMA",
            "start_cmd": ["cmd", "/c", "start", "", "cmd", "/c", "start_production.bat"],
        },
        "max": {
            "health_url": "http://127.0.0.1:3100/health",
            "port": 3100,
            "boot_grace_s": 35,
            "start_dir": r"C:\Users\barry\Desktop\MAX1",
            "start_cmd": ["cmd", "/c", "start", "", "cmd", "/c", "start-local.bat"],
        },
    },

    # ── Bridge check ───────────────────────────────────────────────────────
    # The SOMA->MAX bridge can only work when BOTH are healthy. We also probe
    # MAX's health as a deeper liveness signal for the bridge target.
    "BRIDGE_PROBE_URL": "http://127.0.0.1:3100/health",

    # ── Hard safety: process command-line substrings we must NEVER kill ─────
    "KILL_PROTECT_SUBSTRINGS": ["claude", "marionette", "code.exe", "cursor"],
}
