import { expect } from 'chai';
import Board, { NO_CAPTURE_DRAW_TURNS } from '../src/Board.js';
import GameSession from '../src/GameSession.js';
import { Direction, PieceType, Winner } from '../src/types.js';

describe('GameSession tests', () => {
    it('should start in the choosing state with nobody in control', () => {
        const session = new GameSession();
        const board = new Board();
        expect(session.mode).to.equal('choosing');
        expect(session.controlledColours()).to.deep.equal([]);
        expect(session.botColour()).to.equal(null);
        expect(session.isHumanTurn(board)).to.equal(false);
        expect(session.turnLabel(board)).to.equal('');
    });

    it('should give the human white and the bot black in vs Bot as white', () => {
        const session = new GameSession();
        const board = new Board(5, 5, '1000000000000000000000002');
        session.start('vsBot', PieceType.WHITE);
        expect(session.controlledColours()).to.deep.equal([PieceType.WHITE]);
        expect(session.botColour()).to.equal(PieceType.BLACK);
        expect(session.isHumanTurn(board)).to.equal(true);
        expect(session.turnLabel(board)).to.equal('White to move (you)');

        board.performMove(0, Direction.RIGHT);
        expect(session.isHumanTurn(board)).to.equal(false);
        expect(session.turnLabel(board)).to.equal('Black to move (bot)');
    });

    it('should give the human black and the bot white in vs Bot as black', () => {
        const session = new GameSession();
        const board = new Board(5, 5, '1000000000000000000000002');
        session.start('vsBot', PieceType.BLACK);
        expect(session.controlledColours()).to.deep.equal([PieceType.BLACK]);
        expect(session.botColour()).to.equal(PieceType.WHITE);
        expect(session.isHumanTurn(board)).to.equal(false);
        expect(session.turnLabel(board)).to.equal('White to move (bot)');

        board.performMove(0, Direction.RIGHT);
        expect(session.isHumanTurn(board)).to.equal(true);
        expect(session.turnLabel(board)).to.equal('Black to move (you)');
    });

    it('should let both colours be played by humans in 2 Player', () => {
        const session = new GameSession();
        const board = new Board(5, 5, '1000000000000000000000002');
        session.start('twoPlayer');
        expect(session.controlledColours()).to.deep.equal([PieceType.WHITE, PieceType.BLACK]);
        expect(session.botColour()).to.equal(null);
        expect(session.isHumanTurn(board)).to.equal(true);
        expect(session.turnLabel(board)).to.equal('White to move');

        board.performMove(0, Direction.RIGHT);
        expect(session.isHumanTurn(board)).to.equal(true);
        expect(session.turnLabel(board)).to.equal('Black to move');
    });

    it('should require a colour for vs Bot', () => {
        expect(() => new GameSession().start('vsBot')).to.throw();
    });

    it('should describe the result from the human point of view in vs Bot', () => {
        const asWhite = new GameSession();
        asWhite.start('vsBot', PieceType.WHITE);
        expect(asWhite.endMessage(Winner.WHITE)).to.equal('You won!');
        expect(asWhite.endMessage(Winner.BLACK)).to.equal('You lost!');

        const asBlack = new GameSession();
        asBlack.start('vsBot', PieceType.BLACK);
        expect(asBlack.endMessage(Winner.WHITE)).to.equal('You lost!');
        expect(asBlack.endMessage(Winner.BLACK)).to.equal('You won!');
    });

    it('should name the winning colour in 2 Player', () => {
        const session = new GameSession();
        session.start('twoPlayer');
        expect(session.endMessage(Winner.WHITE)).to.equal('White wins!');
        expect(session.endMessage(Winner.BLACK)).to.equal('Black wins!');
    });

    it('should give the same draw message in every mode', () => {
        const drawMessage = `Draw! No pieces were captured in ${NO_CAPTURE_DRAW_TURNS} turns.`;
        const twoPlayer = new GameSession();
        twoPlayer.start('twoPlayer');
        const vsBot = new GameSession();
        vsBot.start('vsBot', PieceType.BLACK);
        expect(twoPlayer.endMessage(Winner.DRAW)).to.equal(drawMessage);
        expect(vsBot.endMessage(Winner.DRAW)).to.equal(drawMessage);
    });

    it('should go back to choosing when reset', () => {
        const session = new GameSession();
        session.start('vsBot', PieceType.BLACK);
        session.reset();
        expect(session.mode).to.equal('choosing');
        expect(session.humanColour).to.equal(null);
        expect(session.controlledColours()).to.deep.equal([]);
        expect(session.isHumanTurn(new Board())).to.equal(false);
    });
});
