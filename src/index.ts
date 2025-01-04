import Board from './Board.js';
import BotRandomPlayer from './BotRandomPlayer.js';
import CellClickHandler from './CellClickHandler.js';
import { PieceType, Turn, Direction, Winner } from './types.js';
import { drawBoard, animatePieceMove } from './DrawBoardAndPieces.js';

// Set up the canvas and context
const canvas = document.getElementById("fanoronaBoard") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

// Load the circle image
const lightPiece = new Image();
const darkPiece = new Image();
const wood = new Image();
lightPiece.src = "./assets/svg/lightPiece.svg"; 
darkPiece.src = "./assets/svg/darkPiece.svg";
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

document.getElementById('play-again-button')!.addEventListener('click', playAgain);

// Initial highlighting
highlightMoveablePieces(board.getPiecesThatPlayerCanMove(PieceType.WHITE));

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

function highlightApproachOrWithdrawPieces(highlightApproachOrWithdrawPieces: number[]) {
    const buttons = document.querySelectorAll('.grid-container button');

    // Display the two pieces that players can choose to attack
    for (let i = 0; i < highlightApproachOrWithdrawPieces.length; i++) {
        const button = buttons[highlightApproachOrWithdrawPieces[i]];
        if (button) {
            button.classList.add('approachOrWithdraw');
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
    const approachOrWithdrawPieces = document.querySelectorAll('.grid-container button.approachOrWithdraw');
    approachOrWithdrawPieces.forEach(button => {
        button.classList.remove('approachOrWithdraw');
    });
}

function endGame() {
    let message: string;
    if (board.getWinner() === Winner.WHITE) {
        message = 'You won!';
    } else {
        message = 'You lost!'
    }
    const messageContainer = document.getElementById('message-container');
    messageContainer!.style.display = 'flex';

    const winLossMessageDiv = document.getElementById('game-message');
    winLossMessageDiv!.textContent = message;
}

function playAgain() {
    const messageContainer = document.getElementById('message-container');
    messageContainer!.style.display = 'none';
    board.reset();
    removeAllHighlighting();
    highlightMoveablePieces(board.getPiecesThatPlayerCanMove(PieceType.WHITE));
    drawBoard(board, ctx, lightPiece, darkPiece, wood, null);
}

async function onCellClicked(index: number) {

    const handlerState = cellClickHandler.getHandlerState();
    // If a move was made, we know it was made by white, so animate the white piece
    const moveWasPerformed = cellClickHandler.handleCellClick(index);
    if (moveWasPerformed) {
        // If a move was performed, but it was done by selecting the approach or withdraw piece, we need to check what the selectedPiece 
        // was before the current click. This will give us the actual direction.
        const direction: Direction = handlerState.approachOrWithdrawPieces 
            ? handlerState.possibleMoves.find(move => move.index === handlerState.approachOrWithdrawMoveIndex)!.direction
            : handlerState.possibleMoves.find(move => move.index === index)!.direction;
        
        await animatePieceMove(board, ctx, lightPiece, darkPiece, wood, handlerState.selectedCell!, direction, lightPiece);
    }

    removeAllHighlighting();

    if (board.getWinner() !== Winner.NONE) {
        endGame();
        return;
    }

    if (board.getTurn() === Turn.BLACK) {
        let notFinishedTurn: boolean = true;
        while(notFinishedTurn) {
            const moveResults = botPlayer.makeMove();
            notFinishedTurn = moveResults.canMoveAgain;
            await animatePieceMove(board, ctx, lightPiece, darkPiece, wood, moveResults.move.index, moveResults.move.direction, darkPiece);
        }
        drawBoard(board, ctx, lightPiece, darkPiece, wood, null);
    }

    if (board.getWinner() !== Winner.NONE) {
        endGame();
        return;
    }

    if (board.getTurn() === Turn.WHITE) {
        const currentHandlerState = cellClickHandler.getHandlerState();
        // If we are selecting withdraw or approach, highlight the two pieces
        if (currentHandlerState.approachOrWithdrawPieces) {
            highlightApproachOrWithdrawPieces(currentHandlerState.approachOrWithdrawPieces);

        // If we've selected a piece, tell the player where that piece can move
        } else if (currentHandlerState.selectedCell !== null) {
            const possibleMoves: number[] = board.getPossibleMovesForCell(currentHandlerState.selectedCell).map(move => move.index);
            highlightPossibleMoves(possibleMoves);
            
        } else {
            // Otherwise let them know which pieces that can select
            const moveablePieces: number[] = board.getPiecesThatPlayerCanMove(PieceType.WHITE);
            highlightMoveablePieces(moveablePieces);
        }
    }


}