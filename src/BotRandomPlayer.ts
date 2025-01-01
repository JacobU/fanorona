import Board from './Board.js';
import { PieceType, Move } from './types.js';

export default class BotRandomPlayer {
    private pieceType: PieceType;
    private board: Board;
    private pieceTypeString: string;
    private inMiddleOfMoveChain: boolean;
    private indexOfPieceThatMustBeMoved: number | null;

    constructor(pieceType: PieceType, board: Board) {
        this.pieceType = pieceType;
        this.board = board;
        this.pieceTypeString = pieceType === PieceType.WHITE ? 'White' : 'Black';
        this.inMiddleOfMoveChain = false;
        this.indexOfPieceThatMustBeMoved = null;
    }

    public makeMove() {
        this.playerIsMovingLog();
        let possiblePiecesToMove: number[];
        
        if (this.inMiddleOfMoveChain) {
            possiblePiecesToMove = [this.indexOfPieceThatMustBeMoved!];
        } else {
            possiblePiecesToMove = this.board.getPiecesThatPlayerCanMove(this.pieceType);
        }
        
        const moveIndex: number = possiblePiecesToMove.at(Math.floor(Math.random() * possiblePiecesToMove.length))!;
        const possibleMoves = this.board.getPossibleMovesForCell(moveIndex);
        const moveChoice: Move = possibleMoves.at(Math.floor(Math.random() * possibleMoves.length))!;
        const canMoveAgain = this.board.performMove(moveIndex, moveChoice.direction)
        if (canMoveAgain) {
            this.inMiddleOfMoveChain = true;
            this.indexOfPieceThatMustBeMoved = moveChoice.index;
        } else {
            this.inMiddleOfMoveChain = false;
            this.indexOfPieceThatMustBeMoved = null;
        }
        return { canMoveAgain: canMoveAgain, move: { index: moveIndex, direction: moveChoice.direction } };
    }

    private playerIsMovingLog() {
        console.log(this.pieceTypeString + ' is moving!');
    }
}