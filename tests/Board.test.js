import { expect } from 'chai';
import Board from '../src/Board.js';

describe('Board Tests', () => {
    it('should initialize correctly', () => {
        const board = new Board();
        expect(board).to.be.an('object');
    });

    it('should output the correct board after init', () => {
        const boardPositionString = "120000000";
        const board = new Board(3, 3, boardPositionString);
        expect(board.getBoardPositionsAsString()).equals(boardPositionString);
    });
});
