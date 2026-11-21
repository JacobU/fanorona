import Board from '../Board.js';
import { BoardState, PieceType, Turn, Winner, getDirectionFromDeltaIndex } from '../types.js';
import { totalPieces } from './endgame.js';
import { Fortress } from './presets.js';
import { seededRng } from './random.js';
import { Candidate, Rng, chooseMove } from './Search.js';
import { applyOpening, generateOpenings } from './openings.js';

/*
 * Fixed, seeded positions for the board-unchanged tests, the golden results and the benchmark. Each position is
 * saved as plain data (so it can be stored in a JSON file) and rebuilt with boardFromPosition.
 */

export type PositionKind =
    // Between turns, with more than 10 pieces and the game still going
    | 'turn'
    // Between turns, with 10 or fewer pieces (where the endgame settings apply) and the game still going
    | 'endgame'
    // Part way through a capture chain: the player has captured and may carry on or stop
    | 'midChain'
    // The game is over: won, or drawn by the no-capture rule
    | 'finished'
    // One quiet turn away from the no-capture draw
    | 'nearDraw'
    // Random layouts on small boards (3x3, 3x5, 5x5)
    | 'small';

export interface StoredPosition {
    name: string,
    kind: PositionKind,
    rows: number,
    columns: number,
    // The layout the board is created with (what reset() goes back to)
    layout: string,
    state: BoardState,
}

export const STANDARD_LAYOUT = '222222222222222222212102121111111111111111111';

export function boardFromPosition(position: StoredPosition): Board {
    const board = new Board(position.rows, position.columns, position.layout);
    board.resetBoardState(position.state);
    return board;
}

/**
 * @returns the colour of the player whose turn it is.
 */
export function sideToMove(board: Board): PieceType {
    return board.getTurn() === Turn.WHITE ? PieceType.WHITE : PieceType.BLACK;
}

function store(name: string, kind: PositionKind, board: Board, layout: string = STANDARD_LAYOUT): StoredPosition {
    return { name, kind, rows: board.getBoardsNumberOfRows(), columns: board.getBoardsNumberOfColumns(), layout, state: board.saveBoardState() };
}

function listCandidates(board: Board, pieceType: PieceType): Candidate[] {
    const allMoves = board.getAllPossibleCompleteMoves(pieceType);
    return allMoves.startIndexes.flatMap((startIndex, i) => allMoves.moves[i].map(move => ({ startIndex, move })));
}

/**
 * Plays only the first `steps` steps of a capture chain, leaving the player part way through their turn.
 */
function playChainSteps(board: Board, candidate: Candidate, steps: number): void {
    let index = candidate.startIndex;
    for (let i = 0; i < steps; i++) {
        const nextIndex = candidate.move.moveIndexes[i];
        board.setAttackOrWithdraw(candidate.move.moveTypes[i]);
        board.performMove(index, getDirectionFromDeltaIndex(nextIndex - index, board.getBoardsNumberOfColumns()));
        index = nextIndex;
    }
}

/**
 * @returns n items picked at random (without repeats), kept in their original order.
 */
function pick<T>(rng: Rng, items: T[], n: number): T[] {
    const order = items.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order.slice(0, n).sort((a, b) => a - b).map(i => items[i]);
}

interface GamePositions {
    turn: StoredPosition[],
    endgame: StoredPosition[],
    midChain: StoredPosition[],
    finished: StoredPosition[],
}

/**
 * Plays games of random moves from the starting position and records every position along the way.
 */
function randomGamePositions(rng: Rng, games: number): GamePositions {
    const result: GamePositions = { turn: [], endgame: [], midChain: [], finished: [] };
    for (let game = 0; game < games; game++) {
        const board = new Board();
        for (let turn = 0; board.getWinner() === Winner.NONE; turn++) {
            const candidates = listCandidates(board, sideToMove(board));
            if (candidates.length === 0) break;
            const name = `random game ${game}, turn ${turn}`;
            if (totalPieces(board) > 10) result.turn.push(store(name, 'turn', board));
            else result.endgame.push(store(name, 'endgame', board));

            const chosen = candidates[Math.floor(rng() * candidates.length)];
            // A move of 2 or more steps is a capture chain, so also record a position part way through it
            const length = chosen.move.moveIndexes.length;
            if (length >= 2) {
                const saved = board.saveBoardState();
                const steps = 1 + Math.floor(rng() * (length - 1));
                playChainSteps(board, chosen, steps);
                result.midChain.push(store(`${name}, after ${steps} step${steps > 1 ? 's' : ''} of a chain`, 'midChain', board));
                board.resetBoardState(saved);
            }
            board.applyCompleteMove(chosen.startIndex, chosen.move);
        }
        if (board.getWinner() !== Winner.NONE) result.finished.push(store(`random game ${game}, finished`, 'finished', board));
    }
    return result;
}

/**
 * Plays Fortress against Fortress from seeded openings, and records the positions with 10 or fewer pieces.
 * @returns the endgame positions of each game.
 */
function botGameEndgames(rng: Rng, games: number, openingSeed: number): StoredPosition[][] {
    return generateOpenings(games, 4, openingSeed).map((opening, game) => {
        const board = new Board();
        applyOpening(board, opening);
        const endgames: StoredPosition[] = [];
        for (let turn = 4; board.getWinner() === Winner.NONE; turn++) {
            if (totalPieces(board) <= 10) endgames.push(store(`bot game ${game}, turn ${turn}`, 'endgame', board));
            const best = chooseMove(board, sideToMove(board), Fortress.evaluator, Fortress.depth, rng);
            if (best === null) break;
            board.applyCompleteMove(best.startIndex, best.move);
        }
        return endgames;
    });
}

/**
 * Copies of positions with the no-capture counter changed, so they are drawn (60) or one quiet turn from a draw (59).
 */
function withTurnsWithoutCapture(positions: StoredPosition[], turns: number, kind: PositionKind): StoredPosition[] {
    return positions.map(p => ({
        ...p,
        name: `${p.name}, ${turns} turns without a capture`,
        kind,
        state: { ...p.state, turnsWithoutCapture: turns },
    }));
}

/**
 * Random layouts on small boards, with either player to move.
 */
function smallBoardPositions(rng: Rng, count: number): StoredPosition[] {
    const sizes = [[3, 3], [3, 5], [5, 5]];
    const positions: StoredPosition[] = [];
    while (positions.length < count) {
        const [rows, columns] = sizes[positions.length % sizes.length];
        // Each cell: half empty, a quarter white, a quarter black
        const layout = Array.from({ length: rows * columns }, () => {
            const r = rng();
            return r < 0.5 ? '0' : r < 0.75 ? '1' : '2';
        }).join('');
        if (!layout.includes('1') || !layout.includes('2')) continue;
        const board = new Board(rows, columns, layout);
        const position = store(`small ${rows}x${columns} #${positions.length}`, 'small', board, layout);
        position.state.turn = rng() < 0.5 ? Turn.WHITE : Turn.BLACK;
        positions.push(position);
    }
    return positions;
}

/**
 * The fixed positions for the board-unchanged tests and the golden results (about 300).
 */
export function generateTestPositions(seed: number = 1): StoredPosition[] {
    const rng = seededRng(seed);
    const random = randomGamePositions(rng, 40);
    const botEndgames = botGameEndgames(rng, 8, seed).flat();
    // Different positions for the drawn and nearly drawn copies
    const [forDraws, forNearDraws] = [pick(rng, random.turn, 10), pick(rng, random.turn, 15)];
    return [
        ...pick(rng, random.turn, 100),
        ...pick(rng, random.endgame, 40),
        ...pick(rng, botEndgames, 20),
        ...pick(rng, random.midChain, 40),
        ...pick(rng, random.finished, 15),
        ...withTurnsWithoutCapture(forDraws, 60, 'finished'),
        ...withTurnsWithoutCapture(forNearDraws, 59, 'nearDraw'),
        ...smallBoardPositions(rng, 60),
    ];
}

/**
 * The fixed positions the benchmark times searches on:
 * - openings: the position after each of 20 four-turn openings, for the depth-4 searches;
 * - endgames: one position with 10 or fewer pieces from each of 15 bot games (Fortress against Fortress) and from each
 *   of 15 random games, for the depth-6 endgame searches. Random games give the lopsided positions (such as 8 pieces
 *   against 2) that were the slowest.
 */
export function generateBenchmarkPositions(seed: number = 9): { openings: StoredPosition[], endgames: StoredPosition[] } {
    const rng = seededRng(seed);
    const openings = generateOpenings(20, 4, seed).map((opening, i) => {
        const board = new Board();
        applyOpening(board, opening);
        return store(`opening ${i}`, 'turn', board);
    });
    const oneFromEachGame = (games: StoredPosition[][]) => games.filter(g => g.length > 0).map(g => g[Math.floor(rng() * g.length)]);

    const botGames = botGameEndgames(rng, 15, seed);
    const randomGames: StoredPosition[][] = [];
    for (let game = 0; game < 15; game++) {
        randomGames.push(randomGamePositions(rng, 1).endgame.map(p => ({ ...p, name: p.name.replace('random game 0', `random game ${game}`) })));
    }
    return { openings, endgames: [...oneFromEachGame(botGames), ...oneFromEachGame(randomGames)] };
}
