import Board from './Board.js';
import { PieceType, Turn, Move, getDeltaIndex } from './types.js';

export default class CellClickHandler {
    private board: Board;
    private currentlySelectedCell: null | number = null;
    private playersPieceType: PieceType;
    private possibleMoveIndexes: Move[] = [];
    private inTheMiddleOfAttackingChain: boolean = false;

    constructor(board: Board) {
        this.board = board;
        this.playersPieceType = PieceType.WHITE; // Default to white until we make it available to play as black
    }

    handleCellClick(index: number) {
        // Handles a click during an opponents turn
        // Clicking should only affect the board if it is the players turn. Otherwise ignore the click.
        if (this.board.getTurn() !== Turn.WHITE) {
            return;
        }

        // Handle the case when you are in the middle of a turn
        if (this.inTheMiddleOfAttackingChain) {
            if (!this.possibleMoveIndexes.map(move => move.index).includes(index)) {
                return;
            }
            const actualMove = this.possibleMoveIndexes.find(move => move.index === index);
            if (actualMove) {
                const canMoveAgain = this.board.performMove(actualMove.index, actualMove.direction);
                if (!canMoveAgain) {
                    this.currentlySelectedCell = null;
                    this.possibleMoveIndexes = [];
                    this.inTheMiddleOfAttackingChain = false;
                }
                return;
            }
        // Handle all cases where no piece is currently selected            
        } else if (this.currentlySelectedCell === null) {
            // Note this one condition covers the cell selected being an opponents piece, and empty cell, and
            // a players piece that CANNOT move.
            if (!this.board.getPiecesThatPlayerCanMove(this.playersPieceType).includes(index)) {
                return;
            } else {
                this.currentlySelectedCell = index;
                this.possibleMoveIndexes = this.board.getPossibleMovesForCell(this.currentlySelectedCell);
                return;
            }
        } else {
            if (this.board.getPieceTypeAtIndex(index) !== PieceType.WHITE) {
                return;
            // At this point, we are covering the cases where the player selects on of their own pieces (that can't be moved)
            // or where they click their selected piece again.
            } else if (!this.board.getPiecesThatPlayerCanMove(this.playersPieceType).includes(index) ||
                        this.currentlySelectedCell === index) {
                this.currentlySelectedCell = null;
                return;
            } else if (this.board.getPiecesThatPlayerCanMove(this.playersPieceType).includes(index)) {
                this.currentlySelectedCell = index;
                this.possibleMoveIndexes = this.board.getPossibleMovesForCell(this.currentlySelectedCell);
                return;
            } else if (this.possibleMoveIndexes.map(move => move.index).includes(index)) {
                const actualMove = this.possibleMoveIndexes.find(move => move.index === index);
                if (actualMove) {
                    const canMoveAgain = this.board.performMove(actualMove.index, actualMove.direction);
                    if (!canMoveAgain) {
                        this.currentlySelectedCell = null;
                        this.possibleMoveIndexes = [];
                        this.inTheMiddleOfAttackingChain = false;
                    } else {
                        this.inTheMiddleOfAttackingChain = true;
                        this.currentlySelectedCell = index + getDeltaIndex(actualMove.direction, this.board.getBoardsNumberOfColumns());
                        this.possibleMoveIndexes = this.board.getPossibleMovesForCell(this.currentlySelectedCell);
                    }
                    return;
                }
            }
        }
    }

    public getHandlerState(): { selectedCell: number | null, possibleMoves: Move[], attackingChain: boolean } {
        return { selectedCell: this.currentlySelectedCell, possibleMoves: this.possibleMoveIndexes, attackingChain: this.inTheMiddleOfAttackingChain };
    }


}