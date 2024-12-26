import { expect } from 'chai';
import Board from '../src/Board.js';
import CellClickHandler from '../src/CellClickHandler.js';
import { Direction } from '../src/types.js';

const emptyRow5 = '00000';

describe('CellClickHandler tests', () => {
    it('should not do anything to the board or the handler when player clicks during opponents turn', () => {
        const board = new Board(5, 5, '10000' + emptyRow5 + emptyRow5 + emptyRow5 + '00002');
        const handler =  new CellClickHandler(board);

        // Play something so it is not your turn
        board.performMove(0, Direction.RIGHT);

        const boardStateBefore: string = board.getBoardPositionsAsString();
        const handlerStateBefore = handler.getHandlerState();

        handler.handleCellClick(24);
        handler.handleCellClick(1);
        handler.handleCellClick(0);
        handler.handleCellClick(5);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore);
    });
});