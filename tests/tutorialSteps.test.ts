import { expect } from 'chai';
import Board from '../src/Board.js';
import { AttackType, Move, PieceType, Turn, Winner, getDirectionFromDeltaIndex } from '../src/types.js';
import { TUTORIAL_STEPS, TutorialStep, stepLayout } from '../src/tutorial/tutorialSteps.js';

const COLUMNS = 9;

function stepById(id: string): TutorialStep {
    const step = TUTORIAL_STEPS.find(s => s.id === id);
    if (!step) throw new Error(`No tutorial step called ${id}`);
    return step;
}

/**
 * What happened at one scripted move when the step's actions were played on a real board.
 */
interface PlayedMove {
    from: number,
    to: number,
    // Every move the board allowed from `from` just before this move was played
    possibleMoves: Move[],
    captured: number,
}

/**
 * Plays a step's actions on a real board, checking that each one is allowed. Moves that both approach and withdraw use
 * `choice`. An 'anyMove' action plays the first possible move (or the one at `anyMoveChoice` in the list).
 */
function playStep(step: TutorialStep, choice: AttackType = AttackType.APPROACH, anyMoveChoice: number = 0) {
    const board = new Board(5, COLUMNS, stepLayout(step));
    const played: PlayedMove[] = [];
    step.actions.forEach((action, i) => {
        const isLast = i === step.actions.length - 1;
        if (action.kind === 'endTurn') {
            expect(board.canEndTurn(), `${step.id}: End turn should be possible`).to.equal(true);
            board.endTurn();
            return;
        }
        expect(board.getPiecesThatPlayerCanMove(PieceType.WHITE), `${step.id}: piece ${action.from} should be movable`)
            .to.include(action.from);
        const possibleMoves = board.getPossibleMovesForCell(action.from);
        const to = action.kind === 'move' ? action.to : possibleMoves[anyMoveChoice].index;
        expect(possibleMoves.map(move => move.index), `${step.id}: ${action.from} -> ${to} should be allowed`).to.include(to);
        for (const blocked of action.kind === 'move' ? action.blocked ?? [] : []) {
            expect(possibleMoves.map(move => move.index), `${step.id}: ${action.from} -> ${blocked.to} should be blocked`)
                .not.to.include(blocked.to);
        }
        const direction = getDirectionFromDeltaIndex(to - action.from, COLUMNS);
        if (board.willMoveAttackAndWithdraw(action.from, direction)) board.setAttackOrWithdraw(choice);
        const blackBefore = board.getNumPieces(PieceType.BLACK);
        const canMoveAgain = board.performMove(action.from, direction);
        played.push({ from: action.from, to, possibleMoves, captured: blackBefore - board.getNumPieces(PieceType.BLACK) });

        // The turn carries on exactly when the script has more to do
        expect(canMoveAgain, `${step.id}: after move ${i + 1} the chain should ${isLast ? 'end' : 'continue'}`).to.equal(!isLast);
        const next = step.actions[i + 1];
        if (next && next.kind !== 'endTurn') {
            expect(next.from, `${step.id}: the chain should continue from where the piece landed`).to.equal(to);
        }
    });
    const captured = played.reduce((total, move) => total + move.captured, 0);
    return { board, played, captured };
}

function attackTypesOf(move: PlayedMove): AttackType[] {
    return move.possibleMoves.filter(m => m.index === move.to).map(m => m.attackType);
}

describe('Tutorial steps', () => {
    it('has the 13 agreed steps in order', () => {
        expect(TUTORIAL_STEPS.map(step => step.id)).to.deep.equal([
            'strong-point', 'weak-point', 'paika', 'approach', 'withdraw', 'withdraw-line', 'approach-or-withdraw',
            'chain', 'chain-rules', 'end-turn', 'must-capture', 'trapped', 'win',
        ]);
    });

    for (const step of TUTORIAL_STEPS) {
        describe(step.id, () => {
            it('has a 5 x 9 layout of empty, white and black points, with pieces of both colours', () => {
                expect(step.rows).to.have.length(5);
                for (const row of step.rows) expect(row).to.match(/^[012]{9}$/);
                expect(stepLayout(step)).to.have.length(45);
                expect(stepLayout(step)).to.include('1');
                expect(stepLayout(step)).to.include('2');
            });

            it('has a title, explanation and success text', () => {
                expect(step.title).to.not.equal('');
                expect(step.text).to.not.equal('');
                expect(step.successText).to.not.equal('');
            });

            it('can be played as scripted, capturing the expected number of pieces', () => {
                const { board, captured } = playStep(step);
                expect(captured).to.equal(step.expectedCaptures);
                expect(board.getTurn(), 'the turn should have passed to black').to.equal(Turn.BLACK);
                expect(board.getWinner()).to.equal(step.expectWinner ?? Winner.NONE);
            });
        });
    }

    it('strong-point: the piece can move in all 8 directions, and every one is a paika move', () => {
        const step = stepById('strong-point');
        const { played } = playStep(step);
        expect(played[0].possibleMoves).to.have.length(8);
        for (let i = 0; i < 8; i++) {
            const { captured, board } = playStep(step, AttackType.APPROACH, i);
            expect(captured).to.equal(0);
            expect(board.getWinner()).to.equal(Winner.NONE);
        }
    });

    it('weak-point: the piece can only move in 4 directions, and every one is a paika move', () => {
        const step = stepById('weak-point');
        const { played } = playStep(step);
        expect(played[0].possibleMoves).to.have.length(4);
        expect(step.actions[0].kind === 'anyMove' && step.actions[0].from % 2).to.equal(1);
        for (let i = 0; i < 4; i++) {
            expect(playStep(step, AttackType.APPROACH, i).captured).to.equal(0);
        }
    });

    it('paika: no white piece can capture, so the scripted move is a paika move', () => {
        const step = stepById('paika');
        const board = new Board(5, COLUMNS, stepLayout(step));
        for (const piece of board.getPiecesThatPlayerCanMove(PieceType.WHITE)) {
            for (const move of board.getPossibleMovesForCell(piece)) expect(move.attackType).to.equal(AttackType.NONE);
        }
        expect(attackTypesOf(playStep(step).played[0])).to.deep.equal([AttackType.NONE]);
    });

    it('approach: the scripted move captures by approach', () => {
        expect(attackTypesOf(playStep(stepById('approach')).played[0])).to.deep.equal([AttackType.APPROACH]);
    });

    it('withdraw: the scripted move captures by withdrawal', () => {
        expect(attackTypesOf(playStep(stepById('withdraw')).played[0])).to.deep.equal([AttackType.WITHDRAW]);
    });

    it('withdraw-line: the scripted move withdraws from a line of 3 pieces and captures them all', () => {
        const { played } = playStep(stepById('withdraw-line'));
        expect(attackTypesOf(played[0])).to.deep.equal([AttackType.WITHDRAW]);
        expect(played[0].captured).to.equal(3);
    });

    it('approach-or-withdraw: the move both approaches and withdraws, and either choice captures', () => {
        const step = stepById('approach-or-withdraw');
        const action = step.actions[0];
        if (action.kind !== 'move') throw new Error('expected a move');
        const board = new Board(5, COLUMNS, stepLayout(step));
        expect(board.willMoveAttackAndWithdraw(action.from, getDirectionFromDeltaIndex(action.to - action.from, COLUMNS))).to.equal(true);
        for (const choice of [AttackType.APPROACH, AttackType.WITHDRAW]) {
            const { captured, board: after } = playStep(step, choice);
            expect(captured).to.equal(step.expectedCaptures);
            expect(after.getWinner()).to.equal(Winner.NONE);
        }
        expect(step.successTextByAttack?.approach).to.be.a('string');
        expect(step.successTextByAttack?.withdraw).to.be.a('string');
    });

    it('chain: three captures in a row, using both approach and withdrawal', () => {
        const { played } = playStep(stepById('chain'));
        expect(played).to.have.length(3);
        const types = played.flatMap(attackTypesOf);
        expect(types).to.include(AttackType.APPROACH);
        expect(types).to.include(AttackType.WITHDRAW);
        for (const move of played) expect(move.captured).to.be.greaterThan(0);
    });

    it('chain-rules: shows a blocked move in the same direction and a blocked move back to a visited point', () => {
        const step = stepById('chain-rules');
        const blocked = step.actions.flatMap(action => action.kind === 'move' ? action.blocked ?? [] : []);
        expect(blocked.length).to.be.at.least(2);
        for (const b of blocked) expect(b.reason).to.not.equal('');
        // playStep checks that each blocked move is not allowed at that point
        playStep(step);
    });

    it('end-turn: after the capture the chain could continue, and the turn is ended with End turn', () => {
        const step = stepById('end-turn');
        expect(step.actions[step.actions.length - 1].kind).to.equal('endTurn');
        const moves = step.actions.filter(action => action.kind === 'move');
        expect(moves).to.have.length(1);
        const board = new Board(5, COLUMNS, stepLayout(step));
        const move = moves[0];
        if (move.kind !== 'move') throw new Error('expected a move');
        expect(board.performMove(move.from, getDirectionFromDeltaIndex(move.to - move.from, COLUMNS))).to.equal(true);
        expect(board.getPossibleMovesForCell(move.to).length).to.be.greaterThan(0);
    });

    it('must-capture: a white piece that could make a paika move is not allowed to move', () => {
        const step = stepById('must-capture');
        const board = new Board(5, COLUMNS, stepLayout(step));
        const movable = board.getPiecesThatPlayerCanMove(PieceType.WHITE);
        const layout = stepLayout(step);
        const blockedPaikaPieces = [...layout].map((piece, index) => ({ piece, index }))
            .filter(({ piece, index }) => piece === '1' && !movable.includes(index)
                && board.getConnectedIndexes(index).some(n => board.getPieceTypeAtIndex(n) === PieceType.EMPTY));
        expect(blockedPaikaPieces.length).to.be.greaterThan(0);
        expect(attackTypesOf(playStep(step).played[0])).to.not.include(AttackType.NONE);
    });

    it('trapped: a paika move leaves black unable to move, so white wins with black pieces still on the board', () => {
        const { board, played } = playStep(stepById('trapped'));
        expect(attackTypesOf(played[0])).to.deep.equal([AttackType.NONE]);
        expect(board.getNumPieces(PieceType.BLACK)).to.be.greaterThan(0);
        expect(board.getWinner()).to.equal(Winner.WHITE);
    });

    it('win: capturing the last black pieces wins', () => {
        const { board } = playStep(stepById('win'));
        expect(board.getNumPieces(PieceType.BLACK)).to.equal(0);
        expect(board.getWinner()).to.equal(Winner.WHITE);
    });
});
