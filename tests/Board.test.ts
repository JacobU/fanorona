import { expect } from 'chai';
import Board from '../src/Board.ts';
import { Direction } from '../src/types.ts';

describe('Board Tests', () => {

    const emptyRow9: string = '000000000';
    const emptyRow5: string = '00000';
    const emptyRow3: string = '000';

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

    it('should remove correct pieces after diagonal withdrawal', () => {
        // Withdraw diagonal
        const boardPositionsBeforeDiagonalWithdrawal: string = '200000200000100' + emptyRow5 + emptyRow5;
        const board = new Board(5, 5, boardPositionsBeforeDiagonalWithdrawal);

        // Do withdrawal
        const boardPositionsAfterDiagonalWithdrawal: string = emptyRow5 + emptyRow5 + emptyRow5 + '00010' + emptyRow5;
        expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterDiagonalWithdrawal);
    });

    it('should remove correct pieces after diagonal approach', () => {
        // Approach diagonal
        const boardPositionsBeforeDiagonalApproach: string = '2000002000' + emptyRow5 + '00010' + emptyRow5;
        const board = new Board(5, 5, boardPositionsBeforeDiagonalApproach);

        // Do approach
        const boardPositionsAfterDiagonalApproach: string = emptyRow5 + emptyRow5 + '00010' + emptyRow5 + emptyRow5;
        expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterDiagonalApproach);

    it('should remove correct pieces after horizontal withdrawal', () => {
        // Withdraw horizontal
        const boardPositionsBeforeHorizontalWithdrawal: string = emptyRow5 + emptyRow5 + '22100' + emptyRow5 + emptyRow5;
        const board = new Board(5, 5, boardPositionsBeforeHorizontalWithdrawal);

        // DO WITHDRAWAL
        const boardPositionsAfterHorizontalWithdrawal: string = emptyRow5 + emptyRow5 + '00010' + emptyRow5 + emptyRow5;
        expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterHorizontalWithdrawal);
    });

    it('should remove correct pieces after horizontal approach', () => {
        // Approach horizontal
        const boardPositionsBeforeHorizontalApproach: string = emptyRow5 + emptyRow5 + '22010' + emptyRow5 + emptyRow5;
        const board = new Board(5, 5, boardPositionsBeforeHorizontalApproach);

        // DO APPROACH
        const boardPositionsAfterHorizontalApproach: string = emptyRow5 + emptyRow5 + '00100' + emptyRow5 + emptyRow5;
        expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterHorizontalApproach);
    });

    it('should remove correct pieces after vertical withdrawal', () => {
        // Withdraw vertical
        const boardPositionsBeforeVerticalWithdrawal: string = '00200'+ '00200' + '00100' + emptyRow5 + emptyRow5;
        const board = new Board(5, 5, boardPositionsBeforeVerticalWithdrawal);

        // DO WITHDRAWAL
        const boardPositionsAfterVerticalWithdrawal: string = emptyRow5 + emptyRow5 + emptyRow5 + '00100' + emptyRow5;
        expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterVerticalWithdrawal);
    });

    it('should remove correct pieces after vertical withdrawal', () => {
        // Approach vertical
        const boardPositionsBeforeVerticalApproach: string = '00200'+ '00200' + emptyRow5 + '00100' + emptyRow5;
        const board = new Board(5, 5, boardPositionsBeforeVerticalApproach);

        // DO WITHDRAWAL
        const boardPositionsAfterVerticalApproach: string = emptyRow5 + emptyRow5 + '00100' + emptyRow5 + emptyRow5;
        expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterVerticalApproach);
    });
    
    
    // Withdraw vertical
    
    
    
    // Approach vertical
    
    
    
    // Withdraw wrong direction
    
    // Approach wrong direction
    
    // Do moves contain attack
    
});
