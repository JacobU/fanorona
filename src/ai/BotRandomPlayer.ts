import Board from '../Board.js';
import { PieceType, Move } from '../types.js';

export default class BotRandomPlayer {
    private pieceType: PieceType;
    private board: Board;
    private pieceTypeString: string;
    private inMiddleOfMoveChain: boolean;
    private indexOfPieceThatMustBeMoved: number | null;
    private verbose: boolean;

    constructor(pieceType: PieceType, board: Board, verbose: boolean = true) {
        this.pieceType = pieceType;
        this.board = board;
        this.pieceTypeString = pieceType === PieceType.WHITE ? 'White' : 'Black';
        this.inMiddleOfMoveChain = false;
        this.indexOfPieceThatMustBeMoved = null;
        this.verbose = verbose;
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
        let canMoveAgain = this.board.performMove(moveIndex, moveChoice.direction)
        // Only the first capture is compulsory, so stopping is one more option alongside each way of continuing.
        if (canMoveAgain) {
            const numberOfContinuations = this.board.getPossibleMovesForCell(moveChoice.index).length;
            if (Math.random() < 1 / (numberOfContinuations + 1)) {
                this.board.endTurn();
                canMoveAgain = false;
            }
        }
        if (canMoveAgain) {
            this.inMiddleOfMoveChain = true;
            this.indexOfPieceThatMustBeMoved = moveChoice.index;
        } else {
            this.inMiddleOfMoveChain = false;
            this.indexOfPieceThatMustBeMoved = null;
        }
        if (this.verbose) console.log(moveIndex, moveChoice.direction);
        return { canMoveAgain: canMoveAgain, move: { index: moveIndex, direction: moveChoice.direction } };
    }

    private playerIsMovingLog() {
        if (this.verbose) console.log(this.pieceTypeString + ' is moving!');
    }
}