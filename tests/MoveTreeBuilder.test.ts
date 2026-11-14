import { expect } from 'chai';
import { AttackType, CompleteMove, PieceType } from '../src/types.js';
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
            { moveIndexes: [ 0 ], moveTypes: [ AttackType.WITHDRAW ] },
            { moveIndexes: [ 5, 2 ], moveTypes: [ AttackType.WITHDRAW, AttackType.WITHDRAW ] }
        ];
        expect(possibleMoves).to.deep.equals(expectedPossibleMoves);
    });


    it('should return all paika moves for a nearly empty 5x5 board', () => {
        const board = new Board(5, 5, '0000000010000000000020000');
        const possibleMoves = board.getAllPossibleMovesForSinglePiece(8);
        const expectedPossibleMoves: CompleteMove[] = [
            { moveIndexes: [ 2 ], moveTypes: [ AttackType.NONE ] },
            { moveIndexes: [ 3 ], moveTypes: [ AttackType.NONE ] },
            { moveIndexes: [ 4 ], moveTypes: [ AttackType.NONE ] },
            { moveIndexes: [ 7 ], moveTypes: [ AttackType.NONE ] },
            { moveIndexes: [ 9 ], moveTypes: [ AttackType.NONE ] },
            { moveIndexes: [ 12 ], moveTypes: [ AttackType.NONE ] },
            { moveIndexes: [ 13 ], moveTypes: [ AttackType.NONE ] },
            { moveIndexes: [ 14 ], moveTypes: [ AttackType.NONE ] }
        ];
        expect(possibleMoves).to.deep.equals(expectedPossibleMoves);
    });

    it('should not allow the piece to return to the center of 3x3 board', () => {
        const board = new Board(3, 3, '200010220');

        const possibleMoves = board.getAllPossibleMovesForSinglePiece(4);
        const expectedPossibleMoves: CompleteMove[] = [
            { moveIndexes: [ 1, 2 ], moveTypes: [ AttackType.WITHDRAW, AttackType.WITHDRAW ] },
            { moveIndexes: [ 2, 1 ], moveTypes: [ AttackType.WITHDRAW, AttackType.APPROACH ] },
            { moveIndexes: [ 8 ], moveTypes: [ AttackType.WITHDRAW ] }
        ];
        expect(possibleMoves).to.deep.equals(expectedPossibleMoves);
    });

    it('should return the right possible moves for 5x5 board', () => {
        const board = new Board(5, 5, '0020002000201020200000002');

        const possibleMoves = board.getAllPossibleMovesForSinglePiece(12);
        const expectedPossibleMoves: CompleteMove[] = [
            { moveIndexes: [ 7, 8, 2, 6, 11 ], moveTypes: [ AttackType.APPROACH, AttackType.WITHDRAW, AttackType.WITHDRAW, AttackType.APPROACH, AttackType.APPROACH ] },
            { moveIndexes: [ 8, 7 ], moveTypes: [ AttackType.WITHDRAW, AttackType.APPROACH ] },
            { moveIndexes: [ 11 ], moveTypes: [ AttackType.APPROACH ] },
            { moveIndexes: [ 13 ], moveTypes: [ AttackType.APPROACH ] },
            { moveIndexes: [ 18, 17 ], moveTypes: [ AttackType.APPROACH, AttackType.APPROACH ] },
            { moveIndexes: [ 18, 22 ], moveTypes: [ AttackType.APPROACH, AttackType.WITHDRAW ] },
            { moveIndexes: [ 18, 17 ], moveTypes: [ AttackType.WITHDRAW, AttackType.APPROACH ] },
            { moveIndexes: [ 18, 22, 23 ], moveTypes: [ AttackType.WITHDRAW, AttackType.WITHDRAW, AttackType.APPROACH ] }
        ];
        expect(possibleMoves).to.deep.equals(expectedPossibleMoves);
        const repeatedPossibleMoves = board.getAllPossibleMovesForSinglePiece(12);
        expect(repeatedPossibleMoves).to.deep.equals(expectedPossibleMoves);
    });

    it('should return the correct moves for two white pieces in a 3x3 board', () => {
        const board = new Board(3, 3, '210200201');
        const allMoves = board.getAllPossibleCompleteMoves(PieceType.WHITE);
        const expectedPossibleMoves = {
            startIndexes: [1, 8],
            moves: [
                [
                    { moveIndexes: [2, 4, 5], moveTypes: [AttackType.WITHDRAW, AttackType.APPROACH, AttackType.WITHDRAW] }
                ],
                [
                    { moveIndexes: [4, 2], moveTypes: [AttackType.APPROACH, AttackType.WITHDRAW] },
                    { moveIndexes: [4, 5], moveTypes: [AttackType.APPROACH, AttackType.WITHDRAW] },
                    { moveIndexes: [7], moveTypes: [AttackType.APPROACH] }
                ]
            ]
        };
        expect(allMoves).to.deep.equals(expectedPossibleMoves);
    });

    it('should not include chains that move in the same direction twice in a row', () => {
        const board = new Board(5, 9, '200202022200010222000200021100020000010000011');
        const possibleMoves = board.getAllPossibleMovesForSinglePiece(13);
        expect(possibleMoves.length).to.be.greaterThan(0);
        for (const move of possibleMoves) {
            const path = [13, ...move.moveIndexes];
            for (let i = 2; i < path.length; i++) {
                expect(path[i] - path[i - 1]).to.not.equal(path[i - 1] - path[i - 2]);
            }
        }
    });

    it('should not allow an attack after a paika move', () => {
        // Black at 10 has no attacks, but after a paika move to 20 it would be able to withdraw. That must end the turn.
        const board = new Board(5, 9, '220002000220000000210000000110000000111100020');
        const possibleMoves = board.getAllPossibleMovesForSinglePiece(10);
        expect(possibleMoves.length).to.be.greaterThan(0);
        expect(possibleMoves.every(m => m.moveTypes[0] === AttackType.NONE && m.moveIndexes.length === 1)).to.be.true;
    });
});
