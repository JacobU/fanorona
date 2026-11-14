import Board from './Board.js';
import { PieceType, Turn, Move, getDeltaIndex, AttackType, Direction, getOppositePieceType } from './types.js';

export default class CellClickHandler {
    private board: Board;
    private currentlySelectedCell: null | number = null;
    // The colours the people at this screen are allowed to move
    private controlledColours: PieceType[];
    private possibleMoveIndexes: Move[] = [];
    private inTheMiddleOfAttackingChain: boolean = false;
    private isSelectingAttackOrWithdraw: boolean = false;
    private approachOrWithdrawPieces: number[] | null = null;
    private moveDirectionBeforeApproachWithdrawSelection: Direction | null = null;
    private approachOrWithdrawMoveIndex: number | null = null;

    constructor(board: Board) {
        this.board = board;
        this.controlledColours = [PieceType.WHITE]; // Default to white until we make it available to play as black
    }

    /**
     * Sets which colours clicks can move: [WHITE, BLACK] for two players on one screen, or just the human's colour
     * when playing the bot (or nothing while no game is being played).
     */
    public setControlledColours(colours: PieceType[]): void {
        this.controlledColours = [...colours];
    }

    /**
     * Forgets any selected piece, capture chain or pending approach/withdraw choice (used when restarting).
     * The board itself is not touched.
     */
    public reset(): void {
        this.deselectCell();
        this.inTheMiddleOfAttackingChain = false;
        this.isSelectingAttackOrWithdraw = false;
        this.approachOrWithdrawPieces = null;
        this.moveDirectionBeforeApproachWithdrawSelection = null;
        this.approachOrWithdrawMoveIndex = null;
    }

    /**
     * @returns the colour whose turn it is (the player clicking is playing this colour).
     */
    private turnColour(): PieceType {
        return this.board.getTurn() === Turn.WHITE ? PieceType.WHITE : PieceType.BLACK;
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
        const playersPieceType = this.turnColour();
        const isPossibleMove = this.possibleMoveIndexes.map(move => move.index).includes(index);
        const isNotMyTurn = !this.controlledColours.includes(playersPieceType);
        const isSelectingNonMovablePiece = this.currentlySelectedCell === null
            && !this.board.getPiecesThatPlayerCanMove(playersPieceType).includes(index);
        const isInvalidMoveWhilePieceSelected = this.currentlySelectedCell !== null
            && !this.isSelectingAttackOrWithdraw
            && ((!isPossibleMove && this.board.getPieceTypeAtIndex(index) === PieceType.EMPTY)
                || this.board.getPieceTypeAtIndex(index) === getOppositePieceType(playersPieceType));
        const isLockedInChainClickingNonMove = this.inTheMiddleOfAttackingChain
            && this.currentlySelectedCell !== null
            && !this.isSelectingAttackOrWithdraw
            && !isPossibleMove;
        const isChoosingAttackTypeClickingWrong = this.isSelectingAttackOrWithdraw
            && !this.approachOrWithdrawPieces?.includes(index);
        if (isNotMyTurn || isSelectingNonMovablePiece || isInvalidMoveWhilePieceSelected
            || isLockedInChainClickingNonMove || isChoosingAttackTypeClickingWrong) {
            return false;
        }

        // Handle the case where we are selecting which piece to attack during a move (approach vs withdraw)
        if (this.isSelectingAttackOrWithdraw) {
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
            performedMove = this.handleAttemptedMove(index);
        // Handle all cases where no piece is currently selected            
        } else if (this.currentlySelectedCell === null) {
            // Because of the early returns above, this piece should always be a valid piece to select
            this.selectCell(index);

        // Handle where a piece is already selected
        } else {    
            // Selected one of the cells the piece can move to
            if (this.possibleMoveIndexes.map(move => move.index).includes(index)) {
                performedMove = this.handleAttemptedMove(index);

            // Selected an unmovable piece of their own OR the selected piece again
            } else if (!this.board.getPiecesThatPlayerCanMove(playersPieceType).includes(index) ||
                        this.currentlySelectedCell === index) {
                this.deselectCell();

            // Selected another piece that could be moved
            } else if (this.board.getPiecesThatPlayerCanMove(playersPieceType).includes(index)) {
                this.selectCell(index);
            }
        }
        return performedMove;
    }

    /**
     * @returns whether the player is in the middle of a capture chain and can choose to stop (only the first
     * capture of a turn is compulsory).
     */
    public canEndTurn(): boolean {
        return this.controlledColours.includes(this.turnColour()) && this.board.canEndTurn();
    }

    /**
     * Ends the player's turn in the middle of a capture chain. If they were choosing between approach and withdraw,
     * that move is cancelled (it hasn't been played yet) and the turn ends where the piece is.
     * @returns whether the turn was ended.
     */
    public handleEndTurn(): boolean {
        if (!this.canEndTurn()) {
            return false;
        }
        this.isSelectingAttackOrWithdraw = false;
        this.approachOrWithdrawPieces = null;
        this.approachOrWithdrawMoveIndex = null;
        this.moveDirectionBeforeApproachWithdrawSelection = null;
        this.board.endTurn();
        this.deselectCell();
        this.inTheMiddleOfAttackingChain = false;
        return true;
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

    private handleAttemptedMove(index: number): boolean {
        const actualMove = this.possibleMoveIndexes.find(move => move.index === index)!;
        const isMoveAttackAndWithdraw = this.board.willMoveAttackAndWithdraw(this.currentlySelectedCell!, actualMove.direction);
        if (isMoveAttackAndWithdraw) {
            this.moveDirectionBeforeApproachWithdrawSelection = actualMove.direction;
            this.updateOnApproachAndWithdraw(actualMove, index);
            return false;
        } else {
            const canMoveAgain = this.board.performMove(this.currentlySelectedCell!, actualMove.direction);
            this.updateOnPieceMove(index, canMoveAgain);
            return true;
        }
    }

    private updateOnApproachAndWithdraw(actualMove: Move, selectedIndex: number): void {
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