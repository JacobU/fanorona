import Board from '../../Board.js';
import { CompleteMove, PieceType, Turn, Winner } from '../../types.js';
import { seededRng } from '../random.js';
import { chooseMove } from '../Search.js';
import { Fortress } from '../presets.js';

export interface OpeningMove {
    startIndex: number,
    move: CompleteMove,
}

/**
 * A short sequence of complete turns played from the starting position before the bots take over.
 * Playing every comparison from the same set of openings (with both colours) makes the comparison fairer and
 * stops bots that rarely have ties from replaying the same game over and over.
 */
export type Opening = OpeningMove[];

/**
 * Generates distinct openings by picking random legal turns from the starting position.
 * @param count how many openings to make.
 * @param turns how many turns each opening lasts (must be even, so white still moves first after the opening).
 * @param seed the same seed always gives the same openings.
 * @param maxImbalance skip openings where one side is more than this many pieces ahead, since the opening would
 * mostly decide the game by itself.
 */
export function generateOpenings(count: number, turns: number, seed: number = 1, maxImbalance: number = 2): Opening[] {
    if (turns % 2 !== 0) {
        throw new Error('Openings must have an even number of turns so that white moves first afterwards.');
    }
    const rng = seededRng(seed);
    const openings: Opening[] = [];
    const seen = new Set<string>();

    for (let attempt = 0; openings.length < count && attempt < count * 200; attempt++) {
        const board = new Board();
        const opening: Opening = [];
        while (opening.length < turns && board.getWinner() === Winner.NONE) {
            const pieceType = board.getTurn() === Turn.WHITE ? PieceType.WHITE : PieceType.BLACK;
            const allMoves = board.getAllPossibleCompleteMoves(pieceType);
            const candidates: OpeningMove[] = allMoves.startIndexes.flatMap((startIndex, i) => allMoves.moves[i].map(move => ({ startIndex, move })));
            if (candidates.length === 0) break;
            const chosen = candidates[Math.floor(rng() * candidates.length)];
            board.applyCompleteMove(chosen.startIndex, chosen.move);
            opening.push(chosen);
        }
        // Skip openings that end the game, are too one-sided, or are repeats of one we already have
        const key = board.getBoardPositionsAsString();
        const imbalance = Math.abs(board.getNumPieces(PieceType.WHITE) - board.getNumPieces(PieceType.BLACK));
        if (opening.length === turns && board.getWinner() === Winner.NONE && imbalance <= maxImbalance && !seen.has(key)) {
            seen.add(key);
            openings.push(opening);
        }
    }
    if (openings.length < count) {
        throw new Error(`Could only find ${openings.length} distinct openings of ${turns} turns.`);
    }
    return openings;
}

export function applyOpening(board: Board, opening: Opening): void {
    for (const { startIndex, move } of opening) {
        board.applyCompleteMove(startIndex, move);
    }
}

export interface EndgameStartOptions {
    // Total pieces (both colours) a start may have.
    minPieces: number,
    maxPieces: number,
    // How many pieces ahead the side that's ahead may be.
    minImbalance: number,
    maxImbalance: number,
}

export const DEFAULT_ENDGAME_START_OPTIONS: EndgameStartOptions = { minPieces: 6, maxPieces: 9, minImbalance: 1, maxImbalance: 2 };

// Random turns played from the starting position before the playing-down bots take over, so the starts vary.
const ENDGAME_START_RANDOM_TURNS = 4;
// Give up on a game that hasn't reached the endgame after this many turns.
const ENDGAME_START_MAX_TURNS = 400;

/**
 * Generates distinct endgame positions for testing how well bots play the endgame: from a few random turns,
 * Fortress plays both sides (breaking ties at random) until few enough pieces are left. A start is kept if it has
 * the requested number of pieces and imbalance, the game isn't over and it isn't a repeat.
 * Unlike generateOpenings, the starts can end with either colour to move. That doesn't matter because every start
 * is played twice, once with each bot on each side, so both bots play the same position from both sides.
 * @returns the starts, each as the list of turns that leads to it from the starting position.
 */
export function generateEndgameStarts(count: number, options: Partial<EndgameStartOptions> = {}, seed: number = 1): Opening[] {
    const { minPieces, maxPieces, minImbalance, maxImbalance } = { ...DEFAULT_ENDGAME_START_OPTIONS, ...options };
    const rng = seededRng(seed);
    const starts: Opening[] = [];
    const seen = new Set<string>();

    for (let attempt = 0; starts.length < count && attempt < count * 200; attempt++) {
        const board = new Board();
        const start: Opening = [];
        while (board.getWinner() === Winner.NONE && start.length < ENDGAME_START_MAX_TURNS
            && board.getNumPieces(PieceType.WHITE) + board.getNumPieces(PieceType.BLACK) > maxPieces) {
            const pieceType = board.getTurn() === Turn.WHITE ? PieceType.WHITE : PieceType.BLACK;
            let chosen: OpeningMove | null;
            if (start.length < ENDGAME_START_RANDOM_TURNS) {
                const allMoves = board.getAllPossibleCompleteMoves(pieceType);
                const candidates: OpeningMove[] = allMoves.startIndexes.flatMap((startIndex, i) => allMoves.moves[i].map(move => ({ startIndex, move })));
                chosen = candidates.length > 0 ? candidates[Math.floor(rng() * candidates.length)] : null;
            } else {
                const best = chooseMove(board, pieceType, Fortress.evaluator, Fortress.depth, rng);
                chosen = best === null ? null : { startIndex: best.startIndex, move: best.move };
            }
            if (chosen === null) break;
            board.applyCompleteMove(chosen.startIndex, chosen.move);
            start.push(chosen);
        }
        const white = board.getNumPieces(PieceType.WHITE);
        const black = board.getNumPieces(PieceType.BLACK);
        const imbalance = Math.abs(white - black);
        const key = board.getBoardPositionsAsString() + board.getTurn();
        if (board.getWinner() === Winner.NONE && white + black >= minPieces && white + black <= maxPieces
            && imbalance >= minImbalance && imbalance <= maxImbalance && !seen.has(key)) {
            seen.add(key);
            starts.push(start);
        }
    }
    if (starts.length < count) {
        throw new Error(`Could only find ${starts.length} endgame starts with ${minPieces}-${maxPieces} pieces and an imbalance of ${minImbalance}-${maxImbalance}.`);
    }
    return starts;
}

/**
 * @returns how many pieces white is ahead by (negative if black is ahead) after playing an opening or start.
 */
export function startLead(opening: Opening): number {
    const board = new Board();
    applyOpening(board, opening);
    return board.getNumPieces(PieceType.WHITE) - board.getNumPieces(PieceType.BLACK);
}
