import Board from '../Board.js';
import { PieceType, Turn, Winner } from '../types.js';
import BotRandomPlayer from './BotRandomPlayer.js';
import SearchBot from './SearchBot.js';
import { BotPreset } from './presets.js';
import { Rng } from './Search.js';
import { Opening, applyOpening } from './tuning/Openings.js';

export interface Player {
    makeMove(): { canMoveAgain: boolean };
}

/**
 * Something that can take part in a tournament: a name, and a way to create a fresh player for a game.
 */
export interface Contestant {
    name: string,
    create(pieceType: PieceType, board: Board, rng: Rng): Player,
}

export type GameResult = 'WHITE' | 'BLACK' | 'DRAW';

// NO_CAPTURES: the game rule (NO_CAPTURE_DRAW_TURNS turns without a capture).
// TURN_LIMIT: the game was stopped at maxTurns, a safety limit for games that keep going.
export type DrawReason = 'NO_CAPTURES' | 'TURN_LIMIT';

/**
 * Safety limit on the length of a game. Games should end long before this because of the no-capture draw rule,
 * since each capture removes at least one piece.
 */
export const DEFAULT_MAX_TURNS = 1000;

export interface GameStats {
    result: GameResult,
    drawReason?: DrawReason,
    turns: number,
    // Milliseconds each side spent choosing and making moves
    whiteMs: number,
    blackMs: number,
}

export function contestantFromPreset(preset: BotPreset): Contestant {
    return {
        name: preset.name,
        create: (pieceType, board, rng) => new SearchBot(pieceType, board, preset, { rng }),
    };
}

export const RandomContestant: Contestant = {
    name: 'Random',
    create: (pieceType, board) => new BotRandomPlayer(pieceType, board, false),
};

/**
 * Plays one game. A player who can't move on their turn loses. The game is a draw if nobody captures for
 * NO_CAPTURE_DRAW_TURNS turns, or (as a safety net) once maxTurns is reached.
 * @param opening turns to play before the bots take over (not counted in the stats).
 * @param onTurnStart called with the board before each turn the bots play (e.g. to record positions).
 */
export function playGame(
    white: Contestant,
    black: Contestant,
    maxTurns: number = DEFAULT_MAX_TURNS,
    rng: Rng = Math.random,
    opening: Opening = [],
    onTurnStart?: (board: Board) => void,
): GameStats {
    const board = new Board();
    applyOpening(board, opening);
    const whitePlayer = white.create(PieceType.WHITE, board, rng);
    const blackPlayer = black.create(PieceType.BLACK, board, rng);
    let whiteMs = 0;
    let blackMs = 0;
    let turns = 0;

    while (board.getWinner() === Winner.NONE && turns < maxTurns) {
        const isWhitesTurn = board.getTurn() === Turn.WHITE;
        const pieceType = isWhitesTurn ? PieceType.WHITE : PieceType.BLACK;
        if (board.getPiecesThatPlayerCanMove(pieceType).length === 0) {
            return { result: isWhitesTurn ? 'BLACK' : 'WHITE', turns, whiteMs, blackMs };
        }

        onTurnStart?.(board);
        const player = isWhitesTurn ? whitePlayer : blackPlayer;
        const start = performance.now();
        while (player.makeMove().canMoveAgain) {}
        const elapsed = performance.now() - start;
        if (isWhitesTurn) whiteMs += elapsed; else blackMs += elapsed;
        turns++;
    }

    const winner = board.getWinner();
    if (winner === Winner.WHITE || winner === Winner.BLACK) {
        return { result: winner === Winner.WHITE ? 'WHITE' : 'BLACK', turns, whiteMs, blackMs };
    }
    const drawReason: DrawReason = winner === Winner.DRAW ? 'NO_CAPTURES' : 'TURN_LIMIT';
    return { result: 'DRAW', drawReason, turns, whiteMs, blackMs };
}
