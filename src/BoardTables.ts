import Cell from './Cell.js';
import { Direction } from './types.js';

/*
 * Lookup tables for the lines on the board. A cell's connections never change, so instead of searching a cell's
 * list of connections every time (e.g. "is cell 13 connected to cell 22?"), the answer is looked up directly.
 * The tables are built once per board size from the cells' own connections, and only ever read.
 */

// In the neighbour table, where a cell has no connection in that direction
export const NO_NEIGHBOUR = -1;

export interface BoardTables {
    // neighbour[index * 8 + direction] is the cell connected to index in that direction, or NO_NEIGHBOUR
    neighbour: Int16Array,
    // The directions each cell is connected in, in the same (increasing) order as the cell's connections
    directions: Direction[][],
    // The cells each cell is connected to, in the same order as the cell's connections
    connected: number[][],
}

export function buildBoardTables(cells: Cell[]): BoardTables {
    const neighbour = new Int16Array(cells.length * 8).fill(NO_NEIGHBOUR);
    const directions: Direction[][] = [];
    const connected: number[][] = [];
    for (const cell of cells) {
        const connections = cell.getCellConnections();
        for (const connection of connections) {
            neighbour[cell.getIndex() * 8 + connection.direction] = connection.index;
        }
        directions.push(connections.map(connection => connection.direction));
        connected.push(connections.map(connection => connection.index));
    }
    return { neighbour, directions, connected };
}

const cache = new Map<string, BoardTables>();

/**
 * @returns the tables for this board size, building them from the cells the first time and sharing them after that.
 */
export function getBoardTables(rows: number, columns: number, cells: Cell[]): BoardTables {
    const key = `${rows}x${columns}`;
    let tables = cache.get(key);
    if (tables === undefined) {
        tables = buildBoardTables(cells);
        cache.set(key, tables);
    }
    return tables;
}
