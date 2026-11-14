import { expect } from 'chai';
import Board from '../src/Board.js';
import { PieceType } from '../src/types.js';
import { Evaluator } from '../src/ai/Evaluator.js';
import { centrality, edgeExposure, material } from '../src/ai/evaluators.js';
import {
    ALL_PRESETS, DeepFortress, DeepFortressEndgame, EVALUATOR_NAMES, Fortress, FortressEndgame, Lookahead,
    createPreset, evaluatorFromWeights,
} from '../src/ai/presets.js';
import { ENDGAME_FULL_PIECES, ENDGAME_START_PIECES, endgameFactor, searchDepthFor, totalPieces } from '../src/ai/endgame.js';
import { BotSpec, findBuiltInSpec, presetFromSpec, specFromPreset } from '../src/ai/tuning/BotSpec.js';
import { buildVariants } from '../src/ai/tuning/TuningConfig.js';

/**
 * Builds a board of the given size with white and black pieces at the given indexes (everything else empty).
 */
function boardWith(rows: number, cols: number, white: number[], black: number[]): Board {
    const cells = new Array(rows * cols).fill('0');
    for (const i of white) cells[i] = '1';
    for (const i of black) cells[i] = '2';
    return new Board(rows, cols, cells.join(''));
}

/**
 * A 5x9 board with the given number of pieces (white and black alternating, on cells spread over the board).
 */
function boardWithPieces(n: number): Board {
    // Mix of corners, edges and interior cells so the endgame evaluators aren't 0.
    const spots = [0, 22, 44, 13, 4, 31, 9, 20, 36, 12, 17, 24, 40, 30, 8, 2];
    const white = spots.slice(0, n).filter((_, i) => i % 2 === 0);
    const black = spots.slice(0, n).filter((_, i) => i % 2 === 1);
    return boardWith(5, 9, white, black);
}

/** Small deterministic random number generator so the random-board tests always see the same boards. */
function lcg(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

function randomBoard(rows: number, cols: number, rng: () => number): Board {
    let cells = '';
    for (let i = 0; i < rows * cols; i++) cells += Math.floor(rng() * 3).toString();
    return new Board(rows, cols, cells);
}

describe('Endgame evaluator tests', () => {
    describe('edgeExposure', () => {
        it('should count a corner as 2 and an edge as 1 on a 5x9 board', () => {
            // White: corner 0 (2), interior 13 (0). Black: top edge 4 (1), interior 22 (0), corner 44 (2).
            const board = boardWith(5, 9, [0, 13], [4, 22, 44]);
            expect(edgeExposure(board, PieceType.WHITE)).to.equal(3 - 2);
            expect(edgeExposure(board, PieceType.BLACK)).to.equal(2 - 3);
        });

        it('should treat the first and last columns as edges', () => {
            // White: left edge 9 (1), right edge 17 (1). Black: bottom-left corner 36 (2), bottom edge 40 (1),
            // interior 20 and 11 (0).
            const board = boardWith(5, 9, [9, 17], [36, 40, 20, 11]);
            expect(edgeExposure(board, PieceType.WHITE)).to.equal(3 - 2);
            expect(edgeExposure(board, PieceType.BLACK)).to.equal(2 - 3);
        });

        it('should work on a 3x3 board where only the centre is off the edge', () => {
            // White: 1 (edge) and 8 (corner) = 3. Black: 0 (corner), 3 (edge), 6 (corner) = 5.
            const board = new Board(3, 3, '210200201');
            expect(edgeExposure(board, PieceType.WHITE)).to.equal(2);
            expect(edgeExposure(board, PieceType.BLACK)).to.equal(-2);

            // White in the centre (0). Black: 3 (edge) and 8 (corner) = 3.
            const centre = new Board(3, 3, '000210002');
            expect(edgeExposure(centre, PieceType.WHITE)).to.equal(3);
            expect(edgeExposure(centre, PieceType.BLACK)).to.equal(-3);
        });

        it('should work on a 5x5 board', () => {
            // White: 12 (centre) and 6 (interior) = 0. Black: 0 (corner), 2 (top edge), 14 (right edge), 18 (interior) = 4.
            const board = boardWith(5, 5, [12, 6], [0, 2, 14, 18]);
            expect(edgeExposure(board, PieceType.WHITE)).to.equal(4);
            expect(edgeExposure(board, PieceType.BLACK)).to.equal(-4);
        });

        it('should only count our own pieces when the opponent has none', () => {
            const board = boardWith(5, 9, [0, 22, 4], []);
            expect(edgeExposure(board, PieceType.WHITE)).to.equal(-3);
            expect(edgeExposure(board, PieceType.BLACK)).to.equal(3);
        });

        it('should be 0 on an empty board', () => {
            const board = boardWith(5, 9, [], []);
            expect(edgeExposure(board, PieceType.WHITE)).to.equal(0);
            expect(edgeExposure(board, PieceType.BLACK)).to.equal(0);
        });
    });

    describe('centrality', () => {
        it('should be the distance to the nearest edge on a 5x9 board', () => {
            // White: corner 0 (0), 13 = row 1 col 4 (1). Black: 4 (0), 22 = row 2 col 4 (2), 44 (0).
            const board = boardWith(5, 9, [0, 13], [4, 22, 44]);
            expect(centrality(board, PieceType.WHITE)).to.equal(1 - 2);
            expect(centrality(board, PieceType.BLACK)).to.equal(2 - 1);
        });

        it('should use the nearest edge, including columns, on a 5x9 board', () => {
            // Row 2 col 1 (index 19) is 1 from the left edge even though it's in the middle row.
            // Row 2 col 2 (index 20) and row 2 col 6 (index 24) are 2. Row 1 col 7 (index 16) is 1.
            const board = boardWith(5, 9, [19, 20], [24, 16, 9]);
            expect(centrality(board, PieceType.WHITE)).to.equal((1 + 2) - (2 + 1 + 0));
            expect(centrality(board, PieceType.BLACK)).to.equal(0);

            const board2 = boardWith(5, 9, [9, 17], [36, 40, 20, 11]);
            expect(centrality(board2, PieceType.WHITE)).to.equal(0 - (0 + 0 + 2 + 1));
            expect(centrality(board2, PieceType.BLACK)).to.equal(3);
        });

        it('should work on a 3x3 board where the centre is 1', () => {
            expect(centrality(new Board(3, 3, '210200201'), PieceType.WHITE)).to.equal(0);
            const centre = new Board(3, 3, '000210002');
            expect(centrality(centre, PieceType.WHITE)).to.equal(1);
            expect(centrality(centre, PieceType.BLACK)).to.equal(-1);
        });

        it('should work on a 5x5 board where the centre is 2', () => {
            // White: 12 (2), 6 (1). Black: 0, 2, 14 (0) and 18 (1).
            const board = boardWith(5, 5, [12, 6], [0, 2, 14, 18]);
            expect(centrality(board, PieceType.WHITE)).to.equal(3 - 1);
            expect(centrality(board, PieceType.BLACK)).to.equal(-2);
        });

        it('should only count our own pieces when the opponent has none', () => {
            const board = boardWith(5, 9, [0, 22, 13], []);
            expect(centrality(board, PieceType.WHITE)).to.equal(3);
            expect(centrality(board, PieceType.BLACK)).to.equal(-3);
        });
    });

    it('both should be 0 on the starting board', () => {
        const board = new Board();
        for (const evaluator of [edgeExposure, centrality]) {
            expect(evaluator(board, PieceType.WHITE)).to.equal(0);
            expect(evaluator(board, PieceType.BLACK)).to.equal(0);
        }
    });

    it('both should be symmetric on random boards of different sizes', () => {
        const rng = lcg(12345);
        for (const [rows, cols] of [[3, 3], [5, 5], [5, 9], [3, 5]]) {
            for (let i = 0; i < 20; i++) {
                const board = randomBoard(rows, cols, rng);
                for (const evaluator of [edgeExposure, centrality]) {
                    expect(evaluator(board, PieceType.WHITE)).to.equal(-evaluator(board, PieceType.BLACK));
                }
            }
        }
    });

    it('both should be registered so they can be used in weights', () => {
        expect(EVALUATOR_NAMES).to.include('edgeExposure');
        expect(EVALUATOR_NAMES).to.include('centrality');
        const board = boardWith(5, 9, [0, 13], [4, 22, 44]);
        const evaluator = evaluatorFromWeights({ edgeExposure: 40, centrality: 20 });
        expect(evaluator(board, PieceType.WHITE)).to.equal(40 * 1 + 20 * -1);
    });

    it('should not be used by the normal weights of any existing preset', () => {
        for (const preset of ALL_PRESETS) {
            expect(preset.weights.edgeExposure ?? 0).to.equal(0);
            expect(preset.weights.centrality ?? 0).to.equal(0);
        }
    });
});

describe('Endgame blending tests', () => {
    it('should start blending in at 10 pieces and be fully blended at 6', () => {
        expect(ENDGAME_START_PIECES).to.equal(10);
        expect(ENDGAME_FULL_PIECES).to.equal(6);
    });

    it('endgameFactor should rise linearly from 0 at 10 pieces to 1 at 6', () => {
        const expected: [number, number][] = [[44, 0], [11, 0], [10, 0], [9, 0.25], [8, 0.5], [7, 0.75], [6, 1], [3, 1], [0, 1]];
        for (const [n, factor] of expected) {
            expect(endgameFactor(n), `${n} pieces`).to.equal(factor);
        }
    });

    it('totalPieces should count both colours', () => {
        expect(totalPieces(new Board())).to.equal(44);
        expect(totalPieces(boardWith(5, 9, [0, 13], [4, 22, 44]))).to.equal(5);
        expect(totalPieces(boardWithPieces(9))).to.equal(9);
    });

    const endgameWeights = { edgeExposure: 40, centrality: 20 };
    const base = evaluatorFromWeights(Fortress.weights);
    const endgame = evaluatorFromWeights(endgameWeights);
    const blended = createPreset('Blended', 2, Fortress.weights, '', { endgameWeights, endgameDepth: 6 });

    function expectBlend(evaluator: Evaluator, n: number, factor: number) {
        const board = boardWithPieces(n);
        for (const pieceType of [PieceType.WHITE, PieceType.BLACK]) {
            const expected = base(board, pieceType) + factor * endgame(board, pieceType);
            expect(evaluator(board, pieceType), `${n} pieces`).to.equal(expected);
        }
    }

    it('the endgame positions used for the blending tests should have non-zero endgame scores', () => {
        for (const n of [6, 7, 8, 9, 10, 12]) {
            expect(endgame(boardWithPieces(n), PieceType.WHITE), `${n} pieces`).to.not.equal(0);
        }
    });

    it('should equal the base evaluator with 10 or more pieces', () => {
        expectBlend(blended.evaluator, 16, 0);
        expectBlend(blended.evaluator, 12, 0);
        expectBlend(blended.evaluator, 10, 0);
        const start = new Board();
        expect(blended.evaluator(start, PieceType.WHITE)).to.equal(base(start, PieceType.WHITE));
    });

    it('should add the right fraction of the endgame terms between 10 and 6 pieces', () => {
        expectBlend(blended.evaluator, 9, 0.25);
        expectBlend(blended.evaluator, 8, 0.5);
        expectBlend(blended.evaluator, 7, 0.75);
    });

    it('should add the full endgame terms with 6 or fewer pieces', () => {
        expectBlend(blended.evaluator, 6, 1);
        expectBlend(blended.evaluator, 4, 1);
        expectBlend(blended.evaluator, 3, 1);
    });

    it('should stay symmetric when blended', () => {
        for (const n of [3, 7, 9, 12]) {
            const board = boardWithPieces(n);
            expect(blended.evaluator(board, PieceType.WHITE)).to.equal(-blended.evaluator(board, PieceType.BLACK));
        }
    });

    it('presets without endgame settings should be unchanged', () => {
        expect(createPreset('Plain', 2, Fortress.weights).endgameWeights).to.equal(undefined);
        for (const preset of [Fortress, DeepFortress, Lookahead]) {
            expect(preset.endgameWeights).to.equal(undefined);
            expect(preset.endgameDepth).to.equal(undefined);
            const plain = evaluatorFromWeights(preset.weights);
            for (const n of [3, 6, 8, 12]) {
                const board = boardWithPieces(n);
                expect(preset.evaluator(board, PieceType.WHITE)).to.equal(plain(board, PieceType.WHITE));
            }
            expect(searchDepthFor(preset, boardWithPieces(4))).to.equal(preset.depth);
        }
    });

    it('searchDepthFor should use endgameDepth with 10 or fewer pieces', () => {
        expect(searchDepthFor(blended, new Board())).to.equal(2);
        expect(searchDepthFor(blended, boardWithPieces(11))).to.equal(2);
        expect(searchDepthFor(blended, boardWithPieces(10))).to.equal(6);
        expect(searchDepthFor(blended, boardWithPieces(7))).to.equal(6);
        expect(searchDepthFor(blended, boardWithPieces(2))).to.equal(6);
    });

    it('searchDepthFor should use depth when only endgame weights are set', () => {
        const weightsOnly = createPreset('WeightsOnly', 3, { material: 100 }, '', { endgameWeights });
        expect(searchDepthFor(weightsOnly, boardWithPieces(4))).to.equal(3);
    });

    it('endgameDepth on its own should not change the evaluator', () => {
        const depthOnly = createPreset('DepthOnly', 2, { material: 100 }, '', { endgameDepth: 6 });
        const board = boardWithPieces(4);
        expect(depthOnly.evaluator(board, PieceType.WHITE)).to.equal(100 * material(board, PieceType.WHITE));
        expect(searchDepthFor(depthOnly, board)).to.equal(6);
    });

    it('FortressEndgame and DeepFortressEndgame should be Fortress with endgame settings', () => {
        expect(FortressEndgame.depth).to.equal(2);
        expect(DeepFortressEndgame.depth).to.equal(4);
        for (const preset of [FortressEndgame, DeepFortressEndgame]) {
            expect(preset.weights).to.deep.equal(Fortress.weights);
            expect(preset.endgameWeights).to.deep.equal({ edgeExposure: 40, centrality: 20 });
            expect(preset.endgameDepth).to.equal(6);
            expect(ALL_PRESETS).to.include(preset);
            expectBlend(preset.evaluator, 8, 0.5);
        }
    });
});

describe('Endgame BotSpec tests', () => {
    it('specFromPreset should carry the endgame settings', () => {
        const spec = specFromPreset(FortressEndgame);
        expect(spec).to.deep.equal({
            kind: 'search', name: 'FortressEndgame', depth: 2, weights: Fortress.weights,
            endgameWeights: { edgeExposure: 40, centrality: 20 }, endgameDepth: 6,
        });
        // The spec gets its own copy of the weights.
        if (spec.kind === 'search') expect(spec.endgameWeights).to.not.equal(FortressEndgame.endgameWeights);
        expect(findBuiltInSpec('fortressendgame')).to.deep.equal(spec);
    });

    it('specFromPreset should not add endgame fields to presets without them', () => {
        expect(specFromPreset(Fortress)).to.deep.equal({ kind: 'search', name: 'Fortress', depth: 2, weights: Fortress.weights });
    });

    it('should round trip the endgame settings through presetFromSpec', () => {
        const spec: BotSpec = {
            kind: 'search', name: 'Test', depth: 3, weights: { material: 100 },
            endgameWeights: { centrality: 7 }, endgameDepth: 5,
        };
        const preset = presetFromSpec(spec);
        expect(preset.endgameWeights).to.deep.equal({ centrality: 7 });
        expect(preset.endgameDepth).to.equal(5);
        expect(specFromPreset(preset)).to.deep.equal(spec);
        const board = boardWithPieces(4);
        expect(preset.evaluator(board, PieceType.WHITE)).to.equal(100 * material(board, PieceType.WHITE) + 7 * centrality(board, PieceType.WHITE));

        const plain: BotSpec = { kind: 'search', name: 'Plain', depth: 2, weights: { material: 100 } };
        expect(specFromPreset(presetFromSpec(plain))).to.deep.equal(plain);
    });

    it('tuning configs should pass endgame settings from the base and variants to the bots', () => {
        const variants = buildVariants({
            base: { depth: 2, weights: { material: 100 }, endgameWeights: { edgeExposure: 40 }, endgameDepth: 6 },
            variants: [
                { name: 'More centrality', endgameWeights: { centrality: 20 } },
                { name: 'Shallow endgame', endgameDepth: 4 },
            ],
        });
        expect(variants).to.deep.equal([
            { kind: 'search', name: 'Base', depth: 2, weights: { material: 100 }, endgameWeights: { edgeExposure: 40 }, endgameDepth: 6 },
            { kind: 'search', name: 'More centrality', depth: 2, weights: { material: 100 }, endgameWeights: { edgeExposure: 40, centrality: 20 }, endgameDepth: 6 },
            { kind: 'search', name: 'Shallow endgame', depth: 2, weights: { material: 100 }, endgameWeights: { edgeExposure: 40 }, endgameDepth: 4 },
        ]);
    });

    it('tuning configs without endgame settings should build the same bots as before', () => {
        expect(buildVariants({ base: { depth: 2, weights: { material: 100 } } })).to.deep.equal([
            { kind: 'search', name: 'Base', depth: 2, weights: { material: 100 } },
        ]);
    });

    it('tuning configs should reject unknown evaluators in endgame weights', () => {
        expect(() => buildVariants({ base: { weights: {}, endgameWeights: { edgy: 1 } as any } })).to.throw('Unknown evaluator "edgy"');
    });
});

describe('Per-bot endgame threshold tests', () => {
    const endgameWeights = { edgeExposure: 40, centrality: 20 };

    it('endgameFactor should use custom start and full thresholds when given', () => {
        const expected: [number, number][] = [[12, 0], [8, 0], [7, 0.25], [6, 0.5], [5, 0.75], [4, 1], [2, 1]];
        for (const [n, factor] of expected) {
            expect(endgameFactor(n, 8, 4), `${n} pieces`).to.equal(factor);
        }
        // The defaults are unchanged
        expect(endgameFactor(8)).to.equal(0.5);
    });

    it('presets should blend with their own thresholds', () => {
        const preset = createPreset('Late', 2, Fortress.weights, '', { endgameWeights, endgameStart: 8, endgameFull: 4 });
        expect(preset.endgameStart).to.equal(8);
        expect(preset.endgameFull).to.equal(4);
        const base = evaluatorFromWeights(Fortress.weights);
        const endgame = evaluatorFromWeights(endgameWeights);
        for (const [n, factor] of [[9, 0], [8, 0], [7, 0.25], [6, 0.5], [4, 1]] as [number, number][]) {
            const board = boardWithPieces(n);
            expect(preset.evaluator(board, PieceType.WHITE), `${n} pieces`)
                .to.equal(base(board, PieceType.WHITE) + factor * endgame(board, PieceType.WHITE));
        }
    });

    it('searchDepthFor should switch to endgameDepth at the preset\'s own start threshold', () => {
        const preset = createPreset('Late', 2, Fortress.weights, '', { endgameWeights, endgameDepth: 6, endgameStart: 8, endgameFull: 4 });
        expect(searchDepthFor(preset, boardWithPieces(10))).to.equal(2);
        expect(searchDepthFor(preset, boardWithPieces(9))).to.equal(2);
        expect(searchDepthFor(preset, boardWithPieces(8))).to.equal(6);
        const early = createPreset('Early', 2, Fortress.weights, '', { endgameDepth: 6, endgameStart: 12 });
        expect(searchDepthFor(early, boardWithPieces(12))).to.equal(6);
        expect(searchDepthFor(early, boardWithPieces(13))).to.equal(2);
    });

    it('presets without thresholds should not get the fields', () => {
        expect(DeepFortressEndgame.endgameStart).to.equal(undefined);
        expect(DeepFortressEndgame.endgameFull).to.equal(undefined);
    });

    it('should reject thresholds where full is not below start', () => {
        expect(() => createPreset('Bad', 2, Fortress.weights, '', { endgameWeights, endgameStart: 6, endgameFull: 6 })).to.throw('endgameFull');
        expect(() => createPreset('Bad', 2, Fortress.weights, '', { endgameWeights, endgameStart: 5 })).to.throw('endgameFull');
    });

    it('should round trip the thresholds through BotSpec', () => {
        const spec: BotSpec = {
            kind: 'search', name: 'Test', depth: 4, weights: { material: 100 },
            endgameWeights: { centrality: 7 }, endgameDepth: 6, endgameStart: 8, endgameFull: 4,
        };
        const preset = presetFromSpec(spec);
        expect(preset.endgameStart).to.equal(8);
        expect(preset.endgameFull).to.equal(4);
        expect(specFromPreset(preset)).to.deep.equal(spec);
    });

    it('tuning configs should pass thresholds from the base and variants to the bots', () => {
        const variants = buildVariants({
            base: { depth: 4, weights: { material: 100 }, endgameWeights: { edgeExposure: 40 }, endgameDepth: 6, endgameStart: 10, endgameFull: 6 },
            variants: [{ name: 'Late', endgameStart: 8, endgameFull: 4 }],
        });
        expect(variants[0]).to.deep.include({ endgameStart: 10, endgameFull: 6 });
        expect(variants[1]).to.deep.equal({
            kind: 'search', name: 'Late', depth: 4, weights: { material: 100 },
            endgameWeights: { edgeExposure: 40 }, endgameDepth: 6, endgameStart: 8, endgameFull: 4,
        });
    });
});
