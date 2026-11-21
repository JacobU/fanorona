import { Arrow } from './TutorialController.js';

/**
 * Draws the tutorial's arrows on a canvas that lies over the board (and under the grid of buttons), so the board's
 * own drawing and animation code doesn't need to know about them.
 */

const CELL_SIZE = 100;
const COLUMNS = 9;
// Leave room for the piece the arrow starts from. Every arrow is then the same length whichever way it points, so
// arrows to diagonal points (which are further away) don't look bigger than straight ones.
const START_GAP = 36;
const ARROW_LENGTH = 50;
const LINE_WIDTH = 7;
const OUTLINE_WIDTH = 4;
const HEAD_LENGTH = 20;
const HEAD_HALF_WIDTH = 13;
const CROSS_SIZE = 11;

// The same blue and red as the highlights on the board (the pulsing rings and target dots in styles.css)
const GUIDE_COLOUR = 'rgb(79, 195, 247)';
const BLOCKED_COLOUR = 'rgb(247, 79, 79)';
const OUTLINE_COLOUR = 'rgba(255, 255, 255, 0.6)';
// How see-through each arrow is. The whole arrow is faded at once, so where its parts overlap isn't darker.
const ARROW_ALPHA = 0.75;

function centreOf(index: number): { x: number, y: number } {
    return {
        x: (index % COLUMNS) * CELL_SIZE + CELL_SIZE / 2,
        y: Math.floor(index / COLUMNS) * CELL_SIZE + CELL_SIZE / 2,
    };
}

/**
 * Clears the overlay and draws the arrows for the moves to make, plus crossed-out red arrows for moves that aren't allowed.
 */
export function drawArrows(ctx: CanvasRenderingContext2D, arrows: Arrow[], blockedArrows: Arrow[]): void {
    clearArrows(ctx);
    // Each arrow is drawn solid on a scratch canvas, then copied onto the overlay partly transparent
    const scratch = document.createElement('canvas');
    scratch.width = ctx.canvas.width;
    scratch.height = ctx.canvas.height;
    const scratchCtx = scratch.getContext('2d')!;
    const drawFaded = (arrow: Arrow, colour: string, crossedOut: boolean) => {
        scratchCtx.clearRect(0, 0, scratch.width, scratch.height);
        drawArrow(scratchCtx, arrow, colour, crossedOut);
        ctx.save();
        ctx.globalAlpha = ARROW_ALPHA;
        ctx.drawImage(scratch, 0, 0);
        ctx.restore();
    };
    for (const arrow of blockedArrows) drawFaded(arrow, BLOCKED_COLOUR, true);
    for (const arrow of arrows) drawFaded(arrow, GUIDE_COLOUR, false);
}

export function clearArrows(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function drawArrow(ctx: CanvasRenderingContext2D, arrow: Arrow, colour: string, crossedOut: boolean): void {
    const from = centreOf(arrow.from);
    const to = centreOf(arrow.to);
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    // Unit vector along the arrow, and at right angles to it
    const ux = (to.x - from.x) / length;
    const uy = (to.y - from.y) / length;
    const px = -uy;
    const py = ux;

    const start = { x: from.x + ux * START_GAP, y: from.y + uy * START_GAP };
    const tip = { x: from.x + ux * (START_GAP + ARROW_LENGTH), y: from.y + uy * (START_GAP + ARROW_LENGTH) };
    const headBase = { x: tip.x - ux * HEAD_LENGTH, y: tip.y - uy * HEAD_LENGTH };

    const shaft = new Path2D();
    shaft.moveTo(start.x, start.y);
    shaft.lineTo(headBase.x, headBase.y);

    const head = new Path2D();
    head.moveTo(tip.x, tip.y);
    head.lineTo(headBase.x + px * HEAD_HALF_WIDTH, headBase.y + py * HEAD_HALF_WIDTH);
    head.lineTo(headBase.x - px * HEAD_HALF_WIDTH, headBase.y - py * HEAD_HALF_WIDTH);
    head.closePath();

    // A cross over the middle of the shaft
    const cross = new Path2D();
    if (crossedOut) {
        const middle = { x: (start.x + headBase.x) / 2, y: (start.y + headBase.y) / 2 };
        for (const [dx, dy] of [[ux + px, uy + py], [ux - px, uy - py]]) {
            cross.moveTo(middle.x - dx * CROSS_SIZE, middle.y - dy * CROSS_SIZE);
            cross.lineTo(middle.x + dx * CROSS_SIZE, middle.y + dy * CROSS_SIZE);
        }
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // A light outline first, so the arrow stands out against the wood and the black lines
    ctx.strokeStyle = OUTLINE_COLOUR;
    ctx.lineWidth = LINE_WIDTH + OUTLINE_WIDTH;
    ctx.stroke(shaft);
    ctx.stroke(head);
    if (crossedOut) ctx.stroke(cross);

    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = LINE_WIDTH;
    ctx.stroke(shaft);
    ctx.fill(head);
    if (crossedOut) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = LINE_WIDTH;
        ctx.stroke(cross);
        ctx.strokeStyle = colour;
        ctx.lineWidth = LINE_WIDTH - 3;
        ctx.stroke(cross);
    }
    ctx.restore();
}
