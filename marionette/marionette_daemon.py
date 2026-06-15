"""
Marionette — production supervisor for the SOMA <-> MAX pair.

Keeps both services alive, monitors the bridge, and self-heals — safely:
  * TARGETED restarts: kills only the specific PID on a service's port,
    never a blanket `taskkill /IM node.exe` (that footgun is gone).
  * BOOT GRACE: never health-kills a service that is still starting
    (SOMA loads heavy systems 60-90s after binding its port).
  * COEXISTS with human/Claude restarts: if a fresh process is already
    booting on the port, Marionette waits instead of fighting it.
  * CRASH-LOOP BREAKER: if a service restarts too many times in a window,
    the circuit opens, Marionette stops thrashing and alerts.
  * INDEPENDENT ALERTING: posts to a Discord webhook + a JSONL audit log,
    so you still hear about it even when SOMA itself is down.

Pure stdlib. Run:  python marionette_daemon.py
"""
import os
import sys
import json
import time
import threading
import subprocess
import urllib.request
from collections import deque
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from marionette_config import CONFIG

SELF_PID = os.getpid()


def now() -> float:
    return time.time()


def iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# Windows process helpers (PowerShell-backed, robust on this stack)
# ─────────────────────────────────────────────────────────────────────────────

def _ps(cmd: str, timeout: int = 6) -> str:
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-Command", cmd],
            capture_output=True, text=True, timeout=timeout,
        )
        return (out.stdout or "").strip()
    except Exception:
        return ""


def pid_on_port(port: int):
    """Return the listening PID on `port`, or None."""
    out = _ps(f"(Get-NetTCPConnection -LocalPort {port} -State Listen -EA 0 "
              f"| Select-Object -First 1 -ExpandProperty OwningProcess)")
    try:
        return int(out) if out else None
    except ValueError:
        return None


def process_age_seconds(pid: int):
    """Seconds since the process started, or None if unknown."""
    out = _ps(f"$p=Get-Process -Id {pid} -EA 0; if($p){{((Get-Date) - $p.StartTime).TotalSeconds}}")
    try:
        return float(out) if out else None
    except ValueError:
        return None


def process_commandline(pid: int) -> str:
    return _ps(f"(Get-CimInstance Win32_Process -Filter 'ProcessId={pid}' -EA 0).CommandLine") or ""


def kill_pid(pid: int) -> bool:
    """Kill exactly one PID, after refusing to touch protected processes."""
    if not pid or pid <= 0 or pid == SELF_PID:
        return False
    cmdline = process_commandline(pid).lower()
    for guard in CONFIG["KILL_PROTECT_SUBSTRINGS"]:
        if guard.lower() in cmdline:
            return False  # never kill Claude / the supervisor / the editor
    try:
        subprocess.run(["taskkill", "/F", "/PID", str(pid)],
                       capture_output=True, timeout=10)
        return True
    except Exception:
        return False


def http_ok(url: str, timeout: int) -> bool:
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return 200 <= r.status < 300
    except Exception:
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Per-service supervisor
# ─────────────────────────────────────────────────────────────────────────────

class ServiceMonitor:
    def __init__(self, name, spec):
        self.name = name
        self.spec = spec
        self.state = "unknown"           # unknown|healthy|stuck|dead|booting|restarting|circuit_open
        self.consecutive_fails = 0
        self.last_healthy = 0.0
        self.last_state_change = now()
        self.grace_until = 0.0           # don't health-kill before this time
        self.restart_times = deque()     # timestamps of recent restarts
        self.circuit_open_until = 0.0
        self.total_restarts = 0

    # ── state helpers ──
    def _set(self, s):
        if s != self.state:
            self.last_state_change = now()
        self.state = s

    def _circuit_is_open(self) -> bool:
        return now() < self.circuit_open_until

    def _trip_circuit_if_looping(self) -> bool:
        win = CONFIG["RESTART_WINDOW_SECONDS"]
        cutoff = now() - win
        while self.restart_times and self.restart_times[0] < cutoff:
            self.restart_times.popleft()
        if len(self.restart_times) >= CONFIG["MAX_RESTARTS_IN_WINDOW"]:
            self.circuit_open_until = now() + CONFIG["CIRCUIT_COOLDOWN_SECONDS"]
            self._set("circuit_open")
            return True
        return False

    # ── the per-tick evaluation ──
    def evaluate(self, supervisor):
        if self._circuit_is_open():
            self._set("circuit_open")
            return

        # Respect boot grace: a freshly (re)started service is left alone.
        if now() < self.grace_until:
            self._set("booting")
            return

        healthy = http_ok(self.spec["health_url"], CONFIG["HEALTH_TIMEOUT_SECONDS"])
        if healthy:
            self.consecutive_fails = 0
            self.last_healthy = now()
            self._set("healthy")
            return

        self.consecutive_fails += 1

        # Someone else (you / Claude / start script) may already be launching it.
        # If a YOUNG process is sitting on the port, it's booting — wait, don't fight.
        pid = pid_on_port(self.spec["port"])
        if pid:
            age = process_age_seconds(pid)
            if age is not None and age < self.spec["boot_grace_s"]:
                self.grace_until = now() + (self.spec["boot_grace_s"] - age)
                self._set("booting")
                return

        if self.consecutive_fails < CONFIG["FAILS_TO_DEAD"]:
            if self.consecutive_fails >= CONFIG["FAILS_TO_STUCK"] and self.state != "stuck":
                self._set("stuck")
                supervisor.alert(self.name, "stuck",
                                 f"{self.name} unresponsive ({self.consecutive_fails} fails) — watching before restart")
            return

        # Declared DEAD → recover (if circuit allows).
        self.recover(supervisor, reason=f"{self.consecutive_fails} consecutive health failures")

    # ── recovery ──
    def recover(self, supervisor, reason=""):
        if self._circuit_is_open():
            return
        if self._trip_circuit_if_looping():
            supervisor.alert(self.name, "circuit_open",
                             f"{self.name} crash-looping — circuit OPEN for "
                             f"{CONFIG['CIRCUIT_COOLDOWN_SECONDS']//60} min. Needs a human.")
            return

        self._set("restarting")
        supervisor.alert(self.name, "restarting", f"Restarting {self.name}: {reason}")

        # 1) Targeted kill of the (possibly hung) process on the port.
        pid = pid_on_port(self.spec["port"])
        if pid:
            killed = kill_pid(pid)
            supervisor.log_action(self.name, "kill",
                                  {"pid": pid, "killed": killed})
            time.sleep(2)

        # 2) Relaunch via the canonical start script, detached.
        try:
            subprocess.Popen(
                self.spec["start_cmd"],
                cwd=self.spec["start_dir"],
                creationflags=getattr(subprocess, "CREATE_NEW_CONSOLE", 0),
                close_fds=True,
            )
            launched = True
        except Exception as e:
            launched = False
            supervisor.alert(self.name, "launch_failed", f"Could not launch {self.name}: {e}")

        self.restart_times.append(now())
        self.total_restarts += 1
        self.consecutive_fails = 0
        # Give it room to boot before we judge it again.
        self.grace_until = now() + self.spec["boot_grace_s"]
        self._set("booting")
        supervisor.log_action(self.name, "relaunch", {"launched": launched})

    def snapshot(self):
        return {
            "state": self.state,
            "consecutive_fails": self.consecutive_fails,
            "last_healthy_age_s": round(now() - self.last_healthy, 1) if self.last_healthy else None,
            "total_restarts": self.total_restarts,
            "restarts_in_window": len(self.restart_times),
            "circuit_open": self._circuit_is_open(),
            "circuit_reopen_in_s": max(0, round(self.circuit_open_until - now())) if self._circuit_is_open() else 0,
            "booting": now() < self.grace_until,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Supervisor: loop + alerting + HTTP API
# ─────────────────────────────────────────────────────────────────────────────

class Supervisor:
    def __init__(self):
        self.monitors = {name: ServiceMonitor(name, spec)
                         for name, spec in CONFIG["SERVICES"].items()}
        self.paused = False
        self.started_at = now()
        self.bridge_ok = False
        self._lock = threading.Lock()

    # ── alerting & audit ──
    def log_action(self, service, action, detail=None):
        rec = {"ts": iso(), "service": service, "action": action, "detail": detail or {}}
        try:
            with open(CONFIG["ACTION_LOG"], "a", encoding="utf-8") as f:
                f.write(json.dumps(rec) + "\n")
        except Exception:
            pass
        print(f"[Marionette] {service}/{action}: {detail or ''}")

    def alert(self, service, kind, message):
        self.log_action(service, kind, {"message": message})
        hook = CONFIG["DISCORD_WEBHOOK"]
        if hook:
            try:
                body = json.dumps({"content": f"🪢 **Marionette** [{service}/{kind}] {message}"}).encode()
                req = urllib.request.Request(hook, data=body,
                                             headers={"Content-Type": "application/json"}, method="POST")
                urllib.request.urlopen(req, timeout=5)
            except Exception:
                pass

    # ── main loop ──
    def loop(self):
        self.alert("supervisor", "online", "Marionette supervisor online — watching SOMA + MAX")
        while True:
            try:
                if not self.paused:
                    with self._lock:
                        for m in self.monitors.values():
                            m.evaluate(self)
                        self._update_bridge()
            except Exception as e:
                self.log_action("supervisor", "loop_error", {"error": str(e)})
            time.sleep(CONFIG["PING_INTERVAL_SECONDS"])

    def _update_bridge(self):
        # The SOMA->MAX bridge can only work if both are healthy AND MAX answers.
        both_healthy = all(m.state == "healthy" for m in self.monitors.values())
        probe = http_ok(CONFIG["BRIDGE_PROBE_URL"], CONFIG["HEALTH_TIMEOUT_SECONDS"])
        new_bridge = both_healthy and probe
        if new_bridge != self.bridge_ok:
            self.alert("bridge", "up" if new_bridge else "down",
                       "SOMA<->MAX bridge healthy" if new_bridge else "SOMA<->MAX bridge DOWN")
        self.bridge_ok = new_bridge

    def status(self):
        return {
            "supervisor": {
                "uptime_s": round(now() - self.started_at, 1),
                "paused": self.paused,
                "self_pid": SELF_PID,
            },
            "bridge_ok": self.bridge_ok,
            "services": {name: m.snapshot() for name, m in self.monitors.items()},
        }

    def manual_restart(self, name):
        m = self.monitors.get(name)
        if not m:
            return {"error": f"unknown service '{name}'"}
        with self._lock:
            # manual restart bypasses the circuit but still records to the window
            m.circuit_open_until = 0
            m.recover(self, reason="manual /reset request")
        return {"status": f"{name} restart triggered"}


# ─────────────────────────────────────────────────────────────────────────────
# HTTP API
# ─────────────────────────────────────────────────────────────────────────────

def make_handler(sup: Supervisor):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):  # silence default access logging
            pass

        def _json(self, data, status=200):
            payload = json.dumps(data).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def do_GET(self):
            if self.path == "/ping":
                self._json({"status": "alive", "daemon": "marionette"})
            elif self.path in ("/status", "/"):
                self._json(sup.status())
            elif self.path.startswith("/status/"):
                name = self.path.split("/status/", 1)[1]
                m = sup.monitors.get(name)
                self._json(m.snapshot() if m else {"error": "unknown service"},
                           200 if m else 404)
            else:
                self._json({"error": "not found"}, 404)

        def do_POST(self):
            if self.path.startswith("/reset/"):
                name = self.path.split("/reset/", 1)[1]
                self._json(sup.manual_restart(name))
            elif self.path == "/pause":
                sup.paused = True
                sup.log_action("supervisor", "paused", {"by": "api"})
                self._json({"status": "auto-recovery PAUSED (maintenance mode)"})
            elif self.path == "/resume":
                sup.paused = False
                sup.log_action("supervisor", "resumed", {"by": "api"})
                self._json({"status": "auto-recovery RESUMED"})
            else:
                self._json({"error": "not found"}, 404)

    return Handler


def main():
    print("[Marionette] Initializing production supervisor...")
    sup = Supervisor()

    t = threading.Thread(target=sup.loop, daemon=True)
    t.start()

    server = HTTPServer((CONFIG["HOST"], CONFIG["PORT"]), make_handler(sup))
    print(f"[Marionette] API on http://{CONFIG['HOST']}:{CONFIG['PORT']} "
          f"(/status, /ping, POST /reset/<svc>, /pause, /resume)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Marionette] Shutting down.")


if __name__ == "__main__":
    main()
