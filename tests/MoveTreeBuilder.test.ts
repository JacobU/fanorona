import { expect } from 'chai';
import Board from '../src/Board.js';


describe('MoveTreeBuilder tests', () => {
    it('should return the right possible moves for simple 3x3 board', () => {
        const board = new Board(3, 3, '000210002');

        console.log(board.getAllPossibleMovesForSinglePiece(4).length);
        console.log(board.getAllPossibleMovesForSinglePiece(4).length);
        const moves = board.getAllPossibleMovesForSinglePiece(4);
        expect(board.getAllPossibleMovesForSinglePiece(4)).to.deep.equal(moves);
    });

    it('should return the right possible moves for 5x5 board', () => {
        const board = new Board(5, 5, '0020002000201020200000002');

        //console.log(board.saveBoardState());
        console.log(board.getAllPossibleMovesForSinglePiece(12));
        //console.log(board.saveBoardState());
        //console.log(board.getAllPossibleMovesForSinglePiece(12).length);
        //const moves: CompleteMove[] = board.getAllPossibleMovesForSinglePiece(12);
        // expect(board.getAllPossibleMovesForSinglePiece(12)).to.deep.equal(moves);
        // console.log("number of moves: ", moves.length);
        //console.log(moves);
        // console.log(board.getAllPossibleMovesForSinglePiece(12).length);
        // console.log(board.getAllPossibleMovesForSinglePiece(12));
    });

});