'use strict';

const STATUS = Object.freeze({
  PROPOSED: 'proposed',
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  VERIFICATION_FAILED: 'verification_failed',
  FAILED: 'failed',
  DEFERRED: 'deferred',
  BROKEN: 'broken',
  REJECTED: 'rejected',
  ABANDONED: 'abandoned',
  ARCHIVED: 'archived'
});

const LEGACY_STATUS = Object.freeze({
  incomplete_step_budget: STATUS.PENDING,
  incomplete_verification: STATUS.PENDING,
  repairing: STATUS.PENDING
});

const TERMINAL_STATUSES = new Set([
  STATUS.COMPLETED,
  STATUS.VERIFICATION_FAILED,
  STATUS.FAILED,
  STATUS.REJECTED,
  STATUS.ABANDONED,
  STATUS.ARCHIVED
]);

const ALLOWED = Object.freeze({
  [STATUS.PROPOSED]: new Set([STATUS.PENDING, STATUS.ACTIVE, STATUS.DEFERRED, STATUS.REJECTED, STATUS.FAILED]),
  [STATUS.PENDING]: new Set([STATUS.ACTIVE, STATUS.COMPLETED, STATUS.DEFERRED, STATUS.FAILED, STATUS.VERIFICATION_FAILED, STATUS.BROKEN]),
  [STATUS.ACTIVE]: new Set([STATUS.PENDING, STATUS.COMPLETED, STATUS.DEFERRED, STATUS.FAILED, STATUS.VERIFICATION_FAILED, STATUS.BROKEN]),
  [STATUS.BROKEN]: new Set([STATUS.PENDING, STATUS.FAILED, STATUS.DEFERRED, STATUS.ARCHIVED]),
  [STATUS.DEFERRED]: new Set([STATUS.PENDING, STATUS.COMPLETED, STATUS.ARCHIVED]),
  [STATUS.VERIFICATION_FAILED]: new Set([STATUS.PENDING, STATUS.FAILED, STATUS.ARCHIVED]),
  [STATUS.FAILED]: new Set([STATUS.PENDING, STATUS.ARCHIVED]),
  [STATUS.REJECTED]: new Set([STATUS.ARCHIVED]),
  [STATUS.COMPLETED]: new Set([STATUS.ARCHIVED]),
  [STATUS.ABANDONED]: new Set([STATUS.ARCHIVED]),
  [STATUS.ARCHIVED]: new Set()
});

function normalizeStatus(status) {
  return LEGACY_STATUS[status] || status || STATUS.PROPOSED;
}

function isTerminal(status) {
  return TERMINAL_STATUSES.has(normalizeStatus(status));
}

function transitionGoal(goal, nextStatus, options = {}) {
  if (!goal || typeof goal !== 'object') throw new TypeError('goal is required');
  const from = normalizeStatus(goal.status);
  const to = normalizeStatus(nextStatus);
  const now = Number(options.now || Date.now());

  if (from === to) return { changed: false, from, to, goal };
  if (!options.force && !ALLOWED[from]?.has(to)) {
    throw new Error(`Invalid goal transition: ${from} -> ${to}`);
  }

  goal.metadata = goal.metadata || {};
  const history = Array.isArray(goal.metadata.lifecycleHistory)
    ? goal.metadata.lifecycleHistory
    : [];
  history.push({
    from,
    to,
    at: now,
    reason: String(options.reason || 'unspecified').slice(0, 300),
    actor: String(options.actor || 'system').slice(0, 100)
  });
  goal.metadata.lifecycleHistory = history.slice(-100);
  goal.metadata.lastTransition = history.at(-1);
  goal.status = to;

  if (to === STATUS.ACTIVE) goal.startedAt = goal.startedAt || now;
  if ([STATUS.COMPLETED, STATUS.FAILED, STATUS.REJECTED, STATUS.ABANDONED, STATUS.ARCHIVED].includes(to)) {
    goal.completedAt = goal.completedAt || now;
  } else if (options.clearCompletedAt !== false) {
    goal.completedAt = null;
  }

  return { changed: true, from, to, goal };
}

module.exports = {
  STATUS,
  TERMINAL_STATUSES,
  normalizeStatus,
  isTerminal,
  transitionGoal
};
