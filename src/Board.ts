import Cell  from './Cell.ts';
import { PieceType, getDeltaIndex, getOppositePieceType, getOppositeDirection, Direction, Move, AttackType, CellType, Connection, Neighbour } from './types.js';
import chalk from 'chalk';

export default class Board {
    private rows: number;
    private columns: number;
    private board: Cell[];

    private originalCellIndexForCurrentTurn: null | number; 

    constructor(rows: number = 5, columns: number = 9, startingPieces?: string) {
        if (startingPieces) {
            if (rows * columns !== startingPieces.length) {
                throw new Error('The number starting positions does not match the board size.');
            }
            this.rows = rows;
            this.columns = columns;
            this.board = this.initializeBoard(startingPieces);
        } else {
            this.rows = rows;
            this.columns = columns;
            this.board = this.initializeBoard();
        }
        this.originalCellIndexForCurrentTurn = null;
    }

    // Initialize the board with empty cells
    private initializeBoard(startingPiecePositions: string = '222222222222222222212102121111111111111111111'): Cell[] {
        const board: Cell[] = [];
        for (let i = 0; i < this.rows * this.columns; i++) {
            const pieceType: PieceType = parseInt(startingPiecePositions[i], 10) as PieceType;
            const cellType = i % 2 == 0 ? CellType.STRONG : CellType.WEAK;
            board.push(new Cell(i, cellType, pieceType, this.rows, this.columns));
        }
        return board;
    }

    /**
     * The board is recreated, with all the pieces in their original positions.
     */
    public resetBoard(): void {
        this.board = this.initializeBoard();
    }

    /**
     * The board is displayed on the console with colours and in rows and columns.
     */
    public displayBoard(): void {
        let displayString: string = '';
        for (let i = 0; i < this.columns * this.rows; i++) {
            switch (this.getCell(i).getPieceType()) {
                case PieceType.BLACK:
                    displayString += chalk.red('B');
                    break;
                case PieceType.WHITE:
                    displayString += chalk.white('W');
                    break;
                case PieceType.EMPTY:
                    displayString += chalk.green('0');
                    break;
            }
            if ((i + 1) % this.columns == 0) {
                console.log(displayString);
                displayString = '';
            }
        }
    }

    /**
     * @returns the current piece positions as a single string, with EMPTY cells as 0s, 
     * WHITE pieces as 1s and BLACK pieces as 2s.
     */
    public getBoardPositionsAsString(): string {
        return this.board
            .map(cell => {
                switch (cell.getPieceType()) {
                    case PieceType.WHITE:
                        return '1';
                    case PieceType.BLACK:
                        return '2';
                    case PieceType.EMPTY:
                        return '0';
                    default:
                        return '.';
                }
            })
            .join('');
    }

    /**
     * If there are any pieces that can attack, one of these pieces must attack, so only these will be returned. 
     * Otherwise, any pieces which have empty neighbours can be moved, so they will be returned.
     * @param pieceType whose turn it is, either PieceType.BLACK or PieceType.WHITE.
     * @returns a list of the pieces that the current player can move.
     */
    public getPiecesThatPlayerCanMove(pieceType: PieceType): Cell[] {
        const attackingPieces: Cell[] = this.board.filter(cell => cell.isPieceType(pieceType) && this.canPieceAttack(cell.getIndex()));
        if (! attackingPieces || attackingPieces.length === 0) {
            return attackingPieces;
        } else {
            return this.board.filter(cell => cell.isPieceType(pieceType) && this.doesPieceHaveEmptyNeighbours(cell.getIndex()));
        }
    }

    /**
     * Perform a single move (which may be just one of several in a turn). We should set the original move index,
     * if this is the first move in the players turn, calculate whether the move will APPROACH or WITHDRAW
     * from an opponents piece, remove the pieces if needed, make the move, and then determine if 
     * another move can be made.
     * @param {number} index the index of the piece to move. 
     * @param {PieceType} piece the type of piece to move.
     * @param {Direction} direction the direction of the piece to move.
     * @returns {boolean} whether the player can move again.
     */
    public performMove(index: number, pieceType: PieceType, direction: Direction): boolean {
        // TODO
        if (!(direction in Direction)) {
            throw new Error('Invalid direction');
        }
        // If this is the first move in the players turn, set the original cell index for the turn.
        if (this.originalCellIndexForCurrentTurn === null) {
            this.originalCellIndexForCurrentTurn = index;
        }

        const willWithdraw = this.willMoveWithdraw(index, pieceType, direction);
        const willApproach = this.willMoveApproach(index, pieceType, direction);

        let attackType: AttackType = AttackType.NONE;
        // Deal with whether player wants to approach or withdraw
        if (willWithdraw && willApproach) {
            // TODO get input
            attackType = AttackType.APPROACH;
        }

        // Set the new index after moving
        index = this.movePiece(pieceType, index, direction);
        this.removeAttackedPieces(index, pieceType, direction, attackType);

        return this.canPlayerMoveAgain(index, pieceType, direction);
    }

    /**
     * Returns the possible moves for this cell. If there are only paika moves, those can all be returned. 
     * Otherwise if there are any attacking moves, only those moves are returned.
     * @param {number} index the index of the cell we want the moves from.
     * @returns {Move[]} an array of possible moves.
     */
    public getCellPossibleMoves(index: number): Move[] {
        const pieceType = this.getCell(index).getPieceType();
        let moves: Move[] = this.getCell(index).getEmptyNeighbouringCellsAsMoves(this.getCellNeighbours(index));
        // If any of the moves are attacking, just return those. Otherwise just return the complete list of moves.
        if (moves.some(move => this.willMoveApproach(index, pieceType, move.direction) || this.willMoveWithdraw(index, pieceType, move.direction))) {
            return moves.filter(move => this.willMoveApproach(index, pieceType, move.direction) || this.willMoveWithdraw(index, pieceType, move.direction));
        }
        return moves;
    }

    public getCellNeighbours(index: number): Neighbour[] {
        return this.getNeighbours(index, true);
    }

    /**
     * @param {number} currentMove the index where the piece is before the move.
     * @param {PieceType} attackPieceType the type of the piece being moved.
     * @param {Direction} attackDirection the direction the piece was moved in order to get to the moveIndex.
     * @returns {boolean} whether the move will approach an opponents piece.
     */
    private willMoveApproach(currentIndex: number, attackPieceType: PieceType, attackDirection: Direction): boolean {
        const possibleAttackedPieceIndex: number = currentIndex + 2 * getDeltaIndex(attackDirection, this.columns);
        if (this.isPositionOnBoard(possibleAttackedPieceIndex) && attackPieceType === getOppositePieceType(this.getCell(possibleAttackedPieceIndex).getPieceType())) {
            return true;
        }
        return false;
    }

    /**
     * @param {number} currentIndex the current index of the piece to be moved. 
     * @param {PieceType} attackPieceType the type of piece being moved.
     * @param {Direction} moveDirection the direction the piece will be moved in.
     * @returns {boolean} whether moving this piece will cause an opponents piece to be "withdrawn" from.
     */
    private willMoveWithdraw(currentIndex: number, attackPieceType: PieceType, moveDirection: Direction): boolean {
        const possibleAttackedPieceIndex: number = currentIndex + getDeltaIndex(getOppositeDirection(moveDirection), this.columns);
        if (this.isPositionOnBoard(possibleAttackedPieceIndex) && attackPieceType === getOppositePieceType(this.getCell(possibleAttackedPieceIndex).getPieceType())) {
            return true;
        }
        return false;
    }

    /**
     * Returns true if a piece has an empty neighbour (which it could move to)
     * @param {number} index the index of the piece/cell
     */
    private doesPieceHaveEmptyNeighbours(index: number): boolean {
        // TODO might be good to store the results so you dont have to calculate them again
        // Early return if we have accidentally asked to move a cell that is empty
        if (this.getCell(index).getPieceType() === PieceType.EMPTY) {
            return false;
        }
        return this.getCellNeighbours(index).some(cell => cell.pieceType === PieceType.EMPTY);
    }

    /**
     * @param index the piece to check.
     * @returns {boolean} whether this piece can attack any opponents pieces.
     */
    private canPieceAttack(index: number): boolean {
        // Early return if we have accidentally asked to move a cell that is empty
        if (this.getCell(index).getPieceType() === PieceType.EMPTY) {
            return false;
        }
        const possibleMoves: Move[] = this.getCell(index).getEmptyNeighbouringCellsAsMoves(this.getCellNeighbours(index));
        const attackingPieceType = this.getCell(index).getPieceType();
        const canApproach: boolean = possibleMoves.some(move => this.willMoveApproach(move.index, attackingPieceType, move.direction));
        const canWithdraw: boolean = possibleMoves.some(move => this.willMoveWithdraw(index, attackingPieceType, move.direction));
        return (canApproach || canWithdraw);
    }

    /**
     * Determines whether the player can move again. This move must be attacking and neither in the same direction or reaching the same spot as the piece
     * has previously been in this turn. Assumes a move has already been made in the players turn.
     * @param currentIndex the current index of the piece.
     * @param pieceType the piece type of the player.
     * @param previousAttackdirection the direction the last move in the turn attacked.
     * @returns true if the player can play another move.
     */
    private canPlayerMoveAgain(currentIndex: number, pieceType: PieceType, previousAttackdirection: Direction): boolean {
        // We check that there is at least a single neighbour of the current index of the piece that meet all of the following criteria:
        // 1) EMPTY, 2) not the original index of the piece in this turn, 3) in a different direction the last directon's move,
        // and 4) are attacking moves.
        return this.getCell(currentIndex)
            .getEmptyNeighbouringCellsAsMoves(this.getCellNeighbours(currentIndex)) // possible moves already eliminate all EMPTY cells
            .some(move => 
                move.index !== this.originalCellIndexForCurrentTurn &&
                move.direction !== previousAttackdirection &&
                (this.willMoveApproach(move.index, pieceType, move.direction) || this.willMoveWithdraw(currentIndex, pieceType, move.direction)));
    }

    /**
     * Removes at least one of the opponents pieces including all those in the same direction of the WITHDRAW or APPROACH until
     * there is 1) a cell that doesnt contain the opponents piece type or if 2) the edge of the board has been reached. 
     * @param currentIndex the current index of the piece, that is after the move has been made.
     * @param pieceType the type of piece that made the move.
     * @param direction the direction of the attacking piece.
     * @param attackType whether the attack was a WITHDRAW or APPROACH.
     */
    private removeAttackedPieces(currentIndex: number, pieceType: PieceType, direction: Direction, attackType: AttackType): void {
        // In this function, the default move is considered APPROACH. If it is a WITHDRAW, we set the direction to the opposite, and first return
        // the piece index to where it was before the move. Then we can continue "as if" the move was an APPROACH, and it should work the same.
        let deltaIndexFromDirection: number = getDeltaIndex(direction, this.columns);
        if (attackType === AttackType.WITHDRAW) {
            deltaIndexFromDirection *= -1;
            // If we are withdrawing, we first need to return to the index where the piece was moved from.
            currentIndex += deltaIndexFromDirection;
        }
        currentIndex += deltaIndexFromDirection;
        while (this.isPositionOnBoard(currentIndex) && this.getCell(currentIndex).getPieceType() === getOppositePieceType(pieceType)) {
            this.getCell(currentIndex).removePiece();
            currentIndex += deltaIndexFromDirection;
        }
    }

    /**
     * Move the piece (note that no other calculations about opponent pieces destroyed are done).
     * @param {PieceType} piece the type of piece that has been moved (we use this to validate we are not moving an empty cell).
     * @param {number} index the index of the piece being moved.
     * @param {Direction} direction the direction to move the piece.
     * @returns {number} the new index of the piece.
     */
    private movePiece(piece: PieceType, index: number, direction: Direction): number {
        // TODO some move validation
        const newIndex = index + getDeltaIndex(direction, this.columns);
        
        if (this.getCell(newIndex).getPieceType() !== PieceType.EMPTY) {
            throw new Error('The place the piece is being moved is occupied');
        }

        this.setCell(newIndex, piece);
        this.getCell(index).removePiece();
        return newIndex;
    }

    private getNeighbours(index: number, includeEmptyCells: boolean): Neighbour[] {
        const cellNeighbours: Neighbour[] = [];

        const connections: Connection[] = this.getCell(index).getCellConnections();
        for (const connection of connections) {
            const neighborCell = this.getCell(connection.index);
            const isEmpty = neighborCell.getPieceType() === PieceType.EMPTY;

            if (includeEmptyCells || (!includeEmptyCells && !isEmpty)) {
                cellNeighbours.push({
                    index: connection.index,
                    pieceType: neighborCell.getPieceType(),
                    direction: connection.direction,
                });
            }
        }

        return cellNeighbours;
    }

    private getPiecesNeighbours(index: number): Neighbour[] {
        return this.getNeighbours(index, false);
    }

    private isPositionOnBoard(index: number): boolean {
        return index >= 0 && index < this.rows * this.columns;
    }

    public getCell(index: number): Cell {
        return this.board[index];
    }

    private setCell(index: number, pieceType: PieceType): void {
        this.getCell(index).setPieceType(pieceType);
    }

}