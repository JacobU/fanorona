import { expect } from 'chai';
import Board from '../src/Board.js';
import { PieceType, Turn } from '../src/types.js';
import BotRandomPlayer from '../src/ai/BotRandomPlayer.js';
import SearchBot from '../src/ai/SearchBot.js';
import { ALL_PRESETS, DeepFortress, Deep6Central, Fortress } from '../src/ai/presets.js';
import { searchDepthFor } from '../src/ai/endgame.js';
import { DIFFICULTIES, DIFFICULTY_NAMES } from '../src/ai/difficulties.js';

/** A 5x9 board with a few pieces of each colour, for checking the endgame depth. */
function endgameBoard(): Board {
    const cells = new Array(45).fill('0');
    for (const i of [0, 13, 22]) cells[i] = '1';
    for (const i of [4, 31, 44]) cells[i] = '2';
    return new Board(5, 9, cells.join(''));
}

describe('Difficulty level tests', () => {
    it('should have Easy, Medium, Hard and Impossible, in that order', () => {
        expect(DIFFICULTY_NAMES).to.deep.equal(['Easy', 'Medium', 'Hard', 'Impossible']);
        for (const name of DIFFICULTY_NAMES) {
            expect(DIFFICULTIES[name].name).to.equal(name);
            expect(DIFFICULTIES[name].description).to.be.a('string').that.is.not.empty;
        }
    });

    it('Easy should be the random bot', () => {
        expect(DIFFICULTIES.Easy.preset).to.equal(null);
        expect(DIFFICULTIES.Easy.create(PieceType.WHITE, new Board())).to.be.instanceOf(BotRandomPlayer);
    });

    it('Medium should be Fortress (depth 2) and Hard should be DeepFortress (depth 4 all game)', () => {
        expect(DIFFICULTIES.Medium.preset).to.equal(Fortress);
        expect(DIFFICULTIES.Hard.preset).to.equal(DeepFortress);
        expect(searchDepthFor(DeepFortress, new Board())).to.equal(4);
        expect(searchDepthFor(DeepFortress, endgameBoard())).to.equal(4);
        for (const name of ['Medium', 'Hard', 'Impossible'] as const) {
            expect(DIFFICULTIES[name].create(PieceType.BLACK, new Board())).to.be.instanceOf(SearchBot);
        }
    });

    it('Impossible should be Deep6Central: r02\'s weights, searching 6 turns ahead on every move', () => {
        expect(DIFFICULTIES.Impossible.preset).to.equal(Deep6Central);
        expect(Deep6Central.weights).to.deep.equal(Fortress.weights);
        expect(Deep6Central.endgameWeights).to.deep.equal({ edgeExposure: 8, centrality: 37, strongPoints: 1, vulnerability: -24 });
        expect(searchDepthFor(Deep6Central, new Board())).to.equal(6);
        expect(searchDepthFor(Deep6Central, endgameBoard())).to.equal(6);
    });

    it('Deep6Central should not be in ALL_PRESETS, so the default tournaments and the quick tests stay fast', () => {
        expect(ALL_PRESETS).to.not.include(Deep6Central);
    });

    it('every difficulty should play a whole turn from the starting position', function () {
        // Impossible searches 6 turns ahead, which takes under a second from the starting position.
        this.timeout(20000);
        for (const name of DIFFICULTY_NAMES) {
            const board = new Board();
            const player = DIFFICULTIES[name].create(PieceType.WHITE, board);
            let result;
            do {
                result = player.makeMove();
                expect(result.move.index, name).to.be.a('number');
            } while (result.canMoveAgain);
            expect(board.getTurn(), name).to.equal(Turn.BLACK);
        }
    });
});
