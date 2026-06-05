import alpacaService from '../server/finance/AlpacaService.js';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = 'PKASQTQCPGUOPVCF7SYM4SIVYW';
const secretKey = '6eXFtNxx9aLfZxXsf2qrsZFnRbQBYAYzXREUoM1wFC47';

async function run() {
    await alpacaService.connect(apiKey, secretKey, true, false, 'alpaca_paper', 'https://paper-api.alpaca.markets');
    
    console.log('Testing raw getLatestTrade:');
    try {
        const rawTrade = await alpacaService.client.getLatestTrade('AAPL');
        console.log('Raw trade object:', JSON.stringify(rawTrade, null, 2));
        console.log('Keys of raw trade object:', Object.keys(rawTrade));
    } catch (err) {
        console.error('getLatestTrade failed:', err);
    }
}

run().catch(console.error);
