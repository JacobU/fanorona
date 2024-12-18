import { Cell } from './Cell.ts';
import { PieceType, MoveType, Direction, AttackType, StrongIntersectionMoveMap, WeakIntersectionMoveMap, CellType, Connection } from './types.js';
import chalk from 'chalk';

// Define custom types
interface Position {
    row: number;
    col: number;
}

interface Neighbour {
    pieceType: PieceType; // Explicitly use PieceType enum
    direction: Direction; // Explicitly use Direction enum
}

export default class Board {
    private rows: number;
    private columns: number;
    private board: Cell[][];
    #attackedPiece: null | Position = null;

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
    private initializeBoard(startingPiecePositions: string = '222222222222222222212102121111111111111111111'): Cell[][] {
        const board: Cell[][] = [];
        for (let i = 0; i < this.rows; i++) {
            const row: Cell[] = [];
            for (let j = 0; j < this.columns; j++) {
                const index = i * this.columns + j;
                const pieceType: PieceType = parseInt(startingPiecePositions[index], 10) as PieceType;
                const cellType = index % 2 == 0 ? CellType.STRONG : CellType.WEAK;
                row.push(new Cell(index, cellType, pieceType, this.getCellConnections(index, cellType)));
            }
            board.push(row);
        }
        return board;
    }



    private canPieceAttack(index: number): boolean {
        return true;
    }

    private getCellConnections(index: number, cellType: CellType): Connection[] {
        let connections: Connection[] = [];
        if (cellType == CellType.STRONG) {
            let directionIndex = 0;
            for (let i = -1; i < 1; i++) {
                for (let j = -1; j < 1; j++) {
                    connections.push({ index: index + j + i * this.columns, direction: Direction.UPLEFT + directionIndex});
                    directionIndex++;
                }
            }
        } else {
            connections.push({ index: index - this.rows, direction: Direction.UP});
            connections.push({ index: index - 1, direction: Direction.LEFT});
            connections.push({ index: index + 1, direction: Direction.RIGHT});
            connections.push({ index: index + this.rows, direction: Direction.DOWN});
        }
        // This makes sure that we are not adding any cell indexes that are outside of the board
        connections = connections.filter(connection => connection.index >= 0 && connection.index < this.rows * this.columns);
        return connections;
    }

    public getCell(row: number, col: number): Cell {
        return this.board[row][col];
    }

    public getCellByIndex()

    public setCell(row: number, col: number, pieceType: PieceType): void {
        this.board[row][col].setPieceType(pieceType);
    }

    public movePiece(piece: PieceType, position: Position, direction: Direction): void {
        const directionMap = this.getCell(position.row, position.col).getCellMoveMap();

        const movement = directionMap.get(direction);
        let newRow: number;
        let newCol: number;
        if (movement) {
            newRow = position.row + movement?.deltaRow;
            newCol = position.col + movement?.deltaCol;
        } else {
            throw new Error('An invalid direction was used.');
        }
        

        if (this.getCell(newRow, newCol).getPieceType() !== PieceType.EMPTY) {
            throw new Error('The place the piece is being moved is occupied');
        }

        this.setCell(newRow, newCol, piece);
        this.board[position.row][position.col].removePiece();
    }

    private willMoveWithdraw(piece: PieceType, position: Position, direction: Direction): boolean {
        // Implementation placeholder
        return false;
    }

    private willMoveApproach(piece: PieceType, position: Position, direction: Direction): boolean {
        // Implementation placeholder
        return false;
    }

    private removeAttackedPieces(piece: PieceType, direction: Direction, attackType: AttackType): void {
        // Implementation placeholder
    }

    public performMove(piece: PieceType, position: Position, direction: Direction): void {
        if (!(direction in Direction)) {
            throw new Error('Invalid direction');
        }

        const willWithdraw = this.willMoveWithdraw(piece, position, direction);
        const willApproach = this.willMoveApproach(piece, position, direction);

        let attackType: AttackType = AttackType.NONE;
        if (willWithdraw || willApproach) {
            attackType = AttackType.APPROACH;
        }

        this.removeAttackedPieces(piece, direction, attackType);
        this.movePiece(piece, position, direction);
    }

    public getNeighbours(row: number, col: number, includeEmptyCells: boolean): Neighbour[] {
        const cellNeighbours: Neighbour[] = [];

        const directionMap: Map<Direction, { deltaRow: number; deltaCol: number }> = this.board[row][col].getCellMoveMap();
        for (const [direction, { deltaRow, deltaCol }] of directionMap) {
            const neighborRow = row + deltaRow;
            const neighborCol = col + deltaCol;

            if (this.isPositionOnBoard(neighborRow, neighborCol)) {
                const neighborCell = this.board[neighborRow][neighborCol];
                const isEmpty = neighborCell.getPieceType() === PieceType.EMPTY;

                if (includeEmptyCells || (!includeEmptyCells && !isEmpty)) {
                    cellNeighbours.push({
                        pieceType: neighborCell.getPieceType(),
                        direction,
                    });
                }
            }
        }

        return cellNeighbours;
    }

    public getCellNeighbours(row: number, col: number): Neighbour[] {
        return this.getNeighbours(row, col, true);
    }

    public getPiecesNeighbours(row: number, col: number): Neighbour[] {
        return this.getNeighbours(row, col, false);
    }

    private isPositionOnBoard(row: number, col: number): boolean {
        return row >= 0 && row < this.rows && col >= 0 && col < this.columns;
    }

    public displayBoard(): void {
        for (const row of this.board) {
            const rowDisplay = row
                .map(cell => {
                    switch (cell.getPieceType()) {
                        case PieceType.BLACK:
                            return chalk.red('B');
                        case PieceType.WHITE:
                            return chalk.white('W');
                        case PieceType.EMPTY:
                            return chalk.green('0');
                        default:
                            return '.';
                    }
                })
                .join(' ');
            console.log(rowDisplay);
        }
    }

    public getBoardPositionsAsString(): string {
        let boardString = '';
        for (const row of this.board) {
            const rowString = row
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
            boardString += rowString;
        }
        return boardString;
    }

    public resetBoard(): void {
        this.board = this.initializeBoard();
    }
}
