import { expect } from 'chai';
import Board from '../src/Board.js';
import { PieceType } from '../src/types.js';
import { material, lineExposure } from '../src/ai/evaluators.js';
import { evaluatorFromWeights } from '../src/ai/presets.js';
import { buildVariants, TuningConfig } from '../src/ai/tuning/TuningConfig.js';
import { runTuning } from '../src/ai/tuning/Tuner.js';
import { applyOpening, generateEndgameStarts, startLead } from '../src/ai/tuning/Openings.js';
import { Winner } from '../src/types.js';

describe('Tuning tests', () => {
    it('evaluatorFromWeights should weight each named evaluator', () => {
        const board = new Board(3, 3, '210200201');
        const evaluator = evaluatorFromWeights({ material: 10, lineExposure: 3, strongPoints: 0 });
        expect(evaluator(board, PieceType.WHITE)).to.equal(10 * material(board, PieceType.WHITE) + 3 * lineExposure(board, PieceType.WHITE));
    });

    it('should build every combination of the grid on top of the base', () => {
        const variants = buildVariants({
            base: { depth: 2, weights: { material: 100, strongPoints: 2 } },
            grid: { strongPoints: [0, 5], depth: [1, 2, 3] },
        });
        expect(variants.length).to.equal(6);
        expect(variants[0]).to.deep.equal({ kind: 'search', name: 'strongPoints=0 depth=1', depth: 1, weights: { material: 100, strongPoints: 0 } });
        expect(variants[5]).to.deep.equal({ kind: 'search', name: 'strongPoints=5 depth=3', depth: 3, weights: { material: 100, strongPoints: 5 } });
    });

    it('should include the base and apply variant weights on top of it when there is no grid', () => {
        const variants = buildVariants({
            base: { depth: 2, weights: { material: 100, strongPoints: 2 } },
            variants: [{ name: 'No strongPoints', weights: { strongPoints: 0 } }, { name: 'Shallow', depth: 1 }],
        });
        expect(variants).to.deep.equal([
            { kind: 'search', name: 'Base', depth: 2, weights: { material: 100, strongPoints: 2 } },
            { kind: 'search', name: 'No strongPoints', depth: 2, weights: { material: 100, strongPoints: 0 } },
            { kind: 'search', name: 'Shallow', depth: 1, weights: { material: 100, strongPoints: 2 } },
        ]);
    });

    it('should reject unknown evaluator names', () => {
        expect(() => buildVariants({ base: { weights: { materail: 100 } as any } })).to.throw('Unknown evaluator "materail"');
        expect(() => buildVariants({ base: { weights: {} }, grid: { speed: [1] } as any })).to.throw('Unknown grid key "speed"');
        // mobility has been removed, so old configs that use it are rejected rather than silently ignored
        expect(() => buildVariants({ base: { weights: { mobility: 2 } as any } })).to.throw('Unknown evaluator "mobility"');
        expect(() => buildVariants({ base: { weights: {} }, grid: { mobility: [0, 2] } as any })).to.throw('Unknown grid key "mobility"');
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

    describe('Endgame starts', () => {
        const options = { minPieces: 6, maxPieces: 9, minImbalance: 1, maxImbalance: 2 };
        const starts = generateEndgameStarts(6, options, 7);

        function replay(start: ReturnType<typeof generateEndgameStarts>[number]): Board {
            const board = new Board();
            applyOpening(board, start);
            return board;
        }

        it('should give the same starts for the same seed and different ones for another seed', () => {
            expect(generateEndgameStarts(6, options, 7)).to.deep.equal(starts);
            expect(generateEndgameStarts(6, options, 8)).to.not.deep.equal(starts);
        });

        it('should have the requested number of pieces and imbalance, and not be finished', () => {
            expect(starts.length).to.equal(6);
            for (const start of starts) {
                const board = replay(start);
                const white = board.getNumPieces(PieceType.WHITE);
                const black = board.getNumPieces(PieceType.BLACK);
                expect(white + black).to.be.within(6, 9);
                expect(Math.abs(white - black)).to.be.within(1, 2);
                expect(board.getWinner()).to.equal(Winner.NONE);
            }
        });

        it('should all be different positions', () => {
            const keys = starts.map(start => {
                const board = replay(start);
                return board.getBoardPositionsAsString() + board.getTurn();
            });
            expect(new Set(keys).size).to.equal(starts.length);
        });

        it('should respect other piece and imbalance limits', () => {
            for (const start of generateEndgameStarts(3, { minPieces: 4, maxPieces: 6, minImbalance: 2, maxImbalance: 2 }, 3)) {
                const board = replay(start);
                const white = board.getNumPieces(PieceType.WHITE);
                const black = board.getNumPieces(PieceType.BLACK);
                expect(white + black).to.be.within(4, 6);
                expect(Math.abs(white - black)).to.equal(2);
            }
        });

        it('startLead should give white\'s pieces minus black\'s after the start', () => {
            for (const start of starts) {
                const board = replay(start);
                expect(startLead(start)).to.equal(board.getNumPieces(PieceType.WHITE) - board.getNumPieces(PieceType.BLACK));
            }
            expect(startLead([])).to.equal(0);
        });

        it('should reject a config with both openings and endgame starts', async () => {
            const config: TuningConfig = {
                opponents: ['Random'],
                base: { depth: 1, weights: { material: 100 } },
                openings: { count: 1, turns: 2 },
                endgameStarts: { count: 1 },
            };
            let error: unknown;
            try { await runTuning(config, 1); } catch (e) { error = e; }
            expect(String(error)).to.contain('either openings or endgameStarts');
        });

        it('should play each start with both colours and split results by who was ahead', async () => {
            const config: TuningConfig = {
                opponents: ['Random'],
                base: { depth: 1, weights: { material: 100 } },
                endgameStarts: { count: 3, seed: 5 },
            };
            const result = await runTuning(config, 2);
            expect(result.totalGames).to.equal(6);
            const base = result.participants.find(p => p.spec.name === 'Base')!;
            const random = result.participants.find(p => p.spec.name === 'Random')!;
            const games = (r: { wins: number, draws: number, losses: number }) => r.wins + r.draws + r.losses;
            // Every start is unbalanced and is played once with each colour, so each bot is ahead in exactly one game per start.
            expect(games(base.ahead)).to.equal(3);
            expect(games(base.behind)).to.equal(3);
            expect(base.ahead.wins + base.behind.wins).to.equal(base.wins);
            expect(base.ahead.draws + base.behind.draws).to.equal(base.draws);
            expect(base.ahead.losses + base.behind.losses).to.equal(base.losses);
            // When one bot is ahead the other is behind in the same game.
            expect(base.ahead).to.deep.equal({ wins: random.behind.losses, draws: random.behind.draws, losses: random.behind.wins });
            expect(base.behind).to.deep.equal({ wins: random.ahead.losses, draws: random.ahead.draws, losses: random.ahead.wins });
        });
    });
});
