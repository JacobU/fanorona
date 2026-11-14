import Board from '../Board.js';
import { PieceType } from '../types.js';
import { Evaluator } from './Evaluator.js';

/**
 * Number of pieces left on the board (both colours) at which the endgame starts: the endgame evaluator starts
 * being blended in below this, and bots with an endgameDepth search deeper at or below it.
 */
export const ENDGAME_START_PIECES = 10;

/**
 * Number of pieces left on the board (both colours) at or below which the endgame evaluator counts in full.
 */
export const ENDGAME_FULL_PIECES = 6;

/**
 * @returns the number of pieces of both colours on the board.
 */
export function totalPieces(board: Board): number {
    return board.getNumPieces(PieceType.WHITE) + board.getNumPieces(PieceType.BLACK);
}

/**
 * How much the endgame evaluator counts with this many pieces on the board: 0 at ENDGAME_START_PIECES or more,
 * rising linearly to 1 at ENDGAME_FULL_PIECES or fewer.
 * @param start, full a bot's own thresholds, if it has them (the defaults are the constants above).
 */
export function endgameFactor(numPieces: number, start: number = ENDGAME_START_PIECES, full: number = ENDGAME_FULL_PIECES): number {
    const factor = (start - numPieces) / (start - full);
    return Math.min(1, Math.max(0, factor));
}

/**
 * Adds the endgame evaluator to the base evaluator, scaled by endgameFactor, so it fades in as the board empties.
 * Stays symmetric as long as both evaluators are (the factor only depends on the board).
 */
export function blendEndgame(base: Evaluator, endgame: Evaluator, start: number = ENDGAME_START_PIECES, full: number = ENDGAME_FULL_PIECES): Evaluator {
    return (board, pieceType) => {
        const factor = endgameFactor(totalPieces(board), start, full);
        const score = base(board, pieceType);
        return factor === 0 ? score : score + factor * endgame(board, pieceType);
    };
}

/**
 * @returns how many turns ahead a bot should search from this position: its endgameDepth (if it has one) once
 * there are ENDGAME_START_PIECES (or the bot's own endgameStart) or fewer pieces left, otherwise its normal depth. Fewer pieces means fewer moves
 * per turn, so deeper searches become affordable.
 */
export function searchDepthFor(preset: { depth: number, endgameDepth?: number, endgameStart?: number }, board: Board): number {
    if (preset.endgameDepth !== undefined && totalPieces(board) <= (preset.endgameStart ?? ENDGAME_START_PIECES)) {
        return preset.endgameDepth;
    }
    return preset.depth;
}
