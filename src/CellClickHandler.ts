import Board from './Board.js';
import { PieceType, Turn, Move } from './types.js';

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

    handleCellClick(index: number): boolean {
        let performedMove: boolean = false;
        // This contains all the early returns. We early return (i.e. the click does nothing) when either:
        // 1. It is not the players turn
        // 2. There is no selected piece and the player tries to select anything other than a piece that can be moved 
        // 3. There is a selected piece and the click is on an opponents piece or an empty cell that is not a possible move
        // 4. The player is in the middle of an attacking chain and clicks on anything besides a possible move
        if (this.board.getTurn() !== Turn.WHITE || 
            (this.currentlySelectedCell === null && !this.board.getPiecesThatPlayerCanMove(this.playersPieceType).includes(index)) ||
            (this.currentlySelectedCell !== null && 
                (!this.possibleMoveIndexes.map(move => move.index).includes(index) && this.board.getPieceTypeAtIndex(index) === PieceType.EMPTY) 
                    || this.board.getPieceTypeAtIndex(index) === PieceType.BLACK) ||
            ((this.inTheMiddleOfAttackingChain && this.currentlySelectedCell) && !this.possibleMoveIndexes.map(move => move.index).includes(index))) {
            return false;
        }

        // Handle the cases when you are in the middle of a turn
        if (this.inTheMiddleOfAttackingChain && this.currentlySelectedCell) {
            const actualMove = this.possibleMoveIndexes.find(move => move.index === index)!;
            const canMoveAgain = this.board.performMove(this.currentlySelectedCell, actualMove.direction);
            this.updateOnPieceMove(index, canMoveAgain);
            performedMove = true;

        // Handle all cases where no piece is currently selected            
        } else if (this.currentlySelectedCell === null) {
            // Because of the early returns above, this piece should always be a valid piece to select
            this.selectCell(index);

        // Handle where a piece is already selected
        } else {    
            // Selected one of the cells the piece can move to
            if (this.possibleMoveIndexes.map(move => move.index).includes(index)) {
                const actualMove = this.possibleMoveIndexes.find(move => move.index === index)!;
                const canMoveAgain = this.board.performMove(this.currentlySelectedCell, actualMove.direction);
                this.updateOnPieceMove(index, canMoveAgain);
                performedMove = true;

            // Selected an unmovable piece of their own OR the selected piece again
            } else if (!this.board.getPiecesThatPlayerCanMove(this.playersPieceType).includes(index) ||
                        this.currentlySelectedCell === index) {
                this.deselectCell();

            // Selected another piece that could be moved
            } else if (this.board.getPiecesThatPlayerCanMove(this.playersPieceType).includes(index)) {
                this.selectCell(index);
            }
        }
        return performedMove;
    }

    private deselectCell(): void {
        this.currentlySelectedCell = null;
        this.possibleMoveIndexes = [];
    }

    private selectCell(index: number): void {
        this.currentlySelectedCell = index;
        this.possibleMoveIndexes = this.board.getPossibleMovesForCell(this.currentlySelectedCell);
    }

    private updateOnPieceMove(index: number, canMoveAgain: boolean): void {
        if (canMoveAgain) {
            this.inTheMiddleOfAttackingChain = true;
            this.selectCell(index);
        } else {
            this.deselectCell();
            this.inTheMiddleOfAttackingChain = false;
        }
    }
 
    public getHandlerState(): { selectedCell: number | null, possibleMoves: Move[], attackingChain: boolean } {
        return { selectedCell: this.currentlySelectedCell, possibleMoves: this.possibleMoveIndexes, attackingChain: this.inTheMiddleOfAttackingChain };
    }
}