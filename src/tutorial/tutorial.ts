import TutorialController from './TutorialController.js';
import { drawArrows, clearArrows } from './arrows.js';
import { drawBoard, animatePieceMove } from '../DrawBoardAndPieces.js';
import { highlightPossibleMoves, highlightMoveablePieces, highlightApproachOrWithdrawPieces, removeAllHighlighting } from '../boardHighlights.js';

/**
 * The tutorial page: shows each step's explanation and board, passes clicks to the TutorialController, and draws
 * what it says the player should do next.
 */

const ctx = (document.getElementById('fanoronaBoard') as HTMLCanvasElement).getContext('2d')!;
const overlayCtx = (document.getElementById('tutorialOverlay') as HTMLCanvasElement).getContext('2d')!;

const lightPiece = new Image();
const darkPiece = new Image();
const wood = new Image();

const progressLabel = document.getElementById('tutorial-progress')!;
const titleText = document.getElementById('tutorial-title')!;
const stepText = document.getElementById('tutorial-text')!;
const feedbackText = document.getElementById('tutorial-feedback')!;
const backButton = document.getElementById('back-button')!;
const resetButton = document.getElementById('reset-button')!;
const endTurnButton = document.getElementById('end-turn-button')!;
const nextButton = document.getElementById('next-button')!;
const playLink = document.getElementById('play-link')!;

const controller = new TutorialController();
// True while a move is being animated. All input is ignored meanwhile.
let inputLocked = false;
// Why the last click didn't do anything (cleared by the next click that does)
let hint: string | null = null;

let imagesLoaded = 0;
const onImageLoaded = () => {
    imagesLoaded++;
    if (imagesLoaded === 3) showStep();
};
lightPiece.onload = onImageLoaded;
darkPiece.onload = onImageLoaded;
wood.onload = onImageLoaded;
lightPiece.src = './assets/svg/lightPiece.svg';
darkPiece.src = './assets/svg/darkPiece.svg';
wood.src = './assets/svg/wood.svg';

document.querySelectorAll('.grid-container button').forEach((button, index) => {
    button.addEventListener('click', () => onCellClicked(index));
});
backButton.addEventListener('click', () => {
    if (!inputLocked && controller.back()) showStep();
});
resetButton.addEventListener('click', () => {
    if (inputLocked) return;
    controller.resetStep();
    showStep();
});
nextButton.addEventListener('click', () => {
    if (!inputLocked && controller.next()) showStep();
});
endTurnButton.addEventListener('click', onEndTurnClicked);

// Show the first step's text straight away; the board is drawn once its images have loaded
render();

function imagesReady(): boolean {
    return imagesLoaded === 3;
}

/**
 * Draws the current step's board from scratch (after changing or resetting the step).
 */
function showStep() {
    hint = null;
    if (imagesReady()) drawBoard(controller.board, ctx, lightPiece, darkPiece, wood, null);
    render();
}

/**
 * Updates the text, buttons, highlights and arrows to match the controller.
 */
function render() {
    const step = controller.currentStep();
    progressLabel.textContent = controller.progressLabel();
    titleText.textContent = step.title;
    stepText.textContent = step.text;

    const success = controller.successMessage();
    feedbackText.textContent = success ?? hint ?? '';
    feedbackText.className = success !== null ? 'success' : hint !== null ? 'hint' : '';

    const lastStep = controller.isLastStep();
    backButton.classList.toggle('is-disabled', inputLocked || !controller.canGoBack());
    resetButton.classList.toggle('is-disabled', inputLocked);
    // Next is greyed out until the step is done. The last step has Play a game instead, once it's done.
    nextButton.hidden = lastStep;
    nextButton.classList.toggle('is-disabled', inputLocked || !controller.canGoNext());
    nextButton.classList.toggle('pulse-target', controller.canGoNext());
    playLink.hidden = !(lastStep && controller.isStepComplete());
    playLink.classList.toggle('pulse-target', lastStep && controller.isStepComplete());

    const guide = controller.guide();
    endTurnButton.classList.toggle('visible', !inputLocked && guide.endTurn);
    endTurnButton.classList.toggle('pulse-target', guide.endTurn);

    removeAllHighlighting();
    if (inputLocked || !imagesReady()) {
        clearArrows(overlayCtx);
        return;
    }
    highlightMoveablePieces(guide.pieces);
    highlightPossibleMoves(guide.targets);
    highlightApproachOrWithdrawPieces(guide.rings);
    drawArrows(overlayCtx, guide.arrows, guide.blockedArrows);
}

async function onCellClicked(index: number) {
    if (inputLocked || !imagesReady()) return;
    const board = controller.board;
    // The pieces before the move, so captured pieces can still be shown while the piece moves
    const positionsBefore = board.getBoardPiecePositions();
    const result = controller.handleCellClick(index);
    hint = result.hint ?? null;
    if (result.moved) {
        inputLocked = true;
        render();
        try {
            await animatePieceMove(board, ctx, lightPiece, darkPiece, wood, result.from!, result.direction!, lightPiece, undefined, positionsBefore);
        } finally {
            inputLocked = false;
        }
    }
    render();
}

function onEndTurnClicked() {
    if (inputLocked) return;
    const result = controller.handleEndTurn();
    hint = result.hint ?? null;
    render();
}
