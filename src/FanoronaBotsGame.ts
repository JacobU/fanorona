import Board from './Board.js';
import BotRandomPlayer from './ai/BotRandomPlayer.js';
import SimpleBot from './ai/SimpleBot.js';
import { PieceType, Winner } from './types.js';

let whiteWins = 0;
let blackWins = 0;
let draws = 0;


while (whiteWins < 1000) {
    const board = new Board();
    const white = new SimpleBot(PieceType.WHITE, board);
    const black = new BotRandomPlayer(PieceType.BLACK, board);

    let turn: number = 0;
    //board.displayBoard();

    while (board.getWinner() === Winner.NONE) {
        if (turn % 2 == 0) {
            while(white.makeMove().canMoveAgain) {}
        } else {
            while(black.makeMove().canMoveAgain) {}
        }
        turn++;
    }

    let winMessage: string;
    if (board.getWinner() === Winner.WHITE) {
        whiteWins++;
        winMessage = "White won!";
    } else if (board.getWinner() === Winner.DRAW) {
        draws++;
        winMessage = "Draw!";
    } else {
        blackWins++;
        winMessage = "Black won!";
    }

    console.log(winMessage);
}

console.log('No. of white wins was: ' + whiteWins);
console.log('No. of black wins was: ' + blackWins);
console.log('No. of draws was: ' + draws);

