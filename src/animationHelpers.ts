import { PieceType } from './types.js';

// How long a piece takes to slide one step
export const MOVE_ANIMATION_MS = 1000;
// How long captured pieces take to fade out once the moving piece has landed
export const CAPTURE_FADE_MS = 300;
// Pause between the bot's consecutive moves in a capture chain, so each capture can be seen
export const BOT_CHAIN_PAUSE_MS = 800;
// Pause before the bot starts its turn (after the player's move, or at the start of a game)
export const BOT_TURN_PAUSE_MS = 800;

/**
 * Works out which pieces a move captured by comparing the piece positions before and after it.
 * @param movedFrom the cell the moving piece started on (it's empty afterwards but wasn't captured).
 * @returns the cells that had a piece before the move and are empty after it.
 */
export function capturedIndexes(before: number[], after: number[], movedFrom: number): number[] {
    const captured: number[] = [];
    for (let i = 0; i < before.length; i++) {
        if (i !== movedFrom && before[i] !== PieceType.EMPTY && after[i] === PieceType.EMPTY) {
            captured.push(i);
        }
    }
    return captured;
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
