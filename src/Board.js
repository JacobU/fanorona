import { Cell } from './Cell.js'
import { PieceType, MoveType, Direction, AttackType, DirectionMoveMap } from './types.js';
import chalk from 'chalk'

class Board {

    #attackedPiece = null;


    constructor() {
        this.rows = 5; // Number of rows
        this.columns = 9; // Number of columns
        this.board = this.initializeBoard(); // Create the board
    }

    // Initialize the board with empty cells
    initializeBoard() {
        const piecePositions = '222222222222222222212102121111111111111111111';
        const board = [];
        for (let i = 0; i < this.rows; i++) {
            const row = [];
            for (let j = 0; j < this.columns; j++) {
                const pieceType = parseInt(piecePositions[i * this.columns + j]);
                row.push(new Cell(pieceType));
            }
            board.push(row);
        }
        return board;
    }

    getCell(row, column) {
        return this.board[row][column];
    }

    movePiece(piece, direction) {

    }

    willMoveWithdraw(piece, direction) {

    }

    willMoveApproach(piece, direction) {

    }

    performMove(piece, direction) {
        if (!Direction.isValid(direction)) {
            throw new Error("Invalid direction");
        }

        const willMoveCauseWithdraw = this.willMoveWithdraw(piece, direction);
        const willMoveCauseApproach = this.willMoveApproach(piece, direction);

        var attackType = AttackType.values.NONE;
        // Right now, just ignore choosing the withdraw or approach, just go with approach
        if (willMoveCauseApproach && willMoveCauseWithdraw) {
            attackType = AttackType.values.APPROACH;
        } else if (willMoveCauseApproach) {
            attackType = AttackType.values.APPROACH;
        } else if (willMoveCauseWithdraw) {
            attackType = AttackType.values.WITHDRAW;
        }

        this.removeAttackedPieces(piece, direction, attackType);
        this.movePiece(piece, direction);


        // Check if this move with WITHDRAW
        // Check if this move will APPROACH
        // Ask the user if they want to approach or withdraw if there are both
        // Set whether the piece will APPROACH/WITHDRAW/DO NOTHING
        // Move the piece
        // If approach -> do approach removal
        // If withdraw -> do withdraw removal


    }

    getPiecesCellNeigbours(row, col) {
        return this.getNeighbours(row, col, true);
    }

    getPiecesPieceNeighbours(row, col) {
        return this.getNeighbours(row, col, false);
    }

    isPositionOnBoard(row, col) {
        return row >= 0 && row < this.rows && col >= 0 && col < this.columns;
    }

    getNeighbours(row, col, includeEmptyCells) {
        const cellNeighbours = [];

        for (const [direction, { deltaRow, deltaCol }] of DirectionMoveMap) {
            const neighborRow = row + deltaRow;
            const neighborCol = col + deltaCol;

            if (this.isPositionOnBoard(neighborRow, neighborCol)) {
                const neighborCell = this.board[neighborRow][neighborCol];
                const isEmpty = neighborCell.getPieceType() == PieceType.values.EMPTY;
                if (includeEmptyCells || includeEmptyCells && !isEmpty) {
                    cellNeighbours.push({
                        pieceType: neighborCell.getPieceType(),
                        direction: direction,
                    });
                }  
            }
        }

        return cellNeighbours;
    }


    // Display the board in a readable format
    displayBoard() {
        
        for (let row of this.board) {
            const rowDisplay = row.map(cell => {
                if (cell.getPieceType() === PieceType.values.BLACK) return chalk.red("B"); // Black piece
                if (cell.getPieceType() === PieceType.values.WHITE) return chalk.white("W"); // White piece
                if (cell.getPieceType() === PieceType.values.EMPTY) return chalk.green("0");
                return "."; // Empty cell
            }).join(" ");
            console.log(rowDisplay);
        }
    }

    // Reset the board to an empty state
    resetBoard() {
        this.board = this.initializeBoard();
    }
}

const board = new Board();
board.displayBoard();
console.log(board.getPiecesCellNeigbours(0,0));