import alpacaService from '../server/finance/AlpacaService.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    console.log('=== Checking SOMA Alpaca Service Connection ===');
    
    const creds = alpacaService.loadCredentials();
    if (creds) {
        console.log('Found stored credentials, connecting...');
        await alpacaService.connect(creds.apiKey, creds.apiSecret, creds.paperTrading, false, alpacaService.currentCredentialType);
    } else {
        console.log('No stored credentials found.');
    }
    
    const status = alpacaService.getStatus();
    console.log('Alpaca Service Connection Status:', status);
    
    if (status.connected) {
        console.log('Connection successful!');
        try {
            const account = await alpacaService.getAccount();
            console.log('Account status:');
            console.log(`- Cash: $${account.cash}`);
            console.log(`- Portfolio Value: $${account.portfolio_value}`);
            console.log(`- Currency: ${account.currency}`);
            console.log(`- Trading Blocked: ${account.trading_blocked}`);
            console.log(`- Pattern Day Trader: ${account.pattern_day_trader}`);
        } catch (e) {
            console.error('Failed to retrieve account detail:', e.message);
        }
    } else {
        console.log('Alpaca is not connected. Credentials might be missing or invalid.');
    }
}

main().catch(console.error);
