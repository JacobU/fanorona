import { parentPort } from 'worker_threads';
import { playGame } from '../Tournament.js';
import { contestantFromSpec } from './BotSpec.js';
import type { GameJob } from './GamePool.js';

// Plays games sent from GamePool on a separate thread so several games can run at once.
parentPort!.on('message', (job: GameJob & { id: number }) => {
    const stats = playGame(contestantFromSpec(job.white), contestantFromSpec(job.black), job.maxTurns);
    parentPort!.postMessage({ id: job.id, stats });
});
