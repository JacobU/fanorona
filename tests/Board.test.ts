import { expect } from 'chai';
import Board from '../src/Board.ts';
import { Direction } from '../src/types.ts';

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

    // Check correct possible moves
    it('should provide correct possible moves for 3x3 board on weak intersections', () => {
        const boardPositionString = "000102000";
        const board = new Board(3, 3, boardPositionString);

        const directionsForBlack: Direction[] = [ Direction.UP, Direction.LEFT, Direction.DOWN ];
        const directionsForWhite: Direction[] = [ Direction.UP, Direction.RIGHT, Direction.DOWN ];

        expect(board.getCell(1, 0).getPossibleMoves(board.getCellNeighbours(1, 0))).to.deep.equal(directionsForWhite);
        expect(board.getCell(1, 2).getPossibleMoves(board.getCellNeighbours(1, 2))).to.deep.equal(directionsForBlack);
    });


    
});
