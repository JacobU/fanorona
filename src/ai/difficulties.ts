import Board from '../Board.js';
import { Direction, PieceType } from '../types.js';
import BotRandomPlayer from './BotRandomPlayer.js';
import SearchBot from './SearchBot.js';
import { BotPreset, DeepFortress, Deep6Central, Fortress } from './presets.js';

/**
 * What the game needs from a bot: each call plays one step of its turn, and says whether it has more steps to play.
 */
export interface BotPlayer {
    makeMove(): { canMoveAgain: boolean, move: { index: number, direction: Direction } };
}

export const DIFFICULTY_NAMES = ['Easy', 'Medium', 'Hard', 'Impossible'] as const;
export type DifficultyName = typeof DIFFICULTY_NAMES[number];

export interface Difficulty {
    name: DifficultyName,
    description: string,
    // The search settings the bot uses, or null for the random bot.
    preset: BotPreset | null,
    create(pieceType: PieceType, board: Board): BotPlayer,
}

function searchDifficulty(name: DifficultyName, description: string, preset: BotPreset): Difficulty {
    return { name, description, preset, create: (pieceType, board) => new SearchBot(pieceType, board, preset) };
}

/**
 * The bots a player can choose to play against, from easiest to hardest.
 */
export const DIFFICULTIES: Record<DifficultyName, Difficulty> = {
    Easy: {
        name: 'Easy',
        description: 'Plays random moves.',
        preset: null,
        create: (pieceType, board) => new BotRandomPlayer(pieceType, board, false),
    },
    Medium: searchDifficulty('Medium', 'Looks 2 turns ahead (its turn and your reply).', Fortress),
    Hard: searchDifficulty('Hard', 'Looks 4 turns ahead.', DeepFortress),
    Impossible: searchDifficulty('Impossible', 'Looks 6 turns ahead and knows how to play the endgame.', Deep6Central),
};
