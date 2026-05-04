/**
 * test_error.cjs
 * SOMA Health Probe
 */
'use strict';

function scoreMemoryHit(matches, total) {
    if (total === 0) return 0;
    return Math.min(1, matches / total);
}

const result = scoreMemoryHit(3, 10) === 0.3;
console.log(result ? '✅ PASS' : '❌ FAIL');

// Force clean exit for the staging test
process.exit(result ? 0 : 1);
