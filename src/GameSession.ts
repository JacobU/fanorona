import Board, { NO_CAPTURE_DRAW_TURNS } from './Board.js';
import { PieceType, Turn, Winner, getOppositePieceType } from './types.js';

export type GameMode = 'choosing' | 'vsBot' | 'twoPlayer';

/**
 * Keeps track of how the current game is being played (against the bot or two players on one screen) and which
 * colours the people at the screen control. Contains no DOM code, so it can be unit tested.
 */
export default class GameSession {
    public mode: GameMode = 'choosing';
    // The colour the person plays in vs Bot mode (null otherwise)
    public humanColour: PieceType | null = null;

    public start(mode: 'vsBot' | 'twoPlayer', humanColour?: PieceType): void {
        if (mode === 'vsBot' && humanColour !== PieceType.WHITE && humanColour !== PieceType.BLACK) {
            throw new Error('A colour must be chosen to play against the bot.');
        }
        this.mode = mode;
        this.humanColour = mode === 'vsBot' ? humanColour! : null;
    }

    /**
     * Goes back to choosing how to play.
     */
    public reset(): void {
        this.mode = 'choosing';
        this.humanColour = null;
    }

    /**
     * @returns the colours that the people at the screen can move.
     */
    public controlledColours(): PieceType[] {
        if (this.mode === 'twoPlayer') return [PieceType.WHITE, PieceType.BLACK];
        if (this.mode === 'vsBot') return [this.humanColour!];
        return [];
    }

    /**
     * @returns the colour the bot plays, or null if no bot is playing.
     */
    public botColour(): PieceType | null {
        return this.mode === 'vsBot' ? getOppositePieceType(this.humanColour!) : null;
    }

    public isHumanTurn(board: Board): boolean {
        return this.controlledColours().includes(turnColour(board));
    }

    /**
     * @param botThinking whether the bot is choosing its move (it can take a few seconds on the hardest difficulty).
     * @returns text saying whose turn it is, or an empty string when no game is being played.
     */
    public turnLabel(board: Board, botThinking: boolean = false): string {
        if (this.mode === 'choosing') return '';
        const colour = turnColour(board);
        const label = `${colour === PieceType.WHITE ? 'White' : 'Black'} to move`;
        if (this.mode === 'vsBot') {
            if (colour === this.humanColour) return `${label} (you)`;
            return `${label} (${botThinking ? 'bot is thinking…' : 'bot'})`;
        }
        return label;
    }

    /**
     * @returns the message shown when the game ends.
     */
    public endMessage(winner: Winner): string {
        if (winner === Winner.DRAW) return `Draw! No pieces were captured in ${NO_CAPTURE_DRAW_TURNS} turns.`;
        const winningColour = winner === Winner.WHITE ? PieceType.WHITE : PieceType.BLACK;
        if (this.mode === 'vsBot') return winningColour === this.humanColour ? 'You won!' : 'You lost!';
        return winningColour === PieceType.WHITE ? 'White wins!' : 'Black wins!';
    }
}

/**
 * @returns the colour of the player whose turn it is.
 */
export function turnColour(board: Board): PieceType {
    return board.getTurn() === Turn.WHITE ? PieceType.WHITE : PieceType.BLACK;
}
