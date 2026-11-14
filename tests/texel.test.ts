import { expect } from 'chai';
import Board from '../src/Board.js';
import { PieceType } from '../src/types.js';
import { seededRng } from '../src/ai/random.js';
import { applyOpening, generateOpenings } from '../src/ai/tuning/Openings.js';
import { Sample, fitLogistic, labelPositions, recordPosition, toWeights } from '../src/ai/tuning/Texel.js';
import { EVALUATOR_NAMES } from '../src/ai/presets.js';
import { runTuning } from '../src/ai/tuning/Tuner.js';

describe('Opening tests', () => {
    it('should generate the same distinct, balanced openings for the same seed', () => {
        const openings = generateOpenings(20, 4, 7);
        expect(openings.length).to.equal(20);
        expect(JSON.stringify(generateOpenings(20, 4, 7))).to.equal(JSON.stringify(openings));
        const positions = new Set<string>();
        for (const opening of openings) {
            expect(opening.length).to.equal(4);
            const board = new Board();
            applyOpening(board, opening);
            positions.add(board.getBoardPositionsAsString());
            expect(Math.abs(board.getNumPieces(PieceType.WHITE) - board.getNumPieces(PieceType.BLACK))).to.be.at.most(2);
        }
        expect(positions.size).to.equal(20);
    });

    it('should reject an odd number of opening turns', () => {
        expect(() => generateOpenings(5, 3)).to.throw('even');
    });

    it('should play each opening once with each colour in a tuning run', async () => {
        const result = await runTuning({
            openings: { count: 2, turns: 4 },
            opponents: ['Random'],
            base: { depth: 1, weights: { material: 100 } },
        }, 1);
        expect(result.totalGames).to.equal(4);
    });
});

describe('Texel tests', () => {
    it('should record features from the side to move and label them with the result', () => {
        const board = new Board(3, 3, '210200201');
        const position = recordPosition(board, PieceType.WHITE);
        // material for white is 2 - 3 = -1, and white can capture so the position isn't quiet
        expect(position.features[0]).to.equal(-1);
        expect(position.quiet).to.equal(false);
        expect(labelPositions([position], 'WHITE', 0)[0].result).to.equal(1);
        expect(labelPositions([position], 'BLACK', 0)[0].result).to.equal(0);
        expect(labelPositions([position], 'DRAW', 0)[0].result).to.equal(0.5);
    });

    it('should recover the weights that generated the results', () => {
        // Results drawn from a known model: sigmoid(0.4 * material + 0.2 * lineExposure)
        const rng = seededRng(3);
        const samples: Sample[] = [];
        for (let i = 0; i < 20000; i++) {
            const features = [Math.round(rng() * 10 - 5), Math.round(rng() * 6 - 3), 0, 0, Math.round(rng() * 8 - 4)];
            // Pad with zeros for any evaluators after the first five
            while (features.length < EVALUATOR_NAMES.length) features.push(0);
            const p = 1 / (1 + Math.exp(-(0.4 * features[0] + 0.2 * features[4])));
            samples.push({ features, result: rng() < p ? 1 : 0, quiet: true, game: i });
        }
        const fit = fitLogistic(samples);
        expect(fit.coefficients[0]).to.be.closeTo(0.4, 0.03);
        expect(fit.coefficients[4]).to.be.closeTo(0.2, 0.03);
        expect(fit.coefficients[1]).to.be.closeTo(0, 0.03);
        expect(toWeights(fit.coefficients).lineExposure).to.be.closeTo(50, 8);
    });
});
