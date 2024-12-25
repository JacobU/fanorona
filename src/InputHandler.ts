import Board from './Board.js';
import { PieceType, Turn } from './types.js';

export class PlayerInputHandler {
    private board: Board;
    private currentlySelectedCell: null | number = null;
    private playersPieceType: PieceType;
    private possibleMoveIndexes: number[];

    constructor(board: Board) {
        this.board = board;
        this.playersPieceType = PieceType.WHITE; // Default to white until we make it available to play as black
        this.possibleMoveIndexes = [];
    }

    handleCellClick(index: number) {
        // Handles a click during an opponents turn
        // Clicking should only affect the board if it is the players turn. Otherwise ignore the click.
        if (this.board.getTurn() !== Turn.WHITE) {
            return;
        }

        // Handles a click for selecting a piece to move
        // If the cell clicked on is one of the pieces we can move, set it as the selected cell
        // Otherwise, deselect the currently selected cell.
        if (this.board.getPiecesThatPlayerCanMove(this.playersPieceType).includes(index)) {
            this.currentlySelectedCell = index;
            this.possibleMoveIndexes = this.board.getPossibleMovesForCell(this.currentlySelectedCell).map(move => move.index);    
        } else {
            this.currentlySelectedCell = null;
            this.possibleMoveIndexes = [];
        }

        // Handles click for moving a piece
        if (this.currentlySelectedCell !== null && this.possibleMoveIndexes.includes(index)) {
            // TODO
            //this.board.performMove(this.currentlySelectedCell, )
        }

        // 
    }

}