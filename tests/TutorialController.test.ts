import { expect } from 'chai';
import { Direction, PieceType, Winner } from '../src/types.js';
import { TUTORIAL_STEPS, TutorialAction, stepLayout } from '../src/tutorial/tutorialSteps.js';
import TutorialController from '../src/tutorial/TutorialController.js';

const ids = TUTORIAL_STEPS.map(step => step.id);

function controllerAt(id: string): TutorialController {
    const controller = new TutorialController();
    controller.goToStep(ids.indexOf(id));
    return controller;
}

function moveAction(id: string, actionIndex: number = 0): Extract<TutorialAction, { kind: 'move' }> {
    const action = TUTORIAL_STEPS[ids.indexOf(id)].actions[actionIndex];
    if (action.kind !== 'move') throw new Error(`Action ${actionIndex} of ${id} is not a move`);
    return action;
}

/**
 * Clicks the piece then its destination for each scripted move of a step (choosing the first ring when asked).
 */
function playScriptedMoves(controller: TutorialController) {
    for (const action of controller.currentStep().actions) {
        if (action.kind === 'endTurn') {
            expect(controller.handleEndTurn().ended).to.equal(true);
            continue;
        }
        const to = action.kind === 'move' ? action.to : controller.board.getPossibleMovesForCell(action.from)[0].index;
        controller.handleCellClick(action.from);
        const result = controller.handleCellClick(to);
        if (!result.moved) {
            expect(controller.guide().rings).to.have.length(2);
            expect(controller.handleCellClick(controller.guide().rings[0]).moved).to.equal(true);
        }
    }
}

describe('TutorialController', () => {
    it('starts on the first step with Back and Next unavailable', () => {
        const controller = new TutorialController();
        expect(controller.stepIndex).to.equal(0);
        expect(controller.stepCount).to.equal(TUTORIAL_STEPS.length);
        expect(controller.progressLabel()).to.equal(`Step 1 of ${TUTORIAL_STEPS.length}`);
        expect(controller.canGoBack()).to.equal(false);
        expect(controller.canGoNext()).to.equal(false);
        expect(controller.board.getBoardPositionsAsString()).to.equal(stepLayout(TUTORIAL_STEPS[0]));
    });

    it('ignores a click on a piece other than the highlighted one, with a hint', () => {
        const controller = controllerAt('approach');
        const before = controller.board.getBoardPositionsAsString();
        const blackPiece = before.indexOf('2');
        const result = controller.handleCellClick(blackPiece);
        expect(result.moved).to.equal(false);
        expect(result.hint).to.be.a('string');
        expect(controller.board.getBoardPositionsAsString()).to.equal(before);
        expect(controller.guide().targets).to.deep.equal([]);
    });

    it('ignores a click on a point other than the highlighted destination, with a hint', () => {
        const controller = controllerAt('approach');
        const action = moveAction('approach');
        const before = controller.board.getBoardPositionsAsString();
        expect(controller.handleCellClick(action.from).hint).to.equal(undefined);
        const wrongPoint = [...before].findIndex((piece, index) => piece === '0' && index !== action.to);
        const result = controller.handleCellClick(wrongPoint);
        expect(result.moved).to.equal(false);
        expect(result.hint).to.be.a('string');
        expect(controller.board.getBoardPositionsAsString()).to.equal(before);
        expect(controller.isStepComplete()).to.equal(false);
    });

    it('plays the highlighted move, completes the step and unlocks Next', () => {
        const controller = controllerAt('approach');
        const action = moveAction('approach');
        expect(controller.canGoNext()).to.equal(false);
        expect(controller.next()).to.equal(false);
        expect(controller.stepIndex).to.equal(ids.indexOf('approach'));

        expect(controller.handleCellClick(action.from).moved).to.equal(false);
        const result = controller.handleCellClick(action.to);
        expect(result).to.deep.equal({ moved: true, from: action.from, direction: Direction.RIGHT });
        expect(controller.board.getPieceTypeAtIndex(action.to)).to.equal(PieceType.WHITE);
        expect(controller.isStepComplete()).to.equal(true);
        expect(controller.successMessage()).to.equal(TUTORIAL_STEPS[ids.indexOf('approach')].successText);
        expect(controller.canGoNext()).to.equal(true);
        expect(controller.next()).to.equal(true);
        expect(controller.stepIndex).to.equal(ids.indexOf('approach') + 1);
        expect(controller.isStepComplete()).to.equal(false);
        expect(controller.board.getBoardPositionsAsString()).to.equal(stepLayout(TUTORIAL_STEPS[ids.indexOf('approach') + 1]));
    });

    it('guides with a pulsing piece and arrow, then a target dot once the piece is selected', () => {
        const controller = controllerAt('approach');
        const action = moveAction('approach');
        expect(controller.guide()).to.deep.equal({
            arrows: [{ from: action.from, to: action.to }],
            blockedArrows: [],
            pieces: [action.from],
            targets: [],
            rings: [],
            endTurn: false,
        });
        controller.handleCellClick(action.from);
        expect(controller.guide().pieces).to.deep.equal([]);
        expect(controller.guide().targets).to.deep.equal([action.to]);
        expect(controller.guide().arrows).to.deep.equal([{ from: action.from, to: action.to }]);
    });

    it('shows nothing to do and ignores clicks once the step is complete', () => {
        const controller = controllerAt('approach');
        playScriptedMoves(controller);
        const before = controller.board.getBoardPositionsAsString();
        expect(controller.guide()).to.deep.equal({ arrows: [], blockedArrows: [], pieces: [], targets: [], rings: [], endTurn: false });
        const blackPiece = before.indexOf('2');
        expect(controller.handleCellClick(blackPiece).moved).to.equal(false);
        expect(controller.board.getBoardPositionsAsString()).to.equal(before);
    });

    it('Reset step puts the setup back', () => {
        const controller = controllerAt('withdraw');
        playScriptedMoves(controller);
        expect(controller.isStepComplete()).to.equal(true);
        controller.resetStep();
        expect(controller.isStepComplete()).to.equal(false);
        expect(controller.board.getBoardPositionsAsString()).to.equal(stepLayout(TUTORIAL_STEPS[ids.indexOf('withdraw')]));
    });

    it('Back goes to the previous step with its setup, and does nothing on the first step', () => {
        const controller = controllerAt('withdraw');
        expect(controller.canGoBack()).to.equal(true);
        expect(controller.back()).to.equal(true);
        expect(controller.stepIndex).to.equal(ids.indexOf('approach'));
        expect(controller.board.getBoardPositionsAsString()).to.equal(stepLayout(TUTORIAL_STEPS[ids.indexOf('approach')]));

        const first = new TutorialController();
        expect(first.back()).to.equal(false);
        expect(first.stepIndex).to.equal(0);
    });

    it('Next does nothing on the last step, even once it is complete', () => {
        const controller = controllerAt('win');
        playScriptedMoves(controller);
        expect(controller.isStepComplete()).to.equal(true);
        expect(controller.isLastStep()).to.equal(true);
        expect(controller.canGoNext()).to.equal(false);
        expect(controller.next()).to.equal(false);
        expect(controller.stepIndex).to.equal(ids.length - 1);
    });

    for (const id of ['strong-point', 'weak-point']) {
        it(`${id}: accepts a move in any direction, and arrows every one`, () => {
            const step = TUTORIAL_STEPS[ids.indexOf(id)];
            const action = step.actions[0];
            if (action.kind !== 'anyMove') throw new Error('expected anyMove');
            const destinations = controllerAt(id).board.getPossibleMovesForCell(action.from).map(move => move.index);
            expect(destinations.length).to.be.greaterThan(0);
            expect(controllerAt(id).guide().arrows.map(arrow => arrow.to)).to.have.members(destinations);
            for (const to of destinations) {
                const controller = controllerAt(id);
                controller.handleCellClick(action.from);
                expect(controller.handleCellClick(to).moved).to.equal(true);
                expect(controller.isStepComplete()).to.equal(true);
            }
        });
    }

    it('approach-or-withdraw: shows the two rings, ignores other clicks, and accepts either choice', () => {
        const action = moveAction('approach-or-withdraw');
        const step = TUTORIAL_STEPS[ids.indexOf('approach-or-withdraw')];
        const messages: string[] = [];
        for (const ringIndex of [0, 1]) {
            const controller = controllerAt('approach-or-withdraw');
            controller.handleCellClick(action.from);
            expect(controller.handleCellClick(action.to).moved).to.equal(false);
            const rings = controller.guide().rings;
            expect(rings).to.have.length(2);
            expect(controller.guide().arrows).to.deep.equal([]);

            const wrong = controller.handleCellClick(action.to);
            expect(wrong.moved).to.equal(false);
            expect(wrong.hint).to.be.a('string');

            const result = controller.handleCellClick(rings[ringIndex]);
            expect(result).to.deep.equal({ moved: true, from: action.from, direction: Direction.RIGHT });
            expect(controller.isStepComplete()).to.equal(true);
            messages.push(controller.successMessage()!);
        }
        expect(messages).to.have.members([step.successTextByAttack!.approach, step.successTextByAttack!.withdraw]);
    });

    it('chain: each part of the chain is arrowed from where the piece is', () => {
        const controller = controllerAt('chain');
        const actions = TUTORIAL_STEPS[ids.indexOf('chain')].actions;
        controller.handleCellClick(moveAction('chain', 0).from);
        for (let i = 0; i < actions.length; i++) {
            const action = moveAction('chain', i);
            expect(controller.guide().arrows).to.deep.equal([{ from: action.from, to: action.to }]);
            expect(controller.isStepComplete()).to.equal(false);
            expect(controller.handleCellClick(action.to).moved).to.equal(true);
        }
        expect(controller.isStepComplete()).to.equal(true);
    });

    it('chain-rules: shows the blocked moves and explains them when clicked', () => {
        const controller = controllerAt('chain-rules');
        const actions = TUTORIAL_STEPS[ids.indexOf('chain-rules')].actions;
        controller.handleCellClick(moveAction('chain-rules', 0).from);
        for (let i = 0; i < actions.length; i++) {
            const action = moveAction('chain-rules', i);
            const blocked = action.blocked ?? [];
            expect(controller.guide().blockedArrows).to.deep.equal(blocked.map(b => ({ from: action.from, to: b.to })));
            for (const b of blocked) {
                const before = controller.board.getBoardPositionsAsString();
                const result = controller.handleCellClick(b.to);
                expect(result).to.deep.equal({ moved: false, hint: b.reason });
                expect(controller.board.getBoardPositionsAsString()).to.equal(before);
            }
            expect(controller.handleCellClick(action.to).moved).to.equal(true);
        }
        expect(controller.isStepComplete()).to.equal(true);
    });

    it('end-turn: blocks carrying on the chain and completes when End turn is pressed', () => {
        const controller = controllerAt('end-turn');
        const action = moveAction('end-turn');
        expect(controller.handleEndTurn().ended).to.equal(false);
        controller.handleCellClick(action.from);
        controller.handleCellClick(action.to);
        expect(controller.isStepComplete()).to.equal(false);
        expect(controller.guide()).to.deep.equal({ arrows: [], blockedArrows: [], pieces: [], targets: [], rings: [], endTurn: true });

        const continuation = controller.board.getPossibleMovesForCell(action.to)[0].index;
        const before = controller.board.getBoardPositionsAsString();
        const result = controller.handleCellClick(continuation);
        expect(result.moved).to.equal(false);
        expect(result.hint).to.be.a('string');
        expect(controller.board.getBoardPositionsAsString()).to.equal(before);

        expect(controller.handleEndTurn().ended).to.equal(true);
        expect(controller.isStepComplete()).to.equal(true);
    });

    it('End turn is refused in steps that do not ask for it', () => {
        const controller = controllerAt('chain');
        const action = moveAction('chain', 0);
        controller.handleCellClick(action.from);
        controller.handleCellClick(action.to);
        expect(controller.board.canEndTurn()).to.equal(true);
        const result = controller.handleEndTurn();
        expect(result.ended).to.equal(false);
        expect(result.hint).to.be.a('string');
        expect(controller.board.canEndTurn()).to.equal(true);
    });

    for (const id of ['trapped', 'win']) {
        it(`${id}: the step ends with white winning`, () => {
            const controller = controllerAt(id);
            playScriptedMoves(controller);
            expect(controller.isStepComplete()).to.equal(true);
            expect(controller.board.getWinner()).to.equal(Winner.WHITE);
        });
    }

    it('every step can be completed by clicking through its script', () => {
        const controller = new TutorialController();
        for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
            playScriptedMoves(controller);
            expect(controller.isStepComplete(), TUTORIAL_STEPS[i].id).to.equal(true);
            controller.next();
        }
        expect(controller.stepIndex).to.equal(TUTORIAL_STEPS.length - 1);
    });
});
