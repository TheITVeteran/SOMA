import fs from 'fs';
import path from 'path';

// Generate a CSV with numbers following Benford's Law (mostly)
// Frequency of digit d is log10(1 + 1/d)
const generateBenfordData = (count) => {
    let rows = ['TransactionID,Amount'];
    for (let i = 1; i <= count; i++) {
        // Simple way to get Benford-ish distribution: 10^uniform(0, 4)
        const amount = (Math.pow(10, Math.random() * 4)).toFixed(2);
        rows.push(`${i},${amount}`);
    }
    return rows.join('\n');
};

const testDir = path.join(process.cwd(), 'data', 'test_forensics');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

const csvPath = path.join(testDir, 'mock_benford.csv');
fs.writeFileSync(csvPath, generateBenfordData(200));
console.log(`✅ Generated Benford Mock: ${csvPath}`);

// We'll skip XLSX generation for a moment as it requires the 'xlsx' lib to be used correctly, 
// but we'll run the Benford test on the CSV now.
