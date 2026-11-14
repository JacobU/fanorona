import { expect } from 'chai';
import Board from '../src/Board.js';
import { AttackType, PieceType, Winner } from '../src/types.js';
import { boardFromPosition } from '../src/ai/testPositions.js';
import { expectBoardUnchanged } from './helpers/boardInvariance.js';
import { loadGolden } from './helpers/golden.js';

/**
 * The rule written out plainly: if any of the player's pieces can capture, only those pieces can move (captures are
 * compulsory). Otherwise every piece with an empty neighbour can move.
 */
function referencePiecesThatCanMove(board: Board, pieceType: PieceType): number[] {
    const pieces: number[] = [];
    for (let i = 0; i < board.getBoardsNumberOfRows() * board.getBoardsNumberOfColumns(); i++) {
        if (board.getPieceTypeAtIndex(i) === pieceType) pieces.push(i);
    }
    // At the start of a turn, a piece's possible moves are its captures if it has any, otherwise its paika moves
    const attacking = pieces.filter(i => board.getPossibleMovesForCell(i).some(move => move.attackType !== AttackType.NONE));
    return attacking.length > 0 ? attacking : pieces.filter(i => board.getPossibleMovesForCell(i).length > 0);
}

describe('Pieces that a player can move', () => {
    it('should only allow the pieces that can capture when there is a capture', () => {
        // White at 0 can approach black at 2. White at 20 can't capture anything.
        const board = new Board(5, 5, '10200' + '00000' + '00000' + '00000' + '10000');
        expect(board.getPiecesThatPlayerCanMove(PieceType.WHITE)).to.deep.equal([0]);
    });

    it('should allow every piece with an empty neighbour when there are no captures', () => {
        // White at 0 and 20 can both move, but black at 24 is too far away to capture
        const board = new Board(5, 5, '10000' + '00000' + '00000' + '00000' + '10002');
        expect(board.getPiecesThatPlayerCanMove(PieceType.WHITE)).to.deep.equal([0, 20]);
    });

    it('should not allow a piece that is completely surrounded', () => {
        // White at 0 is boxed in by its own pieces at 1, 3 and 4 (its only neighbours), which can move
        const board = new Board(3, 3, '111110002');
        expect(board.getPiecesThatPlayerCanMove(PieceType.WHITE)).to.not.include(0);
    });

    it('should match the plain rule for both players in every test position between turns', () => {
        for (const { position } of loadGolden().entries) {
            if (position.kind === 'midChain') continue;
            const board = boardFromPosition(position);
            // getPossibleMovesForCell gives no moves once the game is over, so the plain rule only applies to games still going
            if (board.getWinner() !== Winner.NONE) continue;
            for (const side of [PieceType.WHITE, PieceType.BLACK]) {
                const pieces = expectBoardUnchanged(board, () => board.getPiecesThatPlayerCanMove(side), position.name);
                expect(pieces, `${position.name} (${side === PieceType.WHITE ? 'white' : 'black'})`).to.deep.equal(referencePiecesThatCanMove(board, side));
            }
        }
    });

    it('should only allow the moving piece in the middle of a capture chain', () => {
        for (const { position } of loadGolden().entries.filter(e => e.position.kind === 'midChain')) {
            const board = boardFromPosition(position);
            expect(board.getPiecesThatPlayerCanMove(PieceType.WHITE), position.name).to.deep.equal([position.state.currentlyMovingPiece]);
        }
    });
});
