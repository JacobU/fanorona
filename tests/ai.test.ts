import { expect } from 'chai';
import { AttackType, PieceType, Turn, Winner } from '../src/types.js';
import Board, { NO_CAPTURE_DRAW_TURNS } from '../src/Board.js';
import { material, vulnerability, strongPoints, lineExposure, mobility } from '../src/ai/evaluators.js';
import { weighted } from '../src/ai/Evaluator.js';
import { chooseMove, getBestMoveSimple, WIN_SCORE } from '../src/ai/Search.js';
import { ALL_PRESETS, AllRounder } from '../src/ai/presets.js';
import { RandomContestant, contestantFromPreset, playGame } from '../src/ai/Tournament.js';

const moveKey = (m: { startIndex: number, move: { moveIndexes: number[] } }) => `${m.startIndex}:${m.move.moveIndexes.join(',')}`;

describe('Evaluator tests', () => {
    it('material should be our pieces minus theirs', () => {
        // White at 1 and 8, black at 0, 3 and 6.
        const board = new Board(3, 3, '210200201');
        expect(material(board, PieceType.WHITE)).to.equal(-1);
        expect(material(board, PieceType.BLACK)).to.equal(1);
    });

    it('strongPoints should count pieces on strong intersections', () => {
        // Strong cells on a 3x3 board are the even indexes. White has 8, black has 0 and 6.
        const board = new Board(3, 3, '210200201');
        expect(strongPoints(board, PieceType.WHITE)).to.equal(-1);
        expect(strongPoints(board, PieceType.BLACK)).to.equal(1);
    });

    it('getCapturablePieces should find pieces capturable by the first step of a turn', () => {
        // White at 4 can withdraw from 3 (moving to 5) or from 8 (moving to 0). Black can't capture anything.
        const board = new Board(3, 3, '000210002');
        const before = board.saveBoardState();
        expect([...board.getCapturablePieces(PieceType.WHITE)].sort()).to.deep.equal([3, 8]);
        expect(board.getCapturablePieces(PieceType.BLACK).size).to.equal(0);
        expect(board.saveBoardState()).to.deep.equal(before);
        expect(vulnerability(board, PieceType.WHITE)).to.equal(2);
        expect(vulnerability(board, PieceType.BLACK)).to.equal(-2);
    });

    it('lineExposure should count connected pairs of the same colour', () => {
        // Black at 0, 3 and 6 make two connected pairs (0-3, 3-6). White at 1 and 8 aren't connected.
        const board = new Board(3, 3, '210200201');
        expect(lineExposure(board, PieceType.WHITE)).to.equal(2);
        expect(lineExposure(board, PieceType.BLACK)).to.equal(-2);
    });

    it('evaluators should be symmetric on the starting board', () => {
        const board = new Board();
        for (const evaluator of [material, vulnerability, strongPoints, lineExposure, mobility]) {
            expect(evaluator(board, PieceType.WHITE)).to.equal(-evaluator(board, PieceType.BLACK));
        }
    });

    it('weighted should sum the weighted scores', () => {
        const board = new Board(3, 3, '210200201');
        const evaluator = weighted([{ evaluator: material, weight: 10 }, { evaluator: lineExposure, weight: 3 }]);
        expect(evaluator(board, PieceType.WHITE)).to.equal(10 * -1 + 3 * 2);
    });
});

describe('Board.applyCompleteMove tests', () => {
    it('should play the whole turn and pass the turn to the opponent', () => {
        const board = new Board(3, 3, '000210002');
        board.applyCompleteMove(4, { moveIndexes: [0], moveTypes: [AttackType.WITHDRAW] });
        expect(board.getBoardPositionsAsString()).to.equal('100200000');
        expect(board.getNumPieces(PieceType.BLACK)).to.equal(1);
        expect(board.getTurn()).to.equal(Turn.BLACK);
    });

    it('should end the turn when the move stops part way through a capture chain', () => {
        // White withdraws from 3 by moving to 5 and could then capture 8, but stops.
        const board = new Board(3, 3, '000210002');
        board.applyCompleteMove(4, { moveIndexes: [5], moveTypes: [AttackType.WITHDRAW] });
        expect(board.getBoardPositionsAsString()).to.equal('000001002');
        expect(board.getTurn()).to.equal(Turn.BLACK);
        expect(board.canEndTurn()).to.equal(false);
        expect(board.getTurnsWithoutCapture()).to.equal(0);
    });

    it('should play a multi-step capture chain', () => {
        const board = new Board(3, 3, '000210002');
        board.applyCompleteMove(4, { moveIndexes: [5, 2], moveTypes: [AttackType.WITHDRAW, AttackType.WITHDRAW] });
        expect(board.getBoardPositionsAsString()).to.equal('001000000');
        expect(board.getWinner()).to.equal(Winner.WHITE);
    });
});

describe('Search tests', () => {
    it('should return the best move for two white pieces on a 3x3 board', () => {
        // Capturing all three black pieces wins the game.
        const board = new Board(3, 3, '210200201');
        const bestMove = getBestMoveSimple(board, PieceType.WHITE);
        expect(bestMove).to.deep.equal({
            startIndex: 1,
            move: { moveIndexes: [ 2, 4, 5 ], moveTypes: [ AttackType.WITHDRAW, AttackType.APPROACH, AttackType.WITHDRAW ] },
            score: WIN_SCORE - 1,
        });
    });

    it('should score a one-move win as a win', () => {
        // White at index 4, only black at index 3. WITHDRAW RIGHT (4→5) captures the last black piece.
        const board = new Board(3, 3, '000210000');
        const bestMove = chooseMove(board, PieceType.WHITE, material, 2);
        expect(bestMove).to.deep.equal({
            startIndex: 4,
            move: { moveIndexes: [5], moveTypes: [AttackType.WITHDRAW] },
            score: WIN_SCORE - 1,
        });
    });

    it('should score a drawn position as 0 even when ahead on pieces', () => {
        // White has 2 pieces to black's 1, but no captures are possible and the next turn will be the 60th without one.
        const board = new Board(5, 5, '1100000000000000000000002');
        expect(chooseMove(board, PieceType.WHITE, material, 1)!.score).to.equal(1);
        board.resetBoardState({ ...board.saveBoardState(), turnsWithoutCapture: NO_CAPTURE_DRAW_TURNS - 1 });
        expect(chooseMove(board, PieceType.WHITE, material, 1)!.score).to.equal(0);
    });

    it('depth 2 should stop a capture chain early when continuing would be punished', () => {
        // Found from random play. White to move. Approaching from 33 to 24 captures, and the chain could
        // continue, but continuing leaves white worse off after black's reply.
        const board = new Board(5, 9, '220202222222000220212000012111100110111101010');
        const rngs = [() => 0, () => 0.5, () => 0.999];
        for (const rng of rngs) {
            const best = chooseMove(board, PieceType.WHITE, material, 2, rng)!;
            expect(moveKey(best)).to.equal('33:24');
        }
        const movesFrom33 = board.getAllPossibleCompleteMoves(PieceType.WHITE);
        const longerChains = movesFrom33.moves[movesFrom33.startIndexes.indexOf(33)]
            .filter(m => m.moveIndexes[0] === 24 && m.moveIndexes.length > 1);
        expect(longerChains.length).to.be.greaterThan(0);
    });

    it('should return null when the player has no moves', () => {
        const board = new Board(3, 3, '222212222');
        expect(chooseMove(board, PieceType.WHITE, material, 2)).to.be.null;
    });

    it('should leave the board unchanged after searching', () => {
        const board = new Board();
        const before = board.saveBoardState();
        chooseMove(board, PieceType.WHITE, AllRounder.evaluator, 2);
        expect(board.saveBoardState()).to.deep.equal(before);
    });

    it('depth 2 should avoid a capture that the opponent punishes on their reply', () => {
        // Found from random play. White to move.
        const board = new Board(5, 9, '222222222222022222210102121101110111011111111');
        const rngs = [() => 0, () => 0.5, () => 0.999];

        // Depth 1 always grabs the most pieces right now.
        const greedyMoves = rngs.map(rng => chooseMove(board, PieceType.WHITE, material, 1, rng)!);
        const greedyKey = moveKey(greedyMoves[0]);
        expect(greedyMoves.every(m => moveKey(m) === greedyKey)).to.be.true;
        expect(greedyKey).to.equal('29:20,12,11');

        // After that move, black's best reply leaves white worse off than depth 2's choice does.
        const lookaheadMoves = rngs.map(rng => chooseMove(board, PieceType.WHITE, material, 2, rng)!);
        expect(lookaheadMoves.some(m => moveKey(m) === greedyKey)).to.be.false;

        const before = board.saveBoardState();
        board.applyCompleteMove(greedyMoves[0].startIndex, greedyMoves[0].move);
        const blackReply = chooseMove(board, PieceType.BLACK, material, 1)!;
        board.resetBoardState(before);
        const greedyScoreAfterReply = -blackReply.score;
        expect(greedyScoreAfterReply).to.be.lessThan(lookaheadMoves[0].score);
    });
});

describe('Tournament tests', () => {
    it('every preset should be able to play a full game', function () {
        // The depth 4 presets take a few seconds per game.
        this.timeout(60000);
        for (const preset of ALL_PRESETS) {
            const stats = playGame(contestantFromPreset(preset), RandomContestant);
            expect(['WHITE', 'BLACK', 'DRAW']).to.include(stats.result);
        }
    });
});
