import { expect } from 'chai';
import Board from '../src/Board.js';
import CellClickHandler from '../src/CellClickHandler.js';
import { AttackType, Direction, Turn } from '../src/types.js';

const emptyRow5 = '00000';

const emptyHandlerState = {
    selectedCell: null,
    possibleMoves: [],
    attackingChain: false,
    approachOrWithdrawPieces: null,
    approachOrWithdrawMoveIndex: null,
};

const cell0SelectionState = {
    selectedCell: 0,
    possibleMoves: [
        { index: 1, direction: Direction.RIGHT, attackType: AttackType.NONE },
        { index: 5, direction: Direction.DOWN, attackType: AttackType.NONE },
        { index: 6, direction: Direction.DOWNRIGHT, attackType: AttackType.NONE },
    ],
    attackingChain: false,
    approachOrWithdrawPieces: null,
    approachOrWithdrawMoveIndex: null,
};

describe('CellClickHandler tests', () => {
    it('should not do anything to the board or the handler when player clicks during opponents turn', () => {
        const board = new Board(5, 5, '10000' + emptyRow5 + emptyRow5 + emptyRow5 + '00002');
        const handler = new CellClickHandler(board);

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
        const board = new Board(5, 5, '10000' + emptyRow5 + emptyRow5 + emptyRow5 + '00002');
        const handler = new CellClickHandler(board);

        const boardStateBefore: string = board.getBoardPositionsAsString();

        expect(handler.getHandlerState()).to.deep.equal(emptyHandlerState);

        handler.handleCellClick(0);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(cell0SelectionState);
    });

    it('should not select a piece if opponent pieces or empty cells are clicked', () => {
        const board = new Board(5, 5, '10000' + emptyRow5 + emptyRow5 + emptyRow5 + '00002');
        const handler = new CellClickHandler(board);

        const boardStateBefore: string = board.getBoardPositionsAsString();

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(emptyHandlerState);

        // Test empty cell click
        handler.handleCellClick(1);
        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(emptyHandlerState);

        // Test opponent piece cell click
        handler.handleCellClick(24);
        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(emptyHandlerState);
    });

    it('should not select a piece if player clicks on piece they cannot move', () => {
        const board = new Board(5, 5, '11000' + '11000' + emptyRow5 + emptyRow5 + emptyRow5);
        const handler = new CellClickHandler(board);

        const boardStateBefore: string = board.getBoardPositionsAsString();

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(emptyHandlerState);

        // Test click on piece player cant move (piece has no empty cells around it)
        handler.handleCellClick(0);
        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(emptyHandlerState);
    });

    it('should do nothing when clicking on an empty cell you cant move to or opponents piece while the players piece is selected', () => {
        const board = new Board(5, 5, '10000' + emptyRow5 + emptyRow5 + emptyRow5 + '00002');
        const handler = new CellClickHandler(board);

        const boardStateBefore: string = board.getBoardPositionsAsString();

        expect(handler.getHandlerState()).to.deep.equal(emptyHandlerState);

        handler.handleCellClick(0);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(cell0SelectionState);

        handler.handleCellClick(2);

        // The handler should do nothing and so its state should remain the same
        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(cell0SelectionState);

        handler.handleCellClick(24);
        // The handler should do nothing and so its state should remain the same
        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(cell0SelectionState);
    });

    it('should unselect the current piece when clicking on the same piece or an unmovable piece', () => {
        const board = new Board(5, 5, '11000' + '11000' + emptyRow5 + emptyRow5 + '00002');
        const handler = new CellClickHandler(board);

        const boardStateBefore: string = board.getBoardPositionsAsString();
        const cell1SelectionState = {
            selectedCell: 1,
            possibleMoves: [ { index: 2, direction: Direction.RIGHT, attackType: AttackType.NONE } ],
            attackingChain: false,
            approachOrWithdrawPieces: null,
            approachOrWithdrawMoveIndex: null,
        };

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(emptyHandlerState);

        handler.handleCellClick(1);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(cell1SelectionState);

        // Click on the cell which cannot be moved
        handler.handleCellClick(0);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(emptyHandlerState);

        // Make the piece selected again
        handler.handleCellClick(1);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(cell1SelectionState);

        // Then click on it again. It should now deselect.
        handler.handleCellClick(1);
        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(emptyHandlerState);
    });

    it('should select another piece and show its moves if players clicks on valid movable piece while another piece is selected', () => {
        const board = new Board(5, 5, '11000' + '11000' + emptyRow5 + emptyRow5 + '00002');
        const handler = new CellClickHandler(board);

        const boardStateBefore: string = board.getBoardPositionsAsString();
        const cell1SelectionState = {
            selectedCell: 1,
            possibleMoves: [ { index: 2, direction: Direction.RIGHT, attackType: AttackType.NONE } ],
            attackingChain: false,
            approachOrWithdrawPieces: null,
            approachOrWithdrawMoveIndex: null,
        };
        const cell5SelectionState = {
            selectedCell: 5,
            possibleMoves: [ { index: 10, direction: Direction.DOWN, attackType: AttackType.NONE } ],
            attackingChain: false,
            approachOrWithdrawPieces: null,
            approachOrWithdrawMoveIndex: null,
        };

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(emptyHandlerState);

        handler.handleCellClick(1);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(cell1SelectionState);

        handler.handleCellClick(5);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(cell5SelectionState);
    });

    it('should move piece when valid move index is clicked and piece is selected', () => {
        const board = new Board(5, 5, '10000' + emptyRow5 + emptyRow5 + emptyRow5 + '00002');
        const handler = new CellClickHandler(board);

        const boardStateBefore: string = board.getBoardPositionsAsString();
        const boardStateAfterMove: string = '01000' + emptyRow5 + emptyRow5 + emptyRow5 + '00002';

        expect(handler.getHandlerState()).to.deep.equal(emptyHandlerState);

        handler.handleCellClick(0);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(cell0SelectionState);

        // Move the piece into cell 1
        handler.handleCellClick(1);
        // The board should be updated to reflect the move, and the handler should be "reset", since it is now the opponents turn
        expect(board.getBoardPositionsAsString()).to.equal(boardStateAfterMove);
        expect(handler.getHandlerState()).to.deep.equal(emptyHandlerState);
    });

    it('should not allow you to click on anything else during a chain of turns apart from move options', () => {
        const board = new Board(5, 5, '10200' + '00020' + '02000' + emptyRow5 + emptyRow5);
        const handler = new CellClickHandler(board);

        const boardStateBefore: string = board.getBoardPositionsAsString();
        const boardStateAfterFirstMove: string = '01000' + '00020' + '02000' + emptyRow5 + emptyRow5;
        const boardStateAfterSecondMove: string = emptyRow5 + '01020' + emptyRow5 + emptyRow5 + emptyRow5;
        const boardStateAfterThirdMove: string = emptyRow5 + '00100' + emptyRow5 + emptyRow5 + emptyRow5;

        const afterSelectionState = {
            selectedCell: 0,
            possibleMoves: [ { index: 1, direction: Direction.RIGHT, attackType: AttackType.APPROACH } ],
            attackingChain: false,
            approachOrWithdrawPieces: null,
            approachOrWithdrawMoveIndex: null,
        };
        const afterFirstMoveState = {
            selectedCell: 1,
            possibleMoves: [ { index: 6, direction: Direction.DOWN, attackType: AttackType.APPROACH } ],
            attackingChain: true,
            approachOrWithdrawPieces: null,
            approachOrWithdrawMoveIndex: null,
        };
        const afterSecondMoveState = {
            selectedCell: 6,
            possibleMoves: [ { index: 7, direction: Direction.RIGHT, attackType: AttackType.APPROACH } ],
            attackingChain: true,
            approachOrWithdrawPieces: null,
            approachOrWithdrawMoveIndex: null,
        };

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(emptyHandlerState);

        // Select piece
        handler.handleCellClick(0);

        expect(board.getBoardPositionsAsString()).to.equal(boardStateBefore);
        expect(handler.getHandlerState()).to.deep.equal(afterSelectionState);

        handler.handleCellClick(1);
        expect(board.getBoardPositionsAsString()).to.equal(boardStateAfterFirstMove);
        expect(handler.getHandlerState()).to.deep.equal(afterFirstMoveState);

        // Clicking on anything else except for the possible move should do nothing!
        handler.handleCellClick(0);
        expect(board.getBoardPositionsAsString()).to.equal(boardStateAfterFirstMove);
        expect(handler.getHandlerState()).to.deep.equal(afterFirstMoveState);
        handler.handleCellClick(1);
        expect(board.getBoardPositionsAsString()).to.equal(boardStateAfterFirstMove);
        expect(handler.getHandlerState()).to.deep.equal(afterFirstMoveState);
        handler.handleCellClick(10);
        expect(board.getBoardPositionsAsString()).to.equal(boardStateAfterFirstMove);
        expect(handler.getHandlerState()).to.deep.equal(afterFirstMoveState);

        // Now perform the second move
        handler.handleCellClick(6);
        expect(board.getBoardPositionsAsString()).to.equal(boardStateAfterSecondMove);
        expect(handler.getHandlerState()).to.deep.equal(afterSecondMoveState);

        // Clicking on anything else except for the possible move should do nothing!
        handler.handleCellClick(0);
        expect(board.getBoardPositionsAsString()).to.equal(boardStateAfterSecondMove);
        expect(handler.getHandlerState()).to.deep.equal(afterSecondMoveState);
        handler.handleCellClick(1);
        expect(board.getBoardPositionsAsString()).to.equal(boardStateAfterSecondMove);
        expect(handler.getHandlerState()).to.deep.equal(afterSecondMoveState);
        handler.handleCellClick(10);
        expect(board.getBoardPositionsAsString()).to.equal(boardStateAfterSecondMove);
        expect(handler.getHandlerState()).to.deep.equal(afterSecondMoveState);

        // Now perform the third move
        handler.handleCellClick(7);
        expect(board.getBoardPositionsAsString()).to.equal(boardStateAfterThirdMove);
        expect(handler.getHandlerState()).to.deep.equal(emptyHandlerState);

        // TODO: Click on FINISH TURN
    });

    it('should let the player end their turn in the middle of a capture chain', () => {
        const board = new Board(5, 9, '200202022200010222000200021100020000010000011');
        const handler = new CellClickHandler(board);
        expect(handler.canEndTurn()).to.equal(false);
        expect(handler.handleEndTurn()).to.equal(false);

        // White approaches DOWN from 13 to 22, capturing 31, and could keep capturing.
        handler.handleCellClick(13);
        expect(handler.canEndTurn()).to.equal(false);
        handler.handleCellClick(22);
        expect(handler.getHandlerState().attackingChain).to.equal(true);
        expect(handler.canEndTurn()).to.equal(true);

        const boardAfterCapture = board.getBoardPositionsAsString();
        expect(handler.handleEndTurn()).to.equal(true);
        expect(board.getBoardPositionsAsString()).to.equal(boardAfterCapture);
        expect(board.getTurn()).to.equal(Turn.BLACK);
        expect(handler.getHandlerState()).to.deep.equal(emptyHandlerState);

        // It's now black's turn, so the turn can't be ended again.
        expect(handler.canEndTurn()).to.equal(false);
        expect(handler.handleEndTurn()).to.equal(false);
    });

    it('should not let the player end their turn once the chain has finished', () => {
        // White withdraws from 8 by moving to 0, and can't capture again from there.
        const board = new Board(3, 3, '000210002');
        const handler = new CellClickHandler(board);
        handler.handleCellClick(4);
        handler.handleCellClick(0);
        expect(board.getTurn()).to.equal(Turn.BLACK);
        expect(handler.canEndTurn()).to.equal(false);
        expect(handler.handleEndTurn()).to.equal(false);
    });

    it('should cancel a pending approach or withdraw choice when ending the turn', () => {
        const board = new Board(5, 9, '220202222000000222010122121100210111010101111');
        const handler = new CellClickHandler(board);

        // White moves UP from 19 to 10, capturing, then picks a move to 20 that could either approach or withdraw.
        handler.handleCellClick(19);
        handler.handleCellClick(10);
        const boardAfterFirstCapture = board.getBoardPositionsAsString();
        expect(handler.handleCellClick(20)).to.equal(false);
        expect(handler.getHandlerState().approachOrWithdrawPieces).to.not.equal(null);
        expect(handler.canEndTurn()).to.equal(true);

        // Ending the turn cancels that move, so the piece stays at 10 and nothing else is captured.
        expect(handler.handleEndTurn()).to.equal(true);
        expect(board.getBoardPositionsAsString()).to.equal(boardAfterFirstCapture);
        expect(board.getTurn()).to.equal(Turn.BLACK);
        expect(handler.getHandlerState()).to.deep.equal(emptyHandlerState);
    });
});
