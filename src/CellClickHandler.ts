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
        if (this.inTheMiddleOfAttackingChain && this.currentlySelectedCell) {
            console.log('got to middle of turn');
            if (!this.possibleMoveIndexes.map(move => move.index).includes(index)) {
                return;
            }
            const actualMove = this.possibleMoveIndexes.find(move => move.index === index);
            if (actualMove) {
                const canMoveAgain = this.board.performMove(this.currentlySelectedCell, actualMove.direction);
                if (!canMoveAgain) {
                    this.currentlySelectedCell = null;
                    this.possibleMoveIndexes = [];
                    this.inTheMiddleOfAttackingChain = false;
                }
                return;
            }
        // Handle all cases where no piece is currently selected            
        } else if (this.currentlySelectedCell === null) {
            console.log('got to no cells selected');
            // Selected an opponents piece or an empty cell or a players piece that CANNOT move.
            if (!this.board.getPiecesThatPlayerCanMove(this.playersPieceType).includes(index)) {
                console.log('Selected an opponents piece or an empty cell or a players piece that CANNOT move.')
                return;
            } else {
                console.log('Selected one of their own movable pieces');
                this.currentlySelectedCell = index;
                this.possibleMoveIndexes = this.board.getPossibleMovesForCell(this.currentlySelectedCell);
                return;
            }
        // Handle the rest of the cases, where a piece is already selected
        } else {    
            console.log('piece is already selected');
            // Selected one of the cells the piece can move to
            if (this.possibleMoveIndexes.map(move => move.index).includes(index)) {
                console.log('Selected the spot to move to');
                const actualMove = this.possibleMoveIndexes.find(move => move.index === index);
                console.log(actualMove);
                if (actualMove) {
                    const canMoveAgain = this.board.performMove(this.currentlySelectedCell, actualMove.direction);
                    if (!canMoveAgain) {
                        console.log('we were told we couldnt move again');
                        this.currentlySelectedCell = null;
                        this.possibleMoveIndexes = [];
                        this.inTheMiddleOfAttackingChain = false;
                    } else {
                        console.log('we were told we COULD move again');
                        this.inTheMiddleOfAttackingChain = true;
                        this.currentlySelectedCell = index + getDeltaIndex(actualMove.direction, this.board.getBoardsNumberOfColumns());
                        this.possibleMoveIndexes = this.board.getPossibleMovesForCell(this.currentlySelectedCell);
                    }
                    return;
                }
            // Selected a black piece or an empty cell (that is not a cell you can move to)
            } else if (this.board.getPieceTypeAtIndex(index) !== PieceType.WHITE) {
                console.log('Not a white piece');
                return;
            // Selected an unmovable piece of their own OR the selected piece again
            } else if (!this.board.getPiecesThatPlayerCanMove(this.playersPieceType).includes(index) ||
                        this.currentlySelectedCell === index) {
                this.currentlySelectedCell = null;
                this.possibleMoveIndexes = [];
                console.log('Selected one of their own pieces (non movable)');
                return;
            // Selected another piece that could be moved
            } else if (this.board.getPiecesThatPlayerCanMove(this.playersPieceType).includes(index)) {
                this.currentlySelectedCell = index;
                this.possibleMoveIndexes = this.board.getPossibleMovesForCell(this.currentlySelectedCell);
                console.log('Selected another movable piece');
                return;
            }
        }
    }

    public getHandlerState(): { selectedCell: number | null, possibleMoves: Move[], attackingChain: boolean } {
        return { selectedCell: this.currentlySelectedCell, possibleMoves: this.possibleMoveIndexes, attackingChain: this.inTheMiddleOfAttackingChain };
    }


}