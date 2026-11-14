import { expect } from 'chai';
import { Winner } from '../src/types.js';
import { totalPieces } from '../src/ai/endgame.js';
import { StoredPosition, boardFromPosition, generateBenchmarkPositions, generateTestPositions } from '../src/ai/testPositions.js';

describe('Test position generation', function () {
    this.timeout(60_000);

    let positions: StoredPosition[] = [];
    before(() => {
        positions = generateTestPositions(1);
    });

    const ofKind = (kind: string) => positions.filter(p => p.kind === kind);

    it('should give the same positions for the same seed', () => {
        expect(JSON.stringify(generateTestPositions(1))).to.equal(JSON.stringify(positions));
    });

    it('should make about 300 positions with unique names', () => {
        expect(positions.length).to.be.within(250, 320);
        expect(new Set(positions.map(p => p.name)).size).to.equal(positions.length);
    });

    it('should rebuild each position exactly as it was saved', () => {
        for (const p of positions) {
            expect(boardFromPosition(p).saveBoardState(), p.name).to.deep.equal(p.state);
        }
    });

    it('should have ordinary positions between turns, with more than 10 pieces and the game not over', () => {
        expect(ofKind('turn').length).to.be.at.least(80);
        for (const p of ofKind('turn')) {
            const board = boardFromPosition(p);
            expect(totalPieces(board), p.name).to.be.greaterThan(10);
            expect(board.getWinner(), p.name).to.equal(Winner.NONE);
            expect(p.state.currentlyMovingPiece, p.name).to.be.null;
        }
    });

    it('should have endgame positions with 10 or fewer pieces, from random games and from bot games', () => {
        const endgames = ofKind('endgame');
        expect(endgames.length).to.be.at.least(40);
        expect(endgames.some(p => p.name.startsWith('bot game'))).to.be.true;
        expect(endgames.some(p => p.name.startsWith('random game'))).to.be.true;
        for (const p of endgames) {
            const board = boardFromPosition(p);
            expect(totalPieces(board), p.name).to.be.at.most(10);
            expect(board.getWinner(), p.name).to.equal(Winner.NONE);
        }
    });

    it('should have positions in the middle of a capture chain, where the player may stop', () => {
        expect(ofKind('midChain').length).to.be.at.least(20);
        for (const p of ofKind('midChain')) {
            const board = boardFromPosition(p);
            expect(p.state.currentlyMovingPiece, p.name).to.not.be.null;
            expect(board.canEndTurn(), p.name).to.be.true;
        }
    });

    it('should have finished games: wins and draws', () => {
        const winners = ofKind('finished').map(p => boardFromPosition(p).getWinner());
        expect(winners).to.not.include(Winner.NONE);
        expect(winners).to.include(Winner.DRAW);
        expect(winners.some(w => w === Winner.WHITE || w === Winner.BLACK)).to.be.true;
    });

    it('should have positions one quiet turn away from the no-capture draw', () => {
        expect(ofKind('nearDraw').length).to.be.at.least(10);
        for (const p of ofKind('nearDraw')) {
            expect(p.state.turnsWithoutCapture, p.name).to.equal(59);
            expect(boardFromPosition(p).getWinner(), p.name).to.equal(Winner.NONE);
        }
    });

    it('should have small boards of several sizes', () => {
        const sizes = new Set(ofKind('small').map(p => `${p.rows}x${p.columns}`));
        expect([...sizes].sort()).to.deep.equal(['3x3', '3x5', '5x5']);
    });

    it('should make benchmark positions: openings, and endgames from bot games and random games', () => {
        const bench = generateBenchmarkPositions(9);
        expect(bench.openings.length).to.equal(20);
        expect(bench.endgames.length).to.be.at.least(20);
        expect(bench.endgames.some(p => p.name.startsWith('bot game'))).to.be.true;
        expect(bench.endgames.some(p => p.name.startsWith('random game'))).to.be.true;
        for (const p of bench.endgames) {
            const board = boardFromPosition(p);
            expect(totalPieces(board), p.name).to.be.at.most(10);
            expect(board.getWinner(), p.name).to.equal(Winner.NONE);
        }
    });
});
