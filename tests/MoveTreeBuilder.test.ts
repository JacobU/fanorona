import { expect } from 'chai';
import { CompleteMove } from '../src/types.js';
import Board from '../src/Board.js';


describe('MoveTreeBuilder tests', () => {
    it('should return empty if there are no moves', () => {
        const board = new Board(3, 3, '222212222');
        const possibleMoves = board.getAllPossibleMovesForSinglePiece(4);
        expect(possibleMoves.length).to.be.equal(0);
    });

    it('should return no paika moves on 3x3 board since white has won', () => {
        const board = new Board(3, 3, '000010000');
        const possibleMoves = board.getAllPossibleMovesForSinglePiece(4);
        expect(possibleMoves.length).to.be.equal(0);
    });

    it('should return the right possible moves for simple 3x3 board', () => {
        const board = new Board(3, 3, '000210002');
        const possibleMoves = board.getAllPossibleMovesForSinglePiece(4);
        const expectedPossibleMoves: CompleteMove[] = [
            { moveIndexes: [ 0 ], moveTypes: [ 2 ] },
            { moveIndexes: [ 5, 2 ], moveTypes: [ 2, 2 ] }
        ];
        expect(possibleMoves).to.deep.equals(expectedPossibleMoves);
    });

    it('should return all paika moves for a nearly empty 5x5 board', () => {
        const board = new Board(5, 5, '0000000010000000000020000');
        const possibleMoves = board.getAllPossibleMovesForSinglePiece(8);
        const expectedPossibleMoves: CompleteMove[] = [
            { moveIndexes: [ 2 ], moveTypes: [ 0 ] },
            { moveIndexes: [ 3 ], moveTypes: [ 0 ] },
            { moveIndexes: [ 4 ], moveTypes: [ 0 ] },
            { moveIndexes: [ 7 ], moveTypes: [ 0 ] },
            { moveIndexes: [ 9 ], moveTypes: [ 0 ] },
            { moveIndexes: [ 12 ], moveTypes: [ 0 ] },
            { moveIndexes: [ 13 ], moveTypes: [ 0 ] },
            { moveIndexes: [ 14 ], moveTypes: [ 0 ] }
        ];
        expect(possibleMoves).to.deep.equals(expectedPossibleMoves);
    });

    it('should not allow the piece to return to the center of 3x3 board', () => {
        const board = new Board(3, 3, '200010220');

        const possibleMoves = board.getAllPossibleMovesForSinglePiece(4);
        const expectedPossibleMoves: CompleteMove[] = [
            { moveIndexes: [ 1, 2 ], moveTypes: [ 2, 2 ] },
            { moveIndexes: [ 2, 1 ], moveTypes: [ 2, 1 ] },
            { moveIndexes: [ 8 ], moveTypes: [ 2 ] }
        ];
        expect(possibleMoves).to.deep.equals(expectedPossibleMoves);
    });

    it('should return the right possible moves for 5x5 board', () => {
        const board = new Board(5, 5, '0020002000201020200000002');

        const possibleMoves = board.getAllPossibleMovesForSinglePiece(12);
        const expectedPossibleMoves: CompleteMove[] = [
            { moveIndexes: [ 7, 8, 2, 6, 11 ], moveTypes: [ 1, 2, 2, 1, 1 ] },
            { moveIndexes: [ 8, 7 ], moveTypes: [ 2, 1 ] },
            { moveIndexes: [ 11 ], moveTypes: [ 1 ] },
            { moveIndexes: [ 13 ], moveTypes: [ 1 ] },
            { moveIndexes: [ 18, 17 ], moveTypes: [ 1, 1 ] },
            { moveIndexes: [ 18, 22 ], moveTypes: [ 1, 2 ] },
            { moveIndexes: [ 18, 17 ], moveTypes: [ 2, 1 ] },
            { moveIndexes: [ 18, 22, 23 ], moveTypes: [ 2, 2, 1 ] }
        ];
        expect(possibleMoves).to.deep.equals(expectedPossibleMoves);
        const repeatedPossibleMoves = board.getAllPossibleMovesForSinglePiece(12);
        expect(repeatedPossibleMoves).to.deep.equals(expectedPossibleMoves);
    });

});