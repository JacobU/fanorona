import Board from '../../Board.js';
import { PieceType } from '../../types.js';
import { EVALUATORS, EVALUATOR_NAMES, Weights } from '../presets.js';
import { seededRng } from '../random.js';

/*
 * Texel tuning: instead of playing tournaments between candidate weights, record lots of positions from real games,
 * label each with how the game ended, and find the weights whose evaluation best predicts those results.
 *
 * The model is P(side to move wins) = sigmoid(intercept + sum of weight * feature), fitted by logistic regression
 * with draws counted as half a win. That problem is convex, so the fit finds the single best set of weights
 * (for predicting results, which is closely related to, but not the same as, playing strength).
 */

export interface RecordedPosition {
    // Each evaluator's value from the side to move's point of view, in EVALUATOR_NAMES order
    features: number[],
    side: 'WHITE' | 'BLACK',
    // The side to move has no capture available, so the static evaluation isn't about to be upset by a forced capture
    quiet: boolean,
}

export interface Sample {
    features: number[],
    // 1 if the side to move went on to win, 0.5 for a draw, 0 for a loss
    result: number,
    quiet: boolean,
    game: number,
}

export function recordPosition(board: Board, sideToMove: PieceType): RecordedPosition {
    return {
        features: EVALUATOR_NAMES.map(name => EVALUATORS[name](board, sideToMove)),
        side: sideToMove === PieceType.WHITE ? 'WHITE' : 'BLACK',
        quiet: board.getCapturablePieces(sideToMove).size === 0,
    };
}

export function labelPositions(positions: RecordedPosition[], result: 'WHITE' | 'BLACK' | 'DRAW', game: number): Sample[] {
    return positions.map(p => ({
        features: p.features,
        result: result === 'DRAW' ? 0.5 : result === p.side ? 1 : 0,
        quiet: p.quiet,
        game,
    }));
}

export interface TexelFit {
    // Fitted coefficients, one per feature in EVALUATOR_NAMES order (before scaling)
    coefficients: number[],
    intercept: number,
    // Average log-loss (cross-entropy) on the samples; lower is better
    logLoss: number,
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/**
 * Logistic regression with soft labels, solved with Newton's method.
 * @param featureMask which features to use (others are fixed at 0), e.g. to fit material only as a baseline.
 * @param l2 a small ridge penalty so the fit is always well defined.
 */
export function fitLogistic(samples: Sample[], featureMask: boolean[] = EVALUATOR_NAMES.map(() => true), l2: number = 1e-4): TexelFit {
    const used = featureMask.map((on, i) => on ? i : -1).filter(i => i >= 0);
    const n = used.length + 1; // plus the intercept
    let beta = new Array(n).fill(0);
    // Missing features count as 0 (e.g. data recorded before an evaluator was added)
    const row = (s: Sample) => [...used.map(i => s.features[i] ?? 0), 1];

    for (let iteration = 0; iteration < 50; iteration++) {
        const gradient = new Array(n).fill(0);
        const hessian = Array.from({ length: n }, () => new Array(n).fill(0));
        for (const s of samples) {
            const x = row(s);
            const p = sigmoid(x.reduce((total, xi, i) => total + xi * beta[i], 0));
            const w = p * (1 - p);
            for (let i = 0; i < n; i++) {
                gradient[i] += (p - s.result) * x[i];
                for (let j = 0; j < n; j++) hessian[i][j] += w * x[i] * x[j];
            }
        }
        for (let i = 0; i < n - 1; i++) {
            gradient[i] += l2 * samples.length * beta[i];
            hessian[i][i] += l2 * samples.length;
        }
        const step = solve(hessian, gradient);
        beta = beta.map((b, i) => b - step[i]);
        if (Math.max(...step.map(Math.abs)) < 1e-9) break;
    }

    const coefficients = EVALUATOR_NAMES.map(() => 0);
    used.forEach((featureIndex, i) => coefficients[featureIndex] = beta[i]);
    return { coefficients, intercept: beta[n - 1], logLoss: logLoss(samples, coefficients, beta[n - 1]) };
}

export function logLoss(samples: Sample[], coefficients: number[], intercept: number): number {
    let total = 0;
    for (const s of samples) {
        const p = Math.min(1 - 1e-12, Math.max(1e-12, sigmoid(intercept + coefficients.reduce((t, c, i) => t + c * (s.features[i] ?? 0), 0))));
        total -= s.result * Math.log(p) + (1 - s.result) * Math.log(1 - p);
    }
    return total / samples.length;
}

/**
 * Turns fitted coefficients into bot weights, scaled so material is 100 (only the ratios matter for choosing moves).
 */
export function toWeights(coefficients: number[]): Weights {
    const materialIndex = EVALUATOR_NAMES.indexOf('material');
    const scale = 100 / coefficients[materialIndex];
    const weights: Weights = {};
    EVALUATOR_NAMES.forEach((name, i) => weights[name] = Math.round(coefficients[i] * scale * 10) / 10);
    return weights;
}

/**
 * Refits on resampled games (positions from the same game are related, so whole games are resampled) to see how
 * much each scaled weight could change just because of which games happened to be played.
 * @returns for each feature, the 2.5% and 97.5% points of its scaled weight.
 */
export function bootstrapWeights(samples: Sample[], resamples: number = 100, seed: number = 1): { low: number, high: number }[] {
    const rng = seededRng(seed);
    const byGame = new Map<number, Sample[]>();
    for (const s of samples) {
        if (!byGame.has(s.game)) byGame.set(s.game, []);
        byGame.get(s.game)!.push(s);
    }
    const games = [...byGame.values()];
    const draws: number[][] = EVALUATOR_NAMES.map(() => []);
    for (let r = 0; r < resamples; r++) {
        const resampled: Sample[] = [];
        for (let g = 0; g < games.length; g++) resampled.push(...games[Math.floor(rng() * games.length)]);
        const weights = toWeights(fitLogistic(resampled).coefficients);
        EVALUATOR_NAMES.forEach((name, i) => draws[i].push(weights[name]!));
    }
    return draws.map(values => {
        values.sort((a, b) => a - b);
        return { low: values[Math.floor(0.025 * values.length)], high: values[Math.min(values.length - 1, Math.floor(0.975 * values.length))] };
    });
}

// Solves a small linear system with Gaussian elimination (with partial pivoting).
function solve(matrix: number[][], vector: number[]): number[] {
    const n = vector.length;
    const a = matrix.map((r, i) => [...r, vector[i]]);
    for (let col = 0; col < n; col++) {
        let pivot = col;
        for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
        [a[col], a[pivot]] = [a[pivot], a[col]];
        if (Math.abs(a[col][col]) < 1e-12) continue;
        for (let r = 0; r < n; r++) {
            if (r === col) continue;
            const factor = a[r][col] / a[col][col];
            for (let c = col; c <= n; c++) a[r][c] -= factor * a[col][c];
        }
    }
    return a.map((r, i) => Math.abs(r[i]) < 1e-12 ? 0 : r[n] / r[i]);
}
