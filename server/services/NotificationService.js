/**
 * Notification Service
 * Sends alerts to external services (Discord)
 */

import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), '.soma', 'notifications.json');

class NotificationService {
    constructor() {
        this.settings = {
            discordWebhookUrl: null
        };
        this.loadSettings();
    }

    loadSettings() {
        try {
            if (fs.existsSync(SETTINGS_FILE)) {
                const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
                this.settings = JSON.parse(data);
            }
        } catch (e) {
            console.error('[Notifications] Failed to load settings:', e.message);
        }
    }

    saveSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        try {
            const dir = path.dirname(SETTINGS_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2));
            return true;
        } catch (e) {
            console.error('[Notifications] Failed to save settings:', e.message);
            return false;
        }
    }

    getSettings() {
        return this.settings;
    }

    /**
     * Generic Discord embed sender — used for engine lifecycle alerts and
     * daily promotion-gate summaries. No-op when no webhook is configured.
     */
    async sendAlert(title, description, { color = 5793266, fields = [] } = {}) {
        if (!this.settings.discordWebhookUrl) return;
        try {
            await fetch(this.settings.discordWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [{ title, description, color, fields, timestamp: new Date().toISOString() }]
                })
            });
        } catch (e) {
            console.error('[Notifications] Discord webhook failed:', e.message);
        }
    }

    /**
     * Daily promotion-gate progress summary toward Tiny Live eligibility.
     * Self-fetches the local API so this stays decoupled from finance internals.
     */
    async sendDailyGateSummary() {
        if (!this.settings.discordWebhookUrl) return;
        try {
            const [repRes, perfRes] = await Promise.all([
                fetch('http://localhost:3001/api/learning/report'),
                fetch('http://localhost:3001/api/performance/summary')
            ]);
            const report = (await repRes.json())?.report || {};
            const perf = (await perfRes.json())?.summary || {};
            const m = report.metrics || {};
            const gates = [
                ['Closed trades', `${m.totalTrades ?? 0} / 100`, (m.totalTrades ?? 0) >= 100],
                ['Win rate', `${(m.winRate ?? 0).toFixed(1)}% / 60%`, (m.winRate ?? 0) >= 60],
                ['Profit factor', `${(m.profitFactor ?? 0).toFixed(2)} / 1.4`, (m.profitFactor ?? 0) >= 1.4],
                ['Max drawdown', `${(m.maxDrawdownPct ?? 0).toFixed(1)}% / 12%`, (m.maxDrawdownPct ?? 0) <= 12]
            ];
            await this.sendAlert(
                '📊 Daily Promotion Gate Report',
                `Total P&L: $${(perf.total_pnl ?? 0).toFixed(2)} · Open positions: ${perf.open_trades ?? 0}`,
                {
                    color: gates.every(g => g[2]) ? 3581519 : 15844367,
                    fields: gates.map(([name, value, pass]) => ({ name: `${pass ? '✅' : '❌'} ${name}`, value, inline: true }))
                }
            );
        } catch (e) {
            console.error('[Notifications] Daily gate summary failed:', e.message);
        }
    }

    /** Schedule the daily gate summary for 9:00 AM local, then every 24h. */
    startDailySummarySchedule() {
        if (this._dailyTimer) return;
        const now = new Date();
        const next = new Date(now);
        next.setHours(9, 0, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
        this._dailyTimer = setTimeout(() => {
            this.sendDailyGateSummary().catch(() => {});
            this._dailyTimer = setInterval(() => this.sendDailyGateSummary().catch(() => {}), 24 * 60 * 60 * 1000);
        }, next - now);
        console.log(`[Notifications] Daily gate summary scheduled for ${next.toLocaleString()}`);
    }

    /**
     * Send a Discord webhook for a closed trade
     * @param {object} trade - The closed trade object
     */
    async sendTradeNotification(trade) {
        if (!this.settings.discordWebhookUrl) return;

        try {
            const isProfit = trade.pnl > 0;
            const embed = {
                title: `✅ Trade Closed: ${trade.symbol}`,
                color: isProfit ? 3581519 : 13632027, // Green or Red
                fields: [
                    { name: "Side", value: trade.side.toUpperCase(), inline: true },
                    { name: "Quantity", value: `${trade.qty}`, inline: true },
                    { name: "P&L", value: `$${trade.pnl.toFixed(2)} (${trade.pnlPct.toFixed(2)}%)`, inline: true },
                    { name: "Entry Price", value: `$${trade.entryPrice.toFixed(2)}`, inline: true },
                    { name: "Exit Price", value: `$${trade.exitPrice.toFixed(2)}`, inline: true },
                    { name: "Reason", value: trade.reason, inline: true }
                ],
                timestamp: new Date().toISOString()
            };

            await fetch(this.settings.discordWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed] })
            });
        } catch (e) {
            console.error('[Notifications] Discord webhook failed:', e.message);
        }
    }
}

const notificationService = new NotificationService();
notificationService.startDailySummarySchedule();
export default notificationService;
