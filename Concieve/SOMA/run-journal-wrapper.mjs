
import { updateJournal } from './update-journal.mjs';

console.log('Running journal update wrapper...');
updateJournal().then(() => {
    console.log('Wrapper finished.');
}).catch(err => {
    console.error('Wrapper failed:', err);
});
