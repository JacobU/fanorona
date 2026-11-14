import Board from '../Board.js';
import { PieceType, Direction, BestMove, getDirectionFromDeltaIndex } from '../types.js';
import { BotPreset } from './presets.js';
import { chooseMove, Rng } from './Search.js';
import { searchDepthFor } from './endgame.js';

export interface SearchBotOptions {
    verbose?: boolean,
    rng?: Rng,
}

/**
 * A bot that picks its complete turn with chooseMove (using the preset's depth and evaluator) and then plays
 * it out one step at a time, each time makeMove is called.
 */
export default class SearchBot {
    protected pieceType: PieceType;
    protected board: Board;
    protected preset: BotPreset;
    private pieceTypeString: string;
    private verbose: boolean;
    private rng: Rng;
    private currentMove: BestMove | null = null;
    private currentMoveIndex: number = 0;

    constructor(pieceType: PieceType, board: Board, preset: BotPreset, options: SearchBotOptions = {}) {
        this.pieceType = pieceType;
        this.board = board;
        this.preset = preset;
        this.pieceTypeString = pieceType === PieceType.WHITE ? 'White' : 'Black';
        this.verbose = options.verbose ?? false;
        this.rng = options.rng ?? Math.random;
    }

    public getName(): string {
        return this.preset.name;
    }

    public makeMove() {
        this.playerIsMovingLog();

        if (this.currentMove === null) {
            // The depth can change during the game (presets with an endgameDepth search deeper once few pieces are left).
            const depth = searchDepthFor(this.preset, this.board);
            this.currentMove = chooseMove(this.board, this.pieceType, this.preset.evaluator, depth, this.rng);
            this.currentMoveIndex = 0;
            if (this.currentMove === null) {
                throw new Error(this.pieceTypeString + ' has no moves available.');
            }
        }

        this.board.setAttackOrWithdraw(this.currentMove.move.moveTypes[this.currentMoveIndex]);

        let index: number;
        let direction: Direction;
        if (this.currentMoveIndex === 0) {
            index = this.currentMove.startIndex;
            direction = getDirectionFromDeltaIndex((this.currentMove.move.moveIndexes[0] - index), this.board.getBoardsNumberOfColumns()) ;
        } else {
            index = this.currentMove.move.moveIndexes[this.currentMoveIndex - 1];
            const indexDelta = this.currentMove.move.moveIndexes[this.currentMoveIndex] - this.currentMove.move.moveIndexes[this.currentMoveIndex - 1];
            direction = getDirectionFromDeltaIndex(indexDelta, this.board.getBoardsNumberOfColumns());
        }


        let canMoveAgain = this.board.performMove(index, direction);

        // The chosen move may stop part way through a capture chain (only the first capture is compulsory).
        const isLastStep = this.currentMoveIndex === this.currentMove.move.moveIndexes.length - 1;
        if (canMoveAgain && isLastStep) {
            this.board.endTurn();
            canMoveAgain = false;
        }

        if (canMoveAgain) {
            this.currentMoveIndex++;
        } else {
            this.currentMove = null;
            this.currentMoveIndex = 0;
        }
        if (this.verbose) console.log(index, direction);
        return { canMoveAgain: canMoveAgain, move: { index: index, direction: direction } };
    }

    private playerIsMovingLog() {
        if (this.verbose) console.log(this.pieceTypeString + ' is moving!');
    }
}
