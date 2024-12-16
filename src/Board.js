import { Cell } from './Cell.js'
import { PieceType, MoveType, Direction, AttackType, DirectionMoveMap } from './types.js';
import chalk from 'chalk'

export default class Board {

    #attackedPiece = null;


    constructor(...args) {
        // This should take the form of "rowLength (int), colLength (int), startingPieces (string)"
        if (args.length === 3) {
            this.rows = args[0]; // Number of rows
            this.columns = args[1]; // Number of columns
            if (this.rows * this.columns != args[2].length) {
                throw new Error("The number starting positions does not match the board size.");
            }
            this.board = this.initializeBoard(args[2]); // Create the board
        } else {
            this.rows = 5; // Number of rows
            this.columns = 9; // Number of columns
            this.board = this.initializeBoard(); // Create the board
        }
    }

    // Initialize the board with empty cells
    initializeBoard(startingPiecePositions = "222222222222222222212102121111111111111111111") {
        const board = [];
        for (let i = 0; i < this.rows; i++) {
            const row = [];
            for (let j = 0; j < this.columns; j++) {
                const pieceType = parseInt(startingPiecePositions[i * this.columns + j]);
                row.push(new Cell(pieceType));
            }
            board.push(row);
        }
        return board;
    }

    getCell(row, col) {
        return this.board[row][col];
    }

    setCell(row, col, pieceType) {
        this.board[row][col].setCell(pieceType);
    }

    movePiece(piece, position, direction) {
        // Always check the input
        if (!Direction.isValid(direction)) {
            throw new Error("Invalid direction");
        }

        const newRow = position.row + DirectionMoveMap.get(direction).deltaRow;
        const newCol = position.col + DirectionMoveMap.get(direction).deltaCol;

        // Check the move is valid (i.e. that the position it is trying to move is indeed empty)
        if (this.getCell(newRow, newCol).getPieceType() != PieceType.values.EMPTY)
        {
            throw new Error("The place the piece is being moved is occupied");
        }        
        this.setCell(position.row, position.col, piece);
        this.board[position.row][position.col].removePiece();

        
    }

    willMoveWithdraw(piece, position, direction) {

    }

    willMoveApproach(piece, position, direction) {

    }

    removeAttackedPieces() {

    }

    performMove(piece, direction) {
        if (!Direction.isValid(direction)) {
            throw new Error("Invalid direction");
        }

        const willMoveCauseWithdraw = this.willMoveWithdraw(piece, position, direction);
        const willMoveCauseApproach = this.willMoveApproach(piece, position, direction);

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
        this.movePiece(piece, position, direction);
    }

    getCellNeigbours(row, col) {
        return this.getNeighbours(row, col, true);
    }

    getPiecesNeighbours(row, col) {
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
        }
    }

    getBoardPositionsAsString() {
        var boardString = '';
        for (let row of this.board) {
            const rowString = row
            .map(cell => {
                if (cell.getPieceType() === PieceType.values.WHITE) return '1'; // WHITE piece
                if (cell.getPieceType() === PieceType.values.BLACK) return '2'; // BLACK piece
                if (cell.getPieceType() === PieceType.values.EMPTY) return '0'; // EMPTY cell
                return '.'; // Fallback for unknown types
            })
            .join('');
            boardString += rowString;
        }
        return boardString;
    }

    // Reset the board to an empty state
    resetBoard() {
        this.board = this.initializeBoard();
    }
}


const board = new Board(3,3,'120000000');

// board.displayBoard();
// console.log(board.getCellNeigbours(0,0));