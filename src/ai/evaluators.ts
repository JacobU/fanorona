import Board from '../Board.js';
import { PieceType, getOppositePieceType } from '../types.js';
import { Evaluator } from './Evaluator.js';

/**
 * Relative number of pieces left (this was rateBoardPositionSimple in Board).
 * @param board the board to give a rating for.
 * @param pieceType the player who we want the rating to be relative to (positive if good position, negative if bad position).
 * @returns a number representing the rating of the overall board positions.
 */
export const material: Evaluator = (board, pieceType) => {
    return board.getNumPieces(pieceType) - board.getNumPieces(getOppositePieceType(pieceType));
};

/**
 * How many of the opponent's pieces we could capture with the first step of a turn, minus how many of ours
 * they could capture. Rewards keeping our pieces out of attack lines while keeping theirs in ours.
 */
export const vulnerability: Evaluator = (board, pieceType) => {
    const opponent = getOppositePieceType(pieceType);
    return board.getCapturablePieces(pieceType).size - board.getCapturablePieces(opponent).size;
};

/**
 * Number of complete turns we could take minus the number the opponent could take.
 * Because captures are compulsory, leaving the opponent with few options can force them into bad moves.
 */
export const mobility: Evaluator = (board, pieceType) => {
    return countCompleteMoves(board, pieceType) - countCompleteMoves(board, getOppositePieceType(pieceType));
};

/**
 * Number of our pieces on strong intersections (which connect in 8 directions instead of 4) minus theirs.
 */
export const strongPoints: Evaluator = (board, pieceType) => {
    const opponent = getOppositePieceType(pieceType);
    let score = 0;
    const numCells = board.getBoardsNumberOfRows() * board.getBoardsNumberOfColumns();
    for (let i = 0; i < numCells; i++) {
        if (!board.isStrongCell(i)) continue;
        const piece = board.getPieceTypeAtIndex(i);
        if (piece === pieceType) score++;
        else if (piece === opponent) score--;
    }
    return score;
};

/**
 * Number of connected pairs of the opponent's pieces minus the number of connected pairs of ours.
 * Pieces sitting next to each other along a line can be captured together by a single approach or withdraw.
 */
export const lineExposure: Evaluator = (board, pieceType) => {
    return countConnectedPairs(board, getOppositePieceType(pieceType)) - countConnectedPairs(board, pieceType);
};

function countCompleteMoves(board: Board, pieceType: PieceType): number {
    const allMoves = board.getAllPossibleCompleteMoves(pieceType);
    return allMoves.moves.reduce((total, movesForPiece) => total + movesForPiece.length, 0);
}

function countConnectedPairs(board: Board, pieceType: PieceType): number {
    let pairs = 0;
    const numCells = board.getBoardsNumberOfRows() * board.getBoardsNumberOfColumns();
    for (let i = 0; i < numCells; i++) {
        if (board.getPieceTypeAtIndex(i) !== pieceType) continue;
        for (const neighbour of board.getConnectedIndexes(i)) {
            // Only count each pair once
            if (neighbour > i && board.getPieceTypeAtIndex(neighbour) === pieceType) pairs++;
        }
    }
    return pairs;
}
