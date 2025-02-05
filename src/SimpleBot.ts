import Board from './Board.js';
import { PieceType, Direction, BestMove, getDirectionFromDeltaIndex } from './types.js';

export default class SimpleBot {
    private pieceType: PieceType;
    private board: Board;
    private pieceTypeString: string;
    private currentMove: BestMove | null = null;
    private currentMoveIndex: number = 0;

    constructor(pieceType: PieceType, board: Board) {
        this.pieceType = pieceType;
        this.board = board;
        this.pieceTypeString = pieceType === PieceType.WHITE ? 'White' : 'Black';
    }

    public makeMove() {
        this.playerIsMovingLog();        
        
        if (this.currentMove === null) {
            this.currentMove = this.board.getBestMoveSimple(this.pieceType);
            this.currentMoveIndex = 0;
        }
        
        this.board.setAttackOrWithdraw(this.currentMove!.move.moveTypes[this.currentMoveIndex]);

        let index: number;
        let direction: Direction;
        if (this.currentMoveIndex === 0) {
            index = this.currentMove!.startIndex;
            direction = getDirectionFromDeltaIndex((this.currentMove!.move.moveIndexes[0] - index), this.board.getBoardsNumberOfColumns()) ;
        } else {
            index = this.currentMove!.move.moveIndexes[this.currentMoveIndex - 1];
            const indexDelta = this.currentMove!.move.moveIndexes[this.currentMoveIndex] - this.currentMove!.move.moveIndexes[this.currentMoveIndex - 1];
            direction = getDirectionFromDeltaIndex(indexDelta, this.board.getBoardsNumberOfColumns());
        }
        

        const canMoveAgain = this.board.performMove(index, direction);

        if (canMoveAgain) {
            this.currentMoveIndex++;
        } else {
            this.currentMove = null;
            this.currentMoveIndex = 0;
        }
        console.log(index, direction);
        return { canMoveAgain: canMoveAgain, move: { index: index, direction: direction } };
    }

    private playerIsMovingLog() {
        console.log(this.pieceTypeString + ' is moving!');
    }
}