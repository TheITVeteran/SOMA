import EventEmitter from 'events';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

class MessageBroker extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.subscribers = new Map(); // topic -> Set<handler>
    this.arbiters = new Map(); // name -> { instance, meta }
    this.threads = new Map(); // threadId -> [messages]
    this.acks = new Map(); // packageId -> { acks: Map<from, ack>, resolver, timeoutId }
    this.auditPath = opts.auditPath || path.join(process.cwd(), 'broker-audit');
    this._ensureAuditDir();
    
    console.log('🌐 MessageBroker initialized');
  }

  async _ensureAuditDir() {
    try { 
      await fs.mkdir(this.auditPath, { recursive: true }); 
    } catch (e) { 
      // ignore 
    }
  }

  async _audit(event, data) {
    const rec = { event, ts: Date.now(), data };
    try {
      const file = path.join(this.auditPath, `audit_${event}_${Date.now()}_${crypto.randomUUID().slice(0, 6)}.json`);
      await fs.writeFile(file, JSON.stringify(rec, null, 2), 'utf8');
    } catch (e) {
      // best-effort
    }
    this.emit('audit', rec);
  }

  // Arbiter registry
  registerArbiter(name, instance, meta = {}) {
    if (!name) throw new Error('Arbiter name required');
    
    const entry = {
      name,
      instance,
      meta: { ...meta, lastSeen: Date.now() }
    };

    this.arbiters.set(name, entry);
    this._audit('arbiter_register', { name, meta });
    this.emit('arbiter.register', name, entry);
    
    console.log(`📝 Registered arbiter: ${name} (${meta.type || 'unknown'})`);
    return true;
  }

  unregisterArbiter(name) {
    this.arbiters.delete(name);
    this._audit('arbiter_unregister', { name });
    this.emit('arbiter.unregister', name);
    console.log(`📝 Unregistered arbiter: ${name}`);
  }

  listArbiters() {
    return Array.from(this.arbiters.values()).map(a => ({
      name: a.name,
      type: a.meta.type || 'unknown',
      capabilities: a.meta.capabilities || [],
      lastSeen: a.meta.lastSeen
    }));
  }

  // Subscribe to topics
  subscribe(arbiterName, topic) {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }
    
    const handler = (message) => {
      const arbiter = this.arbiters.get(arbiterName);
      if (arbiter && arbiter.instance && typeof arbiter.instance.handleMessage === 'function') {
        setImmediate(async () => {
          try {
            await arbiter.instance.handleMessage(message);
          } catch (error) {
            console.error(`[MessageBroker] Error delivering to ${arbiterName}:`, error.message);
          }
        });
      }
    };

    this.subscribers.get(topic).add(handler);
    console.log(`📡 Subscribed ${arbiterName} to topic: ${topic}`);
    
    return () => this.subscribers.get(topic)?.delete(handler);
  }

  // Publish to topics
  async publish(topic, message = {}) {
    const envelope = this._envelope(topic, message);
    this._appendThread(envelope.threadId, envelope);

    const subs = this.subscribers.get(topic);
    if (subs && subs.size > 0) {
      for (const handler of subs) {
        setImmediate(() => {
          try { 
            handler(envelope); 
          } catch (err) { 
            console.error('[MessageBroker] Subscriber error:', err); 
          }
        });
      }
    }

    this._audit('publish', { topic, envelope });
    return envelope;
  }

  // Send direct messages
  async sendMessage({ from, to, type, payload, threadId = null, priority = 'normal', meta = {} }) {
    if (!from) throw new Error('sendMessage requires from');
    
    const envelope = this._envelope(to || 'direct', { 
      from, to, type, payload, threadId, priority, meta 
    });

    if (!to || to === 'broadcast') {
      // Broadcast to all arbiters
      for (const [name, arbiter] of this.arbiters) {
        this._deliverTo(name, envelope);
      }
      return { ok: true, envelope };
    }

    // Direct delivery
    const target = this.arbiters.get(to);
    if (!target) {
      console.warn(`[MessageBroker] Target not found: ${to}`);
      return { ok: false, reason: 'target_not_found', envelope };
    }

    this._deliverTo(to, envelope);
    this._audit('send', { envelope });
    return { ok: true, envelope };
  }

  _deliverTo(targetName, envelope) {
    const target = this.arbiters.get(targetName);
    if (!target || !target.instance) return;

    if (typeof target.instance.handleMessage === 'function') {
      setImmediate(async () => {
        try {
          await target.instance.handleMessage(envelope);
        } catch (err) {
          console.error(`[MessageBroker] Delivery error to ${targetName}:`, err.message);
        }
      });
    }
  }

  _envelope(channel, message) {
    const threadId = message.threadId || crypto.randomUUID();
    return {
      id: message.id || crypto.randomUUID(),
      threadId,
      channel,
      from: message.from || 'broker',
      to: message.to || channel,
      type: message.type || 'message',
      payload: message.payload !== undefined ? message.payload : null,
      priority: message.priority || 'normal',
      meta: message.meta || {},
      ts: Date.now()
    };
  }

  _appendThread(threadId, envelope) {
    if (!this.threads.has(threadId)) {
      this.threads.set(threadId, []);
    }
    this.threads.get(threadId).push(envelope);
    
    // Keep threads manageable
    const arr = this.threads.get(threadId);
    if (arr.length > 100) {
      arr.shift();
    }
  }

  getThread(threadId) {
    return this.threads.get(threadId) || [];
  }

  getStatus() {
    return {
      arbiters: this.arbiters.size,
      topics: this.subscribers.size,
      threads: this.threads.size,
      registeredArbiters: this.listArbiters()
    };
  }

  async shutdown() {
    console.log('🌐 MessageBroker shutting down...');
    
    // Shutdown all arbiters
    for (const [name, arbiter] of this.arbiters) {
      if (arbiter.instance && typeof arbiter.instance.shutdown === 'function') {
        try {
          await arbiter.instance.shutdown();
        } catch (error) {
          console.error(`Error shutting down ${name}:`, error.message);
        }
      }
    }
    
    this.arbiters.clear();
    this.subscribers.clear();
    console.log('🌐 MessageBroker shutdown complete');
  }
}

// Export singleton
const messageBroker = new MessageBroker();
export default messageBroker;