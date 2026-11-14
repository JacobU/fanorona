import Board from '../Board.js';
import { PieceType } from '../types.js';
import SearchBot, { SearchBotOptions } from './SearchBot.js';
import { Greedy } from './presets.js';

/**
 * The original simple bot: picks the turn that leaves it with the most pieces relative to the opponent,
 * without looking at the opponent's reply. Equivalent to a SearchBot using the Greedy preset.
 */
export default class SimpleBot extends SearchBot {
    constructor(pieceType: PieceType, board: Board, options: SearchBotOptions = { verbose: true }) {
        super(pieceType, board, Greedy, options);
    }
}
