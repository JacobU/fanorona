import { parentPort } from 'worker_threads';
import { GameJob, playJob } from './GamePool.js';

// Plays games sent from GamePool on a separate thread so several games can run at once.
parentPort!.on('message', (job: GameJob & { id: number }) => {
    parentPort!.postMessage({ id: job.id, stats: playJob(job) });
});
