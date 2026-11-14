import { Evaluator, WeightedTerm, weighted } from './Evaluator.js';
import { material, vulnerability, strongPoints, lineExposure, edgeExposure, centrality } from './evaluators.js';
import { ENDGAME_FULL_PIECES, ENDGAME_START_PIECES, blendEndgame } from './endgame.js';

/**
 * Every evaluator that can be weighted, by name. Add new evaluators here to make them available to presets
 * and to the tuning script.
 */
export const EVALUATORS = { material, vulnerability, strongPoints, lineExposure, edgeExposure, centrality };

export type EvaluatorName = keyof typeof EVALUATORS;
export const EVALUATOR_NAMES = Object.keys(EVALUATORS) as EvaluatorName[];

/**
 * How much each evaluator counts towards the score. Missing evaluators have a weight of 0 (not used).
 */
export type Weights = Partial<Record<EvaluatorName, number>>;

/**
 * A named bot configuration: how many turns ahead to search, and how to rate the positions it reaches.
 */
export interface BotPreset {
    name: string,
    description: string,
    depth: number,
    weights: Weights,
    // Extra weights that fade in as the board empties (see endgame.ts). Not set = no endgame blending.
    endgameWeights?: Weights,
    // Search depth to use once there are few pieces left (see searchDepthFor). Not set = always use depth.
    endgameDepth?: number,
    // The bot's own endgame thresholds (see endgame.ts). Not set = ENDGAME_START_PIECES / ENDGAME_FULL_PIECES.
    endgameStart?: number,
    endgameFull?: number,
    // Rates positions using weights, plus endgameWeights blended in during the endgame.
    evaluator: Evaluator,
}

export interface EndgameOptions {
    endgameWeights?: Weights,
    endgameDepth?: number,
    endgameStart?: number,
    endgameFull?: number,
}

export function evaluatorFromWeights(weights: Weights): Evaluator {
    const terms: WeightedTerm[] = EVALUATOR_NAMES
        .filter(name => (weights[name] ?? 0) !== 0)
        .map(name => ({ evaluator: EVALUATORS[name], weight: weights[name]! }));
    return weighted(terms);
}

export function createPreset(name: string, depth: number, weights: Weights, description: string = '', options: EndgameOptions = {}): BotPreset {
    const preset: BotPreset = { name, description, depth, weights, evaluator: evaluatorFromWeights(weights) };
    const start = options.endgameStart ?? ENDGAME_START_PIECES;
    const full = options.endgameFull ?? ENDGAME_FULL_PIECES;
    if (full >= start) {
        throw new Error(`${name}: endgameFull (${full}) must be below endgameStart (${start}).`);
    }
    // Only add the endgame fields when they're set, so presets without them look exactly as they did before.
    if (options.endgameWeights !== undefined) {
        preset.endgameWeights = options.endgameWeights;
        preset.evaluator = blendEndgame(preset.evaluator, evaluatorFromWeights(options.endgameWeights), start, full);
    }
    if (options.endgameDepth !== undefined) preset.endgameDepth = options.endgameDepth;
    if (options.endgameStart !== undefined) preset.endgameStart = options.endgameStart;
    if (options.endgameFull !== undefined) preset.endgameFull = options.endgameFull;
    return preset;
}

// Weights are integers (to avoid floating point ties being missed) and are just starting guesses to be tuned
// by running tournaments (see RunTuning.ts). Material is weighted heavily so the other metrics mostly act as tie-breakers.
const MATERIAL = 100;
const VULNERABILITY = 30;
const STRONG_POINTS = 5;
const LINE_EXPOSURE = 5;

export const Greedy = createPreset('Greedy', 1,
    { material: MATERIAL },
    'Most pieces relative to the opponent after our turn (the original simple bot).');

export const Lookahead = createPreset('Lookahead', 2,
    { material: MATERIAL },
    'Most pieces relative to the opponent after our turn and their best reply.');

export const Guardian = createPreset('Guardian', 1,
    { material: MATERIAL, vulnerability: VULNERABILITY },
    'Greedy, but also avoids leaving pieces open to attack after our turn (no lookahead).');

export const Sentinel = createPreset('Sentinel', 2,
    { material: MATERIAL, vulnerability: VULNERABILITY },
    'Lookahead, also counting pieces left open to attack after the opponent\'s reply.');

export const Positional = createPreset('Positional', 2,
    { material: MATERIAL, strongPoints: STRONG_POINTS, lineExposure: LINE_EXPOSURE },
    'Lookahead, also preferring strong intersections and avoiding pieces lined up together.');

export const Fortress = createPreset('Fortress', 2,
    { material: MATERIAL, vulnerability: VULNERABILITY, strongPoints: STRONG_POINTS, lineExposure: LINE_EXPOSURE },
    'Sentinel and Positional combined, which did best in tuning.');

// Searching 4 turns ahead: our turn, the opponent's reply, our next turn and their next reply.

export const DeepSentinel = createPreset('DeepSentinel', 4,
    Sentinel.weights,
    'Sentinel, searching 4 turns ahead.');

export const DeepPositional = createPreset('DeepPositional', 4,
    Positional.weights,
    'Positional, searching 4 turns ahead.');

export const DeepFortress = createPreset('DeepFortress', 4,
    Fortress.weights,
    'Fortress, searching 4 turns ahead.');

// Endgame variants: once only a few pieces are left, also push the opponent's pieces towards the edge (keeping
// ours in the middle) and search deeper. These weights are starting guesses (relative to material's 100).
const FORTRESS_ENDGAME: EndgameOptions = { endgameWeights: { edgeExposure: 40, centrality: 20 }, endgameDepth: 6 };

export const FortressEndgame = createPreset('FortressEndgame', 2,
    Fortress.weights,
    'Fortress, also pushing opponent pieces to the edge and searching 6 turns ahead once few pieces are left.',
    FORTRESS_ENDGAME);

export const DeepFortressEndgame = createPreset('DeepFortressEndgame', 4,
    Fortress.weights,
    'DeepFortress, also pushing opponent pieces to the edge and searching 6 turns ahead once few pieces are left.',
    FORTRESS_ENDGAME);

export const ALL_PRESETS: BotPreset[] = [
    Greedy, Lookahead, Guardian, Sentinel, Positional, Fortress,
    DeepSentinel, DeepPositional, DeepFortress, FortressEndgame, DeepFortressEndgame,
];
