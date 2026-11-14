import { expect } from 'chai';
import Board from '../src/Board.js';
import { AttackType, Direction, PieceType, getDeltaIndex, getOppositePieceType } from '../src/types.js';
import { boardFromPosition, sideToMove } from '../src/ai/testPositions.js';
import { expectBoardUnchanged } from './helpers/boardInvariance.js';
import { loadGolden } from './helpers/golden.js';

const emptyRow5 = '00000';

/**
 * The original capture rule, kept here as an independent reference: step along the line by index arithmetic,
 * checking each step against the cells' connections, and take opponent pieces until the line breaks or ends.
 */
function referenceCaptures(board: Board, fromIndex: number, direction: Direction, attackType: AttackType): number[] {
    const columns = board.getBoardsNumberOfColumns();
    const numCells = board.getBoardsNumberOfRows() * columns;
    const opponent = getOppositePieceType(board.getPieceTypeAtIndex(fromIndex));
    // Approach: start at the cell the piece moves to and go forwards. Withdraw: start where the piece was and go backwards.
    const delta = getDeltaIndex(direction, columns) * (attackType === AttackType.WITHDRAW ? -1 : 1);
    let previous = attackType === AttackType.WITHDRAW ? fromIndex : fromIndex + delta;
    let current = previous + delta;
    const captured: number[] = [];
    while (current >= 0 && current < numCells
        && board.getConnectedIndexes(previous).includes(current)
        && board.getPieceTypeAtIndex(current) === opponent) {
        captured.push(current);
        previous = current;
        current += delta;
    }
    return captured;
}

describe('Working out captures by walking the line', () => {
    it('should list a single piece captured by approach', () => {
        // White at 0 approaches black at 2 by moving right to 1
        const board = new Board(5, 5, '10200' + emptyRow5.repeat(4));
        expect(board.getPiecesCapturedByMove(0, Direction.RIGHT, AttackType.APPROACH)).to.deep.equal([2]);
    });

    it('should list a whole line of pieces, stopping at the edge of the board', () => {
        const board = new Board(5, 5, '10222' + emptyRow5.repeat(4));
        expect(board.getPiecesCapturedByMove(0, Direction.RIGHT, AttackType.APPROACH)).to.deep.equal([2, 3, 4]);
    });

    it('should stop at a gap in the line', () => {
        const board = new Board(5, 5, '10202' + emptyRow5.repeat(4));
        expect(board.getPiecesCapturedByMove(0, Direction.RIGHT, AttackType.APPROACH)).to.deep.equal([2]);
    });

    it('should stop at one of the player\'s own pieces', () => {
        const board = new Board(5, 5, '10212' + emptyRow5.repeat(4));
        expect(board.getPiecesCapturedByMove(0, Direction.RIGHT, AttackType.APPROACH)).to.deep.equal([2]);
    });

    it('should list the pieces behind the piece when withdrawing', () => {
        // White at 2 moves right, away from black at 1 and 0
        const board = new Board(5, 5, '22100' + emptyRow5.repeat(4));
        expect(board.getPiecesCapturedByMove(2, Direction.RIGHT, AttackType.WITHDRAW)).to.deep.equal([1, 0]);
    });

    it('should follow diagonal lines', () => {
        // White at 0 moves diagonally to 6, approaching black at 12 and 18 on the same diagonal
        const board = new Board(5, 5, '10000' + '00000' + '00200' + '00020' + '00000');
        expect(board.getPiecesCapturedByMove(0, Direction.DOWNRIGHT, AttackType.APPROACH)).to.deep.equal([12, 18]);
    });

    it('should not wrap around the edge of the board', () => {
        // White at 2 moves right to 3, so the next cell along is 4. Black at 5 is on the next row, so isn't on the line.
        const board = new Board(5, 5, '00100' + '20000' + emptyRow5.repeat(3));
        expect(board.getPiecesCapturedByMove(2, Direction.RIGHT, AttackType.APPROACH)).to.deep.equal([]);
    });

    it('should list nothing for a move that does not capture', () => {
        const board = new Board(5, 5, '10000' + emptyRow5.repeat(3) + '00002');
        expect(board.getPiecesCapturedByMove(0, Direction.RIGHT, AttackType.NONE)).to.deep.equal([]);
    });

    it('should match the original rule and the pieces performMove removes, for every capture in the test positions', function () {
        this.timeout(60_000);
        let checked = 0;
        for (const { position } of loadGolden().entries) {
            const board = boardFromPosition(position);
            // Between turns both players' moves are checked; part way through a chain only the moving piece can move
            const pieces = position.kind === 'midChain'
                ? [position.state.currentlyMovingPiece!]
                : Array.from({ length: position.rows * position.columns }, (_, i) => i).filter(i => board.getPieceTypeAtIndex(i) !== PieceType.EMPTY);
            for (const index of pieces) {
                for (const move of board.getPossibleMovesForCell(index)) {
                    if (move.attackType === AttackType.NONE) continue;
                    const name = `${position.name}: ${index} ${Direction[move.direction]} ${AttackType[move.attackType]}`;
                    const walked = expectBoardUnchanged(board, () => board.getPiecesCapturedByMove(index, move.direction, move.attackType), name);
                    expect(walked, `${name} (original rule)`).to.deep.equal(referenceCaptures(board, index, move.direction, move.attackType));

                    // Play the move and see which of the opponent's pieces disappeared
                    const saved = board.saveBoardState();
                    const opponent = getOppositePieceType(board.getPieceTypeAtIndex(index));
                    board.setAttackOrWithdraw(move.attackType);
                    board.performMove(index, move.direction, true);
                    const removed = saved.positions
                        .map((piece, i) => piece === opponent && board.getPieceTypeAtIndex(i) === PieceType.EMPTY ? i : -1)
                        .filter(i => i !== -1);
                    expect([...walked].sort((a, b) => a - b), `${name} (performMove)`).to.deep.equal(removed);
                    expect(board.getNumPieces(opponent), `${name} (piece count)`).to.equal(opponent === PieceType.WHITE
                        ? saved.numWhitePieces - walked.length : saved.numBlackPieces - walked.length);
                    board.resetBoardState(saved);
                    checked++;
                }
            }
        }
        // Make sure the loop really did check a good number of captures
        expect(checked).to.be.greaterThan(1000);
    });

    it('getCapturablePieces should only read the board, and find every piece the attacker could capture first', () => {
        for (const { position } of loadGolden().entries.filter(e => e.position.kind !== 'midChain').slice(0, 100)) {
            const board = boardFromPosition(position);
            const attacker = sideToMove(board);
            const expected = new Set<number>();
            for (const index of board.getPiecesThatPlayerCanMove(attacker)) {
                for (const move of board.getPossibleMovesForCell(index)) {
                    if (move.attackType === AttackType.NONE) continue;
                    referenceCaptures(board, index, move.direction, move.attackType).forEach(i => expected.add(i));
                }
            }
            const capturable = expectBoardUnchanged(board, () => board.getCapturablePieces(attacker), position.name);
            expect([...capturable].sort((a, b) => a - b), position.name).to.deep.equal([...expected].sort((a, b) => a - b));
        }
    });
});
