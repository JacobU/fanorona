import { expect } from 'chai';
import Board from '../src/Board.js';
import { PieceType, Turn, Winner } from '../src/types.js';
import { material } from '../src/ai/evaluators.js';
import { Fortress } from '../src/ai/presets.js';
import { WIN_SCORE, findBestMoves } from '../src/ai/Search.js';
import { contestantFromPreset, playGame } from '../src/ai/Tournament.js';
import { boardFromPosition } from '../src/ai/testPositions.js';
import { loadGolden } from './helpers/golden.js';

/**
 * A board with the given layout and player to move.
 */
function boardWithTurn(rows: number, columns: number, layout: string, turn: Turn): Board {
    const board = new Board(rows, columns, layout);
    board.resetBoardState({ ...board.saveBoardState(), turn });
    return board;
}

describe('A player who cannot move loses', () => {
    it('should make the player to move lose when none of their pieces can move', () => {
        // White's only piece, at 4, is surrounded by black pieces, so white can't move
        const board = boardWithTurn(3, 3, '222212222', Turn.WHITE);
        expect(board.getWinner()).to.equal(Winner.BLACK);
    });

    it('should work the same way for black', () => {
        const board = boardWithTurn(3, 3, '111121111', Turn.BLACK);
        expect(board.getWinner()).to.equal(Winner.WHITE);
    });

    it('should not end the game when it is the other player who is boxed in', () => {
        // Black at 0 can't move (1, 3 and 4 are white), but it's white's turn and white can move
        const board = boardWithTurn(3, 3, '211110000', Turn.WHITE);
        expect(board.getWinner()).to.equal(Winner.NONE);
    });

    it('should not count a player in the middle of a capture chain as trapped, since they can end their turn', () => {
        const midChain = loadGolden().entries.map(e => e.position).filter(p => p.kind === 'midChain');
        expect(midChain.length).to.be.greaterThan(20);
        for (const position of midChain) {
            const board = boardFromPosition(position);
            expect(board.canEndTurn(), position.name).to.be.true;
            expect(board.getWinner(), position.name).to.equal(Winner.NONE);
        }
    });

    it('should still count capturing every piece as a win, before checking for a trapped player', () => {
        // Black has no pieces left, so white has won, even though it's black's turn and black "can't move"
        const board = boardWithTurn(3, 3, '100000000', Turn.BLACK);
        expect(board.getWinner()).to.equal(Winner.WHITE);
    });

    it('should count the no-capture draw before a trapped player', () => {
        // The draw happened as the previous turn ended, before the trapped player had to move
        const board = boardWithTurn(3, 3, '222212222', Turn.WHITE);
        board.resetBoardState({ ...board.saveBoardState(), turnsWithoutCapture: 60 });
        expect(board.getWinner()).to.equal(Winner.DRAW);
    });

    it('should make the search see trapping the opponent as a win', () => {
        // Black's only piece is at 0. White moving into 4 from 2, 5 or 6 boxes it in (1, 3 and 4 all white) without a
        // capture. Moving into 4 from 1 or 3 leaves black a way out, and the other moves don't reach 4 at all.
        const board = boardWithTurn(3, 3, '211101100', Turn.WHITE);
        const best = findBestMoves(board, PieceType.WHITE, material, 1)!;
        expect(best.score).to.equal(WIN_SCORE - 1);
        expect(best.moves.map(m => `${m.startIndex}:${m.move.moveIndexes.join(',')}`).sort()).to.deep.equal(['2:4', '5:4', '6:4']);
    });

    it('should end the game straight away after a move that traps the opponent', () => {
        const board = boardWithTurn(3, 3, '211101100', Turn.WHITE);
        board.applyCompleteMove(5, { moveIndexes: [4], moveTypes: [0] });
        expect(board.getTurn()).to.equal(Turn.BLACK);
        expect(board.getWinner()).to.equal(Winner.WHITE);
    });

    it('should count a player as trapped exactly when they have no possible complete moves', () => {
        // The test positions (which happen to include no trapped players), plus some hand-made trapped ones
        const afterTrap = boardWithTurn(3, 3, '211101100', Turn.WHITE);
        afterTrap.applyCompleteMove(5, { moveIndexes: [4], moveTypes: [0] });
        const boards = [
            ...loadGolden().entries.filter(e => e.position.kind !== 'midChain').map(e => boardFromPosition(e.position)),
            boardWithTurn(3, 3, '222212222', Turn.WHITE),
            boardWithTurn(3, 3, '111121111', Turn.BLACK),
            boardWithTurn(3, 3, '211110000', Turn.WHITE),
            afterTrap,
        ];
        let trapped = 0;
        for (const [i, board] of boards.entries()) {
            const sideToMove = board.getTurn() === Turn.WHITE ? PieceType.WHITE : PieceType.BLACK;
            // Skip games already over by captures or the draw rule (then nobody has moves)
            if (board.getNumPieces(PieceType.WHITE) === 0 || board.getNumPieces(PieceType.BLACK) === 0 || board.getTurnsWithoutCapture() >= 60) continue;
            const hasMoves = board.getAllPossibleCompleteMoves(sideToMove).startIndexes.length > 0;
            const lost = board.getWinner() === (sideToMove === PieceType.WHITE ? Winner.BLACK : Winner.WHITE);
            expect(lost, `board ${i}`).to.equal(!hasMoves);
            if (lost) trapped++;
        }
        expect(trapped, 'trapped positions checked').to.equal(3);
    });

    it('should still let bot games finish normally', function () {
        this.timeout(30_000);
        const stats = playGame(contestantFromPreset(Fortress), contestantFromPreset(Fortress), 300, () => 0.5);
        expect(['WHITE', 'BLACK', 'DRAW']).to.include(stats.result);
    });
});
