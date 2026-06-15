"""
Marionette self-test — verifies the supervisor's safety-critical logic without
killing or launching anything real. Run: python marionette_test.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import marionette_daemon as md
from marionette_config import CONFIG

passed = failed = 0
def check(name, cond):
    global passed, failed
    if cond:
        passed += 1; print(f"  PASS  {name}")
    else:
        failed += 1; print(f"  FAIL  {name}")

print("Marionette safety tests\n" + "-" * 40)

# 1) kill_pid refuses protected / invalid PIDs (never actually kills here)
check("refuses PID 0", md.kill_pid(0) is False)
check("refuses self PID", md.kill_pid(md.SELF_PID) is False)

# 2) config sanity: dead threshold strictly greater than stuck threshold
check("FAILS_TO_DEAD > FAILS_TO_STUCK",
      CONFIG["FAILS_TO_DEAD"] > CONFIG["FAILS_TO_STUCK"])

# 3) circuit breaker trips after MAX_RESTARTS_IN_WINDOW restarts
m = md.ServiceMonitor("test", {"health_url": "http://127.0.0.1:1/health", "port": 1,
                               "boot_grace_s": 1, "start_dir": ".", "start_cmd": ["cmd", "/c", "echo"]})
for _ in range(CONFIG["MAX_RESTARTS_IN_WINDOW"]):
    m.restart_times.append(md.now())
check("circuit opens on crash loop", m._trip_circuit_if_looping() is True)
check("circuit reports open", m._circuit_is_open() is True)

# 4) boot grace suppresses recovery (stays 'booting', never restarts)
m2 = md.ServiceMonitor("test2", CONFIG["SERVICES"]["soma"])
m2.grace_until = md.now() + 60
class _NoopSup:
    def alert(self, *a, **k): pass
    def log_action(self, *a, **k): pass
m2.evaluate(_NoopSup())
check("booting state during grace", m2.state == "booting")

# 5) protected substrings include claude + marionette
prot = [s.lower() for s in CONFIG["KILL_PROTECT_SUBSTRINGS"]]
check("protects claude", "claude" in prot)
check("protects marionette", "marionette" in prot)

# 6) an absent OPTIONAL service is 'not_installed' and never acts
absent = md.ServiceMonitor("ghost", {
    "required": False, "health_url": "http://127.0.0.1:1/health", "port": 1,
    "boot_grace_s": 1, "start_dir": r"C:\does\not\exist",
    "detect_file": "nope.bat", "start_cmd": ["cmd", "/c", "echo"],
})
check("absent optional -> not_installed", absent.state == "not_installed")
calls = {"recover": 0}
class _SpySup:
    def alert(self, *a, **k): pass
    def log_action(self, *a, **k): pass
absent.recover = lambda *a, **k: calls.__setitem__("recover", calls["recover"] + 1)
absent.evaluate(_SpySup())
check("not_installed never recovers", calls["recover"] == 0 and absent.state == "not_installed")

# 7) SOMA is detected as installed in this repo
soma = md.ServiceMonitor("soma", CONFIG["SERVICES"]["soma"])
check("SOMA detected installed", soma.installed is True)

print("-" * 40)
print(f"{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
