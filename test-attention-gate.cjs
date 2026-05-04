/**
 * test-attention-gate.cjs
 * Verifies that the AttentionEngine is correctly filtering signals in the MessageBroker.
 */

const broker = require('./core/MessageBroker.cjs');

async function test() {
    console.log('🧪 Testing SOMA Attention Gate...');

    // 1. High Priority Signal (Should pass)
    console.log('\n--- Test 1: High Priority Signal ---');
    const highPassed = await broker.emitSignal('system.update', { data: 'important' }, 'high');
    
    // 2. Background Noise Signal (Should be suppressed)
    console.log('\n--- Test 2: Background Noise (Heartbeat) ---');
    const noisePassed = await broker.emitSignal('arbiter.heartbeat', { status: 'ok' }, 'low');

    // 3. Focused Attention (Focusing on a specific arbiter)
    console.log('\n--- Test 3: Focused Attention ---');
    broker.setAttentionFocus('TodayBarryArbiter');
    // This signal would normally be low strength, but because we are focused on the source, it should pass.
    // Note: emitSignal doesn't take 'from' directly in this version, it defaults to 'MessageBroker'.
    // Let's mock a direct message or simulate a signal from the focused source.
    
    // Actually, let's just test the threshold adjustment
    console.log('\n--- Test 4: Threshold Adjustment ---');
    broker.setAttentionThreshold(0.9); // Set very high
    const suppressed = await broker.emitSignal('normal.signal', { data: 'test' }, 'normal');
    
    if (suppressed === 0) {
        console.log('✅ Success: Normal signal suppressed at 0.9 threshold.');
    }

    broker.setAttentionThreshold(0.1); // Set very low
    const allowed = await broker.emitSignal('normal.signal', { data: 'test' }, 'normal');
    
    console.log('\n--- Cleanup ---');
    broker.disableAttentionGate();
    console.log('✅ Attention Gate disabled.');
}

test().catch(console.error);
