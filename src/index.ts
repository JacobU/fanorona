import Board from './Board.js';
import SearchBot from './ai/SearchBot.js';
import { BotPlayer, DIFFICULTIES, DIFFICULTY_NAMES, DifficultyName } from './ai/difficulties.js';
import TurnPlanner from './TurnPlanner.js';
import CellClickHandler from './CellClickHandler.js';
import GameSession, { turnColour } from './GameSession.js';
import { PieceType, Direction, Winner } from './types.js';
import { drawBoard, animatePieceMove } from './DrawBoardAndPieces.js';
import { BOT_CHAIN_PAUSE_MS, BOT_TURN_PAUSE_MS, sleep } from './animationHelpers.js';
import { highlightPossibleMoves, highlightMoveablePieces, highlightApproachOrWithdrawPieces, removeAllHighlighting } from './boardHighlights.js';

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
// How the current game is being played (vs the bot or 2 players). Nobody can move until a mode is chosen.
const session = new GameSession();
cellClickHandler.setControlledColours(session.controlledColours());
// A new bot is created for each vs Bot game, so nothing carries over between games
let botPlayer: BotPlayer | null = null;
// The difficulty chosen for the current (or next) vs Bot game
let selectedDifficulty: DifficultyName | null = null;
// Chooses the search bots' turns in a background worker, so the page stays responsive while they think
const turnPlanner = new TurnPlanner();

const endTurnButton = document.getElementById('end-turn-button')!;
const restartButton = document.getElementById('restart-button')!;
const modeChoice = document.getElementById('mode-choice')!;
const difficultyChoice = document.getElementById('difficulty-choice')!;
const colourChoice = document.getElementById('colour-choice')!;
const turnIndicator = document.getElementById('turn-indicator')!;
const messageContainer = document.getElementById('message-container')!;
const canvasContainer = document.getElementById('canvas-container')!;
const RESTART_LABEL = 'Restart';
const RESTART_CONFIRM_LABEL = 'Confirm restart?';
// Once the game is over there's nothing to lose, so the Restart button becomes a one-click Play Again
const PLAY_AGAIN_LABEL = 'Play Again';
const RESTART_CONFIRM_MS = 3000;

// True while a move is being processed or animated (including the bot's turn). All input is ignored meanwhile.
let inputLocked = false;
// True after choosing vs Bot, while the player picks the bot's difficulty
let choosingDifficulty = false;
// True after choosing the difficulty, while the player picks which colour to play
let choosingColour = false;
// True while the bot is choosing its move (shown in the turn indicator)
let botThinking = false;
// Set while Restart has been clicked once and is waiting for the confirming second click
let restartConfirmTimer: ReturnType<typeof setTimeout> | null = null;

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

endTurnButton.addEventListener('click', onEndTurnClicked);
restartButton.addEventListener('click', onRestartClicked);
document.getElementById('vs-bot-button')!.addEventListener('click', () => { choosingDifficulty = true; updateControls(); });
// One button per difficulty, easiest first, placed before the Back button
const difficultyBackButton = document.getElementById('difficulty-back-button')!;
for (const name of DIFFICULTY_NAMES) {
    const button = document.createElement('button');
    // Pulses like the other choices before a game
    button.className = 'board-button pulse-target';
    button.textContent = name;
    button.title = DIFFICULTIES[name].description;
    button.addEventListener('click', () => {
        selectedDifficulty = name;
        choosingDifficulty = false;
        choosingColour = true;
        updateControls();
    });
    difficultyChoice.insertBefore(button, difficultyBackButton);
}
difficultyBackButton.addEventListener('click', () => { choosingDifficulty = false; updateControls(); });
document.getElementById('two-player-button')!.addEventListener('click', () => startGame('twoPlayer'));
document.getElementById('play-white-button')!.addEventListener('click', () => startGame('vsBot', PieceType.WHITE));
document.getElementById('play-black-button')!.addEventListener('click', () => startGame('vsBot', PieceType.BLACK));
document.getElementById('colour-back-button')!.addEventListener('click', () => { choosingColour = false; choosingDifficulty = true; updateControls(); });

// The board starts locked, showing the mode choice
updateControls();

function pieceImage(pieceType: PieceType): HTMLImageElement {
    return pieceType === PieceType.WHITE ? lightPiece : darkPiece;
}

function endGame() {
    const message = session.endMessage(board.getWinner());
    messageContainer.style.display = 'flex';

    const winLossMessageDiv = document.getElementById('game-message');
    winLossMessageDiv!.textContent = message;
    cancelRestartConfirmation();
    updateControls();
}

/**
 * Puts the board back to the starting position and shows the vs Bot / 2 Player choice again.
 */
function returnToModeChoice() {
    if (inputLocked) return;
    session.reset();
    cellClickHandler.reset();
    cellClickHandler.setControlledColours(session.controlledColours());
    botPlayer = null;
    choosingDifficulty = false;
    choosingColour = false;
    board.reset();
    messageContainer.style.display = 'none';
    cancelRestartConfirmation();
    removeAllHighlighting();
    drawBoard(board, ctx, lightPiece, darkPiece, wood, null);
    updateControls();
}

/**
 * Starts a new game. If the bot plays white it makes the first move straight away.
 */
function startGame(mode: 'vsBot' | 'twoPlayer', humanColour?: PieceType) {
    if (inputLocked) return;
    session.start(mode, humanColour);
    cellClickHandler.reset();
    cellClickHandler.setControlledColours(session.controlledColours());
    const botColour = session.botColour();
    botPlayer = botColour === null ? null : DIFFICULTIES[selectedDifficulty!].create(botColour, board);
    choosingDifficulty = false;
    choosingColour = false;
    board.reset();
    messageContainer.style.display = 'none';
    cancelRestartConfirmation();
    removeAllHighlighting();
    drawBoard(board, ctx, lightPiece, darkPiece, wood, null);
    return withInputLocked(runBotTurnAndRefresh);
}

/**
 * During a game, Restart needs two clicks: the first asks for confirmation (for a few seconds), the second restarts.
 * Once the game is over the button says Play Again and goes straight back to the mode choice.
 */
function onRestartClicked() {
    if (inputLocked || session.mode === 'choosing') return;
    if (restartConfirmTimer !== null || board.getWinner() !== Winner.NONE) {
        returnToModeChoice();
        return;
    }
    restartConfirmTimer = setTimeout(cancelRestartConfirmation, RESTART_CONFIRM_MS);
    updateControls();
}

function cancelRestartConfirmation() {
    if (restartConfirmTimer !== null) clearTimeout(restartConfirmTimer);
    restartConfirmTimer = null;
    updateControls();
}

/**
 * The only place that shows or hides the controls around the board. The End turn button is shown exactly when the
 * player is in the middle of a capture chain and can choose to stop, and nothing is being animated or processed.
 */
function updateControls() {
    const isChoosing = session.mode === 'choosing';
    const gameOver = board.getWinner() !== Winner.NONE;
    const canEndTurn = !inputLocked && !isChoosing && !gameOver && cellClickHandler.canEndTurn();
    endTurnButton.classList.toggle('visible', canEndTurn);
    restartButton.classList.toggle('visible', !isChoosing);
    restartButton.classList.toggle('is-disabled', inputLocked);
    restartButton.textContent = gameOver ? PLAY_AGAIN_LABEL : restartConfirmTimer !== null ? RESTART_CONFIRM_LABEL : RESTART_LABEL;
    modeChoice.hidden = !isChoosing || choosingDifficulty || choosingColour;
    difficultyChoice.hidden = !isChoosing || !choosingDifficulty;
    colourChoice.hidden = !isChoosing || !choosingColour;
    // Grey out the board until a game starts, so it's clear one of the choices has to be picked first
    canvasContainer.classList.toggle('board-inactive', isChoosing);
    turnIndicator.hidden = isChoosing || gameOver;
    turnIndicator.textContent = session.turnLabel(board, botThinking);
}

/**
 * Runs an action with all input locked, so clicks during animations or the bot's turn are ignored and the
 * End turn button stays hidden until everything has finished.
 */
async function withInputLocked(action: () => Promise<void>) {
    if (inputLocked) return;
    inputLocked = true;
    updateControls();
    try {
        await action();
    } finally {
        inputLocked = false;
        updateControls();
    }
}

function onEndTurnClicked() {
    return withInputLocked(async () => {
        if (!cellClickHandler.handleEndTurn()) return;
        removeAllHighlighting();
        drawBoard(board, ctx, lightPiece, darkPiece, wood, null);
        await runBotTurnAndRefresh();
    });
}

function onCellClicked(index: number) {
    if (session.mode === 'choosing') return;
    return withInputLocked(async () => {
        const handlerState = cellClickHandler.getHandlerState();
        // If a move was made, animate it with the piece of the colour that made it (the colour to move before the click)
        const movingColour = turnColour(board);
        // The pieces before the move, so captured pieces can still be shown while the piece moves
        const positionsBefore = board.getBoardPiecePositions();
        const moveWasPerformed = cellClickHandler.handleCellClick(index);
        if (moveWasPerformed) {
            // If a move was performed, but it was done by selecting the approach or withdraw piece, we need to check what the selectedPiece
            // was before the current click. This will give us the actual direction.
            const direction: Direction = handlerState.approachOrWithdrawPieces
                ? handlerState.possibleMoves.find(move => move.index === handlerState.approachOrWithdrawMoveIndex)!.direction
                : handlerState.possibleMoves.find(move => move.index === index)!.direction;

            await animatePieceMove(board, ctx, lightPiece, darkPiece, wood, handlerState.selectedCell!, direction, pieceImage(movingColour), undefined, positionsBefore);
        }

        removeAllHighlighting();
        await runBotTurnAndRefresh();
    });
}

/**
 * If it's now the bot's turn, plays it, then highlights what the player to move can do next (or ends the game).
 */
async function runBotTurnAndRefresh() {
    if (board.getWinner() !== Winner.NONE) {
        endGame();
        return;
    }

    const botColour = session.botColour();
    if (botPlayer !== null && botColour === turnColour(board)) {
        // Show that it's the bot's turn while it moves, and give the player a moment to see the last move first
        updateControls();
        if (botPlayer instanceof SearchBot) {
            // Search bots choose their turn in the background, at the same time as the usual pause, so the
            // quicker ones feel just as before and the page stays responsive while the hardest one thinks.
            botThinking = true;
            updateControls();
            const [plannedTurn] = await Promise.all([
                turnPlanner.plan(board.saveBoardState(), selectedDifficulty!, botColour!),
                sleep(BOT_TURN_PAUSE_MS),
            ]);
            botThinking = false;
            updateControls();
            if (plannedTurn !== null) botPlayer.usePlannedTurn(plannedTurn);
        } else {
            await sleep(BOT_TURN_PAUSE_MS);
        }
        let notFinishedTurn: boolean = true;
        while(notFinishedTurn) {
            const positionsBefore = board.getBoardPiecePositions();
            const moveResults = botPlayer.makeMove();
            notFinishedTurn = moveResults.canMoveAgain;
            await animatePieceMove(board, ctx, lightPiece, darkPiece, wood, moveResults.move.index, moveResults.move.direction, pieceImage(botColour), undefined, positionsBefore);
            // Pause between the bot's moves in a capture chain so each capture can be seen
            if (notFinishedTurn) await sleep(BOT_CHAIN_PAUSE_MS);
        }
        drawBoard(board, ctx, lightPiece, darkPiece, wood, null);
    }

    if (board.getWinner() !== Winner.NONE) {
        endGame();
        return;
    }

    if (session.isHumanTurn(board)) {
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
            const moveablePieces: number[] = board.getPiecesThatPlayerCanMove(turnColour(board));
            highlightMoveablePieces(moveablePieces);
        }
    }
}
