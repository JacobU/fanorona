import { expect } from 'chai';
import Cell from '../src/Cell.js';
import { CellType, Connection, Direction, PieceType } from '../src/types.js';

const connectionsFor0: Connection[] = [
    { index: 1, direction: Direction.RIGHT },
    { index: 3, direction: Direction.DOWN },
    { index: 4, direction: Direction.DOWNRIGHT }
];

const connectionsFor1: Connection[] = [
    { index: 0, direction: Direction.LEFT },
    { index: 2, direction: Direction.RIGHT },
    { index: 4, direction: Direction.DOWN }
];

const connectionsFor2: Connection[] = [
    { index: 1, direction: Direction.LEFT },
    { index: 4, direction: Direction.DOWNLEFT },
    { index: 5, direction: Direction.DOWN }
];

const connectionsFor3: Connection[] = [
    { index: 0, direction: Direction.UP },
    { index: 4, direction: Direction.RIGHT },
    { index: 6, direction: Direction.DOWN }
];

const connectionsFor4: Connection[] = [
    { index: 0, direction: Direction.UPLEFT },
    { index: 1, direction: Direction.UP },
    { index: 2, direction: Direction.UPRIGHT },
    { index: 3, direction: Direction.LEFT },
    { index: 5, direction: Direction.RIGHT },
    { index: 6, direction: Direction.DOWNLEFT },
    { index: 7, direction: Direction.DOWN },
    { index: 8, direction: Direction.DOWNRIGHT }
];

const connectionsFor5: Connection[] = [
    { index: 2, direction: Direction.UP },
    { index: 4, direction: Direction.LEFT },
    { index: 8, direction: Direction.DOWN }
];

const connectionsFor6: Connection[] = [
    { index: 3, direction: Direction.UP },
    { index: 4, direction: Direction.UPRIGHT },
    { index: 7, direction: Direction.RIGHT }
];

const connectionsFor7: Connection[] = [
    { index: 4, direction: Direction.UP },
    { index: 6, direction: Direction.LEFT },
    { index: 8, direction: Direction.RIGHT }
];

const connectionsFor8: Connection[] = [
    { index: 4, direction: Direction.UPLEFT },
    { index: 5, direction: Direction.UP },
    { index: 7, direction: Direction.LEFT }
];

describe('Cell tests', () => {
    let board: Cell[];

    beforeEach(() => {
        board = [];
        for (let i = 0; i < 9; i++) {
            const cellType = i % 2 === 0 ? CellType.STRONG : CellType.WEAK;
            board.push(new Cell(i, cellType, PieceType.EMPTY, 3, 3));
        }
    });

    it('cell 0 — top-left corner STRONG — should connect RIGHT, DOWN, DOWNRIGHT', () => {
        expect(board[0].getCellConnections()).to.deep.equal(connectionsFor0);
    });

    it('cell 1 — top edge WEAK — should connect LEFT, RIGHT, DOWN', () => {
        expect(board[1].getCellConnections()).to.deep.equal(connectionsFor1);
    });

    it('cell 2 — top-right corner STRONG — should connect LEFT, DOWNLEFT, DOWN', () => {
        expect(board[2].getCellConnections()).to.deep.equal(connectionsFor2);
    });

    it('cell 3 — left edge WEAK — should connect UP, RIGHT, DOWN', () => {
        expect(board[3].getCellConnections()).to.deep.equal(connectionsFor3);
    });

    it('cell 4 — center STRONG — should connect all 8 directions', () => {
        expect(board[4].getCellConnections()).to.deep.equal(connectionsFor4);
    });

    it('cell 5 — right edge WEAK — should connect UP, LEFT, DOWN', () => {
        expect(board[5].getCellConnections()).to.deep.equal(connectionsFor5);
    });

    it('cell 6 — bottom-left corner STRONG — should connect UP, UPRIGHT, RIGHT', () => {
        expect(board[6].getCellConnections()).to.deep.equal(connectionsFor6);
    });

    it('cell 7 — bottom edge WEAK — should connect UP, LEFT, RIGHT', () => {
        expect(board[7].getCellConnections()).to.deep.equal(connectionsFor7);
    });

    it('cell 8 — bottom-right corner STRONG — should connect UPLEFT, UP, LEFT', () => {
        expect(board[8].getCellConnections()).to.deep.equal(connectionsFor8);
    });
});
