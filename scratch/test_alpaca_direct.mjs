import alpacaService from '../server/finance/AlpacaService.js';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = 'PKASQTQCPGUOPVCF7SYM4SIVYW';
const secretKey = '6eXFtNxx9aLfZxXsf2qrsZFnRbQBYAYzXREUoM1wFC47';
const paperTrading = true;

async function run() {
    console.log('--- Connecting to Alpaca Paper ---');
    const connResult = await alpacaService.connect(apiKey, secretKey, paperTrading, true, 'alpaca_paper', 'https://paper-api.alpaca.markets');
    console.log('Connection Result:', connResult);
    
    console.log('--- Fetching Account Details ---');
    const accDetails = await alpacaService.getAccount();
    console.log('Account Details:', JSON.stringify(accDetails.account, null, 2));
    
    console.log('--- Executing 1-Share AAPL Test Buy Order ---');
    const orderResult = await alpacaService.executeOrder('AAPL', 'buy', 1, 'market', 'day');
    console.log('Order Result:', JSON.stringify(orderResult, null, 2));

    console.log('--- Fetching Positions ---');
    const positions = await alpacaService.getPositions();
    console.log('Positions:', JSON.stringify(positions, null, 2));
}

run().catch(err => {
    console.error('Test failed:', err);
});
