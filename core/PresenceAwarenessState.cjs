'use strict';

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(process.cwd(), 'SOMA', 'presence-awareness.json');
const ABSENCE_RESET_MS = 10 * 60 * 1000;
const PROBE_COOLDOWN_MS = Number(process.env.SOMA_PRESENCE_PROBE_COOLDOWN_MS || 45 * 60 * 1000);
const ACTIVITY_WINDOW_MS = 2 * 60 * 1000;
const VISION_CONFIRM_WINDOW_MS = 25 * 1000;

const PERSON_LABELS = new Set(['person', 'human', 'face', 'portrait']);
const PET_LABELS = new Set(['dog', 'puppy', 'cat', 'kitten', 'pet']);

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function now() {
  return Date.now();
}

function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return {
    version: 1,
    mode: 'unknown',
    lastUserActivityAt: null,
    lastPersonSeenAt: null,
    lastPetSeenAt: null,
    lastProbeAt: null,
    consecutivePersonFrames: 0,
    pendingReturnSince: null,
    lastIdentity: null,
    lastProbeReason: null
  };
}

function writeState(state) {
  ensureDir(STATE_FILE);
  fs.writeFileSync(STATE_FILE, JSON.stringify({ version: 1, ...state }, null, 2));
}

function labelsFromVision(payload = {}) {
  const objects = payload.objects || payload.analysis?.objects || [];
  return objects
    .map(obj => ({
      label: String(obj.label || '').toLowerCase(),
      score: Number(obj.score ?? obj.confidence ?? 0)
    }))
    .filter(obj => obj.label);
}

function classifyVision(payload = {}) {
  const labels = labelsFromVision(payload);
  const person = labels.find(item => PERSON_LABELS.has(item.label) && item.score >= 0.55);
  const pet = labels.find(item => PET_LABELS.has(item.label) && item.score >= 0.45);
  return {
    personDetected: !!person,
    personConfidence: person?.score || 0,
    petDetected: !!pet,
    petLabel: pet?.label || null,
    labels: labels.map(item => item.label).slice(0, 8)
  };
}

function buildProbe({ state, timestamp, reason, confidence }) {
  const identity = state.lastIdentity || 'unknown_person';
  const displayName = state.lastIdentityDisplay || null;
  const knownPerson = identity !== 'unknown_person';
  return {
    type: 'presence_probe',
    timestamp,
    reason,
    identity,
    displayName,
    confidence,
    listenWindowMs: 25_000,
    message: knownPerson
      ? `Hello${displayName ? `, ${displayName}` : ''}. I thought you came back. How are you?`
      : 'Hello? I thought someone was there. How are you?'
  };
}

function maybeProbe({ state, timestamp, reason, confidence }) {
  const cooldownOpen = !state.lastProbeAt || timestamp - state.lastProbeAt > PROBE_COOLDOWN_MS;
  if (!cooldownOpen) return null;

  const recentActivity = state.lastUserActivityAt && timestamp - state.lastUserActivityAt < ACTIVITY_WINDOW_MS;
  const confirmedVision = state.consecutivePersonFrames >= 2;
  if (!recentActivity && !confirmedVision) return null;

  state.lastProbeAt = timestamp;
  state.lastProbeReason = reason;
  return buildProbe({ state, timestamp, reason, confidence });
}

function recordUserActivity(payload = {}) {
  const state = readState();
  const timestamp = Number(payload.timestamp || now());
  const wasAway = !state.lastUserActivityAt || timestamp - state.lastUserActivityAt > ABSENCE_RESET_MS;
  state.lastUserActivityAt = timestamp;

  let probe = null;
  if (wasAway && state.lastPersonSeenAt && timestamp - state.lastPersonSeenAt < ACTIVITY_WINDOW_MS) {
    state.mode = 'present';
    probe = maybeProbe({
      state,
      timestamp,
      reason: 'activity_after_absence_with_recent_person',
      confidence: state.lastPersonConfidence || 0.6
    });
  }

  writeState(state);
  return { state, probe };
}

function recordIdentity(payload = {}) {
  const state = readState();
  const timestamp = Number(payload.timestamp || now());
  const name = payload.name || payload.identity || payload.recognizedAs;
  if (name) {
    state.lastIdentityDisplay = String(name);
    state.lastIdentity = String(name).toLowerCase();
    state.lastIdentityConfidence = Number(payload.confidence || 0);
    state.lastIdentityAt = timestamp;
  }
  writeState(state);
  return { state, probe: null };
}

function recordVision(payload = {}) {
  const state = readState();
  const timestamp = Number(payload.timestamp || now());
  const vision = classifyVision(payload);
  const stalePerson = !state.lastPersonSeenAt || timestamp - state.lastPersonSeenAt > ABSENCE_RESET_MS;

  if (vision.petDetected) {
    state.lastPetSeenAt = timestamp;
    state.lastPetLabel = vision.petLabel;
  }

  let probe = null;
  if (vision.personDetected) {
    const priorSeenAt = state.lastPersonSeenAt || 0;
    const samePresenceRun = priorSeenAt && timestamp - priorSeenAt < VISION_CONFIRM_WINDOW_MS;
    state.consecutivePersonFrames = samePresenceRun ? (state.consecutivePersonFrames || 0) + 1 : 1;
    state.lastPersonSeenAt = timestamp;
    state.lastPersonConfidence = vision.personConfidence;
    const payloadIdentity = payload.identity?.name || payload.recognizedAs;
    if (payloadIdentity) {
      state.lastIdentityDisplay = String(payloadIdentity);
      state.lastIdentity = String(payloadIdentity).toLowerCase();
    } else {
      state.lastIdentity = state.lastIdentity || 'unknown_person';
    }
    state.mode = 'present';

    if (stalePerson) {
      state.pendingReturnSince = timestamp;
    }

    const pendingReturnActive = state.pendingReturnSince &&
      timestamp - state.pendingReturnSince < VISION_CONFIRM_WINDOW_MS;
    if (pendingReturnActive) {
      probe = maybeProbe({
        state,
        timestamp,
        reason: 'person_seen_after_absence',
        confidence: vision.personConfidence
      });
      if (probe) state.pendingReturnSince = null;
    } else if (state.pendingReturnSince) {
      state.pendingReturnSince = null;
    }
  } else {
    if (state.lastPersonSeenAt && timestamp - state.lastPersonSeenAt > ABSENCE_RESET_MS) {
      state.mode = state.lastPetSeenAt && timestamp - state.lastPetSeenAt < ABSENCE_RESET_MS ? 'pet_nearby' : 'absent';
      state.consecutivePersonFrames = 0;
      state.pendingReturnSince = null;
    }
  }

  state.lastVisionLabels = vision.labels;
  writeState(state);
  return { state, probe };
}

module.exports = {
  STATE_FILE,
  readState,
  writeState,
  recordUserActivity,
  recordIdentity,
  recordVision,
  classifyVision
};
