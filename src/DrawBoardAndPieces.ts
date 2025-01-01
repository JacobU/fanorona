import Board from '../src/Board.js';
import { Direction, getDeltaIndex } from '../src/types.js'; 

const cellSize: number = 100;
const pieceWidth: number = 60;

export function drawBoard(board: Board, ctx: CanvasRenderingContext2D, lightPiece: HTMLImageElement, darkPiece: HTMLImageElement, wood: HTMLImageElement, indexesToExclude: null | number[]) {
    const rows = board.getBoardsNumberOfRows();
    const cols = board.getBoardsNumberOfColumns();
    ctx.clearRect(0, 0, cols * cellSize, rows * cellSize);
    // Background board
    ctx.drawImage(wood, 0, 0, cols * cellSize, rows * cellSize);

    // Draw the connecting lines
    let lineIndex = 0;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = col * cellSize + cellSize / 2;
            const y = row * cellSize + cellSize / 2;

            // Draw horizontal line
            if (col < cols - 1) {
                const x2 = (col + 1) * cellSize + cellSize / 2;
                const y2 = y;
                drawLine(ctx, x, y, x2, y2);
            }

            // Draw vertical line
            if (row < rows - 1) {
                const x2 = x;
                const y2 = (row + 1) * cellSize + cellSize / 2;
                drawLine(ctx, x, y, x2, y2);
            }

            if (lineIndex % 2 == 0) {
                // Draw diagonal lines (if applicable)
                if (col < cols - 1 && row < rows - 1) {
                    drawLine(ctx, x, y, x + cellSize, y + cellSize); // Down-right diagonal
                }
                if (col > 0 && row < rows - 1) {
                    drawLine(ctx, x, y, x - cellSize, y + cellSize); // Down-left diagonal
                }
            }
            lineIndex++;
        }
    }

    let boardString = board.getBoardPositionsAsString();
    // Exclude the current piece from being drawn temporarily
    if (indexesToExclude) {
        for(let i = 0; i < indexesToExclude.length; i++) {
            boardString = boardString.slice(0, indexesToExclude[i]) + '0' + boardString.slice(indexesToExclude[i] + 1);
        }
    }
    drawPieces(ctx, lightPiece, darkPiece, boardString, rows, cols, cellSize);
}

function drawPieces(ctx: CanvasRenderingContext2D, lightPiece: HTMLImageElement, darkPiece: HTMLImageElement, boardString: string, rows: number, cols: number, cellSize: number) {
    let boardIndex = 0;
    const pieceWidth = 60;
    
    // Draw the grid of circles
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = col * cellSize + cellSize / 2 - pieceWidth / 2;
            const y = row * cellSize + cellSize / 2 - pieceWidth / 2;

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

function drawLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = "#000"; // Line color
    ctx.lineWidth = 2;       // Line width
    ctx.stroke();
}

export function animatePieceMove(
    board: Board, 
    ctx: CanvasRenderingContext2D, 
    lightPiece: HTMLImageElement, 
    darkPiece: HTMLImageElement, 
    wood: HTMLImageElement, 
    indexToAnimate: number, 
    direction: Direction, 
    pieceImage: HTMLImageElement, 
    callback?: () => void
): Promise<void> {
    return new Promise((resolve) => {
        const cols = board.getBoardsNumberOfColumns();
        const rows = board.getBoardsNumberOfRows();

        const startCol = (indexToAnimate) % cols;
        const startRow = Math.floor(indexToAnimate / cols);

        const endIndex = indexToAnimate + getDeltaIndex(direction, cols);
        
        const endCol = (endIndex) % cols;
        const endRow = Math.floor(endIndex / cols);
        
        const startX = startCol * cellSize + cellSize / 2 - pieceWidth / 2;
        const startY = startRow * cellSize + cellSize / 2 - pieceWidth / 2;
        const endX = endCol * cellSize + cellSize / 2 - pieceWidth / 2;
        const endY = endRow * cellSize + cellSize / 2 - pieceWidth / 2;

        const duration = 1000; // Animation duration in milliseconds
        let startTime: number;

        const indexesToExclude: number[] = [indexToAnimate, endIndex];

        function animateFrame(timestamp: number) {
            if (!startTime) startTime = timestamp;

            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1); // Ensure progress stays within [0, 1]

            // Interpolate position
            const currentX = startX + (endX - startX) * progress;
            const currentY = startY + (endY - startY) * progress;

            // Clear the canvas and redraw the board without the animated piece
            ctx.clearRect(0, 0, cols * cellSize, rows * cellSize);
            drawBoard(board, ctx, lightPiece, darkPiece, wood, indexesToExclude);

            // Draw the animated piece at its current position
            ctx.drawImage(pieceImage, currentX, currentY, pieceWidth, pieceWidth);

            if (progress < 1) {
                requestAnimationFrame(animateFrame);
            } else {
                // Animation complete
                if (callback) callback();
                resolve();
            }
        }

        requestAnimationFrame(animateFrame);
    });
}