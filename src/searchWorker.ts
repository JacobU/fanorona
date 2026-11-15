import { planTurn } from './ai/planTurn.js';
import type { PlanReply, PlanRequest } from './TurnPlanner.js';

// Runs in a Web Worker (bundled separately as searchWorker.bundle.js), so the bot's search doesn't freeze the page.
// TypeScript is set up for the page (the "dom" library), so describe the little of the worker's global scope used here.
const scope = self as unknown as {
    onmessage: ((event: MessageEvent<PlanRequest>) => void) | null,
    postMessage(message: PlanReply): void,
};

scope.onmessage = ({ data }) => {
    try {
        scope.postMessage({ id: data.id, move: planTurn(data.state, data.difficulty, data.pieceType) });
    } catch (error) {
        scope.postMessage({ id: data.id, error: String(error) });
    }
};
