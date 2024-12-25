import Board from './Board.js';
import { PieceType } from './types.js';

export default class BotRandomPlayer {
    private pieceType: PieceType;
    private board: Board;
    private pieceTypeString: string;

    constructor(pieceType: PieceType, board: Board) {
        this.pieceType = pieceType;
        this.board = board;
        this.pieceTypeString = pieceType === PieceType.WHITE ? 'White' : 'Black';
    }

    public makeMove(): void {
        // this.playerIsMovingLog();
        // for (let i = 0; i < 3000000000; i++) {
        //     i++;
        // }
        const possiblePiecesToMove: number[] = this.board.getPiecesThatPlayerCanMove(this.pieceType);
        const moveIndex: number = possiblePiecesToMove.at(Math.floor(Math.random() * possiblePiecesToMove.length))!;
        const possibleMoves = this.board.getPossibleMovesForCell(moveIndex);
        const moveChoice = possibleMoves.at(Math.floor(Math.random() * possibleMoves.length))!;
        const canMoveAgain: boolean = this.board.performMove(moveIndex, moveChoice.direction);
        // this.board.displayBoard();
        if (canMoveAgain) {
            this.makeMove();
        }
    }

    private playerIsMovingLog() {
        console.log(this.pieceTypeString + ' is moving!');
    }
}