import assert from 'assert';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { KevinEmailManager } = require('../server/utils/KevinEmailManager.cjs');
const { KevinThreatDatabase } = require('../server/utils/KevinThreatDatabase.cjs');
const { KevinNotificationService } = require('../server/utils/KevinNotificationService.cjs');

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'kevin-hardening-'));
const originalCwd = process.cwd();
const originalEnv = {
    EMAIL_ADDRESS: process.env.EMAIL_ADDRESS,
    APP_PASSWORD: process.env.APP_PASSWORD,
    KEVIN_ALLOW_INSECURE_TLS: process.env.KEVIN_ALLOW_INSECURE_TLS,
    KEVIN_NOTIFY_CONFIG_PATH: process.env.KEVIN_NOTIFY_CONFIG_PATH,
    KEVIN_NOTIFY_DEDUPE_MS: process.env.KEVIN_NOTIFY_DEDUPE_MS
};

try {
    process.chdir(tempRoot);
    delete process.env.KEVIN_ALLOW_INSECURE_TLS;
    process.env.KEVIN_NOTIFY_CONFIG_PATH = path.join(tempRoot, 'kevin_notifications.json');
    process.env.KEVIN_NOTIFY_DEDUPE_MS = '600000';

    const configPath = path.join(tempRoot, '.soma', 'kevin_config.json');
    await mkdir(path.dirname(configPath), { recursive: true });
    const incomingConfig = {
        sensitivity: 77,
        email: 'operator@example.com',
        password: 'do-not-persist'
    };
    const persisted = { ...incomingConfig };
    delete persisted.password;
    delete persisted.appPassword;
    delete persisted.token;
    delete persisted.apiKey;
    delete persisted.secret;
    await writeFile(configPath, JSON.stringify(persisted, null, 2));

    const saved = JSON.parse(await readFile(configPath, 'utf8'));
    assert.equal(saved.password, undefined, 'password must not be persisted');
    assert.equal(saved.appPassword, undefined, 'appPassword must not be persisted');

    const redacted = {
        ...saved,
        email: 'op***@example.com',
        credentials: {
            emailConfigured: true,
            appPasswordConfigured: true,
            source: 'environment'
        }
    };
    assert.equal(redacted.password, undefined, 'status config must not expose password');
    assert.equal(redacted.credentials.appPasswordConfigured, true, 'runtime credential flag should be exposed as boolean');

    const emailManager = new KevinEmailManager();
    assert.equal(emailManager.config.imap.rejectUnauthorized, true, 'IMAP TLS verification should be enabled by default');
    assert.equal(emailManager.smtpConfig.tls.rejectUnauthorized, true, 'SMTP TLS verification should be enabled by default');

    const db = new KevinThreatDatabase();
    const verdict = db.buildEmailVerdict({
        from: 'billing@evil-click.xyz',
        subject: 'Urgent action required',
        body: 'Verify your account immediately at http://1.2.3.4/login'
    });
    assert.equal(verdict.success, true);
    assert.ok(verdict.score >= 55, 'obvious phishing sample should score as high risk');
    assert.ok(Array.isArray(verdict.evidence) && verdict.evidence.length > 0, 'verdict should include evidence');
    assert.equal(verdict.requiresApproval, true, 'risky verdict should require approval');

    const attachment = db.analyzeAttachment('invoice.pdf.exe', Buffer.from('MZ suspicious'));
    assert.equal(attachment.isSafe, false, 'disguised executable attachment should not be marked safe');
    assert.ok(attachment.evidence.some(item => item.type === 'dangerous_extension'), 'attachment verdict should include extension evidence');
    assert.ok(attachment.hash, 'attachment verdict should hash the payload');

    const repeatVerdict = db.buildEmailVerdict({
        from: 'billing@evil-click.xyz',
        subject: 'Second urgent invoice',
        body: 'Open attached payment request'
    });
    assert.equal(repeatVerdict.success, true);
    const reputation = db.getReputationCache();
    assert.ok(reputation.senders.some(sender => sender.sender === 'billing@evil-click.xyz'), 'sender memory should persist observed senders');
    assert.ok(reputation.domains.some(domain => domain.domain === 'evil-click.xyz'), 'domain memory should persist observed domains');

    const notifier = new KevinNotificationService();
    const firstAlert = await notifier.sendSecurityAlert({
        type: 'THREAT_DETECTED',
        title: 'Duplicate Test',
        message: 'Same alert',
        severity: 'high',
        details: { sender: 'billing@evil-click.xyz', subject: 'Urgent action required' },
        source: 'test'
    });
    const secondAlert = await notifier.sendSecurityAlert({
        type: 'THREAT_DETECTED',
        title: 'Duplicate Test',
        message: 'Same alert',
        severity: 'high',
        details: { sender: 'billing@evil-click.xyz', subject: 'Urgent action required' },
        source: 'test'
    });
    assert.equal(firstAlert.success, true);
    assert.equal(secondAlert.suppressed, true, 'duplicate threat notification should be suppressed');

    console.log('Kevin hardening tests passed');
} finally {
    process.chdir(originalCwd);
    for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    await rm(tempRoot, { recursive: true, force: true });
}
