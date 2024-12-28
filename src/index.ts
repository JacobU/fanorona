import Board from './Board.js';
import BotRandomPlayer from './BotRandomPlayer.js';
import CellClickHandler from './CellClickHandler.js';
import { PieceType, Turn, Direction } from './types.js';
import { drawBoard, animatePieceMove } from './DrawBoardAndPieces.js';

// Set up the canvas and context
const canvas = document.getElementById("fanoronaBoard") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

// Dimensions of the board
const rows = 5;
const cols = 9;
const cellWidth = canvas.width / cols;
const cellHeight = canvas.height / rows;

// Load the circle image
const lightPiece = new Image();
const darkPiece = new Image();
const wood = new Image();
lightPiece.src = "./assets/svg/lightPieceDetailed.svg"; 
darkPiece.src = "./assets/svg/darkPieceDetailed.svg";
wood.src = "./assets/svg/wood.svg";

const board = new Board();
const cellClickHandler = new CellClickHandler(board);
const botPlayer = new BotRandomPlayer(PieceType.BLACK, board);

let imagesLoaded = 0;

const checkImagesLoaded = () => {
    imagesLoaded++;
    if (imagesLoaded === 3) {
        drawBoard(board, ctx, lightPiece, darkPiece, wood, null);
    }
};

lightPiece.onload = checkImagesLoaded;
darkPiece.onload = checkImagesLoaded;
wood.onload = checkImagesLoaded;

document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.grid-container button');
    buttons.forEach((button, index) => {
        button.addEventListener('click', () => {
            const pieceIndex: number = index;
            onCellClicked(pieceIndex);
        });
    });
});

function onCellClicked(index: number) {

    console.log(index);

    console.log('entered on click handler')
    cellClickHandler.handleCellClick(index);

    if (board.getTurn() === Turn.WHITE) {
        const piecesToMove: number[] = board.getPiecesThatPlayerCanMove(PieceType.WHITE);
        const buttons = document.querySelectorAll('.grid-container button');

        // Add a class to selected buttons
        for (let i = 0; i < piecesToMove.length; i++) {
            const button = buttons[piecesToMove[i]];
            if (button) {
                button.classList.add('canMove');
            }
        }
    } else {
        const buttonsWithCanMove = document.querySelectorAll('.grid-container button.canMove');
        buttonsWithCanMove.forEach(button => {
            button.classList.remove('canMove');
        });
    }
    
    drawBoard(board, ctx, lightPiece, darkPiece, wood, null);

    console.log(board.getTurn());
    if (board.getTurn() === Turn.BLACK) {
        console.log('bot made a move');
        while(botPlayer.makeMove()) {}
        drawBoard(board, ctx, lightPiece, darkPiece, wood, null);
    }
}