import { expect } from 'chai';
import Board from '../../src/Board.js';

/**
 * Runs an operation that should only look at the board (a search, move generation, an evaluator, ...) and checks
 * that the board is left exactly as it was found: every piece, count, turn, capture chain and pending choice.
 * @param description what the operation was, for the failure message.
 * @returns whatever the operation returned.
 */
export function expectBoardUnchanged<T>(board: Board, operation: () => T, description: string): T {
    const before = board.getFullStateForTesting();
    const result = operation();
    expect(board.getFullStateForTesting(), `the board changed during ${description}`).to.deep.equal(before);
    return result;
}
