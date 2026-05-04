import socialQueue from './server/social/SocialQueue.js';

function inspectQueue() {
    const all = socialQueue.getAll();
    const pending = socialQueue.getPending();
    const failed = all.filter(i => i.failed);
    const posted = all.filter(i => i.postedAt);

    console.log('--- Social Queue Status ---');
    console.log('Total items:', all.length);
    console.log('Pending items:', pending.length);
    console.log('Posted items:', posted.length);
    console.log('Failed items:', failed.length);

    if (failed.length > 0) {
        console.log('\n--- Failed Posts (last 5) ---');
        failed.slice(-5).forEach(f => {
            console.log(`[${new Date(f.failedAt).toLocaleString()}] Platform: ${f.platform}`);
            console.log(`Error: ${f.error}`);
            console.log(`Text: ${f.text.slice(0, 100)}...`);
            console.log('---');
        });
    }

    if (pending.length > 0) {
        console.log('\n--- Pending Posts (last 5) ---');
        pending.slice(-5).forEach(p => {
            console.log(`[Scheduled: ${new Date(p.scheduledFor).toLocaleString()}] Platform: ${p.platform}`);
            console.log(`Text: ${p.text.slice(0, 100)}...`);
            console.log('---');
        });
    }
}

inspectQueue();
