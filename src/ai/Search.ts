import Board from '../Board.js';
import { BestMove, CompleteMove, PieceType, Winner, getOppositePieceType } from '../types.js';
import { Evaluator } from './Evaluator.js';
import { material } from './evaluators.js';

/**
 * The score given to a won position. It is much larger than anything an evaluator should return, and is reduced
 * by the number of turns it takes to get there so that faster wins are preferred (and slower losses).
 */
export const WIN_SCORE = 1_000_000;

export type Rng = () => number;

export interface Candidate {
    startIndex: number,
    move: CompleteMove,
}

/**
 * Counts the positions the search visits (each call to negamax), so the benchmark can measure how much work a search
 * does. Reset it to 0 before measuring.
 */
export const searchStats = { nodes: 0 };

/**
 * orderMoves: inside the search (not for the moves at the top), try longer capture chains first. Alpha-beta can skip
 * more of the tree when good moves come first, and because only moves below the top are reordered, the scores and the
 * tied-best moves found are exactly the same. It can be switched off to check that.
 */
export const searchOptions = { orderMoves: true };

/**
 * Chooses the best complete turn for pieceType by searching depth turns ahead (negamax with alpha-beta pruning).
 * depth = 1 only looks at our own turn, depth = 2 also assumes the opponent then plays their best reply, and so on.
 * Moves that score equally well are chosen between randomly, so that games between bots are not all identical.
 * The board is left exactly as it was found.
 * @param board the board to search, which must be between turns (not in the middle of a capture chain).
 * @param pieceType the player who is about to move.
 * @param evaluator rates the positions at the end of the search.
 * @param depth the number of turns to look ahead (at least 1).
 * @param rng random number generator used to break ties.
 * @returns the best move along with its score, or null if the player can't move.
 */
export function chooseMove(board: Board, pieceType: PieceType, evaluator: Evaluator, depth: number, rng: Rng = Math.random): BestMove | null {
    const best = findBestMoves(board, pieceType, evaluator, depth);
    if (best === null) {
        return null;
    }
    const chosen = best.moves[Math.floor(rng() * best.moves.length)];
    return { startIndex: chosen.startIndex, move: chosen.move, score: best.score };
}

/**
 * The search behind chooseMove: finds every complete turn that ties for the best score (see chooseMove for the
 * parameters). The board is left exactly as it was found.
 * @returns the best score and every move with that score (in the order they were generated), or null if the
 * player can't move.
 */
export function findBestMoves(board: Board, pieceType: PieceType, evaluator: Evaluator, depth: number): { score: number, moves: Candidate[] } | null {
    if (depth < 1) {
        throw new Error('The search depth must be at least 1.');
    }
    const candidates = listCandidates(board, pieceType);
    if (candidates.length === 0) {
        return null;
    }

    const opponent = getOppositePieceType(pieceType);
    let bestScore = -Infinity;
    let bestCandidates: Candidate[] = [];

    for (const candidate of candidates) {
        // Try the move, then take it back so the board is as it was for the next one
        board.makeCompleteMove(candidate.startIndex, candidate.move);
        // Only moves at least as good as the best so far need an exact score, anything worse can be cut off early.
        const score = -negamax(board, opponent, evaluator, depth - 1, -Infinity, -bestScore, 1);
        board.unmakeCompleteMove();

        if (score > bestScore) {
            bestScore = score;
            bestCandidates = [candidate];
        } else if (score === bestScore) {
            bestCandidates.push(candidate);
        }
    }

    return { score: bestScore, moves: bestCandidates };
}

/**
 * The original simple bot: picks the turn that leaves us with the most pieces relative to the opponent,
 * without considering the opponent's reply.
 */
export function getBestMoveSimple(board: Board, pieceType: PieceType, rng: Rng = Math.random): BestMove | null {
    return chooseMove(board, pieceType, material, 1, rng);
}

/**
 * Returns the score of the position from pieceType's point of view (pieceType is the player about to move).
 * Cut-offs only happen when a score is strictly outside the window, so a returned score that lands exactly on
 * alpha or beta is exact. chooseMove relies on this to find every move that ties for best.
 */
function negamax(board: Board, pieceType: PieceType, evaluator: Evaluator, depth: number, alpha: number, beta: number, ply: number): number {
    searchStats.nodes++;
    const winner = board.getWinner();
    // A draw is neutral, so a bot that is ahead will avoid it and a bot that is behind will aim for it.
    if (winner === Winner.DRAW) {
        return 0;
    }
    if (winner !== Winner.NONE) {
        const winScore = WIN_SCORE - ply;
        return (winner as number) === (pieceType as number) ? winScore : -winScore;
    }
    if (depth === 0) {
        return evaluator(board, pieceType);
    }

    const candidates = listCandidates(board, pieceType);
    if (candidates.length === 0) {
        // Can't happen between turns, because getWinner counts a player who can't move as having lost. Kept as a safety net.
        return evaluator(board, pieceType);
    }
    if (searchOptions.orderMoves) {
        // Longer chains capture more, so they're more likely to be good. The sort is stable, so equal lengths keep their order.
        candidates.sort((a, b) => b.move.moveIndexes.length - a.move.moveIndexes.length);
    }

    const opponent = getOppositePieceType(pieceType);
    let best = -Infinity;

    for (const candidate of candidates) {
        board.makeCompleteMove(candidate.startIndex, candidate.move);
        const score = -negamax(board, opponent, evaluator, depth - 1, -beta, -alpha, ply + 1);
        board.unmakeCompleteMove();

        if (score > best) best = score;
        if (best > alpha) alpha = best;
        if (alpha > beta) break;
    }
    return best;
}

function listCandidates(board: Board, pieceType: PieceType): Candidate[] {
    const allMoves = board.getAllPossibleCompleteMoves(pieceType);
    const candidates: Candidate[] = [];
    for (let i = 0; i < allMoves.startIndexes.length; i++) {
        for (const move of allMoves.moves[i]) {
            candidates.push({ startIndex: allMoves.startIndexes[i], move });
        }
    }
    return candidates;
}
