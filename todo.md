# SOMA Presence Vision Roadmap

## V2: Real Understanding

- [x] Add OCR/deep reading path for useful frames through Deep Describe.
- [x] Add object and scene detection when a vision model is available.
- [x] Trigger deep visual description only when the user asks or an important scene is routed.
- [x] Store important scene summaries into memory/reflections instead of saving every frame.
- [x] Add privacy filters before saving or reasoning over frames.
- [x] Let chat and voice automatically reference the current scene when useful.
- [x] Add raw frame retention so SOMA does not hoard screenshots.
- [x] Add cache status, cleanup, and pin controls in Presence.

Goal: SOMA can reliably answer "what am I looking at?" and "what changed?"

## V3: Guided Computer Control

- Add a Desktop Snapshot button in Presence.
- Interpret visible app, visible text, buttons, inputs, warnings, and likely next actions.
- Generate bounded action proposals like "click Retry", "copy this error", or "open settings".
- Route proposed actions through an approval queue with Approve, Reject, and Edit Instruction.
- Use Playwright for browser actions first.
- Add Windows UI Automation later for desktop app control.
- Verify every action with a fresh screenshot/scene diff.

Goal: SOMA can say "I see the problem, here is the next safe action, approve?"

## V4: Bounded Autonomy

- Allow low-risk autonomous actions such as scroll, read, summarize, open safe pages, and copy diagnostics.
- Require approval for medium-risk actions such as submitting forms, moving files, sending messages, or running commands.
- Block or double-confirm high-risk actions.
- Store action receipts: saw -> decided -> acted -> verified.
- Use scene memory and verification before expanding autonomy.

Goal: SOMA can safely operate parts of the computer with a clear paper trail.

## Next Best Build

Build V2 first:

- [x] OCR/deep reading trigger
- [x] Deep describe trigger
- [x] Privacy controls
- [x] Scene summaries into memory/reflections
- [x] Raw-frame retention controls

---

# Aperture / Portal Roadmap

## Completed Foundation

- [x] Build Aperture as an Electron-hosted desktop shell inside Command Bridge.
- [x] Add dark desktop presentation, window controls, dock cleanup, and launchable applications.
- [x] Add a real Chromium-backed Portal browsing surface inside Aperture when running in Electron.
- [x] Isolate Portal web content from Node and deny webpage permissions by default.
- [x] Separate live browsing from indexed evidence capture.
- [x] Add a Portal-owned local page index and searchable captured corpus.
- [x] Route captured research into SOMA memory, Reflections, and Axis tasks.

## Portal Browser V2: Browser Fundamentals

- [ ] Persist open Portal tabs and restore them after restart.
- [ ] Persist structured browsing history and bookmark collections on the backend.
- [ ] Build a downloads manager with progress, destination, completion, and failed-download states.
- [ ] Build a site permission manager for camera, microphone, location, notifications, clipboard, and downloads.
- [ ] Add private browsing sessions that do not persist cookies, history, or captured pages.
- [ ] Add find-in-page, page zoom, copy URL, open externally, and certificate/security indicators.
- [ ] Add explicit profile/session controls for websites requiring authentication.
- [ ] Store sensitive credentials only through an OS-backed credential mechanism, never plain files.

## Portal Search V2: Owned Index

- [ ] Replace the JSON page corpus with SQLite plus FTS5 full-text search.
- [ ] Store canonical URLs, title, domain, extracted text, captured timestamp, refreshed timestamp, and content hash.
- [ ] Add URL canonicalization and duplicate-content detection.
- [ ] Add freshness/status indicators: live, captured, stale, refreshed, failed.
- [ ] Add source deletion, recapture, archive, and retention controls.
- [ ] Add semantic embedding search alongside FTS results.
- [ ] Rank results using full-text score, semantic match, freshness, source quality, and duplication penalty.
- [ ] Show exactly which indexed extracts support SOMA citations.

## Portal Acquisition V3: Controlled Crawler

- [ ] Add opt-in subscriptions for RSS feeds, documentation sites, PubMed, arXiv, and selected research sources.
- [ ] Add domain-scoped crawling with page budgets, rate limits, robots.txt handling, and refresh schedules.
- [ ] Index URLs opened during approved SOMA research workflows.
- [ ] Add an acquisition queue with pending, indexed, stale, blocked, and failed states.
- [ ] Add change detection so Portal can surface meaningful updates to previously captured sources.
- [ ] Keep external discovery explicitly separate from Portal-owned indexed search.

## Aperture OS Boundary

- [ ] Add a clear system-information view identifying Aperture as an application shell running on the host OS.
- [ ] Decide whether Aperture remains a SOMA desktop environment or eventually becomes a bootable Linux-based distribution.
- [ ] If a bootable system is pursued, define the base OS, installer, updater, device support, security model, recovery path, and application packaging strategy before implementation.

## Recommended Next Build

Build Portal Browser V2 in this order:

1. Server-backed tabs, history, and bookmarks.
2. Downloads and site permissions.
3. SQLite FTS5 index migration.
4. Semantic ranking and evidence citations.
5. Controlled acquisition queue.

---

# Axis File Intelligence Roadmap

## Completed Foundation

- [x] Isolate project uploads into per-project storage folders.
- [x] Delete project file records and physical files when a project is deleted.
- [x] Version uploaded project files by project and original filename.
- [x] Seal uploaded project files with SHA-256 checksums.
- [x] Audit upload, download, delete, analyze, index, and smart workbook export actions.
- [x] Auto-index uploaded project files into SOMA/File Intelligence when readable.
- [x] Convert uploaded Excel sheets into searchable text for SOMA retrieval.
- [x] Add manual project file re-index action.
- [x] Add project-native Excel analysis and report endpoints.
- [x] Add smart workbook export with cover, summary, findings, evidence ledger, sheet profile, raw preview, source links, and formulas.

## Excel Operator V1: Guarded Desktop Assistance

- [ ] Build a guarded Excel Operator for Windows desktop automation.
- [ ] Let floating chat route requests like "find the $10,000 variance in xyz.xlsx" to the Excel Operator.
- [ ] Resolve target workbook from indexed Axis project files, File Intelligence, or explicit path.
- [ ] Run backend Excel analysis before opening Excel.
- [ ] Open the workbook in Microsoft Excel using a Windows-safe automation layer.
- [ ] Jump to likely sheets/cells and highlight suspected variance sources.
- [ ] Add non-destructive comments or a generated reconciliation sheet only after user approval.
- [ ] Require user approval before saving, overwriting, editing formulas, or modifying source files.
- [ ] Store action receipts: request -> file resolved -> analysis -> proposed action -> approved action -> verification.
- [ ] Add rollback/export-copy behavior so SOMA works on a copy by default.

Goal: SOMA can help investigate a workbook interactively while preserving evidence, user control, and file safety.

## Trading: Post-June-17 (after Tiny Live gates resolve)

- [ ] **Confluence transplant** — move scalpingEngine's signal logic (Bollinger oversold + RSI + MACD confluence, regime filter, ATR stops) INTO AutonomousTrader as a tick-triggered ENTRY path for hunt-proven strategies only. The standalone scalpingEngine bypasses promotion tiers, guardrails, and the internal paper portfolio (it orders straight to Alpaca via executeOrderFast) and pollutes the promotion trade log — never run it standalone. Goal: one trader, three speeds (deliberate strategy brain, confluence entries at tick speed, tick-instant exits — exits already live as of 2026-06-11).
- [ ] Mission Control "Scalp Mode" toggle — per symbol, unlocks only for strategies the Strategy Hunt has marked proven (speed as an earned privilege, same philosophy as the live ladder).
- [ ] Fix lowLatencyEngine latency stats (hrtime microseconds vs epoch ms mismatch — cosmetic, ticks themselves are correct).
- [ ] Retire or integrate the standalone scalpingEngine once the transplant lands (avoid a second trader sharing the trade log).

Goal: tick-speed entries with the full safety stack — one trader, one P&L, earned velocity.

## ApertureOS: AI-First OS — SOMA as Copilot

Vision: an OS SOMA can control completely, acting as a real copilot. The kernel
(/dev/soma, syscalls, IPC, VFS) was built for this — the Agency Bridge
(2026-06-11) is the first wire: aperture_os tool + /api/aperture/command →
WS → kernel dispatch (open_app/close_app/notify/portal_navigate), every action
attributed via kernel notification.

- [ ] **Approval queue for higher-risk verbs** — autonomyLevel < 2 turns SOMA's
      commands into approve/deny notifications instead of direct execution
      (the settings already model autonomyLevel + permissions; wire them).
- [ ] **More verbs**: write_note, create_task, add_calendar_event, file_open,
      run_terminal_command (terminal verb = approval-gated always).
- [ ] **Make it HER desktop** — Notes surfaces her diary/reflections, Tasks
      mirrors the GoalEngine, Calendar shows market events (FOMC) + her
      schedule, a desktop widget shows her limbic weather/mood live.
- [ ] **Perception**: kernel reports OS state (open apps, active window,
      idle time) back to SOMA via CNS signals so she knows what Barry is
      doing in Aperture before acting (sees → decides → acts → verifies).
- [ ] **Finish stub apps**: Archive preview/restore, Calendar full CRUD
      against existing backend routes, deeper SystemStatus.
- [ ] **Portal**: surface portalDb permissions + downloads manager UI.
- [ ] **WM polish**: alt-tab, snap keyboard shortcuts, taskbar previews,
      notification center grouping.

Goal: SOMA proactively says "I left the variance report open in Files and
queued the Portal page you wanted" — and it's true.
