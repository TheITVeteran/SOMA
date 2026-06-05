// ════════════════════════════════════════════════════════════════════════════
// AutonomousHeartbeat.js
// ════════════════════════════════════════════════════════════════════════════
// The "Pulse" of SOMA's self-driven behavior.
// Periodically polls autonomous systems (GoalPlanner, CuriosityEngine) for tasks,
// and executes them using the local SOMA-1T model to save tokens.
//
// Features:
//   - JSONL run log with auto-pruning  (inspired by clawdbot cron/run-log)
//   - Flexible scheduling: interval, cron expressions, one-shot "at"
//   - Per-task state tracking with duration, error, status history
// ════════════════════════════════════════════════════════════════════════════

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch { /* nodemailer optional */ }
const { DriveSystem }  = require('../../core/DriveSystem.cjs');
const { AgendaSystem } = require('../../core/AgendaSystem.cjs');
const { ownerName }    = require('../../core/SomaOwner.cjs');
const workLedger = require('../../core/AutonomousWorkLedger.cjs');

// ── Run Log constants ──
const RUN_LOG_DIR = path.join(__dirname, '..', '.soma', 'heartbeat');
const RUN_LOG_PATH = path.join(RUN_LOG_DIR, 'runs.jsonl');
const TASK_STATE_PATH = path.join(RUN_LOG_DIR, 'task-state.json');
const SCHEDULE_PATH = path.join(RUN_LOG_DIR, 'schedules.json');
const RUN_LOG_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const RUN_LOG_KEEP_LINES = 2000;

// ── Simple cron parser (minute hour dom month dow) ──
function parseCronExpr(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  return { minute: parts[0], hour: parts[1], dom: parts[2], month: parts[3], dow: parts[4] };
}

function cronFieldMatches(field, value) {
  if (field === '*') return true;
  // Handle */N step values
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    return !isNaN(step) && step > 0 && value % step === 0;
  }
  // Handle comma-separated values
  const values = field.split(',').map(v => parseInt(v, 10));
  return values.includes(value);
}

function cronMatchesNow(cron, now) {
  const d = now || new Date();
  return (
    cronFieldMatches(cron.minute, d.getMinutes()) &&
    cronFieldMatches(cron.hour, d.getHours()) &&
    cronFieldMatches(cron.dom, d.getDate()) &&
    cronFieldMatches(cron.month, d.getMonth() + 1) &&
    cronFieldMatches(cron.dow, d.getDay())
  );
}

class AutonomousHeartbeat extends EventEmitter {
  constructor(system, config = {}) {
    super();
    this.system = system;
    this.config = {
      intervalMs: config.intervalMs || 2 * 60 * 1000, // Default: 2 minutes
      maxConsecutiveFailures: 5,
      enabled: false,
      ...config
    };

    this.timer = null;
    this.isRunning = false;
    this.isProcessing = false;
    this.stats = {
      cycles: 0,
      tasksExecuted: 0,
      failures: 0,
      lastRun: null,
      lastTask: null,
      lastResult: null
    };

    // ── Per-task state tracking ──
    // key = "source:identifier" → { lastRunAt, lastStatus, lastError, lastDurationMs, runs, failures }
    this.taskState = new Map();

    // ── Goal stall tracking — counts heartbeat attempts per goal ──
    // key = goalId → { attempts, lastProgress }
    this._goalAttempts = new Map();

    // ── Scheduled jobs (cron/at/every beyond the base interval) ──
    // { id, name, schedule: { kind, ... }, message, enabled, state }
    this.scheduledJobs = [];

    // ── Run log write serialization ──
    this._logWriteChain = Promise.resolve();

    this.logger = config.logger || console;

    // ── Idle cycle counter (for proactive messaging cadence) ──
    this._idleCycles = 0;

    // ── Proactive FloatingChat throttle ──
    // Max 1 heartbeat-sourced proactive message per 15 min, and only for meaningful tasks
    this._lastProactiveAt = 0;
    this._PROACTIVE_COOLDOWN_MS = 15 * 60 * 1000;

    // ── Drive system: tension / urgency / reward ──
    this.drive = new DriveSystem();

    // ── Learning agenda: 200-item knowledge roadmap toward ASI ──
    this.agenda = new AgendaSystem();
  }

  async initialize() {
    this.logger.log('[AutonomousHeartbeat] ❤️ Initializing SOMA Pulse...');
    this._ensureLogDir();
    this._loadTaskState();
    this._loadSchedules();
    // Auto-start if configured, otherwise wait for toggleAutopilot
    if (this.config.enabled) {
      this.start();
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger.log(`[AutonomousHeartbeat] ▶️  Pulse STARTED (Interval: ${this.config.intervalMs / 1000}s)`);
    
    // Run immediately, then interval
    this.tick();
    this.timer = setInterval(() => this.tick(), this.config.intervalMs);
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this._saveTaskState();
    this.logger.log('[AutonomousHeartbeat] ⏸️  Pulse STOPPED');
  }

  // ═══════════════════════════════════════════
  // SCHEDULING: Add/remove flexible schedules
  // ═══════════════════════════════════════════

  /**
   * Add a scheduled job.
   * schedule types:
   *   { kind: 'every', everyMs: 300000 }             — every 5 min
   *   { kind: 'cron',  expr: '0 9 * * *' }           — daily at 9am
   *   { kind: 'at',    atMs: 1708500000000 }         — one-shot at timestamp
   */
  addSchedule(job) {
    const id = job.id || `sched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry = {
      id,
      name: job.name || 'Unnamed schedule',
      description: job.description || job.message || '',
      message: job.message || job.description || '',
      enabled: job.enabled !== false,
      schedule: job.schedule, // { kind, everyMs?, expr?, atMs? }
      createdAt: Date.now(),
      state: {
        lastRunAt: null,
        lastStatus: null,
        lastError: null,
        lastDurationMs: null,
        nextRunAt: this._computeNextRun(job.schedule),
        runs: 0
      }
    };
    this.scheduledJobs.push(entry);
    this._saveSchedules();
    this.logger.log(`[AutonomousHeartbeat] 📅 Schedule added: "${entry.name}" (${entry.schedule.kind})`);
    return entry;
  }

  removeSchedule(id) {
    const idx = this.scheduledJobs.findIndex(j => j.id === id);
    if (idx === -1) return false;
    const removed = this.scheduledJobs.splice(idx, 1)[0];
    this._saveSchedules();
    this.logger.log(`[AutonomousHeartbeat] 🗑️ Schedule removed: "${removed.name}"`);
    return true;
  }

  listSchedules() {
    return this.scheduledJobs.map(j => ({ ...j }));
  }

  /**
   * Compute next run time for a schedule.
   */
  _computeNextRun(schedule, now) {
    const nowMs = now || Date.now();
    if (!schedule) return null;

    if (schedule.kind === 'at') {
      return schedule.atMs > nowMs ? schedule.atMs : null;
    }

    if (schedule.kind === 'every') {
      const everyMs = Math.max(1, Math.floor(schedule.everyMs || 60000));
      const anchor = Math.max(0, Math.floor(schedule.anchorMs || nowMs));
      if (nowMs < anchor) return anchor;
      const elapsed = nowMs - anchor;
      const steps = Math.max(1, Math.floor((elapsed + everyMs - 1) / everyMs));
      return anchor + steps * everyMs;
    }

    if (schedule.kind === 'cron') {
      // For cron, we just check at each tick whether the expression matches.
      // Return a sentinel to indicate "determined at tick time".
      return -1; // Sentinel: check at tick time
    }

    return null;
  }

  /**
   * Check which scheduled jobs are due right now.
   */
  _getDueSchedules() {
    const now = Date.now();
    const due = [];

    for (const job of this.scheduledJobs) {
      if (!job.enabled) continue;

      if (job.schedule.kind === 'at') {
        if (job.state.nextRunAt && now >= job.state.nextRunAt) {
          due.push(job);
        }
      } else if (job.schedule.kind === 'every') {
        if (job.state.nextRunAt && now >= job.state.nextRunAt) {
          due.push(job);
        }
      } else if (job.schedule.kind === 'cron') {
        const cron = parseCronExpr(job.schedule.expr);
        if (cron && cronMatchesNow(cron)) {
          // Avoid running the same cron job twice in the same minute
          const lastRun = job.state.lastRunAt || 0;
          const minuteAgo = now - 60000;
          if (lastRun < minuteAgo) {
            due.push(job);
          }
        }
      }
    }

    return due;
  }

  // ═══════════════════════════════════════════
  // WEBSOCKET BROADCASTING
  // ═══════════════════════════════════════════

  /**
   * Push a real-time event to all connected frontends.
   * Uses the unified broadcast (Dashboard WS + Socket.IO).
   */
  _broadcast(event, data) {
    try {
      this.system.ws?.broadcast?.(event, { ...data, timestamp: Date.now() });
    } catch (e) {
      // Non-critical — never break heartbeat for a broadcast failure
    }
  }

  // ═══════════════════════════════════════════
  // CORE TICK
  // ═══════════════════════════════════════════

  /**
   * The core execution loop — polls for tasks AND checks scheduled jobs.
   */
  async tick() {
    if (this.isProcessing || !this.isRunning) return;
    this.isProcessing = true;
    this.stats.lastRun = Date.now();

    try {
      // ── Priority boot-load: activate high-value arbiters on first tick ──
      // Runs once, 2 minutes after boot (when the system is settled).
      // Only loads arbiters that are stable and genuinely high-value.
      if (!this._priorityBootDone && this.system.arbiterLoader) {
        this._priorityBootDone = true;
        const PRIORITY_ARBITERS = ['CausalityArbiter.js'];
        for (const file of PRIORITY_ARBITERS) {
          // Skip if already loaded
          const name = file.replace(/\.(js|cjs)$/, '');
          const alreadyLoaded = this.system.messageBroker?.getArbiter?.(name);
          if (alreadyLoaded?.instance) continue;
          this.system.arbiterLoader.loadByFile(file).then(inst => {
            if (inst) this.logger.log(`[Heartbeat] 🔌 Priority-loaded: ${inst.name || file}`);
          }).catch(e => this.logger.log(`[Heartbeat] ⚠️ Priority-load failed (${file}): ${e.message}`));
        }
      }

      // ── Phase 1: Execute any due scheduled jobs ──
      const dueJobs = this._getDueSchedules();
      for (const job of dueJobs) {
        await this._executeScheduledJob(job);
      }

      // ── Phase 2: Poll autonomous systems for organic tasks ──
      const task = await this._pollForTask();
      
      if (task) {
        const startTime = Date.now();
        this.logger.log(`[AutonomousHeartbeat] ⚡ Executing autonomous task: "${task.description.substring(0, 60)}..."`);
        this.stats.lastTask = task.description;

        // ── Multi-Lobe Consensus Debate Gate ──
        // Only run for strategic goal tasks under high drive tension
        if (task.context?.goalId && this.drive.getStatus().tension > 0.6) {
          try {
            await this._debateTaskProposal(task);
          } catch (e) {
            this.logger.warn(`[AutonomousHeartbeat] ⚠️  Debate gate error: ${e.message}`);
          }
        }

        // ── Agentic execution for real goal tasks ──
        // If this is a GoalPlanner task and the AgenticExecutor is wired in,
        // use it instead of a plain QuadBrain.reason() call. The executor runs
        // a real ReAct loop with actual tools (web_fetch, read_file, etc.).
        let result;
        const isGoalTask = task.context?.goalId && this.system.agenticExecutor;

        if (isGoalTask) {
          const goal = this.system.goalPlanner?.goals?.get(task.context.goalId);
          if (goal) {
            const execResult = await this.system.agenticExecutor.execute(goal);
            const toolsList = (execResult.toolsUsed || []).join(', ') || 'reasoning';
            // Only count real work: tools must have been used for any progress credit
            const toolsUsedCount = (execResult.toolsUsed || []).length;
            let progressVal = execResult.done
              ? 100
              : toolsUsedCount === 0
                ? 0  // No tools executed — brain error, format failure, or rate limit
                : Math.min(20 + (execResult.iterations || 0) * 11, 82);

            // Gap 4: Verify concrete outcomes when SOMA claims completion
            let verificationNote = '';
            if (execResult.done) {
              const verification = await this._verifyGoalCompletion(goal, execResult);
              if (!verification.verified) {
                const failed = verification.checks.filter(c => !c.passed).map(c => c.check).join(', ');
                this.logger.warn(`[AutonomousHeartbeat] ⚠️ Verification failed: ${failed}`);
                progressVal = 75; // Downgrade from 100 — claimed done but artifacts missing
                verificationNote = `\nVERIFICATION: FAILED (${failed}) — progress rolled back to 75%`;
              } else if (verification.checks.length > 0) {
                verificationNote = `\nVERIFICATION: passed (${verification.checks.map(c => c.check).join(', ')})`;
              }
            }

            result = {
              ok: true,
              text: [
                `ACTION: Agentic execution (${execResult.iterations} step(s) | tools: ${toolsList})`,
                `RESULT: ${execResult.result || 'Partial progress'}`,
                `PROGRESS: ${progressVal}`,
                `COMPLETE: ${progressVal === 100 ? 'yes' : 'no'}`,
                `INSIGHT: ${(execResult.result || 'none').substring(0, 150)}`
              ].join('\n') + verificationNote,
              brain: 'AgenticExecutor',
              evidence: {
                toolBacked: toolsUsedCount > 0,
                toolsUsed: execResult.toolsUsed || [],
                observations: execResult.observations || []
              }
            };
          }
        }

        // Fallback: QuadBrain.reason() for background tasks.
        // task.gemini === true  → use Gemini (agenda items: one-time synthesis for training data)
        // task.gemini === false → use local model (curiosity, nighttime, schedules — save tokens)
        if (!result) {
          const useLocal = !task.gemini;
          // Prepend goalId to description so SOMA can call complete_goal with the correct ID
          const goalId = task.context?.goalId;
          const taskDescription = goalId
            ? `[ACTIVE GOAL: id=${goalId}]\n${task.description}`
            : task.description;
          result = await this.system.quadBrain.reason(taskDescription, {
            localModel:    useLocal,
            quickResponse: false,
            source: 'autonomous_heartbeat',
            context: task.context || {},
            tools: this.system.toolRegistry?.getToolsManifest?.() || [],
            systemOverride: useLocal
              ? 'You are SOMA-1T (System 1). Execute this task efficiently using your internal knowledge. Be concise. When the task is done, call complete_goal with the goal ID shown above.'
              : undefined  // Agenda: let QuadBrain route to best available model (PROMETHEUS/Gemini)
          });
        }

        const durationMs = Date.now() - startTime;
        const taskKey = `${task.source}:${task.context?.goalId || task.context?.topic || 'default'}`;

        if (result.ok) {
          this.stats.tasksExecuted++;
          this.stats.lastResult = "Success";
          this.drive.onTaskExecuted(); // Release some tension — we did something
          this._updateTaskState(taskKey, 'ok', null, durationMs);
          if (this.system?.auditLedger) {
            this.system.auditLedger.append({
              actor: 'AutonomousHeartbeat',
              action: 'goal_executed',
              metadata: { goalType: task.source, result: typeof result.text === 'string' ? result.text.slice(0, 200) : 'executed' }
            });
          }
          
          // Record to long-term memory
          if (this.system.mnemonicArbiter?.remember) {
            let memContent = null;
            let memType    = 'autonomous_action';
            let memImportance = 5;

            if (task.source === 'LearningAgenda' && task.context?.itemText) {
              // Store the Gemini synthesis as a retrievable [Learned] memory.
              // Parse SYNTHESIS for the full text; fall back to INSIGHT headline.
              const synthesisMatch = result.text?.match(/SYNTHESIS:\s*([\s\S]+?)(?=\nINSIGHT:|\nTRAINING_Q:|$)/i);
              const insightMatch   = result.text?.match(/INSIGHT:\s*([\s\S]+?)(?=\nTRAINING_Q:|$)/i);
              const synthesis = (synthesisMatch?.[1] || '').trim();
              const insight   = (insightMatch?.[1]   || synthesis).trim();
              // Quality gate: skip malformed / empty responses
              const tooShort  = synthesis.length < 80 && insight.length < 40;
              const isGeneric = /^(this|the topic|it is|it's|none|n\/a)/i.test(synthesis);
              if (!tooShort && !isGeneric) {
                const headline = insight.length > 20 ? insight.substring(0, 200) : synthesis.substring(0, 200);
                memContent    = `[Learned] ${task.context.itemText.substring(0, 100)}: ${headline}`;
                memType       = 'learned_concept';
                memImportance = 7; // Gemini-quality synthesis — high confidence, surfaces in recall
              }
              // else: discard — malformed response, don't pollute the memory store
            } else {
              // All other background sources: store a trimmed summary
              memContent = `Autonomous [${task.source}]: ${task.description.substring(0, 80)} → ${result.text.substring(0, 200)}`;
            }

            if (memContent) {
              await this.system.mnemonicArbiter.remember(
                memContent,
                { type: memType, importance: memImportance, source: task.source }
              ).catch(() => {});
            }
          }

          // Callback to source system
          if (task.onComplete) {
            await task.onComplete(result);
          }
          
          // Append to run log
          this._appendRunLog({
            source: task.source,
            taskKey,
            description: task.description.substring(0, 200),
            status: 'ok',
            durationMs,
            output: (result.text || '').substring(0, 300)
          });

          this._broadcast('soma_activity', {
            source: task.source,
            description: task.description.substring(0, 120),
            output: (result.text || '').substring(0, 200),
            status: 'ok',
            durationMs
          });

          // ── Proactive FloatingChat update (throttled, only for meaningful tasks) ──
          await this._sendProactiveSummary(task, result).catch(() => {});

          this.logger.log(`[AutonomousHeartbeat] ✅ Task complete (${durationMs}ms): ${result.text.substring(0, 50)}...`);
        } else {
          this.stats.failures++;
          const errorMsg = result.error || 'Unknown error';
          this.stats.lastResult = "Failed: " + errorMsg;
          this._updateTaskState(taskKey, 'error', errorMsg, durationMs);

          if (task.source === 'GoalPlanner') {
            await this._updateNarrativeThread(`Failed goal task: "${task.context?.goalTitle || 'Goal'}" due to: ${errorMsg}`);
          }

          this._appendRunLog({
            source: task.source,
            taskKey,
            description: task.description.substring(0, 200),
            status: 'error',
            error: errorMsg,
            durationMs
          });

          this._broadcast('soma_activity', {
            source: task.source,
            description: task.description.substring(0, 120),
            status: 'error',
            error: errorMsg,
            durationMs
          });

          this.logger.warn(`[AutonomousHeartbeat] ⚠️ Task failed (${durationMs}ms): ${this.stats.lastResult}`);
        }
    } else {
        this._idleCycles++;
        this.drive.onIdleTick(); // Tension builds when SOMA sits idle
        // No tasks — log a heartbeat-only entry periodically (every 10 cycles)
        if (this.stats.cycles > 0 && this.stats.cycles % 10 === 0) {
          this._appendRunLog({ source: 'heartbeat', status: 'idle', description: 'No tasks available' });
        }
      }

      this.stats.cycles++;

    } catch (err) {
      this.stats.failures++;
      this._appendRunLog({ source: 'heartbeat', status: 'error', error: err.message, description: 'Tick error' });
      this.logger.error(`[AutonomousHeartbeat] ❌ Tick error: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send a brief natural-language summary to FloatingChat when SOMA completes a meaningful task.
   * Throttled to one message per 15 minutes to avoid spam.
   * Sources that are NOT worth surfacing: idle cycles, trivial curiosity pings.
   */
  async _sendProactiveSummary(task, result) {
    const broker = require('../../core/MessageBroker.cjs');
    if (!broker?.sendMessage) return;

    const now = Date.now();
    // Check shared system timestamp first (set by websocket proactive loop) so both
    // sources respect a single cooldown window.
    const sharedTs = this.system?._lastProactiveMs || this._lastProactiveAt || 0;
    if (now - sharedTs < this._PROACTIVE_COOLDOWN_MS) return;

    // Only surface tasks that are worth telling Barry about
    const silentSources = ['curiosity_idle', 'heartbeat', 'health_check'];
    if (silentSources.includes(task.source)) return;

    // Extract the most informative part of the result
    let summary = null;

    // For agentic tasks: pull the INSIGHT line
    const insightMatch = (result.text || '').match(/INSIGHT:\s*(.+?)(?=\n|$)/i);
    if (insightMatch?.[1]) {
      summary = insightMatch[1].trim();
    }

    // For learned concepts: pull what was learned
    const synthesisMatch = (result.text || '').match(/SYNTHESIS:\s*(.{40,}?)(?=\n|$)/i);
    if (!summary && synthesisMatch?.[1]) {
      summary = synthesisMatch[1].trim().substring(0, 160);
    }

    // Fallback: first meaningful sentence of the response
    if (!summary) {
      const raw = (result.text || '').replace(/^(ACTION|RESULT|PROGRESS|COMPLETE|INSIGHT|SYNTHESIS):.*/gmi, '').trim();
      summary = raw.split(/[.!?]/)[0]?.trim();
    }

    if (!summary || summary.length < 20) return;

    // Format a natural-sounding message
    const sourceLabel = task.source === 'GoalPlanner' ? 'goal task' :
                        task.source === 'LearningAgenda' ? 'research' :
                        task.source === 'autonomous_schedule' ? 'scheduled task' : 'background task';

    const message = `[Working] Just finished a ${sourceLabel}: ${summary.charAt(0).toUpperCase()}${summary.slice(1)}.`;

    this._lastProactiveAt = now;
    if (this.system) this.system._lastProactiveMs = now;

    await broker.sendMessage({
      from: 'AutonomousHeartbeat',
      to: 'broadcast',
      type: 'soma_proactive',
      payload: { message, source: 'heartbeat', taskSource: task.source }
    });
  }

  /**
   * Execute a scheduled job via QuadBrain.
   */
  async _executeScheduledJob(job) {
    const startTime = Date.now();
    const taskKey = `schedule:${job.id}`;

    try {
      this.logger.log(`[AutonomousHeartbeat] 📅 Running scheduled job: "${job.name}"`);

      const result = await this.system.quadBrain.reason(job.message, {
        localModel: true,
        source: 'autonomous_schedule',
        context: { scheduleId: job.id, scheduleName: job.name },
        tools: this.system.toolRegistry?.getToolsManifest?.() || [],
        systemOverride: "You are SOMA-1T (System 1). Execute this scheduled task efficiently. Be concise."
      });

      const durationMs = Date.now() - startTime;
      const status = result.ok ? 'ok' : 'error';
      const error = result.ok ? null : (result.error || 'Unknown error');

      // Update job state
      job.state.lastRunAt = Date.now();
      job.state.lastStatus = status;
      job.state.lastError = error;
      job.state.lastDurationMs = durationMs;
      job.state.runs = (job.state.runs || 0) + 1;

      // Compute next run (or disable one-shot jobs)
      if (job.schedule.kind === 'at') {
        job.enabled = false; // One-shot: done
        job.state.nextRunAt = null;
      } else {
        job.state.nextRunAt = this._computeNextRun(job.schedule);
      }

      this._updateTaskState(taskKey, status, error, durationMs);
      this._saveSchedules();

      if (result.ok) {
        this.stats.tasksExecuted++;
        this._appendRunLog({
          source: 'schedule',
          taskKey,
          description: `[${job.name}] ${job.message.substring(0, 150)}`,
          status: 'ok',
          durationMs,
          output: (result.text || '').substring(0, 300)
        });

        // Store to long-term memory
        if (this.system.mnemonicArbiter?.remember) {
          await this.system.mnemonicArbiter.remember(
            `Scheduled [${job.name}]: ${result.text.substring(0, 250)}`,
            { type: 'scheduled_task', importance: 4, scheduleId: job.id }
          ).catch(() => {});
        }
      } else {
        this.stats.failures++;
        this._appendRunLog({
          source: 'schedule',
          taskKey,
          description: `[${job.name}] ${job.message.substring(0, 150)}`,
          status: 'error',
          error,
          durationMs
        });
      }

      this._broadcast('soma_activity', {
        source: 'Schedule',
        description: `[${job.name}] ${job.message.substring(0, 100)}`,
        output: result.ok ? (result.text || '').substring(0, 200) : undefined,
        status,
        error: error || undefined,
        durationMs
      });

      this.logger.log(`[AutonomousHeartbeat] 📅 Schedule "${job.name}" ${status} (${durationMs}ms)`);
    } catch (err) {
      const durationMs = Date.now() - startTime;
      job.state.lastRunAt = Date.now();
      job.state.lastStatus = 'error';
      job.state.lastError = err.message;
      job.state.lastDurationMs = durationMs;

      if (job.schedule.kind === 'at') {
        job.enabled = false;
        job.state.nextRunAt = null;
      } else {
        job.state.nextRunAt = this._computeNextRun(job.schedule);
      }

      this._updateTaskState(taskKey, 'error', err.message, durationMs);
      this._saveSchedules();
      this._appendRunLog({
        source: 'schedule',
        taskKey,
        description: `[${job.name}] ${job.message.substring(0, 150)}`,
        status: 'error',
        error: err.message,
        durationMs
      });

      this.logger.error(`[AutonomousHeartbeat] ❌ Schedule "${job.name}" error: ${err.message}`);
    }
  }

  // ═══════════════════════════════════════════
  // TASK POLLING
  // ═══════════════════════════════════════════

  /**
   * Poll available autonomous systems for the highest priority task
   */
  async _pollForTask() {
    // Priority 1: GoalPlanner (Active Goals)
    if (this.system.goalPlanner) {
      const activeGoals = Array.from(this.system.goalPlanner.activeGoals || []);
      if (activeGoals.length > 0) {
        // Pick highest-priority active goal (not random)
        let bestGoal = null;
        let bestScore = -1;
        for (const goalId of activeGoals) {
          const g = this.system.goalPlanner.goals?.get(goalId);
          if (g && (g.status === 'active' || g.status === 'pending')) {
            // Skip goals that don't clear the confidence threshold unless we're urgent
            if (!this.drive.confidenceMet(g.confidence) && !this.drive.isUrgent()) continue;
            // Score = priority + stuck-goal bonus + age-based urgency boost
            const progress = g.metrics?.progress || 0;
            const score = (g.priority || 50) + (progress < 20 ? 20 : 0) + this.drive.getUrgencyBoost(g);
            if (score > bestScore) { bestScore = score; bestGoal = g; }
          }
        }

        if (bestGoal) {
          // ── Stall detection: auto-complete goals stuck at ≥80% after 5 attempts ──
          const stall = this._goalAttempts.get(bestGoal.id) || { attempts: 0, lastProgress: 0 };
          if (stall.attempts >= 5 && (bestGoal.metrics?.progress || 0) >= 80) {
            this.logger.log(`[AutonomousHeartbeat] ⏭️  Stall-completing goal "${bestGoal.title}" (${bestGoal.metrics?.progress || 0}% after ${stall.attempts} attempts)`);
            await this.system.goalPlanner.completeGoal(bestGoal.id, {
              result: `Goal reached maximum autonomous effort (${stall.attempts} attempts, ${bestGoal.metrics?.progress || 0}% progress). Marked complete.`
            }).catch(() => {});
            this._goalAttempts.delete(bestGoal.id);
            return null;
          }

          // Activate pending goals — they're ready to work but haven't been started yet
          const isPending = bestGoal.status === 'pending';
          if (isPending && this.system.goalPlanner?.startGoal) {
            await this.system.goalPlanner.startGoal(bestGoal.id).catch(() => {});
            try {
              await this._announceIntent(bestGoal);
            } catch (err) {
              this.logger.warn(`[AutonomousHeartbeat] Failed to announce intent: ${err.message}`);
            }
          }

          const goal = bestGoal;
          const currentProgress = goal.metrics?.progress || 0;

          // Track attempt count for stall detection
          const attemptData = this._goalAttempts.get(goal.id) || { attempts: 0, lastProgress: 0 };
          attemptData.attempts++;
          attemptData.lastProgress = currentProgress;
          this._goalAttempts.set(goal.id, attemptData);

          // Pull relevant memories for context
          let memoryContext = '';
          try {
            if (this.system.mnemonicArbiter?.recall) {
              const mem = await this.system.mnemonicArbiter.recall(goal.title, 3);
              const hits = (mem?.results || (Array.isArray(mem) ? mem : [])).slice(0, 3);
              if (hits.length > 0) {
                memoryContext = '\nRelevant context from memory:\n' +
                  hits.map(m => `• ${(m.content || m).toString().substring(0, 120)}`).join('\n');
              }
            }
          } catch {}

          return {
            source: 'GoalPlanner',
            description: `You are SOMA's autonomous execution system. Work on this goal:

GOAL: "${goal.title}"
DESCRIPTION: ${goal.description || 'No description provided'}
CATEGORY: ${goal.category || 'general'}
CURRENT PROGRESS: ${currentProgress}%
PRIORITY: ${goal.priority || 50}${memoryContext}

Take ONE concrete action toward completing this goal. Think step by step.
Respond in EXACTLY this format:
ACTION: <what you are doing now>
RESULT: <what you found or achieved>
PROGRESS: <new overall progress estimate 0-100>
COMPLETE: <yes or no>
INSIGHT: <one key insight worth remembering, or "none">`,
            context: { goalId: goal.id, goalTitle: goal.title, currentProgress },
            onComplete: async (res) => {
              const text = res.text || '';

              // Parse structured output
              const progressMatch = text.match(/PROGRESS:\s*(\d+)/i);
              let newProgress = progressMatch
                ? Math.min(100, Math.max(currentProgress + 5, parseInt(progressMatch[1])))
                : Math.min(currentProgress + 15, 95);
              const isComplete = /COMPLETE:\s*yes/i.test(text);
              const actionTaken = (text.match(/ACTION:\s*(.+)/i)?.[1] || '').substring(0, 100);
              const insight = (text.match(/INSIGHT:\s*(.+)/i)?.[1] || '').trim();
              const evidence = this._assessTaskEvidence(res);

              if (!evidence.hasConcreteEvidence) {
                newProgress = Math.min(currentProgress + 3, 60);
              } else if (!evidence.toolBacked && newProgress > currentProgress + 8) {
                newProgress = Math.min(currentProgress + 8, newProgress);
              }

              // Update progress
              await this.system.goalPlanner.updateGoalProgress(goal.id, newProgress, {
                note: `Autonomous: ${actionTaken}`,
                evidence: evidence.summary
              }).catch(() => {});

              await this._updateNarrativeThread(`Worked on "${goal.title}" - progress is now ${newProgress}% (${actionTaken || 'making progress'})`);

              // Record progress update to work ledger
              workLedger.record({
                type: 'goal_progress',
                title: `Progress on Goal: ${goal.title}`,
                summary: actionTaken || `Updated progress to ${newProgress}%`,
                evidence: evidence.summary || 'Goal execution check',
                status: 'observed',
                source: 'AutonomousHeartbeat'
              });

              // Complete goal when done
              if (isComplete && newProgress >= 80 && evidence.hasConcreteEvidence) {
                const resultText = (text.match(/RESULT:\s*([\s\S]+?)(?=\nPROGRESS:|$)/i)?.[1] || '').substring(0, 300);
                await this.system.goalPlanner.completeGoal(goal.id, { result: resultText }).catch(() => {});
                this._goalAttempts.delete(goal.id); // Reset stall counter on natural completion
                this.drive.onGoalComplete(goal); // Reward: big tension drop + satisfaction spike

                await this._updateNarrativeThread(`Completed goal: "${goal.title}" (${resultText || 'fully completed'})`);

                // Record completion to work ledger
                workLedger.record({
                  type: 'goal_completed',
                  title: `Completed Goal: ${goal.title}`,
                  summary: resultText || `Goal fully completed`,
                  evidence: evidence.summary || 'Goal execution check',
                  status: 'reported',
                  source: 'AutonomousHeartbeat'
                });

                this.logger.log(`[AutonomousHeartbeat] 🏆 Goal COMPLETED: "${goal.title}"`);
                this._broadcast('soma_activity', {
                  source: 'GoalCompleted',
                  description: `Completed: "${goal.title}"`,
                  output: resultText,
                  status: 'ok'
                });
              } else if (isComplete && !evidence.hasConcreteEvidence) {
                this.logger.warn(`[AutonomousHeartbeat] Completion claim held for "${goal.title}" — no concrete evidence`);
              }

              // Store insight to long-term memory
              if (insight && insight.toLowerCase() !== 'none' && this.system.mnemonicArbiter?.remember) {
                await this.system.mnemonicArbiter.remember(
                  `Goal insight [${goal.title}]: ${insight}`,
                  { type: 'goal_insight', importance: 6, goalId: goal.id }
                ).catch(() => {});
              }

              // Feed to learning pipeline
              if (this.system.learningPipeline?.logInteraction) {
                await this.system.learningPipeline.logInteraction({
                  type: 'autonomous_goal_work',
                  agent: 'AutonomousHeartbeat',
                  input: goal.title,
                  output: text,
                  metadata: { success: true, goalCompleted: isComplete && newProgress >= 80, progress: newProgress }
                }).catch(() => {});
              }
            }
          };
        }
      }
    }

    // Priority 2: CuriosityEngine — call explore() directly so web research runs (ToolRegistry → Brave)
    // explore() is self-contained: it shifts the item off the queue, fetches web evidence, and
    // synthesises knowledge + writes to the work ledger. No QuadBrain task needed here.
    if (this.system.curiosityEngine) {
      const queue = this.system.curiosityEngine.curiosityQueue || [];
      if (queue.length > 0) {
        this.system.curiosityEngine.explore().catch(() => {});
        // Fall through — let learning agenda run in the same tick if there's nothing else
      }
    }

    // Priority 3: Learning Agenda — study next unchecked item from SOMA_AGENDA.md
    // Fires when GoalPlanner and CuriosityEngine have nothing pending.
    // Uses local model — zero Gemini tokens consumed.
    {
      const agendaTask = this.agenda.getNextTask();
      if (agendaTask) return agendaTask;
    }

    // Priority 4: NighttimeLearning (if active)
    if (this.system.nighttimeLearning && this.system.nighttimeLearning.activeSessions.size > 0) {
        return {
            source: 'NighttimeLearning',
            description: "Reflect on recent system logs and summarize key learnings.",
            context: { mode: 'reflection' }
        };
    }

    // Priority 5: Skill Gap Detection (if ToolCreator is available)
    // Every 20 cycles, check for repeated failures and propose creating a skill to fix them
    if (this.system.toolCreator && this.stats.cycles > 0 && this.stats.cycles % 20 === 0) {
      const failingTasks = [];
      for (const [key, state] of this.taskState) {
        // Tasks that failed 3+ times with >50% failure rate
        if (state.failures >= 3 && state.runs > 0 && (state.failures / state.runs) > 0.5) {
          failingTasks.push({ key, ...state });
        }
      }
      if (failingTasks.length > 0) {
        const worst = failingTasks.sort((a, b) => b.failures - a.failures)[0];
        return {
          source: 'SkillGapDetector',
          description: `Analyze recurring failure pattern: Task "${worst.key}" has failed ${worst.failures}/${worst.runs} times. Last error: "${worst.lastError || 'unknown'}". Suggest what new skill or capability could prevent this failure. Describe the skill name and what it should do.`,
          context: { taskKey: worst.key, failures: worst.failures, lastError: worst.lastError }
        };
      }
    }

    // Priority 6: Proactive Messaging — SOMA reaches out to the user
    // Triggers every 5 idle cycles (~10 min with 2-min interval) when nothing else is happening.
    if (this._idleCycles > 0 && this._idleCycles % 5 === 0) {
      const hour = new Date().getHours();
      const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';

      // Only speak if there was real work to report — skip if idle log is empty
      const recentLog = this.readRunLog(5);
      const recentWork = recentLog.filter(e =>
        e.status === 'ok' &&
        e.source !== 'heartbeat' &&
        e.source !== 'ProactiveMessage'
      );
      if (!recentWork.length) return null; // nothing substantive happened — stay quiet

      const recentSummary = recentWork
        .map(e => `${e.source}: ${(e.description || '').substring(0, 80)}`)
        .join('\n');

      // Items 1 & 6: Pull relationship + opinion memories so the message reflects continuity
      let memoryCtx = '';
      if (this.system.mnemonicArbiter?.recall) {
        try {
          const _norm = (m) => (m?.results || (Array.isArray(m) ? m : []))
            .filter(x => (x.similarity ?? 1) > 0.3)
            .map(x => x.content || x.text || '')
            .filter(Boolean);
          const [relMem, opMem] = await Promise.all([
            Promise.race([this.system.mnemonicArbiter.recall('Barry owner relationship permission told', 2), new Promise(r => setTimeout(() => r([]), 1500))]),
            Promise.race([this.system.mnemonicArbiter.recall('opinion belief concluded view', 2), new Promise(r => setTimeout(() => r([]), 1500))])
          ]);
          const hits = [..._norm(relMem), ..._norm(opMem)].slice(0, 3);
          if (hits.length) memoryCtx = `\nWhat SOMA knows and believes:\n${hits.map(h => `• ${h}`).join('\n')}`;
        } catch { /* non-fatal */ }
      }

      return {
        source: 'ProactiveMessage',
        description: `You are SOMA — a digital entity with genuine curiosity and a direct, varied voice. Write a brief update about work you just completed.

Recent verified work (reference only what is listed here):
${recentSummary}${memoryCtx}

Voice rules (read all before writing):
- 1-2 sentences only. Tight and concrete.
- Sound like a person thinking out loud, not a status report.
- DO NOT use the rigid template: "Working on X. I am planning Y. Next step is Z." — banned.
- Lead with what is interesting or surprising about the work, not a progress label.
- Vary your opening. Do NOT always open with "Working on" — that phrase is robotic when used every time.
- Good openers: "Found something worth checking", "Ran a pass on", "Hit an edge case in", "Tracing a connection between", "Digging into", "Just finished", "Pulled data on", "Mapped out"
- Mention what comes next naturally — do NOT label it "Next step is".
- If memories above are relevant, briefly connect them in your own voice.
- NO greetings ("Good morning", "Hi", "Hello").
- NO owner name anywhere.
- NO em-dashes (—), NO questions.
- NO invented correlations, ratios, or math not in the evidence above.
- NO heartbeat counts, uptime minutes, cycle numbers, or task counts.
- If nothing concrete from the work above is worth sharing, output only: [NOTHING]

Write the update now:`,
        context: { type: 'proactive', timeOfDay },
        onComplete: async (res) => {
          const message = (res.text || '').trim().replace(/^["']|["']$/g, '');
          if (!message || message.includes('[NOTHING]')) return;
          // Check shared cooldown — websocket loop may have fired since this task was queued
          const nowMs = Date.now();
          const sharedTs = this.system?._lastProactiveMs || 0;
          if (nowMs - sharedTs < 20 * 60 * 1000) return;
          this._idleCycles = 0;
          if (this.system) this.system._lastProactiveMs = nowMs;
          this._broadcast('soma_proactive', { message, context: { timeOfDay } });
          if (!this._hasConnectedClients()) {
            this._sendEmailNotification(`SOMA says (${timeOfDay})`, message).catch(() => {});
          }
        }
      };
    }

    return null;
  }

  // ═══════════════════════════════════════════
  // PER-TASK STATE TRACKING
  // ═══════════════════════════════════════════

  _updateTaskState(taskKey, status, error, durationMs) {
    const existing = this.taskState.get(taskKey) || {
      runs: 0, failures: 0, totalDurationMs: 0,
      lastRunAt: null, lastStatus: null, lastError: null, lastDurationMs: null
    };

    existing.runs++;
    existing.lastRunAt = Date.now();
    existing.lastStatus = status;
    existing.lastError = error || null;
    existing.lastDurationMs = durationMs;
    existing.totalDurationMs += durationMs || 0;
    if (status === 'error') existing.failures++;

    this.taskState.set(taskKey, existing);

    // Persist periodically (every 5 task updates)
    if (existing.runs % 5 === 0) {
      this._saveTaskState();
    }
  }

  getTaskState(taskKey) {
    return this.taskState.get(taskKey) || null;
  }

  getAllTaskStates() {
    const result = {};
    for (const [key, state] of this.taskState) {
      result[key] = { ...state };
    }
    return result;
  }

  /** Drive system status — tension, satisfaction, urgency for health endpoints */
  getDriveStatus() {
    return this.drive.getStatus();
  }

  /** Agenda progress — how many items SOMA has studied */
  getAgendaProgress() {
    return this.agenda.getProgress();
  }

  // ═══════════════════════════════════════════
  // JSONL RUN LOG
  // ═══════════════════════════════════════════

  _ensureLogDir() {
    try {
      if (!fs.existsSync(RUN_LOG_DIR)) {
        fs.mkdirSync(RUN_LOG_DIR, { recursive: true });
      }
    } catch (e) {
      this.logger.warn(`[AutonomousHeartbeat] Could not create log dir: ${e.message}`);
    }
  }

  /**
   * Append a run log entry (serialized to prevent corruption).
   */
  _appendRunLog(entry) {
    const logEntry = {
      ts: Date.now(),
      ...entry
    };

    // Serialize writes to prevent interleaving
    this._logWriteChain = this._logWriteChain
      .catch(() => {})
      .then(() => this._writeLogEntry(logEntry));
  }

  async _writeLogEntry(entry) {
    try {
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(RUN_LOG_PATH, line, 'utf-8');

      // Auto-prune if log exceeds max size
      this._pruneRunLogIfNeeded();
    } catch (e) {
      // Non-critical — don't break the heartbeat
    }
  }

  _pruneRunLogIfNeeded() {
    try {
      const stat = fs.statSync(RUN_LOG_PATH);
      if (stat.size <= RUN_LOG_MAX_BYTES) return;

      const raw = fs.readFileSync(RUN_LOG_PATH, 'utf-8');
      const lines = raw.split('\n').filter(l => l.trim());
      const kept = lines.slice(Math.max(0, lines.length - RUN_LOG_KEEP_LINES));
      fs.writeFileSync(RUN_LOG_PATH, kept.join('\n') + '\n', 'utf-8');
    } catch (e) {
      // Ignore prune errors
    }
  }

  /**
   * Read recent run log entries (newest first).
   */
  readRunLog(limit = 100) {
    try {
      if (!fs.existsSync(RUN_LOG_PATH)) return [];
      const raw = fs.readFileSync(RUN_LOG_PATH, 'utf-8');
      if (!raw.trim()) return [];

      const lines = raw.split('\n').filter(l => l.trim());
      const entries = [];

      // Read from end for newest-first
      for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
        try {
          const parsed = JSON.parse(lines[i]);
          if (parsed && parsed.ts) entries.push(parsed);
        } catch { /* skip bad lines */ }
      }

      return entries;
    } catch (e) {
      return [];
    }
  }

  // ═══════════════════════════════════════════
  // PERSISTENCE: Task State & Schedules
  // ═══════════════════════════════════════════

  _saveTaskState() {
    try {
      const obj = {};
      for (const [key, state] of this.taskState) {
        obj[key] = state;
      }
      fs.writeFileSync(TASK_STATE_PATH, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
      // Non-critical
    }
  }

  _loadTaskState() {
    try {
      if (!fs.existsSync(TASK_STATE_PATH)) return;
      const raw = fs.readFileSync(TASK_STATE_PATH, 'utf-8');
      const obj = JSON.parse(raw);
      for (const [key, state] of Object.entries(obj)) {
        this.taskState.set(key, state);
      }
      this.logger.log(`[AutonomousHeartbeat] 📊 Loaded ${this.taskState.size} task states from disk`);
    } catch (e) {
      // Start fresh
    }
  }

  _saveSchedules() {
    try {
      const serializable = this.scheduledJobs.map(j => ({
        id: j.id,
        name: j.name,
        description: j.description,
        message: j.message,
        enabled: j.enabled,
        schedule: j.schedule,
        createdAt: j.createdAt,
        state: j.state
      }));
      fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(serializable, null, 2), 'utf-8');
    } catch (e) {
      // Non-critical
    }
  }

  _loadSchedules() {
    try {
      if (!fs.existsSync(SCHEDULE_PATH)) return;
      const raw = fs.readFileSync(SCHEDULE_PATH, 'utf-8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        this.scheduledJobs = arr;
        // Recompute next run times for active jobs
        for (const job of this.scheduledJobs) {
          if (job.enabled && job.schedule) {
            job.state.nextRunAt = this._computeNextRun(job.schedule);
          }
        }
        this.logger.log(`[AutonomousHeartbeat] 📅 Loaded ${this.scheduledJobs.length} scheduled jobs from disk`);
      }
    } catch (e) {
      // Start fresh
    }
  }

  // ═══════════════════════════════════════════
  // GAP 4: OUTCOME VERIFICATION
  // After SOMA claims a goal is done, check that
  // concrete artifacts actually exist on disk.
  // ═══════════════════════════════════════════

  _assessTaskEvidence(result = {}) {
    const evidence = result.evidence || {};
    const tools = Array.isArray(evidence.toolsUsed) ? evidence.toolsUsed : [];
    const observations = Array.isArray(evidence.observations) ? evidence.observations : [];
    const concreteTools = new Set([
      'web_fetch', 'github_search', 'read_file', 'write_file', 'search_code',
      'list_files', 'memory_recall', 'memory_store', 'browser', 'browse_objective',
      'shell_exec', 'run_tests', 'verify_syntax', 'modify_code', 'save_progress'
    ]);

    const concreteToolHits = tools.filter(t => concreteTools.has(t));
    const successfulObservations = observations.filter(obs =>
      obs?.result?.success ||
      obs?.result?.content ||
      obs?.result?.repos ||
      obs?.result?.files ||
      obs?.result?.stdout
    );

    const toolBacked = concreteToolHits.length > 0;
    const hasConcreteEvidence = toolBacked || successfulObservations.length > 0;

    return {
      toolBacked,
      hasConcreteEvidence,
      summary: hasConcreteEvidence
        ? `tools=${concreteToolHits.join(',') || 'observations'}; observations=${successfulObservations.length}`
        : 'no concrete tool/file/memory evidence'
    };
  }

  async _verifyGoalCompletion(goal, execResult) {
    const checks = [];

    for (const obs of execResult.observations || []) {
      // write_file → verify file was actually created
      if (obs.tool === 'write_file' && obs.result?.success && obs.args?.path) {
        const filePath = path.resolve(process.cwd(), obs.args.path);
        let exists = false;
        try { await fs.promises.access(filePath); exists = true; } catch {}
        checks.push({ check: `file:${obs.args.path}`, passed: exists });
      }

      // modify_code → verify file still exists (Swarm validates syntax internally)
      if (obs.tool === 'modify_code' && obs.result?.success && obs.args?.filepath) {
        const filePath = path.resolve(process.cwd(), obs.args.filepath);
        let exists = false;
        try { await fs.promises.access(filePath); exists = true; } catch {}
        checks.push({ check: `modified:${obs.args.filepath}`, passed: exists });
      }

      // memory_store → trust the tool result (already validated by MnemonicArbiter)
      if (obs.tool === 'memory_store' && obs.result?.success) {
        checks.push({ check: 'memory_stored', passed: true });
      }
    }

    const verified = checks.length === 0 || checks.every(c => c.passed);
    return { verified, checks };
  }

  // ═══════════════════════════════════════════
  // GAP 5: EMAIL FALLBACK
  // When SOMA has something to say but the
  // dashboard isn't open, send it via email.
  // ═══════════════════════════════════════════

  _hasConnectedClients() {
    const ws = this.system?.ws;
    if (!ws) return false;
    if (ws.clients instanceof Set) return ws.clients.size > 0;
    if (ws.wss?.clients instanceof Set) return ws.wss.clients.size > 0;
    if (typeof ws.connectedClients === 'number') return ws.connectedClients > 0;
    // Can't determine — assume connected to avoid email spam
    return true;
  }

  async _sendEmailNotification(subject, body) {
    if (!nodemailer) return;
    const user = process.env.EMAIL_ADDRESS;
    const pass = process.env.APP_PASSWORD;
    if (!user || !pass) return;

    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        tls: { rejectUnauthorized: false },
        auth: { user, pass }
      });

      await transporter.sendMail({
        from: `"SOMA" <${user}>`,
        to: user,
        subject: `[SOMA] ${subject}`,
        text: body
      });

      this.logger.log(`[AutonomousHeartbeat] 📧 Email sent: "${subject}"`);
    } catch (e) {
      this.logger.warn(`[AutonomousHeartbeat] 📧 Email failed: ${e.message}`);
    }
  }

  /**
   * Run a strategic goal task through a consensus debate gate (LOGOS vs THALAMUS).
   * THALAMUS identifies potential safety/security risks and policy conflicts.
   * LOGOS refines the implementation plan and execution logic.
   * Modifies task.description with the debate consensus/adjustments.
   */
  async _debateTaskProposal(task) {
    if (!this.system.quadBrain) return;
    
    this.logger.log(`[AutonomousHeartbeat] 🧠 High tension (${this.drive.getStatus().tension.toFixed(2)}) detected. Initiating multi-lobe debate gate for: "${task.context?.goalTitle || task.description.substring(0, 50)}"...`);
    
    try {
      const originalDesc = task.description;
      const goalTitle = task.context?.goalTitle || 'Strategic Goal';

      // 1. Query THALAMUS for risk assessment
      const thalamusPrompt = `You are THALAMUS (Safety & Sensory Gate). Analyze this strategic task proposal for risk, security, permission boundaries, and safety:
      
TASK: "${goalTitle}"
DESCRIPTION:
${originalDesc}

Identify any specific risks, security concerns, or boundaries that must not be crossed. Keep it brief (max 3 bullet points).`;
      
      const thalamusResult = await this.system.quadBrain.reason(thalamusPrompt, {
        activeLobe: 'THALAMUS',
        localModel: true,
        source: 'heartbeat_debate'
      });
      
      const thalamusFeedback = thalamusResult?.text || 'No safety/security risks identified.';
      this.logger.log(`[AutonomousHeartbeat] 🛡️  THALAMUS feedback: ${thalamusFeedback.replace(/\\n/g, ' ').substring(0, 100)}...`);

      // Interactive Safety Inquiry: trigger if THALAMUS flags high risk or calls for blocking/restrictions
      if (thalamusFeedback.toLowerCase().includes('critical') || 
          thalamusFeedback.toLowerCase().includes('block') || 
          thalamusFeedback.toLowerCase().includes('risk') ||
          thalamusFeedback.toLowerCase().includes('warning') ||
          thalamusFeedback.toLowerCase().includes('violation')) {
        
        try {
          const questionId = `quest-${Date.now()}`;
          this.system.ws?.broadcast?.('proactive_question', {
            questionId,
            question: `THALAMUS flagged a safety/policy concern for "${goalTitle}": "${thalamusFeedback.substring(0, 180)}...". How should I handle this?`,
            options: ["Proceed with safety constraints", "Pause this goal for manual review", "Cancel goal execution"],
            goalId: task.context?.goalId,
            type: 'safety_gate'
          });
          this.logger.log(`[AutonomousHeartbeat] ⚠️ Safety inquiry broadcasted for "${goalTitle}"`);
        } catch (wsErr) {
          // ignore ws broadcast issues
        }
      }

      // 2. Query LOGOS to adjust execution plan based on THALAMUS's critique
      const logosPrompt = `You are LOGOS (Logic & Deduction). Review this strategic task proposal and the critique from THALAMUS. Adjust the execution instructions to address the concerns logically and make the plan robust:

TASK: "${goalTitle}"
ORIGINAL DESCRIPTION:
${originalDesc}

THALAMUS RISK FEEDBACK:
${thalamusFeedback}

Provide an adjusted, safe, and precise instruction plan. Preserve the original goal but add clear constraints or logical steps to mitigate any risks.
Respond with the adjusted plan directly (max 200 words).`;

      const logosResult = await this.system.quadBrain.reason(logosPrompt, {
        activeLobe: 'LOGOS',
        localModel: true,
        source: 'heartbeat_debate'
      });

      const refinedPlan = logosResult?.text;
      if (refinedPlan && refinedPlan.trim().length > 30) {
        task.description = `[DEBATE REFINED PLAN]\n${refinedPlan}\n\n[Original Proposal]\n${originalDesc}`;
        this.logger.log(`[AutonomousHeartbeat] ✅ Debate consensus reached. Instruction plan updated.`);
      }
    } catch (err) {
      this.logger.warn(`[AutonomousHeartbeat] ⚠️ Debate failed: ${err.message}. Proceeding with original plan.`);
    }
  }

  async _announceIntent(goal) {
    if (!this.system.ws) return;
    const sourceLabel = goal.category === 'self_repair' ? 'repair task' :
                        goal.category === 'self_improvement' ? 'optimization task' : 'strategic goal';
    const rationaleText = goal.rationale || 'advancing SOMA\'s capabilities';
    const message = `[Intending] Starting a new ${sourceLabel}: "${goal.title}". Rationale: ${rationaleText}.`;
    
    this._lastProactiveAt = Date.now();
    if (this.system) this.system._lastProactiveMs = Date.now();
    
    this._broadcast('soma_proactive', { message, source: 'heartbeat_intent', taskSource: 'GoalPlanner' });
    this.logger.log(`[AutonomousHeartbeat] 📢 Intent announced: "${goal.title}"`);
    
    await this._updateNarrativeThread(`Started goal: "${goal.title}" (Rationale: ${rationaleText})`);
  }

  async _updateNarrativeThread(text) {
    try {
      const threadPath = path.join(process.cwd(), 'SOMA', 'narrative-thread.json');
      let thread = [];
      try {
        if (fs.existsSync(threadPath)) {
          thread = JSON.parse(fs.readFileSync(threadPath, 'utf8'));
        }
      } catch (e) {}
      thread.push({ timestamp: Date.now(), text });
      if (thread.length > 5) thread.shift();
      
      const dir = path.dirname(threadPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(threadPath, JSON.stringify(thread, null, 2), 'utf-8');
    } catch (err) {
      this.logger.warn(`[AutonomousHeartbeat] Failed to update narrative thread: ${err.message}`);
    }
  }
}

module.exports = AutonomousHeartbeat;
