class RequestTrace {
  constructor({ route = 'unknown', mode = 'normal', budgetMs = 10000 } = {}) {
    this.id = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.route = route;
    this.mode = mode;
    this.budgetMs = budgetMs;
    this.startedAt = Date.now();
    this.spans = [];
    this._last = this.startedAt;
  }

  mark(name, meta = {}) {
    const now = Date.now();
    this.spans.push({
      name,
      atMs: now - this.startedAt,
      deltaMs: now - this._last,
      ...meta
    });
    this._last = now;
  }

  finish(status = 'ok', meta = {}) {
    this.mark('finish', { status, ...meta });
    return {
      id: this.id,
      route: this.route,
      mode: this.mode,
      status,
      budgetMs: this.budgetMs,
      totalMs: Date.now() - this.startedAt,
      spans: this.spans
    };
  }
}

export default class LatencySpine {
  constructor({ maxHistory = 300, maxQueue = 500, defaultTtlMs = 30000 } = {}) {
    this.maxHistory = maxHistory;
    this.maxQueue = maxQueue;
    this.defaultTtlMs = defaultTtlMs;
    this.history = [];
    this.cache = new Map();
    this.queue = [];
    this.processing = 0;
    this.maxConcurrent = 2;
    this.stats = {
      traces: 0,
      cacheHits: 0,
      cacheMisses: 0,
      queued: 0,
      completed: 0,
      failed: 0
    };
  }

  startTrace(opts = {}) {
    return new RequestTrace(opts);
  }

  record(traceSummary) {
    if (!traceSummary) return;
    this.stats.traces++;
    this.history.unshift(traceSummary);
    if (this.history.length > this.maxHistory) this.history.length = this.maxHistory;
  }

  getCached(key) {
    const item = this.cache.get(key);
    if (!item || item.expiresAt <= Date.now()) {
      if (item) this.cache.delete(key);
      this.stats.cacheMisses++;
      return null;
    }
    this.stats.cacheHits++;
    return item.value;
  }

  setCached(key, value, ttlMs = this.defaultTtlMs) {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  async cached(key, factory, ttlMs = this.defaultTtlMs) {
    const hit = this.getCached(key);
    if (hit !== null) return hit;
    const value = await factory();
    return this.setCached(key, value, ttlMs);
  }

  enqueue(name, fn, { priority = 'normal' } = {}) {
    if (typeof fn !== 'function') return false;
    if (this.queue.length >= this.maxQueue) {
      this.queue.shift();
    }
    this.queue.push({ name, fn, priority, queuedAt: Date.now() });
    this.stats.queued++;
    this._drain();
    return true;
  }

  _drain() {
    while (this.processing < this.maxConcurrent && this.queue.length > 0) {
      const jobIndex = this.queue.findIndex(j => j.priority === 'high');
      const [job] = this.queue.splice(jobIndex >= 0 ? jobIndex : 0, 1);
      this.processing++;
      Promise.resolve()
        .then(job.fn)
        .then(() => { this.stats.completed++; })
        .catch(() => { this.stats.failed++; })
        .finally(() => {
          this.processing--;
          setImmediate(() => this._drain());
        });
    }
  }

  budgetFor({ voiceMode = false, deepThinking = false, action = false } = {}) {
    if (voiceMode) return 5000;
    if (deepThinking) return 90000;
    if (action) return 20000;
    return 12000;
  }

  status() {
    const last = this.history.slice(0, 20);
    const total = this.history.length || 1;
    const avgMs = Math.round(this.history.reduce((sum, h) => sum + (h.totalMs || 0), 0) / total);
    return {
      stats: this.stats,
      cacheSize: this.cache.size,
      queueSize: this.queue.length,
      processing: this.processing,
      avgMs,
      last
    };
  }
}
