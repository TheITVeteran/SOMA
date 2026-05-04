/**
 * regression-runner.mjs
 *
 * Runs ExcelAnalyzer against known test fixtures and asserts specific findings.
 * Fails with a non-zero exit code if any assertion misses.
 *
 * Usage:
 *   node test/financial/regression-runner.mjs
 *
 * Run after any change to ExcelAnalyzer.js to catch regressions.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { ExcelAnalyzer } from '../../server/finance/ExcelAnalyzer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES   = path.join(__dirname, 'fixtures');
const analyzer   = new ExcelAnalyzer();

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
    if (condition) {
        console.log(`  ✓  ${label}`);
        passed++;
    } else {
        console.error(`  ✗  ${label}${detail ? ` — ${detail}` : ''}`);
        failed++;
    }
}

function has(findings, predicate) {
    return findings.some(predicate);
}

console.log('\n══ SOMA Financial Regression Suite ══\n');

// ── Test 1: SUM Gap ───────────────────────────────────────────────────────────
{
    console.log('Test 1: sum_gap.xlsx — SUM range excludes inserted row');
    const result = analyzer.analyze(path.join(FIXTURES, 'sum_gap.xlsx'));

    assert('Analysis succeeded', result.ok === true, result.error);

    const findings = (result.sheets || []).flatMap(s => s.findings || []);

    assert(
        'Detects SUM range gap (type: sum_range_gap)',
        has(findings, f => f.type === 'sum_range_gap'),
        `found types: ${findings.map(f => f.type).join(', ') || 'none'}`
    );

    assert(
        'Gap points to A10 ($1,024,500)',
        has(findings, f => f.type === 'sum_range_gap' && f.gap?.cell === 'A10'),
        `gap cells: ${findings.filter(f => f.type === 'sum_range_gap').map(f => f.gap?.cell).join(', ')}`
    );

    assert(
        'Severity is high or critical',
        has(findings, f => f.type === 'sum_range_gap' && ['high','critical'].includes(f.severity))
    );

    assert(
        'Sheet named Sheet1',
        (result.sheets || []).some(s => s.sheetName === 'Sheet1')
    );
}

// ── Test 2: Hardcoded Override ────────────────────────────────────────────────
{
    console.log('\nTest 2: hardcode.xlsx — plain value in formula column');
    const result = analyzer.analyze(path.join(FIXTURES, 'hardcode.xlsx'));

    assert('Analysis succeeded', result.ok === true, result.error);

    const findings = (result.sheets || []).flatMap(s => s.findings || []);

    assert(
        'Detects hardcoded override (type: hardcoded_override)',
        has(findings, f => f.type === 'hardcoded_override'),
        `found types: ${findings.map(f => f.type).join(', ') || 'none'}`
    );

    assert(
        'Override is in B7 (value: 99,999)',
        has(findings, f => f.type === 'hardcoded_override' && f.cell === 'B7'),
        `override cells: ${findings.filter(f => f.type === 'hardcoded_override').map(f => f.cell).join(', ')}`
    );

    assert(
        'Sheet named Expenses',
        (result.sheets || []).some(s => s.sheetName === 'Expenses')
    );
}

// ── Test 3: Formula Errors ────────────────────────────────────────────────────
{
    console.log('\nTest 3: formula_error.xlsx — #REF! and #DIV/0! present');
    const result = analyzer.analyze(path.join(FIXTURES, 'formula_error.xlsx'));

    assert('Analysis succeeded', result.ok === true, result.error);

    const findings = (result.sheets || []).flatMap(s => s.findings || []);

    assert(
        'Detects formula error in C2',
        has(findings, f => f.type === 'formula_error' && f.cell === 'C2'),
        `error cells: ${findings.filter(f => f.type === 'formula_error').map(f => f.cell).join(', ')}`
    );

    assert(
        'Detects formula error in C4',
        has(findings, f => f.type === 'formula_error' && f.cell === 'C4')
    );

    assert(
        'Both errors are critical severity',
        findings.filter(f => f.type === 'formula_error').every(f => f.severity === 'critical')
    );
}

// ── Test 4: Outlier Detection ─────────────────────────────────────────────────
{
    console.log('\nTest 4: outlier.xlsx — extreme value in consistent column');
    const result = analyzer.analyze(path.join(FIXTURES, 'outlier.xlsx'));

    assert('Analysis succeeded', result.ok === true, result.error);

    const findings = (result.sheets || []).flatMap(s => s.findings || []);

    assert(
        'Detects outlier in A13',
        has(findings, f => f.type === 'outlier' && f.cell === 'A13'),
        `outlier cells: ${findings.filter(f => f.type === 'outlier').map(f => f.cell).join(', ') || 'none'}`
    );

    assert(
        'Z-score exceeds detection threshold (> 3)',
        has(findings, f => f.type === 'outlier' && f.cell === 'A13' && f.zScore > 3),
        `z-score: ${findings.find(f => f.type === 'outlier')?.zScore}`
    );
}

// ── Test 5: Multi-Sheet ───────────────────────────────────────────────────────
{
    console.log('\nTest 5: multi_sheet.xlsx — two sheets, SUM gap in Summary');
    const result = analyzer.analyze(path.join(FIXTURES, 'multi_sheet.xlsx'));

    assert('Analysis succeeded', result.ok === true, result.error);

    assert(
        'Both sheets analyzed',
        result.sheets?.length === 2,
        `sheet count: ${result.sheets?.length}`
    );

    const findings = (result.sheets || []).flatMap(s => s.findings || []);

    assert(
        'Detects SUM issue in Summary sheet',
        has(findings, f => (f.type === 'sum_range_gap' || f.type === 'sum_discrepancy') && f.sheet === 'Summary'),
        `summary findings: ${findings.filter(f => f.sheet === 'Summary').map(f => f.type).join(', ') || 'none'}`
    );
}

// ── Test 6: Header row NOT flagged as hardcoded override ──────────────────────
{
    console.log('\nTest 6: hardcode.xlsx — header row (B1 "Tax (15%)") must not be flagged');
    const result = analyzer.analyze(path.join(FIXTURES, 'hardcode.xlsx'));

    assert('Analysis succeeded', result.ok === true, result.error);

    const findings = (result.sheets || []).flatMap(s => s.findings || []);
    const headerFlagged = has(findings, f => f.type === 'hardcoded_override' && f.cell === 'B1');

    assert(
        'Header row B1 is NOT flagged as override',
        !headerFlagged,
        'B1 (text header) was incorrectly flagged as a hardcoded override'
    );

    assert(
        'B7 (the real override) IS still flagged',
        has(findings, f => f.type === 'hardcoded_override' && f.cell === 'B7')
    );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n══ Results: ${passed} passed, ${failed} failed ══\n`);

if (failed > 0) {
    console.error('REGRESSION DETECTED — ExcelAnalyzer missed expected findings.\n');
    process.exit(1);
} else {
    console.log('All assertions passed. ExcelAnalyzer is production-ready for these patterns.\n');
    process.exit(0);
}
