import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { EngineeringSwarmArbiter } from '../arbiters/EngineeringSwarmArbiter.js';
import { SomaAgenticExecutor } from '../core/SomaAgenticExecutor.js';
import { resolveWithinRoot } from '../core/PathSafety.js';
import { SelfModificationPipeline } from '../core/SelfModificationPipeline.js';
import { wireSelfModificationRuntime } from '../core/SelfModificationRuntime.js';
import { SwarmPatchTransaction } from '../core/SwarmPatchTransaction.js';

const tempDirs = [];

async function tempDir() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'soma-selfmod-'));
    tempDirs.push(dir);
    return dir;
}

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

describe('self-modification safety', () => {
    it('rejects sibling-prefix and parent traversal paths', async () => {
        const root = await tempDir();
        assert.throws(() => resolveWithinRoot(root, '../outside.js'), /outside allowed root/);
        assert.throws(() => resolveWithinRoot(root, `${root}-evil/file.js`), /outside allowed root/);
        assert.equal(resolveWithinRoot(root, '.', 'Directory', { allowRoot: true }), path.resolve(root));
    });

    it('restores every file in a patch transaction rollback', async () => {
        const root = await tempDir();
        const target = path.join(root, 'target.js');
        await fs.writeFile(target, 'export const value = 1;\n');

        const transaction = new SwarmPatchTransaction(root);
        await transaction.applyPatch({ files: [{ path: 'target.js', content: 'export const value = 2;\n' }] });
        await transaction.rollback();

        assert.equal(await fs.readFile(target, 'utf8'), 'export const value = 1;\n');
    });

    it('fails closed when human approval is denied', async () => {
        const root = await tempDir();
        const target = path.join(root, 'target.js');
        await fs.writeFile(target, 'export const value = 1;\n');

        const swarm = new EngineeringSwarmArbiter({ rootPath: root, quadBrain: {} });
        swarm.system = {
            commandBridgeSettings: { authority: { humanInLoopOverride: true } },
            approvalGate: { request: async () => ({ approved: false, reason: 'test denial' }) },
        };

        const result = await swarm.modifyCode(target, 'change value');
        assert.equal(result.success, false);
        assert.equal(result.humanRejected, true);
        assert.match(result.error, /test denial/);
        await swarm.shutdown();
    });

    it('requires an approval gate when authority settings are not loaded yet', async () => {
        const root = await tempDir();
        const target = path.join(root, 'target.js');
        await fs.writeFile(target, 'export const value = 1;\n');
        const swarm = new EngineeringSwarmArbiter({ rootPath: root, quadBrain: {} });
        swarm.system = {};

        const result = await swarm.modifyCode(target, 'change value');
        assert.equal(result.success, false);
        assert.match(result.error, /no approval gate/i);
        await swarm.shutdown();
    });

    it('propagates Engineering Swarm failure through modify_code', async () => {
        const executor = new SomaAgenticExecutor();
        executor.initialize({
            system: {
                engineeringSwarm: { modifyCode: async () => ({ success: false, error: 'verification failed' }) },
            },
        });

        const result = await executor._tools.modify_code.execute({
            filepath: 'core/PathSafety.js',
            request: 'test failure propagation',
        });

        assert.equal(result.success, false);
        assert.match(result.error, /verification failed/);
    });

    it('keeps file tools inside SOMA while allowing root directory inspection', async () => {
        const executor = new SomaAgenticExecutor();
        executor.initialize({ system: {} });
        const listing = await executor._tools.list_files.execute({ directory: '.' });
        const escaped = await executor._tools.read_file.execute({ path: '../outside.txt' });
        assert.ok(Array.isArray(listing.files));
        assert.match(escaped.error, /outside allowed root/);
    });

    it('wires the full SelfModificationPipeline into the live bootstrap system', async () => {
        const system = { engineeringSwarm: {} };
        wireSelfModificationRuntime(system, { log() {} });
        assert.ok(system.selfModPipeline instanceof SelfModificationPipeline);
        assert.equal(system.selfModPipeline.system, system);
    });

    it('requires syntax and repository smoke verification for every patch', async () => {
        const root = await tempDir();
        const swarm = new EngineeringSwarmArbiter({ rootPath: root, quadBrain: {} });
        const plan = swarm.buildRequiredVerificationPlan({ files: [{ path: 'target.js', content: 'export {}' }] });
        assert.deepEqual(plan.map(task => task.command), [
            'node --check "target.js"',
            'npm run soma:test',
        ]);
        await swarm.shutdown();
    });

    it('executes required syntax and smoke checks and records their evidence', async () => {
        const root = await tempDir();
        await fs.writeFile(path.join(root, 'target.js'), 'export const value = 1;\n');
        await fs.writeFile(path.join(root, 'smoke.mjs'), 'console.log("verified");\n');
        await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({
            type: 'module',
            scripts: { 'soma:test': 'node smoke.mjs' },
        }));

        const swarm = new EngineeringSwarmArbiter({ rootPath: root, quadBrain: {} });
        const plan = swarm.buildRequiredVerificationPlan({ files: [{ path: 'target.js', content: 'export {}' }] });
        const result = await swarm.verifyPatch({ files: [{ path: 'target.js' }] }, plan);
        assert.equal(result.passed, true);
        assert.equal(result.results.length, 2);
        assert.deepEqual(result.results.map(item => item.exitCode), [0, 0]);
        await swarm.shutdown();
    });
});
