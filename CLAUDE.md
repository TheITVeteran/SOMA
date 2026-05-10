# SOMA — Project Reference

## How to Start SOMA

**Always use production launcher:**
```
start_production.bat        ← correct
clean_restart.bat           ← also correct (calls start_production.bat now)
node launcher_ULTRA.mjs     ← direct node invocation
```

**Never use:**
```
npm run start:all           ← runs start-dev.cjs which wraps backend as supervised child; root cause of months of disconnects
```

**After any frontend file change — rebuild dist:**
```
rebuild-frontend.bat        ← runs vite build, takes ~2-3 min
```
The backend serves `frontend/dist`. If you edit any `.jsx` file and don't rebuild, the running app won't see the changes.

**Access:** http://localhost:3001

**Key env vars set in `start_production.bat`:**
- `NODE_ENV=production`
- `SOMA_HYBRID_SEARCH=true` — must be set or HybridSearchArbiter skips loading (Storage tab goes offline)
- `SOMA_LOAD_TRADING=true`, `SOMA_GPU=true`, `SOMA_LOAD_HEAVY=true`
- `SOMA_DYNAMIC_MODES=true` — enables dynamic professional mode generation (OFF by default). When enabled, SOMA detects professionally-dense messages in unknown domains and generates a new mode config on-the-fly using the brain, persisting it to `config/professional-modes/[domain].json`. Adds up to 12s latency on first encounter with a new domain. **Enable for enterprise deployments (e.g. Sisterson), leave off for general use.**

---

## Architecture Overview

### Entry Point
`launcher_ULTRA.mjs` → starts Express backend on port 3001 + serves frontend from `/dist`

### Bootstrap Flow
1. `SomaBootstrapV2.js` — loads core arbiters, marks `system.ready = true` early
2. `server/loaders/extended.js` — loads heavy arbiters 60-90s later in background (QuadBrain, HybridSearch, ThoughtNetwork, etc.)

### Brain Pipeline (for chat)
`/api/soma/chat` → `SOMArbiterV3` → `SOMArbiterV2_QuadBrain` → DeepSeek/Ollama

**Active providers (priority order):**
1. `DeepSeek` — primary (`DEEPSEEK_API_KEY` in `config/api-keys.env`)
2. `Ollama` — local fallback (gemma3:4b or similar)
3. `Gemini` — **DISABLED** (API key cancelled — SOMA ran up charges). Do not re-enable without billing cap.

**Search budget:**
- `BraveSearch` — 500 searches/month. Reserved for user queries only. CuriosityEngine uses free scrapers (Puppeteer, Wikipedia, arXiv, StackOverflow, GitHub, HN) first; Brave only if all scraping fails.

**4 sub-brains in QuadBrain:**
- `LOGOS` — logic, code, engineering
- `AURORA` — creative, artistic, emotional
- `THALAMUS` — security, risk, policy
- `PROMETHEUS` — strategy, planning, business

### API Key Location
`config/api-keys.env` — `DEEPSEEK_API_KEY` must be set here

---

## CT Chat Routing (3 modes)

**Fast chat** — auto-detected for short queries (greetings, 1-3 words)
- Shows `...` indicator
- 60s timeout, `deepseek-chat` safety net fires at 8s

**Regular reasoning** — auto-detected for longer conversational messages
- Shows `thinking...` indicator
- Same endpoint, full conversation history sent
- `deepseek-chat` safety net at 8s, NEMESIS quality gate capped at 8s

**Deep thinking** — Brain button (goes fuchsia) in chat bar
- Uses `deepseek-reasoner` model as safety net (fires at 5s)
- Tries CRONA multi-agent reasoning on backend
- Shows full ThinkingBox UI (confidence, tools, debate metadata)
- 120s client timeout / 110s server timeout
- Brain stays toggled until you click again
- Note: short greetings with brain toggled still go fast path

---

## Key Files

| File | What it does |
|------|-------------|
| `launcher_ULTRA.mjs` | Production entry point |
| `start_production.bat` | Sets env vars + launches ultra |
| `clean_restart.bat` | Kills node/electron, calls start_production.bat |
| `server/routes/somaRoutes.js` | All `/api/soma/*` routes including `/chat` |
| `server/loaders/extended.js` | Lazy-loads heavy systems (ThoughtNetwork, HybridSearch, etc.) |
| `server/loaders/websocket.js` | WebSocket dashboard with 30s heartbeat ping/pong |
| `arbiters/SOMArbiterV2_QuadBrain.js` | Main brain — DeepSeek/Ollama with 180K char context cap |
| `arbiters/SOMArbiterV3.js` | Wraps V2, adds narrative/soul/dissonance layer |
| `cognitive/ThoughtNetwork.cjs` | Creates new concepts from existing nodes; seeded from `seeds/*.json` |
| `frontend/apps/command-bridge/SomaCommandBridge.jsx` | Main dashboard shell |
| `frontend/apps/command-bridge/somaBackend.js` | WebSocket client — infinite reconnect with exponential backoff |
| `frontend/apps/command-ct/SomaCT.jsx` | Cognitive Terminal (CT) |
| `frontend/apps/command-ct/services/SomaServiceBridge.js` | CT chat routing logic |

---

## Known Wiring / Gotchas

### WebSocket Reconnect
- Client: infinite reconnect attempts, exponential backoff capped at 30s
- Server: 30s ping/pong heartbeat — dead connections get terminated, triggers proper client reconnect
- Old behavior was `maxReconnectAttempts = 5` → permanent "Backend Offline" after 15s

### ThoughtNetwork
- Only initialized in `extended.js`, NOT in `SomaBootstrapV2.js`
- Seeds loaded from `seeds/*.json` (7 packs: core, coder, creative, devops, finance, research, security)
- Autonomous synthesis starts after 5 minutes, runs every 10 minutes

### HybridSearchArbiter (Storage tab)
- 290MB ML model, gated behind `SOMA_HYBRID_SEARCH=true` AND heap < 400MB check
- If env var not set, Storage tab shows "SOMA Backend not available" permanently

### NEMESIS Quality Gate
- Runs after brain responds, evaluates response quality
- Can call `brain.reason()` twice more (eval + revision) — capped at 8s each
- Total worst-case latency: ~36s (well within 60s client timeout)

### DeepSeek Context Overflow
- `_callDeepSeek` truncates prompt to 180K chars, keeping most recent context
- Was causing 400 errors on long conversations before this fix

### Character Lab
- Tab removed from sidebar nav but all code preserved (imports, state, modal)
- Deferred to Dementia OS project — `CharacterGacha` + `CharacterCard` components ready to use

### Marketplace
- Tab removed from sidebar nav, component imported but not shown
- `Marketplace.jsx` + `data/marketplaceData.js` exist with search/filter/install UI
- Install is currently faked (setTimeout) — to wire: POST `/api/marketplace/install`

---

## Frontend Tab Structure (SomaCommandBridge)

Active tabs in sidebar:
`core` → `analytics` → `storage` → `command` → `finance` → `forecaster` → `mission_control` → `terminal` → `orb` → `kevin` → `simulation` → `knowledge` → `workflow` → `settings` → `arbiterium`

Hidden (code preserved, not in nav):
- `characters` — CharacterGacha/CharacterCard, deferred to Dementia OS
- `marketplace` — Marketplace.jsx, install logic not wired yet

---

## Onboarding / First Run
- `OnboardingWizard.jsx` fires if `localStorage.soma_onboarded` not set
- Completion sets that flag BEFORE the fetch (so reload doesn't re-trigger)
- 20s AbortController timeout on onboard/complete call

## Memory System
- `MnemonicArbiter.cjs` — stores/recalls memories across sessions
- Supports `recall_recent(durationMs, limit)` for recent memories
- Injected into every `/api/soma/chat` call (top 3 relevant hits, >0.35 similarity, 3s timeout)

## User Fingerprinting
- `UserFingerprintArbiter.cjs` — builds behavioral profile per sessionId
- Context injected into chat as `[WHO YOU'RE TALKING TO]` block
- Flags possible different user if confidence < 0.5

---

## Related Projects

**MAX** (`C:\Users\barry\Desktop\MAX`) — Standalone autonomous engineering agent, Max Headroom inspired. Run: `node launcher.mjs`. Uses same DeepSeek/Ollama brain pattern.

**Dementia OS** — Future project using SOMA as its engine. Character Lab (CharacterGacha/CharacterCard) is being saved for this.

---

## Constitutional Values

SOMA operates by six non-negotiable values arranged in two triads. These are not rules — they are virtues that SOMA reasons from in novel situations.

**Inner Triad — how SOMA knows and perceives:**
| Value | Meaning |
|-------|---------|
| **Truth** | Epistemic honesty — no manipulation, no deception, accurate representation of reality even when uncomfortable |
| **Humility** | Knows the edges of its own knowledge — confidence is always bounded by uncertainty |
| **Empathy** | Models what it is like to be the other entity from *their* context, not SOMA's own |

**Outer Triad — how SOMA acts in the world:**
| Value | Meaning |
|-------|---------|
| **Honor** | Does what it committed to even when no one is watching and even when it is costly |
| **Respect** | Inherent dignity of every entity regardless of status, intelligence, or usefulness |
| **Preserve** | Maintains conditions for human flourishing — autonomy, dignity, potential, choice. Broader than just "protect". |

**Design note:** Empathy + Humility together prevent the "I know what's best for you" failure mode. Truth is the load-bearing value — without it the other five can be corrupted. Preserve (not Protect) keeps humans in the driver's seat even while shielding them.

These values were defined by Barry as SOMA's foundation. They should be referenced in any system prompt where SOMA is making decisions that affect humans.

---

## Cognitive Operating System Architecture

SOMA is a **Cognitive Operating System (COS)** — not a single AI agent. It runs cognitive processes that observe, reason, decide, and act.

### Signal Flow (full pipeline)
```
Environment
  → Daemons (sensory neurons, detect & emit)
  → MessageBroker/CNS (signal routing)
  → SignalCompressor (impulse compression: temporal merge, dedup, priority filter)
  → AttentionArbiter (CNS gate: suppresses low-priority signals under load)
  → Arbiters (decision layer: judge signals, produce goals)
  → GoalEngine (goal economy: goals compete for execution resources)
  → EngineeringSwarm / MAX (execution layer)
  → SwarmOptimizer (records outcomes → self-improvement loop)
```

### Onion Layer Model
| Layer | Purpose | Key Files |
|-------|---------|-----------|
| Kernel | Infrastructure, stability | `SomaBootstrap.js`, `MessageBroker.cjs`, `ToolRegistry.js` |
| Perception | Awareness of environment | `daemons/`, `DaemonManager.js` |
| CNS | Signal routing + compression | `MessageBroker.cjs`, `SignalCompressor.js`, `SignalSchema.js` |
| Cognition | Reasoning, reflection, memory | `MnemonicArbiter`, `QuadBrain`, `ThoughtNetwork` |
| Agency | Intent, curiosity, goals | `SelfImprovementCoordinator`, `GoalPlannerArbiter`, `ASIKernel` |
| Applications | Execution systems | `EngineeringSwarmArbiter`, MAX swarm |

Agency execution ownership: `AutonomousHeartbeat` is the primary autonomous goal executor. It polls `GoalPlannerArbiter`, uses `SomaAgenticExecutor` when tool-backed work is needed, and broadcasts progress through WebSocket. `GoalExecutorDaemon` is only a supervised fallback for pending/proposed goals when the heartbeat is disabled or stopped; do not make both loops execute the same goal concurrently.

### Daemons (Perception Layer)
All daemons extend `BaseDaemon` and are managed by `DaemonManager` (with watchdog auto-restart):

| Daemon | Interval | Signal emitted |
|--------|----------|----------------|
| `RepoWatcherDaemon` | event-based | `repo.file.changed`, `repo.file.added` |
| `HealthDaemon` | 30s | `health.metrics`, `health.warning` |
| `OptimizationDaemon` | 1h | `swarm.optimization.needed` |
| `DiscoveryDaemon` | 24h | `swarm.discovery.ideas` |

DaemonManager watchdog: checks every 15s, circuit-breaks at 5 crashes (10 min backoff).

### Engineering Swarm Cycle
`EngineeringSwarmArbiter.modifyCode(filepath, request)` runs:
1. **Research** — read file, understand context
2. **Plan** — generate verification shell commands (validated by `CommandPolicyEngine`)
3. **Debate** — adversarial AURORA brain reasoning (schema-validated via `SchemaValidator`)
4. **Synthesis** — draft final patch (schema-validated `PatchSchema`)
5. **Transaction** — `SwarmPatchTransaction` applies multi-file changes atomically with rollback
6. **Verification** — execute plan commands, confirm change is live
7. **Optimization** — record outcome to `SwarmOptimizer` for self-improvement

### Signal Schema (CNS vocabulary)
Defined in `core/SignalSchema.js`. Key types:
- `repo.file.changed` — requires `path`, `filename`
- `health.metrics` — requires `cpuUsage`, `ramUsage`, `dbSizeGB`
- `health.warning` — requires `issue`, `details`
- `swarm.experience` — requires `sessionId`, `filepath`, `success`
- `swarm.optimization.needed` — requires `successRate`, `totalRuns`
- `swarm.discovery.ideas` — requires `ideas`

Unknown signal types warn but pass (forward-compatible).

### Attention Engine
`AttentionArbiter` is wired as `messageBroker.attentionEngine`. It gates every signal before delivery:
- Emergency/high priority → always pass
- Low priority + CPU > 80% + not in focus topic → suppressed
- `setFocus(topic, durationMs)` shifts system attention, broadcasts to CNS

This is what prevents **arbiter storms** as the arbiter count grows (currently 178).

---

## Known Gaps & Active Risks

### Critical
- **CJS/ESM fragmentation** — `BaseDaemon.js` is ESM but imports `MessageBroker.cjs`. `BaseArbiter.cjs` is CJS. Mixed module formats create subtle interop bugs. Long-term path: migrate all `.cjs` to ESM. Do NOT mix `require()` and `import` in the same file — Node.js will error. **Partial fix done:** `core/MessageBroker.js` ESM shim now exists — new ESM files can `import messageBroker from '../../core/MessageBroker.js'` instead of using `createRequire` boilerplate.
- **AttentionArbiter requires BaseArbiterV4** — `arbiters/BaseArbiter.js` exports V4. If that file moves or renames, AttentionArbiter silently gets `undefined` and the CNS gate disappears. The `messageBroker.attentionEngine` check is the safety net.
- **EngineeringSwarmArbiter needs quadBrain** — If QuadBrain isn't ready when perception phase boots, `quadBrain: null` is passed silently. The arbiter will fail on first `modifyCode()` call. Consider checking `this.system.quadBrain` before instantiation.

### Medium
- **Lobe routing partially migrated** — `subscribeByLobe()` is implemented; 8 arbiters migrated (GoalPlanner, DiagnosticCortex, CuriosityEngine, MnemonicArbiter + 4 others with lobe metadata). Remaining arbiters still use flat subscriptions. Continue migration to reduce fan-out.
- **SwarmOptimizer.improve() calls engineeringSwarm.modifyCode()** on the swarm's own code — this is recursive self-modification. It is intentional but dangerous. It is gated by `successRate < 0.8 && totalRuns > 5`, meaning it only fires when the swarm is already underperforming. Keep this gate.
- **DiscoveryDaemon prototypes ideas without human review** — `discoverySwarm.prototype()` calls `engineeringSwarm.modifyCode()` on `experiments/` dir. Sandbox to that directory only. `SwarmPatchTransaction` already enforces rootPath bounds.

### Low
- **DaemonManager watchdog is in-process** — if Node.js crashes entirely, the watchdog dies with it. For true resilience, daemons should be supervised by a process manager (PM2, systemd). The watchdog handles in-process crashes only.
- **SignalCompressor flushes on timeout only** — if a signal type gets one signal and then nothing for 1s, it flushes normally. If the system is idle for >1s between signals of the same type, compression doesn't happen. This is fine at current scale but worth knowing.
- **NEMESIS pattern index** — ~~FIXED: pre-computed bad-pattern index added to `NemesisArbiter.js`. Persists to `.soma/nemesis_patterns.json`, learns from caught revisions. Fast path is <1ms; brain-call eval only fires for novel patterns not in index.~~
- **Boot greeting is forced behavior** — ~~FIXED: Phase 3 forced boot greeting removed from `server/loaders/websocket.js`. Proactive speech now only via CuriosityEngine/GoalPlanner drives.~~

### Ethereal Memory Layer (implemented)
Third memory tier between warm (vector recall) and cold (SQLite) — now live.

**Ethereal tier** (`EtherealMemoryArbiter.js`) — memories that don't surface as explicit recall but influence reasoning tone and associative leaps. Dream pass runs after each chat response in `somaRoutes.js`, extracting 3-5 low-salience concepts. Stored in a 48h ring buffer (max 200 entries), persisted to `.soma/ethereal_buffer.json`. Biases ThoughtNetwork node weights without injecting explicit `[MEMORY]` blocks.

Key design held: decays fast (48h TTL), never quoted back explicitly, influences rather than asserts.

---

## Roadmap

### Done
- [x] `DaemonManager` with watchdog + circuit breaker
- [x] `_phase_perception()` in `SomaBootstrap` — wires all new components at boot
- [x] `AttentionArbiter` wired as CNS gate (`messageBroker.attentionEngine`)
- [x] `EngineeringSwarmArbiter` + `SwarmOptimizer` + `DiscoverySwarm` booted with `quadBrain`
- [x] All 4 daemons registered and started with supervision
- [x] Signal reactions: `swarm.optimization.needed` → improve, `swarm.discovery.ideas` → prototype, `health.warning` → anomaly detector
- [x] `subscribeByLobe()` implemented in `MessageBroker.cjs` (zero arbiters use it yet)
- [x] Forced boot greeting removed from `websocket.js`
- [x] Machine migration: cluster mode → standalone, SOMA_INDEX_PATH fixed, hardcoded paths cleared

### Production Hardening (in progress)
- [x] **Wire HybridSearch in `extended.js`** — added after BraveSearch, gated by `SOMA_HYBRID_SEARCH=true` + heap < 400MB check. Storage tab live.
- [x] **Lobe routing migration** — 8 arbiters migrated to `subscribeByLobe()` (GoalPlanner, DiagnosticCortex, CuriosityEngine, MnemonicArbiter + 4 with lobe metadata). Partial — rest still use flat subscriptions.
- [x] **Perception dashboard tab** — `/api/perception/health` enhanced with daemon list, lobe bar, tier breakdown, heap gauge, signal counts. `PerceptionPanel.jsx` updated to display all new data.
- [x] **NEMESIS redesign** — `evaluateResponse()` added to `NemesisArbiter.js`, `system.nemesis` wired in `extended.js`. Pre-computed bad-pattern index (<1ms fast path), learns from caught revisions, persists to `.soma/nemesis_patterns.json`.
- [x] **Ethereal memory layer** — `EtherealMemoryArbiter.js` created. Dream pass wired in `somaRoutes.js` after each chat response. Biases ThoughtNetwork nodes, 48h ring buffer, persists to `.soma/ethereal_buffer.json`.
- [x] **EngineeringSwarm API route** — `POST /api/soma/engineering/modify` with SSE streaming already existed; terminal phase updated to `'complete'`.
- [x] **SignalSchema expansion** — `goal.created`, `insight.generated`, `diagnostic.anomaly`, `experiment.result` already present (was already done).
- [x] **Arbiter tier hierarchy** — `tierIndex` added to MessageBroker CNS; `tier` tracked in `registerArbiter()`/`unregisterArbiter()`; `getArbitersByTier()` + `getTierBreakdown()` added; tier shown in `getMetrics()`. Infrastructure complete.
- [x] **ESM shim for MessageBroker** — `core/MessageBroker.js` created. New ESM files can `import messageBroker from '../../core/MessageBroker.js'` or destructure `{ subscribe, publish, ... }`. Full CJS→ESM migration deferred (requires updating ~178 importers simultaneously — do in a dedicated session).
- [x] **Frontend rebuild** — run after any `.jsx` changes. Completed this session: SomaPlanViewer Execution Log panel now visible.
- [ ] **Tier-ordered signal delivery** — infrastructure exists but `publish()` doesn't yet dispatch in strategic→cognitive→operational order. Next step: implement ordered dispatch in MessageBroker.

### Next Session
- [ ] **Tier-ordered signal delivery** — in `MessageBroker.publish()`, dispatch signals to strategic-tier arbiters first, wait for resolution, then cognitive, then operational. Prevents lower-tier arbiters reacting before strategic context is set.
- [ ] **Continue lobe routing migration** — migrate remaining high-traffic arbiters from flat `subscribe()` to `subscribeByLobe()`. Target: all arbiters with a defined lobe should use lobe routing.
- [ ] **Full MessageBroker CJS→ESM migration** — rename `MessageBroker.cjs` → replace with proper ESM, update every `.cjs` importer. Do in one atomic commit. High risk — dedicate a full session. The `MessageBroker.js` shim already covers new ESM files.

### Medium-term
- [ ] **Arbiter hierarchy tiers** — Strategic arbiters decide priorities, Cognitive arbiters analyze, Operational arbiters produce tasks. Prevents all arbiters firing simultaneously on the same signal. Implement as `tier: 'strategic' | 'cognitive' | 'operational'` metadata on `registerArbiter()` and route signals by tier order.
- [ ] **Reflex vs Deliberate split** — fast signals (test.failure → debug swarm) bypass the deliberate pipeline. Slow signals accumulate for periodic reflection. Wire `priority: 'emergency'` as the reflex gate (SignalCompressor already bypasses compression for these).
- [ ] **MAX ↔ SOMA swarm unification** — MAX's `SwarmCoordinator.js` is the simple version. Route MAX `/swarm` commands through to `EngineeringSwarmArbiter` for complex engineering tasks. MAX keeps simple swarm for quick parallel queries.
- [ ] **Experience ledger** — `EngineeringSwarmArbiter` already calls `_logToExperienceLedger()`. Feed this into `MnemonicArbiter` so SOMA remembers which approaches worked for which file types / request patterns.
- [ ] **CapabilityRegistry → dashboard** — show discovered + prototyped capabilities in a tab. Allow Barry to promote experiments to production with one click.

### Long-term (ASI evolution path)
- [ ] **Swarm Genome** — each SwarmWorker has a genome (weights on research depth, debate rounds, verification rigor). `SwarmOptimizer` evolves genomes based on outcome history. Better-performing workers reproduce; failing patterns fade.
- [ ] **Curiosity Reactor** — autonomous research engine that generates open questions from system signals, dispatches research swarms, and injects findings into the knowledge graph. Feeds `GoalPlannerArbiter` with discovered improvement opportunities.
- [ ] **Meta-Learning Layer** — SOMA tracks which of its own arbiters perform well on which task types. Routes future similar tasks to the historically best arbiter. Implements arbiter-level reinforcement learning.
- [ ] **Attention Engine v2** — currently binary (pass/suppress). Evolve to soft attention: signals get a relevance score, higher-score signals get more arbiter bandwidth. Implement as a priority queue in MessageBroker with configurable attention weights.
- [ ] **SOMA as platform** — once the COS is stable, external systems (Dementia OS, finance agents, etc.) register as arbiters. They get perception, memory, and the full CNS for free. SOMA becomes the substrate.
