import { expect } from 'chai';
import Board from '../src/Board.js';
import { PieceType } from '../src/types.js';
import { material, lineExposure } from '../src/ai/evaluators.js';
import { evaluatorFromWeights } from '../src/ai/presets.js';
import { buildVariants, TuningConfig } from '../src/ai/tuning/TuningConfig.js';
import { runTuning } from '../src/ai/tuning/Tuner.js';

describe('Tuning tests', () => {
    it('evaluatorFromWeights should weight each named evaluator', () => {
        const board = new Board(3, 3, '210200201');
        const evaluator = evaluatorFromWeights({ material: 10, lineExposure: 3, mobility: 0 });
        expect(evaluator(board, PieceType.WHITE)).to.equal(10 * material(board, PieceType.WHITE) + 3 * lineExposure(board, PieceType.WHITE));
    });

    it('should build every combination of the grid on top of the base', () => {
        const variants = buildVariants({
            base: { depth: 2, weights: { material: 100, mobility: 2 } },
            grid: { mobility: [0, 5], depth: [1, 2, 3] },
        });
        expect(variants.length).to.equal(6);
        expect(variants[0]).to.deep.equal({ kind: 'search', name: 'mobility=0 depth=1', depth: 1, weights: { material: 100, mobility: 0 } });
        expect(variants[5]).to.deep.equal({ kind: 'search', name: 'mobility=5 depth=3', depth: 3, weights: { material: 100, mobility: 5 } });
    });

    it('should include the base and apply variant weights on top of it when there is no grid', () => {
        const variants = buildVariants({
            base: { depth: 2, weights: { material: 100, mobility: 2 } },
            variants: [{ name: 'No mobility', weights: { mobility: 0 } }, { name: 'Shallow', depth: 1 }],
        });
        expect(variants).to.deep.equal([
            { kind: 'search', name: 'Base', depth: 2, weights: { material: 100, mobility: 2 } },
            { kind: 'search', name: 'No mobility', depth: 2, weights: { material: 100, mobility: 0 } },
            { kind: 'search', name: 'Shallow', depth: 1, weights: { material: 100, mobility: 2 } },
        ]);
    });

    it('should reject unknown evaluator names', () => {
        expect(() => buildVariants({ base: { weights: { materail: 100 } as any } })).to.throw('Unknown evaluator "materail"');
        expect(() => buildVariants({ base: { weights: {} }, grid: { speed: [1] } as any })).to.throw('Unknown grid key "speed"');
    });

    it('should play every game of a gauntlet across worker threads', async () => {
        const config: TuningConfig = {
            gamesPerPair: 2,
            opponents: ['Random'],
            base: { depth: 1, weights: { material: 100 } },
        };
        const result = await runTuning(config, 2);
        expect(result.totalGames).to.equal(2);
        const base = result.participants.find(p => p.spec.name === 'Base')!;
        const random = result.participants.find(p => p.spec.name === 'Random')!;
        expect(base.isVariant).to.be.true;
        expect(base.games).to.equal(2);
        expect(base.wins).to.equal(random.losses);
        expect(base.draws).to.equal(random.draws);
    });
});
