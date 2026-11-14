import { expect } from 'chai';
import Board from '../src/Board.js';
import { PieceType } from '../src/types.js';
import { seededRng } from '../src/ai/random.js';
import { applyOpening, generateOpenings } from '../src/ai/tuning/Openings.js';
import { Sample, fitLogistic, labelPositions, recordPosition, remapFeatures, toWeights } from '../src/ai/tuning/Texel.js';
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
    it('should remap features saved in an older evaluator order to the current one', () => {
        // Files saved before mobility was removed list 7 features, with mobility third
        const savedNames = ['material', 'vulnerability', 'mobility', 'strongPoints', 'lineExposure', 'edgeExposure', 'centrality'];
        const remapped = remapFeatures([1, 2, 3, 4, 5, 6, 7], savedNames);
        expect(remapped.length).to.equal(EVALUATOR_NAMES.length);
        const byName = Object.fromEntries(EVALUATOR_NAMES.map((name, i) => [name, remapped[i]]));
        expect(byName).to.deep.equal({ material: 1, vulnerability: 2, strongPoints: 4, lineExposure: 5, edgeExposure: 6, centrality: 7 });
    });

    it('should count features missing from an old file as 0', () => {
        // Files saved before the endgame evaluators were added
        const savedNames = ['material', 'vulnerability', 'mobility', 'strongPoints', 'lineExposure'];
        const remapped = remapFeatures([1, 2, 3, 4, 5], savedNames);
        const byName = Object.fromEntries(EVALUATOR_NAMES.map((name, i) => [name, remapped[i]]));
        expect(byName).to.deep.equal({ material: 1, vulnerability: 2, strongPoints: 4, lineExposure: 5, edgeExposure: 0, centrality: 0 });
    });

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
        // Feature positions are looked up by name, so the test doesn't depend on the order of EVALUATOR_NAMES
        const MATERIAL = EVALUATOR_NAMES.indexOf('material');
        const VULNERABILITY = EVALUATOR_NAMES.indexOf('vulnerability');
        const LINE_EXPOSURE = EVALUATOR_NAMES.indexOf('lineExposure');
        const rng = seededRng(3);
        const samples: Sample[] = [];
        for (let i = 0; i < 20000; i++) {
            // Every other evaluator is 0
            const features = EVALUATOR_NAMES.map(() => 0);
            features[MATERIAL] = Math.round(rng() * 10 - 5);
            features[VULNERABILITY] = Math.round(rng() * 6 - 3);
            features[LINE_EXPOSURE] = Math.round(rng() * 8 - 4);
            const p = 1 / (1 + Math.exp(-(0.4 * features[MATERIAL] + 0.2 * features[LINE_EXPOSURE])));
            samples.push({ features, result: rng() < p ? 1 : 0, quiet: true, game: i });
        }
        const fit = fitLogistic(samples);
        expect(fit.coefficients[MATERIAL]).to.be.closeTo(0.4, 0.03);
        expect(fit.coefficients[LINE_EXPOSURE]).to.be.closeTo(0.2, 0.03);
        expect(fit.coefficients[VULNERABILITY]).to.be.closeTo(0, 0.03);
        expect(toWeights(fit.coefficients).lineExposure).to.be.closeTo(50, 8);
    });
});
