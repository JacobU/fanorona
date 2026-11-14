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

/**
 * Edge cells (weighted by how many edges they touch, so corners count 2) occupied by the opponent minus those
 * occupied by us. Pieces on the edge have fewer lines to move along and escape by, which matters most in the
 * endgame when a few pieces are chasing each other around an empty board.
 */
export const edgeExposure: Evaluator = (board, pieceType) => {
    const opponent = getOppositePieceType(pieceType);
    const rows = board.getBoardsNumberOfRows();
    const cols = board.getBoardsNumberOfColumns();
    let score = 0;
    for (let i = 0; i < rows * cols; i++) {
        const piece = board.getPieceTypeAtIndex(i);
        if (piece === PieceType.EMPTY) continue;
        const row = Math.floor(i / cols);
        const col = i % cols;
        // 1 for each edge (top/bottom row, left/right column) the cell is on, so corners count 2.
        const edges = (row === 0 || row === rows - 1 ? 1 : 0) + (col === 0 || col === cols - 1 ? 1 : 0);
        if (piece === opponent) score += edges;
        else if (piece === pieceType) score -= edges;
    }
    return score;
};

/**
 * Sum of how far each of our pieces is from the nearest edge, minus the same for the opponent's pieces.
 * A finer-grained version of edgeExposure that rewards holding the middle of the board.
 */
export const centrality: Evaluator = (board, pieceType) => {
    const opponent = getOppositePieceType(pieceType);
    const rows = board.getBoardsNumberOfRows();
    const cols = board.getBoardsNumberOfColumns();
    let score = 0;
    for (let i = 0; i < rows * cols; i++) {
        const piece = board.getPieceTypeAtIndex(i);
        if (piece === PieceType.EMPTY) continue;
        const row = Math.floor(i / cols);
        const col = i % cols;
        const distanceToEdge = Math.min(row, rows - 1 - row, col, cols - 1 - col);
        if (piece === pieceType) score += distanceToEdge;
        else if (piece === opponent) score -= distanceToEdge;
    }
    return score;
};
