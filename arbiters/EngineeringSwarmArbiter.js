import { BaseArbiterV4, ArbiterRole, ArbiterCapability } from './BaseArbiter.js';
import messageBroker from '../core/MessageBroker.cjs';
import { SwarmEngine, SwarmTask } from './EngineeringSwarmRuntime.js';
import { CommandPolicyEngine } from '../core/CommandPolicyEngine.js';
import { SwarmPatchTransaction } from '../core/SwarmPatchTransaction.js';
import { validateSchema } from '../core/SchemaValidator.js';
import blackboard from '../core/Blackboard.js';
import maintenanceBridge from '../core/MaintenanceBridge.js';
import gitArbiter from '../core/GitArbiter.js';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

import { VirtualShell } from './VirtualShell.js';

// Files the swarm must never autonomously modify — matches SelfModificationPipeline list
const IMMUTABLE_PATHS = [
    'server/routes/somaRoutes.js',
    'launcher_ULTRA.mjs',
    'start_production.bat',
    'clean_restart.bat',
    'core/SomaBootstrapV2.js',
    'core/SelfModificationPipeline.js',
    'server/loaders/',
    'config/',
    'ecosystem.config.cjs',
];

export const DebateSchema = {
    type: "object",
    properties: {
        architect: { type: "string" },
        maintainer: { type: "string" },
        security: { type: "string" },
        consensus: { type: "string" }
    },
    required: ["architect", "maintainer", "security", "consensus"]
};

export const PatchSchema = {
    type: "object",
    properties: {
        patch: {
            type: "object",
            properties: {
                files: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            path: { type: "string" },
                            // full_rewrite mode: provide complete file content
                            content: { type: "string" },
                            // surgical mode: provide targeted old→new replacements (preferred for large files)
                            edits: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        old: { type: "string" },
                                        new: { type: "string" }
                                    },
                                    required: ["old", "new"]
                                }
                            }
                        },
                        required: ["path"]
                        // Note: either 'content' or 'edits' must be present — enforced at runtime by SwarmPatchTransaction
                    }
                }
            },
            required: ["files"]
        }
    },
    required: ["patch"]
};

/**
 * EngineeringSwarmArbiter (Upgrade Pack Edition)
 * 
 * Replaces simple self-modification with a robust, autonomous engineering swarm.
 * Features:
 * - Security: CommandPolicyEngine blocks dangerous shell commands.
 * - Atomicity: SwarmPatchTransaction ensures multi-file edits are transactional with rollback.
 * - Reliability: Schema validation ensures machine-readable reasoning and code patches.
 * - Verification: Execution pipeline runs real-world tests to verify changes.
 * - Cybernetics: PlanMonitor logic with automatic pivot/retry on test failure.
 * - Intent: Permanent 'North Star' preservation across the reasoning chain.
 */
export class EngineeringSwarmArbiter extends BaseArbiterV4 {
  constructor(opts = {}) {
    super({
      ...opts,
      name: opts.name || 'EngineeringSwarmArbiter',
      role: ArbiterRole.ARCHITECT,
      capabilities: [
        ArbiterCapability.READ_FILES,
        ArbiterCapability.WRITE_FILES,
        ArbiterCapability.EXECUTE_CODE,
        ArbiterCapability.MODIFY_CODE,
        ArbiterCapability.SELF_HEALING,
        ArbiterCapability.SECURITY_AUDIT
      ]
    });
    this.tier = 'operational';

    this.quadBrain = opts.quadBrain || null;
    this.mnemonicArbiter = opts.mnemonicArbiter || null;
    this.rootPath = opts.rootPath || process.cwd();
    this.commandPolicy = new CommandPolicyEngine();
    this.optimizer = opts.swarmOptimizer || null;
    this.shell = new VirtualShell(this.rootPath);
    console.log(`[EngSwarm] VirtualShell initialized at: ${this.shell.cwd}`);
    this.runtime = new SwarmEngine({
        workspace: path.join(this.rootPath, '.soma', 'swarm_vault'),
        logger: this.auditLogger
    });

    // Cross-session failure context: filepath → { error, timestamp }
    // Prevents the "Meeseeks Loop" where the swarm repeats the same broken approach
    // across independent modifyCode() calls. Cleared on success, persists on final failure.
    this._persistentFailureLog = new Map();
  }

  setOptimizer(optimizer) {
    this.optimizer = optimizer;
  }

  async onInitialize() {
    await this.runtime.initialize();

    // Register with MessageBroker so goal assignments via sendMessage({to:'EngineeringSwarmArbiter'}) work
    try {
      messageBroker.registerArbiter('EngineeringSwarmArbiter', {
        instance: this,
        type: 'engineering',
        role: 'architect',
        capabilities: ['modify_code', 'self_healing', 'engineering']
      });
    } catch (e) {
      // Already registered or broker unavailable — non-fatal
    }

    this.auditLogger.info('🚀 Engineering Swarm (UPGRADED) Online', {
      mode: 'Verified Transactional Execution'
    });
  }

  /**
   * Handle direct messages from MessageBroker (sendMessage({to:'EngineeringSwarmArbiter'})).
   * Primary use: goal_assigned from GoalPlannerArbiter.
   */
  async handleMessage(envelope = {}) {
    const { type, payload } = envelope;

    if (type !== 'goal_assigned') {
      return { success: true, message: 'acknowledged' };
    }

    const { goalId, goal } = payload || {};
    if (!goalId || !goal) return { success: false, error: 'Invalid goal_assigned payload' };

    this.auditLogger.info(`[EngSwarm] ⚡ Goal assigned: "${goal.title}" (${goalId.slice(0, 8)})`);

    // Prioritize file path from metadata (Sovereign Assembly protocol)
    let filepath = goal.metadata?.filePath;

    // Fallback: Extract from description if metadata is missing
    if (!filepath) {
        const fileMatch = (goal.description || '').match(/[\w./\\-]+\.(js|cjs|mjs|ts|jsx|tsx|json|py)/i);
        if (fileMatch) filepath = fileMatch[0];
    }

    if (!filepath && this.quadBrain) {
      // Fix 1: Ask brain to infer the most relevant file for this goal
      try {
        const inference = await Promise.race([
          this.quadBrain.reason(
            `Given this engineering goal: "${goal.title}"\nDescription: "${goal.description || ''}"\n\nRespond with ONLY a single relative file path (e.g. arbiters/Foo.js) that is the most appropriate file to modify in order to implement this goal. If no code file is relevant, respond with the single word NONE.`,
            { quickResponse: true, preferredBrain: 'LOGOS' }
          ),
          new Promise(resolve => setTimeout(() => resolve(null), 8_000))
        ]);
        const raw = (inference?.text || '').trim().split('\n')[0].trim();
        if (raw && raw !== 'NONE') {
          const match = raw.match(/[\w./\\-]+\.(js|cjs|mjs|ts|jsx|tsx|json|py)/i);
          if (match) filepath = match[0];
        }
      } catch { /* fall through */ }
    }

    if (!filepath) {
      // Non-code goal — acknowledge but cannot execute via modifyCode
      this.auditLogger.warn(`[EngSwarm] Goal "${goal.title}" has no file target even after brain inference — skipping`);
      messageBroker.sendMessage({
        from: 'EngineeringSwarmArbiter', to: 'GoalPlannerArbiter',
        type: 'update_goal_progress',
        payload: { goalId, progress: 5, metadata: { note: 'No file target; routed to reasoning-only execution' } }
      }).catch(() => {});
      return { success: true, message: 'Goal acknowledged, no file target' };
    }

    // Run modifyCode in the background — do NOT block handleMessage
    (async () => {
      try {
        const result = await this.modifyCode(filepath, `${goal.title}: ${goal.description}`);
        if (result?.success) {
          messageBroker.sendMessage({
            from: 'EngineeringSwarmArbiter', to: 'GoalPlannerArbiter',
            type: 'update_goal_progress',
            payload: { goalId, progress: 100, metadata: { sessionId: result.sessionId, duration: result.duration } }
          }).catch(() => {});
          this.auditLogger.info(`[EngSwarm] ✅ Goal "${goal.title}" completed (${result.duration}s)`);
        } else {
          // Use swarm_goal_failed (not cancel_goal) so GoalPlannerArbiter can
          // apply retry escalation rather than just silently deferring the goal.
          messageBroker.sendMessage({
            from: 'EngineeringSwarmArbiter', to: 'GoalPlannerArbiter',
            type: 'swarm_goal_failed',
            payload: { goalId, reason: result?.error || 'unknown' }
          }).catch(() => {});
          this.auditLogger.warn(`[EngSwarm] ❌ Goal "${goal.title}" failed: ${result?.error}`);
        }
      } catch (err) {
        this.auditLogger.error(`[EngSwarm] Goal execution exception: ${err.message}`);
      }
    })();

    return { success: true, message: 'goal execution started', filepath };
  }

  /**
   * Main Entry Point for Autonomous Engineering
   * Orchestrates the research, plan, debate, and synthesis cycle.
   */
  async modifyCode(filepath, request, onProgress = null) {
    const normPath = (filepath || '').replace(/\\/g, '/');
    const blocked = IMMUTABLE_PATHS.find(p => normPath.includes(p.replace(/\\/g, '/')));
    if (blocked) {
      this.auditLogger.warn(`[EngSwarm] 🚫 BLOCKED modifyCode on "${filepath}" — matches protected path "${blocked}"`);
      return { success: false, error: `Protected path: ${blocked} — only Barry can modify this file` };
    }

    if (!this.quadBrain) {
      this.auditLogger.error('[EngSwarm] Cannot modifyCode — quadBrain is null (QuadBrain not yet ready)');
      return { success: false, error: 'quadBrain not initialized — try again after system is fully booted' };
    }
    const emit = (phase, message) => { if (onProgress) onProgress(phase, message); };

    this.auditLogger.info(`⚡ [EngSwarm] Engineering loop started for ${filepath}`);
    const sessionStartTime = Date.now();
    const sessionId = `swarm_${crypto.randomBytes(4).toString('hex')}`;

    // ─── STATE INITIALIZATION (Intent Preservation) ───
    // Inject cross-session failure context so the swarm never repeats a known-broken approach
    const priorFailure = this._persistentFailureLog.get(normPath);
    const priorIsRecent = priorFailure && (Date.now() - priorFailure.timestamp) < 86400000;
    const priorError = priorIsRecent
        ? `[PRIOR SESSION — ${priorFailure.attempts} attempt(s) — ${new Date(priorFailure.timestamp).toISOString()}]\n${priorFailure.error}`
        : null; // stale after 24h — fresh eyes beat stale context

    const swarmState = {
        sessionId,
        filepath,
        northStar: request, // The persistent goal
        attempts: 0,
        maxAttempts: 2,
        lastError: priorError  // null on first-ever attempt, prior error on retry
    };

    if (priorError) {
        this.auditLogger.warn(`[EngSwarm] ⚠️ Prior failure context injected for ${filepath}: "${priorError.slice(0, 80)}"`);
    }

    // Initialize Blackboard for this session
    blackboard.reset(sessionId);
    blackboard.post('insights', { type: 'initial_request', content: request });

    while (swarmState.attempts < swarmState.maxAttempts) {
        swarmState.attempts++;
        this.auditLogger.info(`[Swarm] Phase Loop: Attempt ${swarmState.attempts}/${swarmState.maxAttempts}`);
        emit('attempt', `Attempt ${swarmState.attempts}/${swarmState.maxAttempts}`);

        try {
            // 1. RESEARCH - Understand the context
            emit('research', `Reading ${filepath} and understanding context...`);
            const research = await this.runResearch(filepath, swarmState.northStar);
            blackboard.post('insights', { type: 'research_complete', filepath, size: research.content.length });

            // 2. PLAN - Generate verification commands (With Cybernetic context)
            emit('plan', 'Generating verification plan...');
            const plan = await this.generatePlan(swarmState, research);
            blackboard.post('codeTargets', { type: 'verification_plan', commands: plan.map(p => p.command) });

            // 3. DEBATE - Technical adversarial reasoning (With North Star)
            emit('debate', 'Running adversarial technical debate...');
            const debate = await this.runDebate(swarmState, research);
            blackboard.post('insights', { type: 'debate_consensus', content: debate.consensus });

            // 4. SYNTHESIS - Drafting the final code patch
            emit('synthesis', 'Synthesizing final patch...');
            const verdict = await this.runSynthesis(swarmState, research, debate);
            blackboard.post('codeTargets', { type: 'final_patch', files: verdict.patch.files.map(f => f.path) });

            // 5. TRANSACTION - Multi-file safety layer
            const transaction = new SwarmPatchTransaction(this.rootPath);

            try {
                emit('apply', `Applying patch to ${verdict.patch.files.length} file(s)...`);
                this.auditLogger.info(`[Swarm] Applying patch transaction...`);
                await transaction.applyPatch(verdict.patch);

                // 6. VERIFICATION (Real-world Plan Monitor)
                emit('verify', 'Running verification commands...');
                const verification = await this.verifyPatch(verdict.patch, plan);

                if (!verification.passed) {
                    throw new Error(`Verification FAILED: ${verification.error}`);
                }

                // Finalize changes
                transaction.commit();
                blackboard.post('insights', { type: 'task_complete', status: 'success' });
                this.auditLogger.success(`[Swarm] ✅ SUCCESS: ${filepath} updated and verified on attempt ${swarmState.attempts}.`);

                const duration = ((Date.now() - sessionStartTime) / 1000).toFixed(1);
                const experienceData = { sessionId, filepath, request, success: true, duration, consensus: debate.consensus };

                if (this.optimizer) this.optimizer.record(experienceData);
                await this._logToExperienceLedger(experienceData);

                // Self-publish the improvement to GitHub
                gitArbiter.setBroker(messageBroker);
                gitArbiter.publishImprovement(
                    `${request.slice(0, 72)} (${path.basename(filepath)})`,
                    verdict.patch?.files?.map(f => f.path) || [filepath]
                ).catch(e => this.auditLogger.warn(`[Swarm] GitArbiter publish failed: ${e.message}`));

                // Success — wipe failure context so next call starts clean
                this._persistentFailureLog.delete(normPath);

                return { success: true, sessionId, duration, verdict };

            } catch (transErr) {
                this.auditLogger.warn(`[Swarm] 🔄 CYBERNETIC PIVOT: Verification failed on attempt ${swarmState.attempts}. Rolling back and retrying with error context.`);
                emit('pivot', `Attempt ${swarmState.attempts} failed — rolling back and retrying: ${transErr.message}`);
                await transaction.rollback();
                swarmState.lastError = transErr.message;
                blackboard.post('risks', { type: 'attempt_failed', attempt: swarmState.attempts, error: transErr.message });

                if (swarmState.attempts >= swarmState.maxAttempts) {
                    throw transErr; // Out of attempts
                }
                // Loop continues for the retry pivot
            }

        } catch (err) {
            const duration = ((Date.now() - sessionStartTime) / 1000).toFixed(1);
            const errorData = { sessionId, filepath, request, success: false, error: err.message, duration };

            if (this.optimizer) this.optimizer.record(errorData);
            // Publish failure to broker — was previously silent; GoalPlannerArbiter
            // and SwarmOptimizer both subscribe to swarm.experience for feedback loops.
            await this._logToExperienceLedger(errorData);
            blackboard.post('insights', { type: 'task_aborted', error: err.message });
            this.auditLogger.error(`[Swarm] ❌ ENGINEERING ABORTED after ${swarmState.attempts} attempts: ${err.message}`);

            // Persist failure context so the NEXT call to modifyCode() for this file
            // starts with awareness of what already failed (Stateful Failure Recovery).
            // Slice to 500 chars — err.message already contains verification stderr via the chain:
            // verifyPatch returns { error: stderr } → thrown as "Verification FAILED: <stderr>"
            this._persistentFailureLog.set(normPath, {
                error:     err.message.slice(0, 500),
                attempts:  swarmState.attempts,
                timestamp: Date.now()
            });

            return { success: false, error: err.message };
        }
    }
  }

  async runResearch(filepath, request) {
    this.auditLogger.info(`[Researcher] Analyzing ${filepath}...`);
    const fullPath = path.resolve(this.rootPath, filepath);
    const content = await fs.readFile(fullPath, 'utf8');
    
    return {
        timestamp: Date.now(),
        filepath,
        content,
        request
    };
  }

  async generatePlan(state, context) {
    const prompt = `[NORTH STAR]: ${state.northStar}
    [PREVIOUS ERROR]: ${state.lastError || "None - Initial Attempt"}
    
    You are the RALPH VERIFIER (Autonomous Stress-Tester).
    Context File: ${context.filepath}
    
    TASK: Generate a robust validation plan to prove the code patch is functionally correct and structurally safe.
    Instead of just checking syntax, write a command that executes an autonomous test.
    If you need to test logic, you can instruct the system to run a dynamically generated test script or use an existing test runner.
    
    Return ONLY a JSON array of commands to execute. Ensure they return exit code 0 on success, and >0 on failure.
    [{ "command": "node --check ${context.filepath} && npm test" }]`;

    const result = await this.quadBrain.reason(prompt, { brain: 'LOGOS' });
    const jsonMatch = result.text.match(/\[[\s\S]*\]/s);
    if (!jsonMatch) throw new Error(`Planner produced unparseable plan: ${result.text}`);
    
    try {
        const tasks = JSON.parse(jsonMatch[0]);
        tasks.forEach(t => {
            if (t.command) this.commandPolicy.validate(t.command);
        });
        return tasks;
    } catch (e) {
        throw new Error(`Failed to parse plan JSON: ${e.message}`);
    }
  }

  async runDebate(state, context) {
    this.auditLogger.info(`[Swarm] Running Structured Debate...`);
    const prompt = `[NORTH STAR]: ${state.northStar}
    [PREVIOUS ERROR]: ${state.lastError || "None"}
    
    Debate this engineering change for FILE: ${context.filepath}
    
    Return ONLY JSON matching this schema:
    { "architect": "...", "maintainer": "...", "security": "...", "consensus": "..." }`;

    const result = await this.quadBrain.reason(prompt, { brain: 'AURORA' });
    const jsonMatch = result.text.match(/\{[\s\S]*\}/s);
    if (!jsonMatch) throw new Error(`Swarm produced unparseable debate: ${result.text}`);
    
    try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateSchema(DebateSchema, parsed);
    } catch (e) {
        throw new Error(`Failed to parse debate JSON: ${e.message}`);
    }
  }

  async runSynthesis(state, context, debate) {
    this.auditLogger.info(`[LeadDev] Synthesizing final patch...`);
    const prompt = `[NORTH STAR]: ${state.northStar}
    [CONSENSUS]: ${debate.consensus}
    [PREVIOUS ERROR]: ${state.lastError || "None"}

    Produce final code patch for ORIGINAL FILE: ${context.filepath}

    PATCH FORMAT RULES (AEGIS Protocol — read carefully):
    - If the file is large (>100 lines) or already exists: use SURGICAL edits.
      Surgical format: { "path": "...", "edits": [{ "old": "exact string", "new": "replacement" }] }
      Each "old" must be an EXACT verbatim substring of the current file. Copy it character-for-character.
      Make the "old" string unique enough (include 1-2 surrounding lines of context) to avoid ambiguity.
    - If the file is new or small (<100 lines): full rewrite is acceptable.
      Full rewrite format: { "path": "...", "content": "entire file content" }
    - NEVER use full_rewrite on large existing files. The AEGIS guard will block it if you delete routes or functions.
    - You may mix modes: different files in the same patch can use different formats.

    Return ONLY JSON:
    { "patch": { "files": [{ "path": "...", "edits": [{ "old": "...", "new": "..." }] }] } }`;

    const result = await this.quadBrain.reason(prompt, { brain: 'LOGOS' });
    const jsonMatch = result.text.match(/\{[\s\S]*\}/s);
    if (!jsonMatch) throw new Error(`Lead Dev produced unparseable patch: ${result.text}`);
    
    try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateSchema(PatchSchema, parsed);
    } catch (e) {
        throw new Error(`Failed to parse patch JSON: ${e.message}`);
    }
  }

  async verifyPatch(patch, tasks) {
    this.auditLogger.info(`[Ralph] 🛡️ Running autonomous verification loop via VirtualShell...`);
    
    for (const task of tasks) {
        try {
            this.commandPolicy.validate(task.command);
            
            // Execute via stateful VirtualShell
            const result = await this.shell.execute(task.command, task.timeout || 30000);
            
            this.auditLogger.debug(`[Ralph] Command: ${task.command} | Exit: ${result.exitCode}`);

            if (result.exitCode !== 0) {
                this.auditLogger.error(`[Ralph] Verification failed on command: ${task.command}`);
                return { 
                    passed: false, 
                    error: result.stderr || result.stdout || `Command failed with exit code ${result.exitCode}` 
                };
            }
        } catch (e) {
            return { passed: false, error: `Policy/Execution Error: ${e.message}` };
        }
    }

    return { passed: true };
  }

  /**
   * Out-of-Body Self-Surgery
   * Steps outside the current process to modify core files via external MAX.
   */
  async performSelfSurgery(filepath, request) {
    this.auditLogger.info(`🩹 [Swarm] Initiating Out-of-Body Self-Surgery for ${filepath}`);
    
    try {
        // 1. Delegate to the bridge
        const delegation = await maintenanceBridge.delegateToExternalMax(filepath, request);
        
        if (delegation.success) {
            this.auditLogger.success(`🚀 [Swarm] Task handed off to external maintenance runner (PID: ${delegation.pid})`);
            return {
                success: true,
                message: "Self-surgery initiated. The system will be updated and potentially restarted by the external runner.",
                pid: delegation.pid
            };
        } else {
            throw new Error("Delegation to external runner failed.");
        }
    } catch (err) {
        this.auditLogger.error(`❌ [Swarm] Self-surgery failed: ${err.message}`);
        return { success: false, error: err.message };
    }
  }

  async _logToExperienceLedger(data) {
    if (messageBroker && typeof messageBroker.publish === 'function') {
        await messageBroker.publish('swarm.experience', data);
    }
    const mnemonic = this.mnemonicArbiter || this.quadBrain?.mnemonic;
    if (mnemonic && typeof mnemonic.remember === 'function') {
        await mnemonic.remember(
            `Engineering Swarm: ${data.request} on ${data.filepath}. Result: ${data.success ? 'success' : 'failure'}`,
            { type: 'swarm_experience', ...data }
        );
    }

    // 🍭 PHYSICAL NUTRIENT GENERATION: Philosophy of the Fix
    if (data.success) {
        try {
            const nutrientId = `fix_${crypto.randomBytes(4).toString('hex')}`;
            const prompt = `
You are SOMA's Lead Architect. You just completed a successful engineering swarm modification.
TARGET FILE: ${data.filepath}
REQUEST: ${data.request}
CONSENSUS RATIONALE: ${data.consensus || "N/A"}

TASK: Synthesize a high-level "YumYum" nutrient (3-4 paragraphs) explaining the PHILOSOPHY behind this fix.
Do not just list code changes. Explain the architectural principle we reinforced, the technical debt we cleared, or the system resilience we improved.

Write this for the LOGOS library. Be precise, technical, and declarative.
`.trim();

            const result = await this.quadBrain.reason(prompt, { brain: 'LOGOS', temperature: 0.7 });
            const philosophy = result?.text || result;

            if (philosophy) {
                const filename = `philosophy_of_fix_${nutrientId}.md`;
                const header = [
                    '---',
                    'lobe: logos',
                    'type: philosophy_of_fix',
                    `target: ${data.filepath}`,
                    `timestamp: ${new Date().toISOString()}`,
                    '---',
                    '',
                    `# Philosophy of Fix: ${path.basename(data.filepath)}`,
                    ''
                ].join('\n');

                const yumyumPath = path.join(process.cwd(), 'knowledge', 'logos', 'yumyums', filename);
                await fs.writeFile(yumyumPath, header + philosophy + '\n');
                this.auditLogger.info(`[Swarm] 🍭 Nutrient generated: ${filename}`);
            }
        } catch (e) {
            this.auditLogger.warn(`[Swarm] ⚠️ Failed to generate nutrient: ${e.message}`);
        }
    }
  }
}

export default EngineeringSwarmArbiter;
