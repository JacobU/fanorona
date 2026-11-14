import Board from '../Board.js';
import { PieceType } from '../types.js';

/**
 * Rates a board position from the point of view of pieceType.
 * Positive numbers are good for pieceType, negative numbers are good for the opponent.
 * Evaluators should be symmetric: evaluator(board, WHITE) === -evaluator(board, BLACK).
 * They are only called between turns (never in the middle of a capture chain).
 */
export type Evaluator = (board: Board, pieceType: PieceType) => number;

export interface WeightedTerm {
    evaluator: Evaluator,
    weight: number,
}

/**
 * Combines several evaluators into one by summing their weighted scores.
 */
export function weighted(terms: WeightedTerm[]): Evaluator {
    return (board, pieceType) => {
        let total = 0;
        for (const term of terms) {
            if (term.weight !== 0) total += term.weight * term.evaluator(board, pieceType);
        }
        return total;
    };
}
