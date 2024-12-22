import { expect } from 'chai';
import Board from '../src/Board.ts';
import { Direction, Neighbour, Move } from '../src/types.ts';

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

        const directionsForWhite: Move[] = [
            { index: 4, direction: Direction.RIGHT },
        ];
        const directionsForBlack: Move[] = [
            { index: 4, direction: Direction.LEFT },
        ];
        
        expect(board.getPossibleMovesForCell(3)).to.deep.equal(directionsForWhite);
        expect(board.getPossibleMovesForCell(5)).to.deep.equal(directionsForBlack);
    });

    // it('should provide all the possible moves a piece can make on a strong intersection', () => {
    //     const expectedEmptyBoardMoves: Move[] = [
    //         { index: 0, direction: Direction.UPLEFT },
    //         { index: 1, direction: Direction.UP },
    //         { index: 2, direction: Direction.UPRIGHT },
    //         { index: 3, direction: Direction.LEFT },
    //         { index: 5, direction: Direction.RIGHT },
    //         { index: 6, direction: Direction.DOWNLEFT },
    //         { index: 7, direction: Direction.DOWN },
    //         { index: 8, direction: Direction.DOWNRIGHT },
    //     ]
        
    //     const board = new Board(3, 3, emptyRow3 + '010' + emptyRow3);

    //     expect(board.getPossibleMovesForCell(4)).to.deep.equal(expectedEmptyBoardMoves);

    //     // Situation 2: Completely surrounded by pieces of its own type. Shouldnt be able to move anywhere.
        
    //     const whiteFilledBoard = new Board(3, 3, '111111111');
    //     expect(whiteFilledBoard.getPossibleMovesForCell(4)).to.be.empty;

    //     // Situation 3: Completely surrounded by pieces of its opponents type. Should be able to move anywhere.
    //     const blackFilledBoard = new Board(3, 3, '222212222');
    //     expect(blackFilledBoard.getPossibleMovesForCell(4)).to.be.empty;

    //     // Situation 4: Surrounded on the sides except for two piaka moves (up or down). Should have only those two options.
    //     // NOTE: When debugging remember the indexes of the Move[] and Neighbour[] arrays wont match.
    //     const piakaMovesBoard = new Board(3, 3, '202212202')
    //     const expectedUpDownPaikaMoves: Move[] = [
    //         { index: 1, direction: Direction.UP },
    //         { index: 7, direction: Direction.DOWN },
    //     ]

    //     expect(piakaMovesBoard.getPossibleMovesForCell(4)).to.deep.equal(expectedUpDownPaikaMoves)
    // });

    // it('should remove correct pieces after diagonal withdrawal', () => {
    //     // Withdraw diagonal
    //     const boardPositionsBeforeDiagonalWithdrawal: string = '200000200000100' + emptyRow5 + emptyRow5;
    //     const board = new Board(5, 5, boardPositionsBeforeDiagonalWithdrawal);

    //     // Do withdrawal
    //     const boardPositionsAfterDiagonalWithdrawal: string = emptyRow5 + emptyRow5 + emptyRow5 + '00010' + emptyRow5;
    //     expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterDiagonalWithdrawal);
    // });

    // it('should remove correct pieces after diagonal approach', () => {
    //     // Approach diagonal
    //     const boardPositionsBeforeDiagonalApproach: string = '2000002000' + emptyRow5 + '00010' + emptyRow5;
    //     const board = new Board(5, 5, boardPositionsBeforeDiagonalApproach);

    //     // Do approach
    //     const boardPositionsAfterDiagonalApproach: string = emptyRow5 + emptyRow5 + '00010' + emptyRow5 + emptyRow5;
    //     expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterDiagonalApproach);

    // it('should remove correct pieces after horizontal withdrawal', () => {
    //     // Withdraw horizontal
    //     const boardPositionsBeforeHorizontalWithdrawal: string = emptyRow5 + emptyRow5 + '22100' + emptyRow5 + emptyRow5;
    //     const board = new Board(5, 5, boardPositionsBeforeHorizontalWithdrawal);

    //     // DO WITHDRAWAL
    //     const boardPositionsAfterHorizontalWithdrawal: string = emptyRow5 + emptyRow5 + '00010' + emptyRow5 + emptyRow5;
    //     expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterHorizontalWithdrawal);
    // });

    // it('should remove correct pieces after horizontal approach', () => {
    //     // Approach horizontal
    //     const boardPositionsBeforeHorizontalApproach: string = emptyRow5 + emptyRow5 + '22010' + emptyRow5 + emptyRow5;
    //     const board = new Board(5, 5, boardPositionsBeforeHorizontalApproach);

    //     // DO APPROACH
    //     const boardPositionsAfterHorizontalApproach: string = emptyRow5 + emptyRow5 + '00100' + emptyRow5 + emptyRow5;
    //     expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterHorizontalApproach);
    // });

    // it('should remove correct pieces after vertical withdrawal', () => {
    //     // Withdraw vertical
    //     const boardPositionsBeforeVerticalWithdrawal: string = '00200'+ '00200' + '00100' + emptyRow5 + emptyRow5;
    //     const board = new Board(5, 5, boardPositionsBeforeVerticalWithdrawal);

    //     // DO WITHDRAWAL
    //     const boardPositionsAfterVerticalWithdrawal: string = emptyRow5 + emptyRow5 + emptyRow5 + '00100' + emptyRow5;
    //     expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterVerticalWithdrawal);
    // });

    // it('should remove correct pieces after vertical withdrawal', () => {
    //     // Approach vertical
    //     const boardPositionsBeforeVerticalApproach: string = '00200'+ '00200' + emptyRow5 + '00100' + emptyRow5;
    //     const board = new Board(5, 5, boardPositionsBeforeVerticalApproach);

    //     // DO WITHDRAWAL
    //     const boardPositionsAfterVerticalApproach: string = emptyRow5 + emptyRow5 + '00100' + emptyRow5 + emptyRow5;
    //     expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterVerticalApproach);
    // });
    
    
    // Withdraw vertical
    
    
    
    // Approach vertical
    
    
    
    // Withdraw wrong direction
    
    // Approach wrong direction
    
    // Do moves contain attack
    
});
