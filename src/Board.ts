import Cell  from './Cell.ts';
import { PieceType, getDeltaIndex, getOppositePieceType, getOppositeDirection, Direction, Move, AttackType, CellType, Connection, Neighbour } from './types.js';
import chalk from 'chalk';

export default class Board {
    private rows: number;
    private columns: number;
    private board: Cell[];

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

    /**
     * 
     * @param pieceType whose turn it is, either PieceType.BLACK or PieceType.WHITE.
     * @returns a list of cells which have pieces that can attack.
     */
    public getPiecesThatCanAttack(pieceType: PieceType): Cell[] {
        return this.board.filter(cell => cell.getPieceType() === pieceType && this.canPieceAttack(cell.getIndex()));
    }

    /**
     * If there are any pieces that can attack, one of these pieces must attack, so only these will be returned. 
     * Otherwise, any pieces which have empty neighbours can be moved, so they will be returned.
     * @param pieceType whose turn it is, either PieceType.BLACK or PieceType.WHITE.
     * @returns a list of the pieces that the current player can move.
     */
    public getPiecesThatCanMove(pieceType: PieceType): Cell[] {
        const attackingPieces: Cell[] = this.getPiecesThatCanAttack(pieceType);
        if (! attackingPieces || attackingPieces.length === 0) {
            return attackingPieces;
        } else {
            return this.getPiecesThatCanMove
        }
    }

    /**
     * Returns true if a piece has an empty
     * @param index 
     */
    private doesPieceHaveEmptyNeighbours(index: number): boolean {
        // TODO
        
        // Early return if we have accidentally asked to move a cell that is empty
        if (this.getCell(index).getPieceType() === PieceType.EMPTY) {
            return false;
        }
        return this.board.map()
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
        const canApproach: boolean = possibleMoves.map(move => this.willMoveApproach(move.index, attackingPieceType, move.direction)).some(Boolean);
        const canWithdraw: boolean = possibleMoves.map(move => this.willMoveWithdraw(index, attackingPieceType, move.direction)).some(Boolean);
        return (canApproach || canWithdraw);
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

    public getCell(index: number): Cell {
        return this.board[index];
    }

    private setCell(index: number, pieceType: PieceType): void {
        this.getCell(index).setPieceType(pieceType);
    }

    public movePiece(piece: PieceType, index: number, direction: Direction): void {
        // TODO some move validation
        const newIndex = index + getDeltaIndex(direction, this.columns);
        
        if (this.getCell(newIndex).getPieceType() !== PieceType.EMPTY) {
            throw new Error('The place the piece is being moved is occupied');
        }

        this.setCell(newIndex, piece);
        this.getCell(index).removePiece();
    }

    private removeAttackedPieces(piece: PieceType, direction: Direction, attackType: AttackType): void {
        // TODO
    }

    private performMove(piece: PieceType, index: number, direction: Direction): void {
        if (!(direction in Direction)) {
            throw new Error('Invalid direction');
        }

        const willWithdraw = this.willMoveWithdraw(piece, index, direction);
        const willApproach = this.willMoveApproach(piece, index, direction);

        let attackType: AttackType = AttackType.NONE;
        if (willWithdraw || willApproach) {
            // TODO get input
            attackType = AttackType.APPROACH;
        }

        this.removeAttackedPieces(piece, direction, attackType);
        this.movePiece(piece, index, direction);
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

    public getCellNeighbours(index: number): Neighbour[] {
        return this.getNeighbours(index, true);
    }

    private getPiecesNeighbours(index: number): Neighbour[] {
        return this.getNeighbours(index, false);
    }

    private isPositionOnBoard(index: number): boolean {
        return index >= 0 && index < this.rows * this.columns;
    }


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

    public resetBoard(): void {
        this.board = this.initializeBoard();
    }
}