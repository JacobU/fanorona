import { Worker } from 'worker_threads';
import { PieceType, Turn } from '../../types.js';
import { GameStats, playGame } from '../Tournament.js';
import { BotSpec, contestantFromSpec } from './BotSpec.js';
import { Opening } from './Openings.js';
import { RecordedPosition, recordPosition } from './Texel.js';

export interface GameJob {
    white: BotSpec,
    black: BotSpec,
    maxTurns: number,
    // Turns to play from the start before the bots take over
    opening?: Opening,
    // Record the evaluator features of every position in the game (for Texel tuning)
    recordPositions?: boolean,
}

export interface GameJobResult extends GameStats {
    positions?: RecordedPosition[],
}

/**
 * Plays a single job. Used both by the worker threads and when running on a single thread.
 */
export function playJob(job: GameJob): GameJobResult {
    const positions: RecordedPosition[] = [];
    const onTurnStart = job.recordPositions
        ? (board: Parameters<typeof recordPosition>[0]) => positions.push(recordPosition(board, board.getTurn() === Turn.WHITE ? PieceType.WHITE : PieceType.BLACK))
        : undefined;
    const stats = playGame(contestantFromSpec(job.white), contestantFromSpec(job.black), job.maxTurns, Math.random, job.opening ?? [], onTurnStart);
    return job.recordPositions ? { ...stats, positions } : stats;
}

/**
 * Plays every job and returns the results in the same order as the jobs.
 * With more than one worker, games are spread over that many threads.
 */
export async function runGames(jobs: GameJob[], numWorkers: number, onProgress?: (completed: number, total: number) => void): Promise<GameJobResult[]> {
    const results: GameJobResult[] = new Array(jobs.length);

    if (numWorkers <= 1) {
        jobs.forEach((job, i) => {
            results[i] = playJob(job);
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
            worker.on('message', ({ id, stats }: { id: number, stats: GameJobResult }) => {
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
