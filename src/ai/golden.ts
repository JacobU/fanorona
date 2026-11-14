import Board from '../Board.js';
import { CompleteMove, PieceType } from '../types.js';
import { EVALUATORS, EVALUATOR_NAMES, FortressEndgame } from './presets.js';
import { findBestMoves } from './Search.js';
import { StoredPosition, boardFromPosition, sideToMove } from './testPositions.js';

/*
 * Golden results: the answers the original (known-correct) code gives for a fixed set of positions, saved once by
 * `npm run golden`. Each speed-up must reproduce them exactly, which shows it is faster without changing how the
 * game or the bots behave.
 */

export const GOLDEN_FILE = 'tests/golden/golden.json';
export const BENCHMARK_POSITIONS_FILE = 'tests/golden/benchmark-positions.json';

// The golden searches use FortressEndgame's evaluator because between them its normal and endgame weights use all six
// metrics (the endgame ones fade in as the board empties).
export const GOLDEN_SEARCH_EVALUATOR = FortressEndgame.evaluator;
export const GOLDEN_SEARCH_DEPTHS = [2, 3];

type Side = 'WHITE' | 'BLACK';

export interface GoldenSearch {
    depth: number,
    // null when the player can't move
    score: number | null,
    // Every move tied for the best score, as moveKey strings, in the order they were generated
    moves: string[],
}

export interface GoldenEntry {
    position: StoredPosition,
    // Every complete move, as moveKey strings, in the order they were generated. In the middle of a capture chain
    // only the player who is moving has moves.
    moves: Partial<Record<Side, string[]>>,
    // The rest are only recorded between turns (the evaluators and searches are only used there):
    // the pieces each player could capture with the first step of a turn (sorted)
    capturable?: Record<Side, number[]>,
    // Each evaluator's value from each player's point of view
    evaluators?: Record<string, Record<Side, number>>,
    // The search for the player to move, at each of the golden depths
    search?: GoldenSearch[],
}

export interface GoldenFile {
    description: string,
    generated: string,
    searchDepths: number[],
    entries: GoldenEntry[],
}

const SIDES: [Side, PieceType][] = [['WHITE', PieceType.WHITE], ['BLACK', PieceType.BLACK]];

export function moveKey(startIndex: number, move: CompleteMove): string {
    return `${startIndex}:${move.moveIndexes.join(',')}:${move.moveTypes.join(',')}`;
}

function listMoveKeys(board: Board, pieceType: PieceType): string[] {
    const allMoves = board.getAllPossibleCompleteMoves(pieceType);
    return allMoves.startIndexes.flatMap((startIndex, i) => allMoves.moves[i].map(move => moveKey(startIndex, move)));
}

/**
 * Works out the golden results for one position with the current code.
 * @param searchDepths the depths to search at (none to skip the searches, which are the slow part).
 */
export function computeGolden(position: StoredPosition, searchDepths: number[]): GoldenEntry {
    const board = boardFromPosition(position);
    const entry: GoldenEntry = { position, moves: {} };
    if (position.kind === 'midChain') {
        const side = sideToMove(board);
        entry.moves[side === PieceType.WHITE ? 'WHITE' : 'BLACK'] = listMoveKeys(board, side);
        return entry;
    }

    for (const [name, side] of SIDES) entry.moves[name] = listMoveKeys(board, side);
    entry.capturable = {
        WHITE: [...board.getCapturablePieces(PieceType.WHITE)].sort((a, b) => a - b),
        BLACK: [...board.getCapturablePieces(PieceType.BLACK)].sort((a, b) => a - b),
    };
    entry.evaluators = {};
    for (const evaluatorName of EVALUATOR_NAMES) {
        entry.evaluators[evaluatorName] = {
            WHITE: EVALUATORS[evaluatorName](board, PieceType.WHITE),
            BLACK: EVALUATORS[evaluatorName](board, PieceType.BLACK),
        };
    }
    if (searchDepths.length > 0) {
        entry.search = searchDepths.map(depth => {
            const best = findBestMoves(board, sideToMove(board), GOLDEN_SEARCH_EVALUATOR, depth);
            return { depth, score: best?.score ?? null, moves: best?.moves.map(m => moveKey(m.startIndex, m.move)) ?? [] };
        });
    }
    return entry;
}
