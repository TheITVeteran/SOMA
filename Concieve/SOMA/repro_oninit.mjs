
import { BaseArbiterV4 } from './arbiters/BaseArbiter.js';

class TestArbiter extends BaseArbiterV4 {
    constructor(opts = {}) {
        super(opts);
        this.onInitializeCalled = false;
    }

    async onInitialize() {
        console.log('onInitialize called!');
        this.onInitializeCalled = true;
    }
}

async function run() {
    const arbiter = new TestArbiter({ name: 'Test' });
    await arbiter.initialize();
    if (arbiter.onInitializeCalled) {
        console.log('SUCCESS: onInitialize was called');
    } else {
        console.log('FAILURE: onInitialize was NOT called');
    }
}

run();
