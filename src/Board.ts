import { Dir } from 'fs';
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
            board.push(new Cell(i, cellType, pieceType, this.getCellConnections(i, cellType)));
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
     * @param {number} moveIndex the index where the piece moved will end up.
     * @param {PieceType} attackPieceType the type of the piece being moved.
     * @param {Direction} attackDirection the direction the piece was moved in order to get to the moveIndex.
     * @returns {boolean} whether the move will approach an opponents piece.
     */
    private willMoveApproach(moveIndex: number, attackPieceType: PieceType, attackDirection: Direction): boolean {
        const possibleAttackedPieceIndex: number = moveIndex + getDeltaIndex(attackDirection, this.columns);
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

        // TODO Fix this up, index should be using the index it will be. Also need to determine if we should be using a MoveType in the method's parameters to avoid confusion.
        const willWithdraw = this.willMoveWithdraw(index, pieceType, direction);
        const willApproach = this.willMoveApproach(index, pieceType, direction);

        let attackType: AttackType = AttackType.NONE;
        // Deal with whether player wants to approach or withdraw
        if (willWithdraw && willApproach) {
            // TODO get input
            attackType = AttackType.APPROACH;
        }

        this.removeAttackedPieces(pieceType, direction, attackType);
        // Set the new index after moving
        index = this.movePiece(pieceType, index, direction);

        return this.canPlayerMoveAgain(index, pieceType, direction);
    }

    public getCellNeighbours(index: number): Neighbour[] {
        return this.getNeighbours(index, true);
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
        const possibleMoves: Move[] = this.getCell(index).getPossibleMoves(this.getCellNeighbours(index));
        const attackingPieceType = this.getCell(index).getPieceType();
        const canApproach: boolean = possibleMoves.some(move => this.willMoveApproach(move.index, attackingPieceType, move.direction));
        const canWithdraw: boolean = possibleMoves.some(move => this.willMoveWithdraw(index, attackingPieceType, move.direction));
        return (canApproach || canWithdraw);
    }

    private canPlayerMoveAgain(currentIndex: number, pieceType: PieceType, previousAttackdirection: Direction): boolean {
        // We check that there is at least a single neighbour of the current index of the piece that meet all of the following criteria:
        // 1) EMPTY, 2) not the original index of the piece in this turn, 3) in a different direction the last directon's move,
        // and 4) are attacking moves.
        return this.getCell(currentIndex)
            .getPossibleMoves(this.getCellNeighbours(currentIndex)) // possible moves already eliminate all EMPTY cells
            .some(move => 
                move.index !== this.originalCellIndexForCurrentTurn &&
                move.direction !== previousAttackdirection &&
                (this.willMoveApproach(move.index, pieceType, move.direction) || this.willMoveWithdraw(currentIndex, pieceType, move.direction)));
    }

    private removeAttackedPieces(piece: PieceType, direction: Direction, attackType: AttackType): void {
        // TODO
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

    private getCellConnections(index: number, cellType: CellType): Connection[] {
        let connections: Connection[] = [];
    
        const isTopEdge = index < this.columns;
        const isLeftEdge = index % this.columns === 0;
        const isRightEdge = (index + 1) % this.columns === 0;
        const isBottomEdge = index >= (this.rows - 1) * this.columns;
    
        if (cellType === CellType.STRONG) {
            let directionIndex = 0;
            for (let i = -1; i < 2; i++) {
                for (let j = -1; j < 2; j++) {
                    // Skip the current cell itself
                    if (i === 0 && j === 0) continue;
    
                    const direction = Direction.UPLEFT + directionIndex;
                    const newIndex = index + j + i * this.columns;
    
                    // Skip invalid directions based on edge constraints
                    if ((isTopEdge && direction <= Direction.UPRIGHT) ||  // UP directions
                        (isLeftEdge && (direction === Direction.UPLEFT || direction === Direction.LEFT || direction === Direction.DOWNLEFT)) ||  // LEFT directions
                        (isRightEdge && (direction === Direction.UPRIGHT || direction === Direction.RIGHT || direction === Direction.DOWNRIGHT)) ||  // RIGHT directions
                        (isBottomEdge && direction >= Direction.DOWNLEFT)) {  // DOWN directions
                        directionIndex++;
                        continue;
                    }
    
                    connections.push({ index: newIndex, direction });
                    directionIndex++;
                }
            }
        } else {
            // Handle weak connections with edge constraints
            if (!isTopEdge) {
                connections.push({ index: index - this.columns, direction: Direction.UP });
            }
            if (!isLeftEdge) {
                connections.push({ index: index - 1, direction: Direction.LEFT });
            }
            if (!isRightEdge) {
                connections.push({ index: index + 1, direction: Direction.RIGHT });
            }
            if (!isBottomEdge) {
                connections.push({ index: index + this.columns, direction: Direction.DOWN });
            }
        }
        return connections;
    }

    public getCell(index: number): Cell {
        return this.board[index];
    }

    private setCell(index: number, pieceType: PieceType): void {
        this.getCell(index).setPieceType(pieceType);
    }

}