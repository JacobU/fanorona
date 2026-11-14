import { expect } from 'chai';
import Board from '../src/Board.js';
import { Direction } from '../src/types.js';
import { capturedIndexes, sleep } from '../src/animationHelpers.js';

const emptyRow5 = '00000';

/**
 * Plays a single move on a 5x5 board and returns what capturedIndexes reports for it.
 */
function capturesFor(position: string, from: number, direction: Direction): number[] {
    const board = new Board(5, 5, position);
    const before = board.getBoardPiecePositions();
    board.performMove(from, direction);
    return capturedIndexes(before, board.getBoardPiecePositions(), from);
}

describe('Animation helper tests', () => {
    it('should report a single piece captured by approach', () => {
        // White at 0 approaches black at 2 by moving to 1
        expect(capturesFor('10200' + emptyRow5.repeat(4), 0, Direction.RIGHT)).to.deep.equal([2]);
    });

    it('should report a whole line captured by approach', () => {
        // White at 0 approaches the line of black pieces at 2, 3 and 4
        expect(capturesFor('10222' + emptyRow5.repeat(4), 0, Direction.RIGHT)).to.deep.equal([2, 3, 4]);
    });

    it('should report a piece captured by withdrawal, behind the moving piece', () => {
        // White at 1 moves away from black at 0
        expect(capturesFor('21000' + emptyRow5.repeat(4), 1, Direction.RIGHT)).to.deep.equal([0]);
    });

    it('should report nothing for a move without a capture', () => {
        expect(capturesFor('10000' + emptyRow5.repeat(3) + '00002', 0, Direction.RIGHT)).to.deep.equal([]);
    });

    it('should never report the square the moving piece left', () => {
        const captured = capturesFor('10222' + emptyRow5.repeat(4), 0, Direction.RIGHT);
        expect(captured).to.not.include(0);
    });

    it('should wait for roughly the requested time', async () => {
        const start = Date.now();
        await sleep(30);
        expect(Date.now() - start).to.be.at.least(25);
    });
});
