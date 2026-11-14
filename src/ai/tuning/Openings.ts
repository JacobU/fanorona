import Board from '../../Board.js';
import { CompleteMove, PieceType, Turn, Winner } from '../../types.js';
import { seededRng } from '../random.js';

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
