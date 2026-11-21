import Board from '../Board.js';
import CellClickHandler from '../CellClickHandler.js';
import { AttackType, Direction, PieceType } from '../types.js';
import { TUTORIAL_STEPS, TutorialAction, TutorialStep, stepLayout } from './tutorialSteps.js';

const ROWS = 5;
const COLUMNS = 9;

const PIECE_HINT = 'Click the highlighted piece.';
const POINT_HINT = 'Follow the arrow.';
const RING_HINT = 'Click a piece with a red ring.';
const END_TURN_HINT = 'Press End turn.';
const NO_END_TURN_HINT = 'This step doesn\'t use End turn.';
const STEP_DONE_HINT = 'Press Next to continue.';

export interface Arrow {
    from: number,
    to: number,
}

/**
 * What the page should show to guide the player towards the next action.
 */
export interface TutorialGuide {
    // Moves to make, drawn as arrows
    arrows: Arrow[],
    // Moves that aren't allowed, drawn as crossed-out red arrows
    blockedArrows: Arrow[],
    // Pieces to pulse (the piece to click)
    pieces: number[],
    // Points to mark as destinations (once the piece is selected)
    targets: number[],
    // The two pieces to choose between when a move both approaches and withdraws
    rings: number[],
    // Whether the player should press End turn
    endTurn: boolean,
}

/**
 * from and direction are set when a move was played, so the page can animate it. hint is set when the click did
 * nothing and the player should be told why.
 */
export interface ClickResult {
    moved: boolean,
    from?: number,
    direction?: Direction,
    hint?: string,
}

/**
 * Runs the tutorial: which step the player is on, a fresh board for that step, and which clicks are allowed.
 * Clicks that match the step's next action are passed on to a CellClickHandler, so moves follow exactly the same
 * rules as in a game. Contains no DOM code, so it can be unit tested.
 */
export default class TutorialController {
    private readonly steps: TutorialStep[];
    private index = 0;
    private currentBoard!: Board;
    private handler!: CellClickHandler;
    // How many of the step's actions have been done
    private actionIndex = 0;
    // Which side the player chose to capture, if the step had a move that both approaches and withdraws
    private chosenAttack: AttackType = AttackType.NONE;

    constructor(steps: TutorialStep[] = TUTORIAL_STEPS) {
        if (steps.length === 0) throw new Error('The tutorial needs at least one step.');
        this.steps = steps;
        this.loadStep(0);
    }

    public get board(): Board {
        return this.currentBoard;
    }

    public get stepIndex(): number {
        return this.index;
    }

    public get stepCount(): number {
        return this.steps.length;
    }

    public currentStep(): TutorialStep {
        return this.steps[this.index];
    }

    public goToStep(index: number): void {
        if (index < 0 || index >= this.steps.length) throw new Error(`There is no tutorial step ${index}.`);
        this.loadStep(index);
    }

    /**
     * Throws away the current board and sets up a new one with the step's layout.
     */
    private loadStep(index: number): void {
        this.index = index;
        this.currentBoard = new Board(ROWS, COLUMNS, stepLayout(this.steps[index]));
        this.handler = new CellClickHandler(this.currentBoard);
        this.handler.setControlledColours([PieceType.WHITE]);
        this.actionIndex = 0;
        this.chosenAttack = AttackType.NONE;
    }

    public resetStep(): void {
        this.loadStep(this.index);
    }

    public isStepComplete(): boolean {
        return this.actionIndex >= this.currentStep().actions.length;
    }

    public isLastStep(): boolean {
        return this.index === this.steps.length - 1;
    }

    public canGoNext(): boolean {
        return this.isStepComplete() && !this.isLastStep();
    }

    public canGoBack(): boolean {
        return this.index > 0;
    }

    /**
     * @returns whether the tutorial moved on (only once the current step is complete).
     */
    public next(): boolean {
        if (!this.canGoNext()) return false;
        this.loadStep(this.index + 1);
        return true;
    }

    /**
     * @returns whether the tutorial went back to the previous step (which starts again from its setup).
     */
    public back(): boolean {
        if (!this.canGoBack()) return false;
        this.loadStep(this.index - 1);
        return true;
    }

    public progressLabel(): string {
        return `Step ${this.index + 1} of ${this.steps.length}`;
    }

    /**
     * @returns the text to show once the step is complete, or null if it isn't yet.
     */
    public successMessage(): string | null {
        if (!this.isStepComplete()) return null;
        const step = this.currentStep();
        if (step.successTextByAttack && this.chosenAttack === AttackType.APPROACH) return step.successTextByAttack.approach;
        if (step.successTextByAttack && this.chosenAttack === AttackType.WITHDRAW) return step.successTextByAttack.withdraw;
        return step.successText;
    }

    private currentAction(): TutorialAction | null {
        return this.isStepComplete() ? null : this.currentStep().actions[this.actionIndex];
    }

    /**
     * @returns the points the piece is allowed to move to for this action.
     */
    private allowedDestinations(action: Extract<TutorialAction, { kind: 'move' | 'anyMove' }>): number[] {
        if (action.kind === 'move') return [action.to];
        return [...new Set(this.currentBoard.getPossibleMovesForCell(action.from).map(move => move.index))];
    }

    public handleCellClick(index: number): ClickResult {
        const action = this.currentAction();
        if (action === null) return this.isLastStep() ? { moved: false } : { moved: false, hint: STEP_DONE_HINT };
        if (action.kind === 'endTurn') return { moved: false, hint: action.hint ?? END_TURN_HINT };

        const state = this.handler.getHandlerState();

        // Choosing which side to capture after a move that both approaches and withdraws: either side is fine
        if (state.approachOrWithdrawPieces) {
            if (!state.approachOrWithdrawPieces.includes(index)) return { moved: false, hint: RING_HINT };
            const from = state.selectedCell!;
            const direction = state.possibleMoves.find(move => move.index === state.approachOrWithdrawMoveIndex)!.direction;
            const chosen = index === state.approachOrWithdrawPieces[0] ? AttackType.APPROACH : AttackType.WITHDRAW;
            if (!this.handler.handleCellClick(index)) return { moved: false };
            this.chosenAttack = chosen;
            this.actionIndex++;
            return { moved: true, from, direction };
        }

        // The piece to move hasn't been selected yet: only that piece can be clicked
        if (state.selectedCell !== action.from) {
            if (index !== action.from) return { moved: false, hint: PIECE_HINT };
            this.handler.handleCellClick(index);
            return { moved: false };
        }

        // The piece is selected
        const blocked = action.kind === 'move' ? action.blocked?.find(b => b.to === index) : undefined;
        if (blocked) return { moved: false, hint: blocked.reason };

        if (this.allowedDestinations(action).includes(index)) {
            const direction = state.possibleMoves.find(move => move.index === index)!.direction;
            // No move is made yet if the player now has to choose between approach and withdraw
            if (!this.handler.handleCellClick(index)) return { moved: false };
            this.actionIndex++;
            return { moved: true, from: action.from, direction };
        }

        // Clicking the selected piece again deselects it (but not in the middle of a chain, where it must keep moving)
        if (index === action.from && !state.attackingChain) {
            this.handler.handleCellClick(index);
            return { moved: false };
        }
        return { moved: false, hint: POINT_HINT };
    }

    /**
     * @returns whether the turn was ended (only when the step asks for End turn).
     */
    public handleEndTurn(): { ended: boolean, hint?: string } {
        const action = this.currentAction();
        if (action === null || action.kind !== 'endTurn') return { ended: false, hint: NO_END_TURN_HINT };
        if (!this.handler.handleEndTurn()) return { ended: false };
        this.actionIndex++;
        return { ended: true };
    }

    public guide(): TutorialGuide {
        const guide: TutorialGuide = { arrows: [], blockedArrows: [], pieces: [], targets: [], rings: [], endTurn: false };
        const action = this.currentAction();
        if (action === null) return guide;
        if (action.kind === 'endTurn') return { ...guide, endTurn: true };

        const state = this.handler.getHandlerState();
        if (state.approachOrWithdrawPieces) return { ...guide, rings: [...state.approachOrWithdrawPieces] };

        const destinations = this.allowedDestinations(action);
        const isSelected = state.selectedCell === action.from;
        return {
            ...guide,
            arrows: destinations.map(to => ({ from: action.from, to })),
            blockedArrows: (action.kind === 'move' ? action.blocked ?? [] : []).map(b => ({ from: action.from, to: b.to })),
            pieces: isSelected ? [] : [action.from],
            targets: isSelected ? destinations : [],
        };
    }
}
