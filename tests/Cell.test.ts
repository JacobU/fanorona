import { expect } from 'chai';
import Cell from '../src/Cell.js';
import { CellType, Connection, Direction, PieceType } from '../src/types.js';

describe('Cell tests', () => {

    // Check cell connections
    it('should provide correct cell connections for a 3x3 board', () => {

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

        let board: Cell[] = [];
        for (let i = 0; i < 9; i++) {
            let cellType: CellType = CellType.WEAK;
            if (i % 2 == 0) {
                cellType = CellType.STRONG;
            }
            board.push(new Cell(i, cellType, PieceType.EMPTY, 3, 3));
        }
        expect(board[0].getCellConnections()).to.deep.equal(connectionsFor0);
        expect(board[1].getCellConnections()).to.deep.equal(connectionsFor1);
        expect(board[2].getCellConnections()).to.deep.equal(connectionsFor2);
        expect(board[3].getCellConnections()).to.deep.equal(connectionsFor3);
        expect(board[4].getCellConnections()).to.deep.equal(connectionsFor4);
        expect(board[5].getCellConnections()).to.deep.equal(connectionsFor5);
        expect(board[6].getCellConnections()).to.deep.equal(connectionsFor6);
        expect(board[7].getCellConnections()).to.deep.equal(connectionsFor7);
        expect(board[8].getCellConnections()).to.deep.equal(connectionsFor8);
    });    
});
