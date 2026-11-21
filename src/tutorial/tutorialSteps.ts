import { Winner } from '../types.js';

/**
 * The steps of the tutorial: a board setup for each rule, the move(s) the player has to make, and the text shown.
 * The player is always white, plays first and black never moves.
 *
 * Each layout is written as the 5 rows of the board, top to bottom, with 9 points in each row:
 * 0 = empty, 1 = white, 2 = black. Points are numbered 0 to 44 from the top left, row by row; at(row, col) gives the
 * number of a point. Points with an even number are strong points (with diagonal lines).
 */

const COLUMNS = 9;

function at(row: number, col: number): number {
    return row * COLUMNS + col;
}

/**
 * A move the player might try that the rules don't allow at that point. It is drawn as a crossed-out red arrow, and
 * clicking it shows the reason.
 */
export interface BlockedMove {
    to: number,
    reason: string,
}

/**
 * One thing the player has to do in a step:
 * - move: move the piece on `from` to the neighbouring point `to` (part of a chain if it follows another move)
 * - anyMove: move the piece on `from` in any direction it can go
 * - endTurn: press End turn (in the middle of a chain)
 */
export type TutorialAction =
    | { kind: 'move', from: number, to: number, blocked?: BlockedMove[] }
    | { kind: 'anyMove', from: number }
    | { kind: 'endTurn', hint?: string };

export interface TutorialStep {
    // A short name used by the tests
    id: string,
    title: string,
    // The explanation shown above the board
    text: string,
    // Shown once the step has been completed
    successText: string,
    // For a move that both approaches and withdraws: the success text for each choice (used instead of successText)
    successTextByAttack?: { approach: string, withdraw: string },
    rows: string[],
    actions: TutorialAction[],
    // How many black pieces the actions capture (checked by the tests)
    expectedCaptures: number,
    // Who has won once the actions are done (Winner.NONE if not given)
    expectWinner?: Winner,
}

/**
 * @returns the step's layout as the 45 character string Board takes.
 */
export function stepLayout(step: TutorialStep): string {
    return step.rows.join('');
}

export const TUTORIAL_STEPS: TutorialStep[] = [
    {
        id: 'strong-point',
        title: 'Moving',
        text: 'The goal is to capture all your opponent\'s pieces. Click a piece, then click where to move it. '
            + 'Pieces move one point along a line. Where diagonals cross, a piece can move in 8 directions.',
        successText: 'Pieces can only move to an empty point.',
        rows: [
            '200000000',
            '000000000',
            '000010000',
            '000000000',
            '000000000',
        ],
        actions: [{ kind: 'anyMove', from: at(2, 4) }],
        expectedCaptures: 0,
    },
    {
        id: 'weak-point',
        title: 'Moving without diagonals',
        text: 'Where there are no diagonal lines, a piece can only move up, down, left or right. Move the highlighted piece.',
        successText: 'No diagonal moves from here.',
        rows: [
            '200000000',
            '000000000',
            '000100000',
            '000000000',
            '000000000',
        ],
        actions: [{ kind: 'anyMove', from: at(2, 3) }],
        expectedCaptures: 0,
    },
    {
        id: 'paika',
        title: 'Paika moves',
        text: 'A move that captures nothing is a paika move. You can only make one when no capture is possible. '
            + 'Move the highlighted piece.',
        successText: 'Nothing was captured. Now it\'s black\'s turn.',
        rows: [
            '002020200',
            '000000000',
            '000000000',
            '001000100',
            '000010000',
        ],
        actions: [{ kind: 'move', from: at(4, 4), to: at(3, 4) }],
        expectedCaptures: 0,
    },
    {
        id: 'approach',
        title: 'Capturing by approaching',
        text: 'Move straight towards an opponent\'s piece, ending next to it, to capture it. Move towards the '
            + 'black piece.',
        successText: 'Captured!',
        rows: [
            '000000002',
            '000000000',
            '001020000',
            '000000000',
            '000000002',
        ],
        actions: [{ kind: 'move', from: at(2, 2), to: at(2, 3) }],
        expectedCaptures: 1,
    },
    {
        id: 'withdraw',
        title: 'Capturing by withdrawing',
        text: 'If an opponent\'s piece is next to yours, move directly away from it to capture it. Move away from '
            + 'the black piece.',
        successText: 'Captured!',
        rows: [
            '000000002',
            '000000000',
            '000210000',
            '000000000',
            '000000002',
        ],
        actions: [{ kind: 'move', from: at(2, 4), to: at(2, 5) }],
        expectedCaptures: 1,
    },
    {
        id: 'withdraw-line',
        title: 'Capturing a line',
        text: 'A capture takes the whole line of opponent pieces, up to the first gap or one of your pieces. '
            + 'Withdraw from the line of three.',
        successText: 'Three pieces in one move! Approaching a line works the same way.',
        rows: [
            '000000002',
            '000000000',
            '022210000',
            '000000000',
            '000000002',
        ],
        actions: [{ kind: 'move', from: at(2, 4), to: at(2, 5) }],
        expectedCaptures: 3,
    },
    {
        id: 'approach-or-withdraw',
        title: 'Approach or withdraw',
        text: 'Some moves approach one piece and withdraw from another, but you can only capture one side. After '
            + 'moving, click a piece with a red ring to choose.',
        successText: 'You chose which side to capture.',
        successTextByAttack: {
            approach: 'You captured the piece in front.',
            withdraw: 'You captured the piece behind.',
        },
        rows: [
            '000000002',
            '000000000',
            '000210200',
            '000000000',
            '000000002',
        ],
        actions: [{ kind: 'move', from: at(2, 4), to: at(2, 5) }],
        expectedCaptures: 1,
    },
    {
        id: 'chain',
        title: 'Chains',
        text: 'After a capture, the same piece can capture again. The piece stays selected, so just click the next '
            + 'point. Follow the arrows to capture three times.',
        successText: 'Three captures in one turn!',
        rows: [
            '000000002',
            '000200000',
            '102000000',
            '020000000',
            '000000002',
        ],
        actions: [
            { kind: 'move', from: at(2, 0), to: at(2, 1) },
            { kind: 'move', from: at(2, 1), to: at(1, 1) },
            { kind: 'move', from: at(1, 1), to: at(1, 2) },
        ],
        expectedCaptures: 3,
    },
    {
        id: 'chain-rules',
        title: 'Chain rules',
        text: 'In a chain, a piece can\'t move in the same direction twice in a row or return to a point it visited '
            + 'this turn. Red arrows show blocked moves. Follow the blue arrows.',
        successText: 'Chain complete.',
        rows: [
            '000200000',
            '000002000',
            '021002000',
            '020000000',
            '000000000',
        ],
        actions: [
            { kind: 'move', from: at(2, 2), to: at(2, 3) },
            {
                kind: 'move', from: at(2, 3), to: at(1, 3),
                blocked: [{ to: at(2, 4), reason: 'Not allowed: same direction twice in a row.' }],
            },
            {
                kind: 'move', from: at(1, 3), to: at(1, 4),
                blocked: [{ to: at(2, 2), reason: 'Not allowed: already visited this turn.' }],
            },
        ],
        expectedCaptures: 3,
    },
    {
        id: 'end-turn',
        title: 'Ending a turn early',
        text: 'You don\'t have to finish a chain. Capture once, then press End turn.',
        successText: 'Turn ended. Stopping early can keep your piece safe.',
        rows: [
            '000200002',
            '000000000',
            '001020000',
            '000000000',
            '000000002',
        ],
        actions: [
            { kind: 'move', from: at(2, 2), to: at(2, 3) },
            { kind: 'endTurn', hint: 'Press End turn instead of capturing again.' },
        ],
        expectedCaptures: 1,
    },
    {
        id: 'must-capture',
        title: 'Capturing is compulsory',
        text: 'If any piece can capture, you must capture. Only pieces that can capture are highlighted. If several '
            + 'can, choose any.',
        successText: 'Captured!',
        rows: [
            '020000000',
            '000000200',
            '000000000',
            '000000100',
            '101000000',
        ],
        actions: [{ kind: 'move', from: at(3, 6), to: at(2, 6) }],
        expectedCaptures: 1,
    },
    {
        id: 'trapped',
        title: 'Trapping',
        text: 'If your opponent can\'t move on their turn, you win. Move into the last free point next to the black '
            + 'piece.',
        successText: 'You win! Black can\'t move.',
        rows: [
            '211000000',
            '101000000',
            '100000000',
            '000000000',
            '000000000',
        ],
        actions: [{ kind: 'move', from: at(1, 2), to: at(1, 1) }],
        expectedCaptures: 0,
        expectWinner: Winner.WHITE,
    },
    {
        id: 'win',
        title: 'Winning',
        text: 'Capture all of your opponent\'s pieces to win. Take the last two black pieces.',
        successText: 'You win! One more rule: if 60 turns pass without a capture, the game is a draw.',
        rows: [
            '000000000',
            '000000000',
            '001022000',
            '000000000',
            '000000000',
        ],
        actions: [{ kind: 'move', from: at(2, 2), to: at(2, 3) }],
        expectedCaptures: 2,
        expectWinner: Winner.WHITE,
    },
];
