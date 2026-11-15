import { BestMove, BoardState, PieceType } from './types.js';
import { DifficultyName } from './ai/difficulties.js';
import { planTurn } from './ai/planTurn.js';

export interface PlanRequest {
    id: number,
    state: BoardState,
    difficulty: DifficultyName,
    pieceType: PieceType,
}

export type PlanReply = { id: number, move: BestMove | null } | { id: number, error: string };

interface Pending {
    request: PlanRequest,
    resolve: (move: BestMove | null) => void,
    reject: (error: Error) => void,
}

/**
 * Chooses the bot's turns in a background Web Worker, so the page stays responsive while it thinks (the hardest
 * difficulty can take a few seconds). If the worker can't be used (e.g. the page was opened straight from a file,
 * where browsers don't allow module workers), the search runs on the page itself instead: slower to respond, but
 * the game still works.
 */
export default class TurnPlanner {
    private worker: Worker | null = null;
    private nextId = 0;
    private pending = new Map<number, Pending>();

    constructor() {
        try {
            this.worker = new Worker(new URL('./searchWorker.bundle.js', import.meta.url), { type: 'module' });
            this.worker.onmessage = ({ data }: MessageEvent<PlanReply>) => {
                const entry = this.pending.get(data.id);
                if (!entry) return;
                this.pending.delete(data.id);
                if ('error' in data) entry.reject(new Error(data.error));
                else entry.resolve(data.move);
            };
            // The worker failed to load or crashed: stop using it, and choose any waiting turns on the page instead.
            this.worker.onerror = () => this.stopUsingWorker();
        } catch {
            this.worker = null;
        }
    }

    public plan(state: BoardState, difficulty: DifficultyName, pieceType: PieceType): Promise<BestMove | null> {
        const request: PlanRequest = { id: this.nextId++, state, difficulty, pieceType };
        if (this.worker === null) return Promise.resolve(planOnPage(request));
        return new Promise((resolve, reject) => {
            this.pending.set(request.id, { request, resolve, reject });
            this.worker!.postMessage(request);
        });
    }

    private stopUsingWorker(): void {
        this.worker?.terminate();
        this.worker = null;
        const waiting = [...this.pending.values()];
        this.pending.clear();
        for (const { request, resolve, reject } of waiting) {
            try {
                resolve(planOnPage(request));
            } catch (error) {
                reject(error as Error);
            }
        }
    }
}

function planOnPage({ state, difficulty, pieceType }: PlanRequest): BestMove | null {
    return planTurn(state, difficulty, pieceType);
}
