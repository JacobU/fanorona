import Board from '../Board.js';
import { BestMove, BoardState, PieceType } from '../types.js';
import { DIFFICULTIES, DifficultyName } from './difficulties.js';
import { searchDepthFor } from './endgame.js';
import { chooseMove } from './Search.js';

/**
 * Chooses a difficulty's next complete turn from a saved board state, with the same depth and evaluator SearchBot
 * would use. Everything going in and coming out is plain data, so this can run in a Web Worker (see searchWorker.ts)
 * while the page stays responsive.
 * @returns the chosen turn, or null if the player has no moves.
 */
export function planTurn(state: BoardState, difficulty: DifficultyName, pieceType: PieceType): BestMove | null {
    const preset = DIFFICULTIES[difficulty].preset;
    if (preset === null) {
        throw new Error(`${difficulty} plays random moves, so it has no turn to plan.`);
    }
    const board = new Board();
    board.resetBoardState(state);
    return chooseMove(board, pieceType, preset.evaluator, searchDepthFor(preset, board));
}
