import Board from './Board';
import BotRandomPlayer from './BotRandomPlayer';
import { PieceType, Winner } from './types';

let whiteWins = 0;
let blackWins = 0;


while (whiteWins < 1000) {
    const board = new Board();
    const white = new BotRandomPlayer(PieceType.WHITE, board);
    const black = new BotRandomPlayer(PieceType.BLACK, board);

    let turn: number = 0;
    //board.displayBoard();

    while (board.getWinner() === Winner.NONE) {
        if (turn % 2 == 0) {
            white.makeMove();
        } else {
            black.makeMove();
        }
        turn++;
    }

    let winMessage: string;
    if (board.getWinner() === Winner.WHITE) {
        whiteWins++;
        winMessage = "White won!";
    } else {
        blackWins++;
        winMessage = "Black won!";
    }

    console.log(winMessage);        
}

console.log('No. of white wins was: ' + whiteWins);
console.log('No. of black wins was: ' + blackWins);

