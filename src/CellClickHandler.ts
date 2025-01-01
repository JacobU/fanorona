import Board from './Board.js';
import { PieceType, Turn, Move, getDeltaIndex, AttackType, Direction } from './types.js';

export default class CellClickHandler {
    private board: Board;
    private currentlySelectedCell: null | number = null;
    private playersPieceType: PieceType;
    private possibleMoveIndexes: Move[] = [];
    private inTheMiddleOfAttackingChain: boolean = false;
    private isSelectingAttackOrWithdraw: boolean = false;
    private approachOrWithdrawPieces: number[] | null = null;
    private moveDirectionBeforeApproachWithdrawSelection: Direction | null = null;
    private approachOrWithdrawMoveIndex: number | null = null;

    constructor(board: Board) {
        this.board = board;
        this.playersPieceType = PieceType.WHITE; // Default to white until we make it available to play as black
    }

    handleCellClick(index: number): boolean {
        let performedMove: boolean = false;
        // This contains all the early returns. We early return (i.e. the click does nothing) when either:
        // 1. It is not the players turn
        // 2. There is no selected piece and the player tries to select anything other than a piece that can be moved 
        // 3. There is a selected piece and the click is on an opponents piece or an empty cell that is not a 
        //    possible move (given that you are not in the middle of selecting an approach/withdraw)
        // 4. The player is in the middle of an attacking chain and clicks on anything besides a possible 
        //    move (given that you are not in the middle of selecting an approach/withdraw)
        // 5. The player is in the middle of choosing whether to attack or withdraw and clicks on anything besides those two indexes
        console.log('index is: %d', index);
        console.log('which cell is selected: %d', this.currentlySelectedCell);
        console.log('are we selecting A/W: %s', this.isSelectingAttackOrWithdraw);
        if (this.isSelectingAttackOrWithdraw) {
            console.log('approach: %d, withdraw: %d', this.approachOrWithdrawPieces![0], this.approachOrWithdrawPieces![1]);
        }
        
        if (this.board.getTurn() !== Turn.WHITE 
            || (this.currentlySelectedCell === null && !this.board.getPiecesThatPlayerCanMove(this.playersPieceType).includes(index))
            || (this.currentlySelectedCell !== null && !this.isSelectingAttackOrWithdraw &&
                ((!this.possibleMoveIndexes.map(move => move.index).includes(index) && this.board.getPieceTypeAtIndex(index) === PieceType.EMPTY) 
                    || this.board.getPieceTypeAtIndex(index) === PieceType.BLACK))
            || ((this.inTheMiddleOfAttackingChain && this.currentlySelectedCell && !this.isSelectingAttackOrWithdraw) && !this.possibleMoveIndexes.map(move => move.index).includes(index))
            || (this.isSelectingAttackOrWithdraw && !this.approachOrWithdrawPieces?.includes(index))
        ) 
        {
            console.log('early return');
            return false;
        }

        console.log(this.isSelectingAttackOrWithdraw);
        // Handle the case where we are selecting which piece to attack during a move (approach vs withdraw)
        if (this.isSelectingAttackOrWithdraw) {
            console.log('reached the a/w section');
            if (this.approachOrWithdrawPieces![0] === index) {
                this.board.setAttackOrWithdraw(AttackType.APPROACH);
            } else {
                this.board.setAttackOrWithdraw(AttackType.WITHDRAW);
            }
            const canMoveAgain = this.board.performMove(this.currentlySelectedCell!, this.moveDirectionBeforeApproachWithdrawSelection!);
            const newSelectedCell = this.currentlySelectedCell! + getDeltaIndex(this.moveDirectionBeforeApproachWithdrawSelection!, this.board.getBoardsNumberOfColumns());
            this.updateOnPieceMove(newSelectedCell, canMoveAgain);
            performedMove = true;
            this.approachOrWithdrawMoveIndex = null;
            this.isSelectingAttackOrWithdraw = false;
            this.approachOrWithdrawPieces = null;

        // Handle the cases when you are in the middle of a turn
        } else if (this.inTheMiddleOfAttackingChain && this.currentlySelectedCell) {
            const actualMove = this.possibleMoveIndexes.find(move => move.index === index)!;
            const isMoveAttackAndWithdraw = this.board.willMoveAttackAndWithdraw(this.currentlySelectedCell, actualMove.direction);
            if (isMoveAttackAndWithdraw) {
                this.moveDirectionBeforeApproachWithdrawSelection = actualMove.direction;
                this.updateOnApproachAndWithdraw(actualMove, index);
            } else {
                const canMoveAgain = this.board.performMove(this.currentlySelectedCell, actualMove.direction);
                this.updateOnPieceMove(index, canMoveAgain);
                performedMove = true;
            }
        // Handle all cases where no piece is currently selected            
        } else if (this.currentlySelectedCell === null) {
            // Because of the early returns above, this piece should always be a valid piece to select
            this.selectCell(index);

        // Handle where a piece is already selected
        } else {    
            // Selected one of the cells the piece can move to
            if (this.possibleMoveIndexes.map(move => move.index).includes(index)) {
                const actualMove = this.possibleMoveIndexes.find(move => move.index === index)!;
                const isMoveAttackAndWithdraw = this.board.willMoveAttackAndWithdraw(this.currentlySelectedCell, actualMove.direction);
                if (isMoveAttackAndWithdraw) {
                    this.moveDirectionBeforeApproachWithdrawSelection = actualMove.direction;
                    this.updateOnApproachAndWithdraw(actualMove, index);
                } else {
                    const canMoveAgain = this.board.performMove(this.currentlySelectedCell, actualMove.direction);
                    this.updateOnPieceMove(index, canMoveAgain);
                    performedMove = true;
                }

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

    private updateOnApproachAndWithdraw(actualMove: Move, selectedIndex: number): void {
        console.log('set A/W to true');
        this.isSelectingAttackOrWithdraw = true;
        const deltaIndex = getDeltaIndex(actualMove.direction, this.board.getBoardsNumberOfColumns());
        const approachIndex: number = this.currentlySelectedCell! + (2 * deltaIndex);
        const withdrawIndex: number = this.currentlySelectedCell! - deltaIndex;
        this.approachOrWithdrawMoveIndex = selectedIndex;
        this.approachOrWithdrawPieces = [approachIndex, withdrawIndex];
    }
 
    public getHandlerState(): { selectedCell: number | null, possibleMoves: Move[], attackingChain: boolean, approachOrWithdrawPieces: number[] | null, approachOrWithdrawMoveIndex: number | null } {
        return { 
            selectedCell: this.currentlySelectedCell, 
            possibleMoves: this.possibleMoveIndexes, 
            attackingChain: this.inTheMiddleOfAttackingChain, 
            approachOrWithdrawPieces: this.approachOrWithdrawPieces,
            approachOrWithdrawMoveIndex: this.approachOrWithdrawMoveIndex,
        };
    }
}