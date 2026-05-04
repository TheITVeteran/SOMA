/**
 * generate-test-workbooks.mjs
 *
 * Creates 3 Excel test fixtures with planted problems.
 * Run once: node test/financial/generate-test-workbooks.mjs
 *
 * Files created:
 *   test/financial/fixtures/sum_gap.xlsx        — SUM excludes an inserted row ($1,024,500)
 *   test/financial/fixtures/hardcode.xlsx       — formula column with one hardcoded override
 *   test/financial/fixtures/formula_error.xlsx  — #REF! and #DIV/0! errors
 */

import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');
fs.mkdirSync(FIXTURES, { recursive: true });

function setRef(ws, maxRow, maxCol) {
    const start = XLSX.utils.encode_cell({ r: 0, c: 0 });
    const end   = XLSX.utils.encode_cell({ r: maxRow, c: maxCol });
    ws['!ref'] = `${start}:${end}`;
}

// ── 1. SUM Gap ────────────────────────────────────────────────────────────────
// A1=header, A2:A10=values, A11=SUM(A2:A9) — A10 ($1,024,500) excluded.
{
    const wb = XLSX.utils.book_new();
    const ws = {};

    ws['A1']  = { t: 's', v: 'Revenue' };
    const vals = [125000, 234000, 178500, 312000, 289000, 445000, 198000, 367000, 1024500];
    vals.forEach((v, i) => { ws[`A${i + 2}`] = { t: 'n', v }; });

    // SUM deliberately stops at A9 — A10 ($1,024,500) is outside the range
    ws['A11'] = { t: 'n', v: 2148500, f: 'SUM(A2:A9)' };
    ws['B11'] = { t: 's', v: 'BUG: should be SUM(A2:A10)' };

    setRef(ws, 10, 1); // rows 0-10, cols 0-1

    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, path.join(FIXTURES, 'sum_gap.xlsx'));
    console.log('✓ sum_gap.xlsx — SUM(A2:A9) excludes A10 ($1,024,500)');
}

// ── 2. Hardcoded Override ─────────────────────────────────────────────────────
// B column = =A*0.15 (tax), except B7 which is hardcoded 99999.
{
    const wb = XLSX.utils.book_new();
    const ws = {};

    ws['A1'] = { t: 's', v: 'Amount' };
    ws['B1'] = { t: 's', v: 'Tax (15%)' };

    const amounts = [50000, 72000, 61000, 84000, 93000, 47000, 55000, 68000, 79000];
    amounts.forEach((v, i) => {
        const row = i + 2;
        ws[`A${row}`] = { t: 'n', v };
        if (i === 5) {
            // Row 7: manually typed override instead of formula
            ws[`B${row}`] = { t: 'n', v: 99999 };
            ws[`C${row}`] = { t: 's', v: 'BUG: should be =A7*0.15 = 7050' };
        } else {
            ws[`B${row}`] = { t: 'n', v: v * 0.15, f: `A${row}*0.15` };
        }
    });

    setRef(ws, amounts.length, 2); // rows 0 to 9, cols 0-2

    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    XLSX.writeFile(wb, path.join(FIXTURES, 'hardcode.xlsx'));
    console.log('✓ hardcode.xlsx — B7 hardcoded as 99999 (should be =A7*0.15 = 7,050)');
}

// ── 3. Formula Errors ─────────────────────────────────────────────────────────
// C2 → #REF!, C4 → #DIV/0!
{
    const wb = XLSX.utils.book_new();
    const ws = {};

    ws['A1'] = { t: 's', v: 'Item' };
    ws['B1'] = { t: 's', v: 'Amount' };
    ws['C1'] = { t: 's', v: 'Ratio' };

    ws['A2'] = { t: 's', v: 'Alpha' };  ws['B2'] = { t: 'n', v: 100000 };
    ws['A3'] = { t: 's', v: 'Beta' };   ws['B3'] = { t: 'n', v: 250000 };
    ws['A4'] = { t: 's', v: 'Gamma' };  ws['B4'] = { t: 'n', v: 0 };
    ws['A5'] = { t: 's', v: 'Total' };  ws['B5'] = { t: 'n', v: 350000, f: 'SUM(B2:B4)' };

    // #REF! — formula references a column that doesn't exist
    ws['C2'] = { t: 'e', v: 7, f: 'B2/D2', w: '#REF!' };
    // #DIV/0! — dividing by zero (B4 = 0)
    ws['C4'] = { t: 'e', v: 7, f: 'B2/B4', w: '#DIV/0!' };

    setRef(ws, 4, 2);

    XLSX.utils.book_append_sheet(wb, ws, 'ErrorSheet');
    XLSX.writeFile(wb, path.join(FIXTURES, 'formula_error.xlsx'));
    console.log('✓ formula_error.xlsx — C2 #REF!, C4 #DIV/0!');
}

// ── 4. Statistical Outlier ────────────────────────────────────────────────────
// Column of 12 consistent values with one extreme outlier (50x the mean).
{
    const wb = XLSX.utils.book_new();
    const ws = {};

    ws['A1'] = { t: 's', v: 'Monthly Expense' };
    const normal = [12000, 11500, 13200, 12800, 11900, 12400, 13100, 11700, 12600, 12200, 11800];
    normal.forEach((v, i) => { ws[`A${i + 2}`] = { t: 'n', v }; });
    ws['A13'] = { t: 'n', v: 650000 }; // outlier — ~53x the mean
    ws['B13'] = { t: 's', v: 'BUG: should be ~12,000' };

    setRef(ws, 12, 1);
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    XLSX.writeFile(wb, path.join(FIXTURES, 'outlier.xlsx'));
    console.log('✓ outlier.xlsx — A13 ($650,000) is ~53σ from column mean (~$12,400)');
}

// ── 5. Multi-Sheet Cross-Reference ───────────────────────────────────────────
// Two sheets: Summary references Detail. Summary!B2 = SUM(Detail!A2:A9)
// but A10 in Detail ($500,000) is excluded.
{
    const wb = XLSX.utils.book_new();

    // Detail sheet
    const detail = {};
    detail['A1'] = { t: 's', v: 'Revenue Line' };
    [80000, 95000, 72000, 110000, 88000, 103000, 91000, 86000, 500000].forEach((v, i) => {
        detail[`A${i + 2}`] = { t: 'n', v };
    });
    setRef(detail, 9, 0);
    XLSX.utils.book_append_sheet(wb, detail, 'Detail');

    // Summary sheet — SUM stops at A9, misses A10 ($500,000)
    const summary = {};
    summary['A1'] = { t: 's', v: 'Category' };
    summary['B1'] = { t: 's', v: 'Total' };
    summary['A2'] = { t: 's', v: 'Revenue' };
    summary['B2'] = { t: 'n', v: 725000, f: "SUM(Detail!A2:A9)" };
    summary['C2'] = { t: 's', v: 'BUG: should be SUM(Detail!A2:A10)' };
    setRef(summary, 1, 2);
    XLSX.utils.book_append_sheet(wb, summary, 'Summary');

    XLSX.writeFile(wb, path.join(FIXTURES, 'multi_sheet.xlsx'));
    console.log('✓ multi_sheet.xlsx — Summary!B2 SUM excludes Detail!A10 ($500,000)');
}

console.log('\nAll fixtures written to test/financial/fixtures/');
