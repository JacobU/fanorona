import Board from './Board.js';

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
lightPiece.src = "./assets/svg/lightPieceDetailed.svg"; // Replace with the path to your circle image
darkPiece.src = "./assets/svg/darkPieceDetailed.svg"; // Replace with the path to your circle image

const board = new Board();

let imagesLoaded = 0;

const checkImagesLoaded = () => {
    imagesLoaded++;
    if (imagesLoaded === 2) {
        drawBoard(board);
    }
};

lightPiece.onload = checkImagesLoaded;
darkPiece.onload = checkImagesLoaded;


function drawBoard(board: Board) {
    // Draw the connecting lines
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = col * cellWidth + cellWidth / 2;
            const y = row * cellHeight + cellHeight / 2;

            // Draw horizontal line
            if (col < cols - 1) {
                const x2 = (col + 1) * cellWidth + cellWidth / 2;
                const y2 = y;
                drawLine(x, y, x2, y2);
            }

            // Draw vertical line
            if (row < rows - 1) {
                const x2 = x;
                const y2 = (row + 1) * cellHeight + cellHeight / 2;
                drawLine(x, y, x2, y2);
            }

            // Draw diagonal lines (if applicable)
            if (col < cols - 1 && row < rows - 1) {
                drawLine(x, y, x + cellWidth, y + cellHeight); // Down-right diagonal
            }
            if (col > 0 && row < rows - 1) {
                drawLine(x, y, x - cellWidth, y + cellHeight); // Down-left diagonal
            }
        }
    }

    let boardIndex = 0;
    const boardString = board.getBoardPositionsAsString();
    const pieceWidth = 60;
    // Draw the grid of circles
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = col * cellWidth + cellWidth / 2 - pieceWidth / 2;
            const y = row * cellHeight + cellHeight / 2 - pieceWidth / 2;

            const pieceType = boardString.at(boardIndex);
            // Draw the circle
            switch (pieceType) {
                case '0':
                    break;
                case '1':
                    ctx.drawImage(lightPiece, x, y, pieceWidth, pieceWidth);
                    break;
                case '2':
                    ctx.drawImage(darkPiece, x, y, pieceWidth, pieceWidth);
            }
            boardIndex++;
        }
    }
}

function drawLine(x1: number, y1: number, x2: number, y2: number): void {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = "#000"; // Line color
    ctx.lineWidth = 2;       // Line width
    ctx.stroke();
}
