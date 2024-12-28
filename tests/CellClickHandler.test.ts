import { expect } from 'chai';
import Board from '../src/Board.js';
import CellClickHandler from '../src/CellClickHandler.js';
import { Direction, PieceType } from '../src/types.js';

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

    it('should select a piece when clicking on valid piece when no other piece is selected', () => {
        const board = new Board(5, 5, '10000' + emptyRow5 + emptyRow5 + emptyRow5 + emptyRow5);
        const handler =  new CellClickHandler(board);

        const boardStateBefore: string = board.getBoardPositionsAsString();
        const handlerStateBefore = { selectedCell: null, possibleMoves: [], attackingChain: false };
        const handlerStateAfterSelection =  { 
            selectedCell: 0, 
            possibleMoves: [ { index: 1, direction: 4 }, { index: 5, direction: 6 }, { index: 6, direction: 7 } ], 
            attackingChain: false 
        }; 
        
        expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore);

        handler.handleCellClick(0);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore); // board state stays the same
        expect(handler.getHandlerState()).to.deep.equal(handlerStateAfterSelection); // handler state should change and show moves
    });

    it('should not select a piece if opponent pieces or empty cells are clicked', () => {
        const board = new Board(5, 5, '10000' + emptyRow5 + emptyRow5 + emptyRow5 + '00002');
        const handler =  new CellClickHandler(board);

        const boardStateBefore: string = board.getBoardPositionsAsString();
        const handlerStateBefore = { selectedCell: null, possibleMoves: [], attackingChain: false };
        
        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore);

        // Test empty cell click
        handler.handleCellClick(1);
        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore); 

        // Test opponent piece cell click
        handler.handleCellClick(24);
        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore); 
    });

    it('should not select a piece if player clicks on piece they cannot move', () => {
        const board = new Board(5, 5, '11000' + '11000' + emptyRow5 + emptyRow5 + emptyRow5);
        const handler =  new CellClickHandler(board);

        const boardStateBefore: string = board.getBoardPositionsAsString();
        const handlerStateBefore = { selectedCell: null, possibleMoves: [], attackingChain: false };
        
        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore);

        // Test click on piece player cant move (piece has no empty cells around it)
        handler.handleCellClick(0);
        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore); 
    });
    
    it('should do nothing when clicking on an empty cell you cant move to or opponents piece while the players piece is selected', () => {
        const board = new Board(5, 5, '10000' + emptyRow5 + emptyRow5 + emptyRow5 + '00002');
        const handler =  new CellClickHandler(board);

        const boardStateBefore: string = board.getBoardPositionsAsString();
        const handlerStateBefore = { selectedCell: null, possibleMoves: [], attackingChain: false };
        const handlerStateAfterSelection =  { 
            selectedCell: 0, 
            possibleMoves: [ { index: 1, direction: 4 }, { index: 5, direction: 6 }, { index: 6, direction: 7 } ], 
            attackingChain: false 
        }; 
        
        expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore);

        handler.handleCellClick(0);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore); // board state stays the same
        expect(handler.getHandlerState()).to.deep.equal(handlerStateAfterSelection); // handler state should change and show moves

        handler.handleCellClick(2);

        // The handler should do nothing and so its state should remain the same
        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore); 
        expect(handler.getHandlerState()).to.deep.equal(handlerStateAfterSelection);

        handler.handleCellClick(24);
        // The handler should do nothing and so its state should remain the same
        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore); 
        expect(handler.getHandlerState()).to.deep.equal(handlerStateAfterSelection);

    });

    it('should unselect the current piece when clicking on the same piece or an unmovable piece', () => {
        const board = new Board(5, 5, '11000' + '11000' + emptyRow5 + emptyRow5 + emptyRow5);
        const handler =  new CellClickHandler(board);

        const boardStateBefore: string = board.getBoardPositionsAsString();
        const handlerStateBefore = { selectedCell: null, possibleMoves: [], attackingChain: false };
        const handlerStateAfterSelection =  { 
            selectedCell: 1, 
            possibleMoves: [ { index: 2, direction: 4 } ], 
            attackingChain: false 
        }; 

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore);

        handler.handleCellClick(1);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(handlerStateAfterSelection); 

        // Click on the cell which cannot be moved
        handler.handleCellClick(0);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore);

        // Make the piece selected again
        handler.handleCellClick(1);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(handlerStateAfterSelection); 

        // Then click on it again. It should now deselect.
        handler.handleCellClick(1);
        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore);
    });

    it('should select another piece and show its moves if players clicks on valid movable piece while another piece is selected', () => {
        const board = new Board(5, 5, '11000' + '11000' + emptyRow5 + emptyRow5 + emptyRow5);
        const handler =  new CellClickHandler(board);

        const boardStateBefore: string = board.getBoardPositionsAsString();
        const handlerStateBefore = { selectedCell: null, possibleMoves: [], attackingChain: false };
        const handlerStateAfterClickingOn1 =  { 
            selectedCell: 1, 
            possibleMoves: [ { index: 2, direction: 4 } ], 
            attackingChain: false 
        };
        const handlerStateAfterClickingOn5 =  { 
            selectedCell: 5, 
            possibleMoves: [ { index: 10, direction: 6 } ], 
            attackingChain: false 
        }; 


        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore);

        handler.handleCellClick(1);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(handlerStateAfterClickingOn1); 

        handler.handleCellClick(5);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(handlerStateAfterClickingOn5); 
    });

    it('should move piece when valid move index is clicked and piece is selected', () => {
        const board = new Board(5, 5, '10000' + emptyRow5 + emptyRow5 + emptyRow5 + emptyRow5);
        const handler =  new CellClickHandler(board);

        const boardStateBefore: string = board.getBoardPositionsAsString();
        const handlerStateBefore = { selectedCell: null, possibleMoves: [], attackingChain: false };
        const handlerStateAfterSelection =  { 
            selectedCell: 0, 
            possibleMoves: [ { index: 1, direction: 4 }, { index: 5, direction: 6 }, { index: 6, direction: 7 } ], 
            attackingChain: false 
        }; 
        const boardStateAfterMove: string = '01000' + emptyRow5 + emptyRow5 + emptyRow5 + emptyRow5;

        expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore);

        handler.handleCellClick(0);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore); // board state stays the same
        expect(handler.getHandlerState()).to.deep.equal(handlerStateAfterSelection); // handler state should change and show moves

        // Move the piece into cell 1
        handler.handleCellClick(1);
        // The board should be updated to reflect the move, and the handler should be "reset", since it is now the opponents turn
        expect(board.getBoardPositionsAsString()).to.equal(boardStateAfterMove); 
        expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore); 
    });

    // it('should not allow you to click on anything else during a chain of turns apart from move options', () => {
    //     const board = new Board(5, 5, '10200' + emptyRow5 + '02000' + emptyRow5 + emptyRow5);
    //     const handler =  new CellClickHandler(board);

    //     // Move the piece so that we are in the middle of a turn
    //     handler.handleCellClick(0); // Click on the white piece
    //     console.log(board.getBoardPositionsAsString());
    //     console.log(handler.getHandlerState());

    //     handler.handleCellClick(1); // Click on the cell to move it to

    //     console.log(board.getBoardPositionsAsString());
    //     console.log(handler.getHandlerState());

    //     const boardStateBefore: string = board.getBoardPositionsAsString();
    //     const handlerStateBefore = handler.getHandlerState();
    //     const expectedHandlerStateDuringMoveChain = { selectedCell: 1, possibleMoves: [ { index: 1, direction: 4 } ], attackingChain: true };

    //     console.log(boardStateBefore);
    //     console.log(handlerStateBefore);

    //     expect(handler.getHandlerState()).to.deep.equal(expectedHandlerStateDuringMoveChain);

        

    //     // handler.handleCellClick(24);
    //     // expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
    //     // expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore);
    //     handler.handleCellClick(1);
    //     expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
    //     expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore);
    //     // handler.handleCellClick(2);
    //     // expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
    //     // expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore);
    //     // handler.handleCellClick(0);
    //     // expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
    //     // expect(handler.getHandlerState()).to.deep.equal(handlerStateBefore);
    // });


// 0) If you are in the middle of a turn
// 0a) Click on anything else except for your options - DO NOTHING
// 0b) Click on your options - perform move
// 0c) Click on FINISH TURN - Deselect pieces - perform move

// 3) One of your pieces is selected
// 3f) Select an empty cell that can be moved into - move the piece





//DONE
// 1) Click anywhere - its not your move - DO NOTHING - DONE
// 2d) Click on one of your pieces that can be moved - select that piece and show its moves - DONE
// 2c) Click on an empty cell - DO NOTHING - DONE
// 2a) Click on not your pieces - DO NOTHING - DONE
// 2b) Click on one of your pieces that cant be moved - DO NOTHING

// 3a) Select an empty cell (not one of your moves) - DO NOTHING
// 3b) Select a black piece - DO NOTHING
// 3c) Select one of your own pieces that cant be moved - unselect the piece
// 3d) Select your piece again - unselect the piece
// 3e) Select another piece that can be moved - select that piece
});