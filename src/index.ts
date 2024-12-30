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


function highlightPossibleMoves(possibleMoves: number[]) {
    const buttons = document.querySelectorAll('.grid-container button');

    // Display all possible moves
    for (let i = 0; i < possibleMoves.length; i++) {
        const button = buttons[possibleMoves[i]];
        if (button) {
            button.classList.add('possibleMove');
        }
    }
}

function highlightMoveablePieces(moveablePieces: number[]) {
    const buttons = document.querySelectorAll('.grid-container button');

    // Display all moveable pieces
    for (let i = 0; i < moveablePieces.length; i++) {
        const button = buttons[moveablePieces[i]];
        if (button) {
            button.classList.add('moveablePiece');
        }
    }
}

function removeAllHighlighting() {
    const buttonsWithMoveablePiece = document.querySelectorAll('.grid-container button.moveablePiece');
    buttonsWithMoveablePiece.forEach(button => {
        button.classList.remove('moveablePiece');
    });
    const possibleMoves = document.querySelectorAll('.grid-container button.possibleMove');
    possibleMoves.forEach(button => {
        button.classList.remove('possibleMove');
    });
}


function onCellClicked(index: number) {

    console.log(index);

    console.log('entered on click handler')
    cellClickHandler.handleCellClick(index);
    removeAllHighlighting();

    if (board.getTurn() === Turn.WHITE) {
        const currentHandlerState = cellClickHandler.getHandlerState();
        // If we've selected a piece, tell the player where that piece can move
        if (currentHandlerState.selectedCell !== null) {
            const possibleMoves: number[] = board.getPossibleMovesForCell(currentHandlerState.selectedCell).map(move => move.index);
            highlightPossibleMoves(possibleMoves);
            
        } else {
            // Otherwise let them know which pieces that can select
            const moveablePieces: number[] = board.getPiecesThatPlayerCanMove(PieceType.WHITE);
            highlightMoveablePieces(moveablePieces);
        }
    }
    
    drawBoard(board, ctx, lightPiece, darkPiece, wood, null);

    console.log(board.getTurn());
    if (board.getTurn() === Turn.BLACK) {
        console.log('bot made a move');
        while(botPlayer.makeMove()) {
            // animatePieceMove(board, ctx, lightPiece, darkPiece, wood, index, )
        }
        drawBoard(board, ctx, lightPiece, darkPiece, wood, null);
    }
}