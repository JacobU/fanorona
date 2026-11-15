import { expect } from 'chai';
import { readFileSync } from 'fs';
import Board, { NO_CAPTURE_DRAW_TURNS } from '../src/Board.js';
import { BestMove, PieceType } from '../src/types.js';
import { DIFFICULTIES } from '../src/ai/difficulties.js';
import { searchDepthFor } from '../src/ai/endgame.js';
import { BENCHMARK_POSITIONS_FILE } from '../src/ai/golden.js';
import { planTurn } from '../src/ai/planTurn.js';
import { findBestMoves } from '../src/ai/Search.js';
import SearchBot from '../src/ai/SearchBot.js';
import { StoredPosition, boardFromPosition, sideToMove } from '../src/ai/testPositions.js';
import { expectBoardUnchanged } from './helpers/boardInvariance.js';

const positions: { openings: StoredPosition[], endgames: StoredPosition[] } = JSON.parse(readFileSync(BENCHMARK_POSITIONS_FILE, 'utf8'));

const moveKey = (m: { startIndex: number, move: BestMove['move'] }) => JSON.stringify([m.startIndex, m.move.moveIndexes, m.move.moveTypes]);

/**
 * Checks that planTurn, given only the board's saved state, picks one of the best moves the search finds on the
 * board itself (the same depth and evaluator SearchBot would use), and leaves the board alone.
 */
function expectPlansABestMove(board: Board, difficulty: 'Medium' | 'Hard' | 'Impossible', description: string) {
    const preset = DIFFICULTIES[difficulty].preset!;
    const side = sideToMove(board);
    const best = findBestMoves(board, side, preset.evaluator, searchDepthFor(preset, board))!;
    const planned = expectBoardUnchanged(board, () => planTurn(board.saveBoardState(), difficulty, side), `planTurn (${description})`)!;
    expect(planned.score, description).to.equal(best.score);
    expect(best.moves.map(moveKey), description).to.include(moveKey(planned));
}

describe('planTurn tests', function () {
    // Impossible searches 6 turns ahead.
    this.timeout(60_000);

    it('should pick one of the best moves for each search difficulty, from the start and after openings', () => {
        expectPlansABestMove(new Board(), 'Medium', 'start, Medium');
        for (const position of positions.openings.slice(0, 3)) {
            for (const difficulty of ['Medium', 'Hard'] as const) {
                expectPlansABestMove(boardFromPosition(position), difficulty, `${position.name}, ${difficulty}`);
            }
        }
        expectPlansABestMove(boardFromPosition(positions.openings[1]), 'Impossible', `${positions.openings[1].name}, Impossible`);
    });

    it('should pick one of the best moves in endgame positions, using the endgame settings', () => {
        // The first and third benchmark endgames are quick to search at depth 6.
        for (const position of [positions.endgames[0], positions.endgames[2]]) {
            for (const difficulty of ['Medium', 'Hard', 'Impossible'] as const) {
                expectPlansABestMove(boardFromPosition(position), difficulty, `${position.name}, ${difficulty}`);
            }
        }
    });

    it('should carry over the no-capture count, which changes what the search sees as a draw', () => {
        const board = boardFromPosition(positions.endgames[0]);
        board.resetBoardState({ ...board.saveBoardState(), turnsWithoutCapture: NO_CAPTURE_DRAW_TURNS - 1 });
        expectPlansABestMove(board, 'Hard', 'one quiet turn from the draw, Hard');
    });

    it('should return plain data that survives being sent to a worker', () => {
        const planned = planTurn(boardFromPosition(positions.openings[0]).saveBoardState(), 'Hard', sideToMove(boardFromPosition(positions.openings[0])));
        expect(JSON.parse(JSON.stringify(planned))).to.deep.equal(planned);
    });

    it('should refuse the random bot, which has no search to plan with', () => {
        expect(() => planTurn(new Board().saveBoardState(), 'Easy', PieceType.WHITE)).to.throw('Easy');
    });
});

describe('SearchBot.usePlannedTurn tests', () => {
    /** Finds a position and a complete move in it that takes more than one step (a capture chain). */
    function findChainMove(): { position: StoredPosition, move: BestMove } {
        for (const position of [...positions.openings, ...positions.endgames]) {
            const board = boardFromPosition(position);
            const all = board.getAllPossibleCompleteMoves(sideToMove(board));
            for (let i = 0; i < all.startIndexes.length; i++) {
                const chain = all.moves[i].find(m => m.moveIndexes.length > 1);
                if (chain) return { position, move: { startIndex: all.startIndexes[i], move: chain, score: 0 } };
            }
        }
        throw new Error('No capture chain found in the benchmark positions.');
    }

    function playTurn(bot: SearchBot): void {
        while (bot.makeMove().canMoveAgain) {}
    }

    it('should play exactly the planned turn, including a capture chain', () => {
        const { position, move } = findChainMove();
        const board = boardFromPosition(position);
        const expected = boardFromPosition(position);
        expected.applyCompleteMove(move.startIndex, move.move);

        const bot = new SearchBot(sideToMove(board), board, DIFFICULTIES.Hard.preset!);
        bot.usePlannedTurn(move);
        playTurn(bot);
        expect(board.saveBoardState()).to.deep.equal(expected.saveBoardState());
    });

    it('should go back to searching for itself on the turn after a planned one', () => {
        const { position, move } = findChainMove();
        const board = boardFromPosition(position);
        const side = sideToMove(board);
        const bot = new SearchBot(side, board, DIFFICULTIES.Medium.preset!);
        bot.usePlannedTurn(move);
        playTurn(bot);
        // Let the opponent play its first possible turn, then the bot's next turn should be one of its own best moves
        const replies = board.getAllPossibleCompleteMoves(sideToMove(board));
        expect(replies.startIndexes.length, 'the opponent should have a reply in this position').to.be.greaterThan(0);
        board.applyCompleteMove(replies.startIndexes[0], replies.moves[0][0]);
        expect(sideToMove(board)).to.equal(side);
        const best = findBestMoves(board, side, DIFFICULTIES.Medium.preset!.evaluator, 2)!;
        const before = board.saveBoardState();
        playTurn(bot);
        const matchesABest = best.moves.some(m => {
            const copy = new Board();
            copy.resetBoardState(before);
            copy.applyCompleteMove(m.startIndex, m.move);
            return JSON.stringify(copy.saveBoardState()) === JSON.stringify(board.saveBoardState());
        });
        expect(matchesABest).to.equal(true);
    });

    it('should refuse a plan part-way through a turn', () => {
        const { position, move } = findChainMove();
        const board = boardFromPosition(position);
        const bot = new SearchBot(sideToMove(board), board, DIFFICULTIES.Hard.preset!);
        bot.usePlannedTurn(move);
        expect(bot.makeMove().canMoveAgain).to.equal(true);
        expect(() => bot.usePlannedTurn(move)).to.throw('part-way');
    });
});
