import alpacaService from '../server/finance/AlpacaService.js';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = 'PKASQTQCPGUOPVCF7SYM4SIVYW';
const secretKey = '6eXFtNxx9aLfZxXsf2qrsZFnRbQBYAYzXREUoM1wFC47';

async function run() {
    await alpacaService.connect(apiKey, secretKey, true, false, 'alpaca_paper', 'https://paper-api.alpaca.markets');
    console.log('--- Closing AAPL position ---');
    const result = await alpacaService.closePosition('AAPL');
    console.log('Close Result:', JSON.stringify(result, null, 2));
}

run().catch(console.error);
