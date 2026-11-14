import { Worker } from 'worker_threads';
import { GameStats, playGame } from '../Tournament.js';
import { BotSpec, contestantFromSpec } from './BotSpec.js';

export interface GameJob {
    white: BotSpec,
    black: BotSpec,
    maxTurns: number,
}

/**
 * Plays every job and returns the results in the same order as the jobs.
 * With more than one worker, games are spread over that many threads.
 */
export async function runGames(jobs: GameJob[], numWorkers: number, onProgress?: (completed: number, total: number) => void): Promise<GameStats[]> {
    const results: GameStats[] = new Array(jobs.length);

    if (numWorkers <= 1) {
        jobs.forEach((job, i) => {
            results[i] = playGame(contestantFromSpec(job.white), contestantFromSpec(job.black), job.maxTurns);
            onProgress?.(i + 1, jobs.length);
        });
        return results;
    }

    let nextJob = 0;
    let completed = 0;
    const workers = Array.from({ length: Math.min(numWorkers, jobs.length) }, () => new Worker(new URL('./worker.js', import.meta.url)));

    try {
        await Promise.all(workers.map(worker => new Promise<void>((resolve, reject) => {
            const sendNext = () => {
                if (nextJob >= jobs.length) {
                    resolve();
                    return;
                }
                const id = nextJob++;
                worker.postMessage({ ...jobs[id], id });
            };
            worker.on('message', ({ id, stats }: { id: number, stats: GameStats }) => {
                results[id] = stats;
                completed++;
                onProgress?.(completed, jobs.length);
                sendNext();
            });
            worker.on('error', reject);
            sendNext();
        })));
    } finally {
        await Promise.all(workers.map(worker => worker.terminate()));
    }
    return results;
}
