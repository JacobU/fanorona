import Board from '../src/Board.js';
import { Direction, getDeltaIndex, PieceType } from '../src/types.js'; 
import { CAPTURE_FADE_MS, MOVE_ANIMATION_MS, capturedIndexes } from './animationHelpers.js';

/**
 * A piece drawn partly transparent (e.g. a captured piece fading out).
 */
interface FadingPiece {
    index: number,
    pieceType: PieceType,
    alpha: number,
}

const cellSize: number = 100;
const pieceWidth: number = 60;

/**
 * @param positions the pieces to draw. Defaults to the board's current pieces, but animations pass the positions from
 * before a move so captured pieces stay visible until the moving piece arrives.
 * @param fadingPieces extra pieces drawn partly transparent on top (e.g. captured pieces fading out).
 */
export function drawBoard(board: Board, ctx: CanvasRenderingContext2D, lightPiece: HTMLImageElement, darkPiece: HTMLImageElement, wood: HTMLImageElement, indexesToExclude: null | number[], positions?: number[], fadingPieces: FadingPiece[] = []) {
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

    let boardPositions = positions ? [...positions] : board.getBoardPiecePositions();
    // Exclude the current piece from being drawn temporarily
    if (indexesToExclude) {
        for(let i = 0; i < indexesToExclude.length; i++) {
            boardPositions[indexesToExclude[i]] = PieceType.EMPTY;
        }
    }
    drawPieces(ctx, lightPiece, darkPiece, boardPositions, rows, cols, cellSize);

    for (const piece of fadingPieces) {
        const x = (piece.index % cols) * cellSize + cellSize / 2 - pieceWidth / 2;
        const y = Math.floor(piece.index / cols) * cellSize + cellSize / 2 - pieceWidth / 2;
        ctx.globalAlpha = piece.alpha;
        ctx.drawImage(piece.pieceType === PieceType.WHITE ? lightPiece : darkPiece, x, y, pieceWidth, pieceWidth);
    }
    ctx.globalAlpha = 1;
}

function drawPieces(ctx: CanvasRenderingContext2D, lightPiece: HTMLImageElement, darkPiece: HTMLImageElement, boardPositions: number[], rows: number, cols: number, cellSize: number) {
    let boardIndex = 0;
    const pieceWidth = 60;
    
    // Draw the grid of circles
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = col * cellSize + cellSize / 2 - pieceWidth / 2;
            const y = row * cellSize + cellSize / 2 - pieceWidth / 2;

            const pieceType = boardPositions[boardIndex];
            // Draw the circle
            switch (pieceType) {
                case PieceType.EMPTY:
                    break;
                case PieceType.WHITE:
                    ctx.drawImage(lightPiece, x, y, pieceWidth, pieceWidth);
                    break;
                case PieceType.BLACK:
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
    callback?: () => void,
    positionsBeforeMove?: number[],
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

        const duration = MOVE_ANIMATION_MS; // Animation duration in milliseconds
        let startTime: number;

        const indexesToExclude: number[] = [indexToAnimate, endIndex];

        function animateFrame(timestamp: number) {
            if (!startTime) startTime = timestamp;

            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1); // Ensure progress stays within [0, 1]

            // Interpolate position
            const currentX = startX + (endX - startX) * progress;
            const currentY = startY + (endY - startY) * progress;

            // Clear the canvas and redraw the board without the animated piece.
            // If we know the positions from before the move, draw those so that captured pieces are still shown
            // while the piece is moving (they fade out after it arrives).
            ctx.clearRect(0, 0, cols * cellSize, rows * cellSize);
            drawBoard(board, ctx, lightPiece, darkPiece, wood, indexesToExclude, positionsBeforeMove);

            // Draw the animated piece at its current position
            ctx.drawImage(pieceImage, currentX, currentY, pieceWidth, pieceWidth);

            if (progress < 1) {
                requestAnimationFrame(animateFrame);
            } else {
                // Animation complete. Fade out any captured pieces before finishing.
                const captured = positionsBeforeMove
                    ? capturedIndexes(positionsBeforeMove, board.getBoardPiecePositions(), indexToAnimate)
                    : [];
                if (captured.length > 0) {
                    fadeStartTime = undefined;
                    requestAnimationFrame(timestamp => fadeFrame(timestamp, captured));
                } else {
                    finish();
                }
            }
        }

        let fadeStartTime: number | undefined;
        function fadeFrame(timestamp: number, captured: number[]) {
            if (fadeStartTime === undefined) fadeStartTime = timestamp;
            const progress = Math.min((timestamp - fadeStartTime) / CAPTURE_FADE_MS, 1);
            // The board now has the piece at its destination and the captured pieces removed, so draw those on top, fading out
            const fadingPieces = captured.map(index => ({ index, pieceType: positionsBeforeMove![index] as PieceType, alpha: 1 - progress }));
            drawBoard(board, ctx, lightPiece, darkPiece, wood, null, undefined, fadingPieces);
            if (progress < 1) {
                requestAnimationFrame(timestamp => fadeFrame(timestamp, captured));
            } else {
                finish();
            }
        }

        function finish() {
            drawBoard(board, ctx, lightPiece, darkPiece, wood, null);
            if (callback) callback();
            resolve();
        }

        requestAnimationFrame(animateFrame);
    });
}