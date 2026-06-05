import fs from 'fs';
import path from 'path';

const THESIS_PATH = 'c:/Users/barry/OneDrive/Desktop/The Stack/SOMA/data/mission-control/trade-theses.json';

const btcMetrics = {
  totalTrades: 48,
  winningTrades: 14,
  losingTrades: 34,
  winRate: 29.166666666666668,
  profitFactor: 0.7483011314959114,
  sharpeRatio: -0.7818780720491873,
  sortinoRatio: -1.047514330691515,
  maxDrawdown: 8.705607317765103,
  totalReturn: -3.567083042456429,
  annualizedReturn: -99.98822004248834,
  totalPnL: -356.70830424564293,
  netPnL: -365.1764263721329,
  avgWin: 25.32168953119159,
  avgLoss: 20.918028167129272,
  largestWin: 136.21639343749964,
  largestLoss: -73.0805561073822,
  avgHoldingPeriod: 18.520833333333332,
  totalFees: 8.468122126489953,
  finalCapital: 9643.291695754357
};

const nvdaMetrics = {
  totalTrades: 6,
  winningTrades: 2,
  losingTrades: 4,
  winRate: 33.33333333333333,
  profitFactor: 0.5898867375253896,
  sharpeRatio: -0.9022513470659695,
  sortinoRatio: -1.3418579089531558,
  maxDrawdown: 1.5230985375200237,
  totalReturn: -0.49007421381378177,
  annualizedReturn: -99.98822004248834,
  totalPnL: -49.00742138137818,
  netPnL: -50.05260193137818,
  avgWin: 35.34005822363282,
  avgLoss: 29.957134457128913,
  largestWin: 36.1950346386719,
  largestLoss: -55.97349163867188,
  avgHoldingPeriod: 30.5,
  totalFees: 1.0451805500000002,
  finalCapital: 9950.992578618622
};

function main() {
    const data = JSON.parse(fs.readFileSync(THESIS_PATH, 'utf8'));
    
    let updatedCount = 0;
    for (const thesis of data) {
        if (thesis.id === 'thesis-1778329353558') {
            thesis.status = 'simulated';
            thesis.statusDetails = {
                sessionId: 'bt_1780509853518',
                metrics: btcMetrics,
                trades: 48,
                strategy: 'sma_crossover',
                interval: '1Min'
            };
            thesis.statusUpdatedAt = new Date().toISOString();
            thesis.updatedAt = new Date().toISOString();
            updatedCount++;
            console.log('Updated BTC thesis');
        }
        if (thesis.id === 'thesis-1780509263214') {
            thesis.status = 'simulated';
            thesis.statusDetails = {
                sessionId: 'bt_1780509853527',
                metrics: nvdaMetrics,
                trades: 6,
                strategy: 'sma_crossover',
                interval: '1Min'
            };
            thesis.statusUpdatedAt = new Date().toISOString();
            thesis.updatedAt = new Date().toISOString();
            updatedCount++;
            console.log('Updated NVDA thesis');
        }
    }
    
    if (updatedCount > 0) {
        fs.writeFileSync(THESIS_PATH, JSON.stringify(data, null, 2), 'utf8');
        console.log(`Successfully updated ${updatedCount} theses.`);
    } else {
        console.log('No matching theses found to update.');
    }
}

main();
