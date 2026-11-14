import { expect } from 'chai';
import Board from '../src/Board.js';
import { CompleteMove, PieceType, Winner } from '../src/types.js';
import { seededRng } from '../src/ai/random.js';
import { StoredPosition, boardFromPosition, sideToMove } from '../src/ai/testPositions.js';
import { loadGolden } from './helpers/golden.js';

interface Candidate { startIndex: number, move: CompleteMove }

function listCandidates(board: Board): Candidate[] {
    const allMoves = board.getAllPossibleCompleteMoves(sideToMove(board));
    return allMoves.startIndexes.flatMap((startIndex, i) => allMoves.moves[i].map(move => ({ startIndex, move })));
}

const describeMove = (c: Candidate) => `${c.startIndex}:${c.move.moveIndexes.join(',')}`;

describe('Making and unmaking moves', function () {
    this.timeout(60_000);

    let positions: StoredPosition[] = [];
    before(() => {
        // Every test position between turns where the game is still going
        positions = loadGolden().entries.map(e => e.position)
            .filter(p => p.kind !== 'midChain' && boardFromPosition(p).getWinner() === Winner.NONE);
    });

    it('should start with nothing to undo', () => {
        expect(new Board().getFullStateForTesting().undoDepth).to.equal(0);
    });

    it('should leave the board exactly as applyCompleteMove does', () => {
        for (const p of positions) {
            const board = boardFromPosition(p);
            for (const candidate of listCandidates(board)) {
                const applied = boardFromPosition(p);
                applied.applyCompleteMove(candidate.startIndex, candidate.move);
                board.makeCompleteMove(candidate.startIndex, candidate.move);
                const { undoDepth, ...made } = board.getFullStateForTesting();
                const { undoDepth: _, ...expected } = applied.getFullStateForTesting();
                expect(made, `${p.name}: ${describeMove(candidate)}`).to.deep.equal(expected);
                expect(undoDepth).to.be.greaterThan(0);
                board.unmakeCompleteMove();
            }
        }
    });

    it('should put everything back after unmaking each move, including wins, draws and chains stopped early', () => {
        const seen = { singleSteps: 0, chains: 0, stoppedEarly: 0, wins: 0, draws: 0 };
        for (const p of positions) {
            const board = boardFromPosition(p);
            const before = board.getFullStateForTesting();
            const candidates = listCandidates(board);
            for (const candidate of candidates) {
                board.makeCompleteMove(candidate.startIndex, candidate.move);
                const winner = board.getWinner();
                board.unmakeCompleteMove();
                expect(board.getFullStateForTesting(), `${p.name}: ${describeMove(candidate)}`).to.deep.equal(before);

                // Keep track of the kinds of moves covered
                const steps = candidate.move.moveIndexes.length;
                if (steps === 1) seen.singleSteps++; else seen.chains++;
                const key = describeMove(candidate);
                if (candidates.some(other => other.startIndex === candidate.startIndex && describeMove(other).startsWith(`${key},`))) seen.stoppedEarly++;
                if (winner === Winner.WHITE || winner === Winner.BLACK) seen.wins++;
                if (winner === Winner.DRAW) seen.draws++;
            }
        }
        // Each kind of move must actually have been tested
        for (const [kind, count] of Object.entries(seen)) {
            expect(count, kind).to.be.greaterThan(0);
        }
    });

    it('should unmake nested moves in reverse order, restoring each earlier position', () => {
        const rng = seededRng(11);
        for (const p of positions) {
            const board = boardFromPosition(p);
            // Play up to 6 random moves, saving the position before each one
            const snapshots = [];
            for (let i = 0; i < 6 && board.getWinner() === Winner.NONE; i++) {
                const candidates = listCandidates(board);
                if (candidates.length === 0) break;
                snapshots.push(board.getFullStateForTesting());
                const chosen = candidates[Math.floor(rng() * candidates.length)];
                board.makeCompleteMove(chosen.startIndex, chosen.move);
            }
            // Undo them one at a time, checking each earlier position comes back
            while (snapshots.length > 0) {
                board.unmakeCompleteMove();
                expect(board.getFullStateForTesting(), `${p.name}: after undoing back to move ${snapshots.length - 1}`).to.deep.equal(snapshots.pop());
            }
        }
    });

    it('should throw when there is nothing to unmake', () => {
        expect(() => new Board().unmakeCompleteMove()).to.throw('nothing to undo');
    });

    it('should not record anything for moves played normally (e.g. by the UI)', () => {
        const board = new Board();
        const [first] = listCandidates(board);
        board.applyCompleteMove(first.startIndex, first.move);
        expect(board.getFullStateForTesting().undoDepth).to.equal(0);
    });

    it('should forget unfinished undo records when the board is reset', () => {
        const board = new Board();
        const [first] = listCandidates(board);
        board.makeCompleteMove(first.startIndex, first.move);
        board.reset();
        expect(board.getFullStateForTesting().undoDepth).to.equal(0);
    });

    it('should count unfinished undo records as a change to the board', () => {
        // So every board-unchanged test also catches a search that forgets to unmake a move
        const board = new Board();
        const before = board.getFullStateForTesting();
        const [first] = listCandidates(board);
        board.makeCompleteMove(first.startIndex, first.move);
        board.resetBoardState({ ...before });
        expect(board.getFullStateForTesting()).to.not.deep.equal(before);
    });
});
