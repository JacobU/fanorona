import { expect } from 'chai';
import { PieceType, Winner } from '../src/types.js';
import SimpleBot from '../src/SimpleBot.js';
import BotRandomPlayer from '../src/BotRandomPlayer.js';
import Board from '../src/Board.js';

describe('MoveTreeBuilder tests', () => {
    it('simple bot should beat random bot', () => {
        let whiteWins = 0;
        let blackWins = 0;


        while (whiteWins < 100) {
            const board = new Board();
            const white = new SimpleBot(PieceType.WHITE, board);
            const black = new BotRandomPlayer(PieceType.BLACK, board);

            let turn: number = 0;

            while (board.getWinner() === Winner.NONE) {
                if (turn % 2 == 0) {
                    while(white.makeMove().canMoveAgain) {}
                } else {
                    while(black.makeMove().canMoveAgain) {}
                }
                turn++;
                console.log("Number of white pieces left: %d. Number of black pieces left: %d", board.saveBoardState().numWhitePieces, board.saveBoardState().numBlackPieces);
            }

            let winMessage: string;
            if (board.getWinner() === Winner.WHITE) {
                whiteWins++;
                winMessage = "WHITE WON!";
            } else {
                blackWins++;
                winMessage = "BLACK WON!";
            }

            console.log(winMessage);        
        }

        console.log('No. of white wins was: ' + whiteWins);
        console.log('No. of black wins was: ' + blackWins);
    });

    
});