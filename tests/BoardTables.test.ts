import { expect } from 'chai';
import Board from '../src/Board.js';
import Cell from '../src/Cell.js';
import { BoardTables, NO_NEIGHBOUR, buildBoardTables, getBoardTables } from '../src/BoardTables.js';
import { CellType, Direction, PieceType, getOppositeDirection } from '../src/types.js';

const SIZES: [number, number][] = [[3, 3], [3, 5], [5, 5], [5, 9]];
const ALL_DIRECTIONS = [0, 1, 2, 3, 4, 5, 6, 7] as Direction[];

/**
 * Makes the cells the same way the Board does, so the tables can be checked against the cells' own connections.
 */
function makeCells(rows: number, columns: number): Cell[] {
    const cells: Cell[] = [];
    for (let i = 0; i < rows * columns; i++) {
        cells.push(new Cell(i, i % 2 === 0 ? CellType.STRONG : CellType.WEAK, PieceType.EMPTY, rows, columns));
    }
    return cells;
}

describe('Board lookup tables', () => {
    for (const [rows, columns] of SIZES) {
        describe(`on a ${rows}x${columns} board`, () => {
            let cells: Cell[];
            let tables: BoardTables;
            beforeEach(() => {
                cells = makeCells(rows, columns);
                tables = buildBoardTables(cells);
            });

            it('should give the connected cell in each direction, or NO_NEIGHBOUR where there is no connection', () => {
                for (const cell of cells) {
                    for (const direction of ALL_DIRECTIONS) {
                        const connection = cell.getCellConnections().find(c => c.direction === direction);
                        expect(tables.neighbour[cell.getIndex() * 8 + direction], `cell ${cell.getIndex()} direction ${Direction[direction]}`)
                            .to.equal(connection ? connection.index : NO_NEIGHBOUR);
                    }
                }
            });

            it('should list the directions each cell connects in, in the same order as its connections', () => {
                for (const cell of cells) {
                    expect(tables.directions[cell.getIndex()]).to.deep.equal(cell.getCellConnections().map(c => c.direction));
                }
            });

            it('should list the connected cells in the same order as the connections', () => {
                for (const cell of cells) {
                    expect(tables.connected[cell.getIndex()]).to.deep.equal(cell.getCellConnections().map(c => c.index));
                }
            });

            it('should be symmetric: if B is A\'s neighbour in a direction, A is B\'s neighbour in the opposite direction', () => {
                for (const cell of cells) {
                    for (const direction of ALL_DIRECTIONS) {
                        const neighbour = tables.neighbour[cell.getIndex() * 8 + direction];
                        if (neighbour === NO_NEIGHBOUR) continue;
                        expect(tables.neighbour[neighbour * 8 + getOppositeDirection(direction)]).to.equal(cell.getIndex());
                    }
                }
            });
        });
    }

    it('should build the tables once per board size and share them', () => {
        const cells = makeCells(5, 9);
        expect(getBoardTables(5, 9, cells)).to.equal(getBoardTables(5, 9, makeCells(5, 9)));
        expect(getBoardTables(3, 3, makeCells(3, 3))).to.not.equal(getBoardTables(5, 9, cells));
    });

    it('should give the same connected cells through the board as through the cells', () => {
        const board = new Board();
        const cells = makeCells(5, 9);
        for (const cell of cells) {
            expect(board.getConnectedIndexes(cell.getIndex())).to.deep.equal(cell.getCellConnections().map(c => c.index));
        }
    });
});
