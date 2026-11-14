import { Rng } from '../Search.js';

/*
 * A small CMA-ES (covariance matrix adaptation evolution strategy), following Hansen's standard (μ/μ_w, λ) version.
 * Each generation samples λ points from a multivariate normal distribution, ranks them by fitness, and moves the
 * mean towards the best μ. It also learns the shape of the distribution (the covariance), so it can follow
 * diagonal ridges where two weights need to change together, and it adapts the step size σ. It only uses the
 * ranking of the points, which makes it fairly robust to noisy fitness measurements like game results.
 */

export interface CmaesState {
    dimension: number,
    lambda: number,
    mean: number[],
    sigma: number,
    covariance: number[][],
    pathSigma: number[],
    pathCovariance: number[],
    generation: number,
}

export function createCmaes(mean: number[], sigma: number, lambda?: number): CmaesState {
    const n = mean.length;
    return {
        dimension: n,
        lambda: lambda ?? 4 + Math.floor(3 * Math.log(n)),
        mean: [...mean],
        sigma,
        covariance: identity(n),
        pathSigma: new Array(n).fill(0),
        pathCovariance: new Array(n).fill(0),
        generation: 0,
    };
}

/**
 * Samples a new population of λ points.
 */
export function samplePopulation(state: CmaesState, rng: Rng): number[][] {
    const { eigenvectors, eigenvalues } = jacobiEigen(state.covariance);
    const sqrtValues = eigenvalues.map(v => Math.sqrt(Math.max(v, 1e-20)));
    return Array.from({ length: state.lambda }, () => {
        const z = Array.from({ length: state.dimension }, () => gaussian(rng));
        // y = B * D * z, x = mean + sigma * y
        const y = matVec(eigenvectors, z.map((zi, i) => zi * sqrtValues[i]));
        return state.mean.map((m, i) => m + state.sigma * y[i]);
    });
}

/**
 * Updates the distribution from a population and its fitness values (higher is better).
 */
export function updateCmaes(state: CmaesState, population: number[][], fitness: number[]): CmaesState {
    const n = state.dimension;
    const lambda = population.length;
    const mu = Math.floor(lambda / 2);
    const rawWeights = Array.from({ length: mu }, (_, i) => Math.log(mu + 0.5) - Math.log(i + 1));
    const weightSum = rawWeights.reduce((a, b) => a + b, 0);
    const weights = rawWeights.map(w => w / weightSum);
    const muEff = 1 / weights.reduce((total, w) => total + w * w, 0);

    const cc = (4 + muEff / n) / (n + 4 + 2 * muEff / n);
    const cs = (muEff + 2) / (n + muEff + 5);
    const c1 = 2 / ((n + 1.3) ** 2 + muEff);
    const cmu = Math.min(1 - c1, 2 * (muEff - 2 + 1 / muEff) / ((n + 2) ** 2 + muEff));
    const damps = 1 + 2 * Math.max(0, Math.sqrt((muEff - 1) / (n + 1)) - 1) + cs;
    const chiN = Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n));

    const order = fitness.map((f, i) => ({ f, i })).sort((a, b) => b.f - a.f).map(x => x.i);
    const best = order.slice(0, mu).map(i => population[i]);
    const oldMean = state.mean;
    const mean = oldMean.map((_, j) => best.reduce((total, x, k) => total + weights[k] * x[j], 0));
    const step = mean.map((m, j) => (m - oldMean[j]) / state.sigma);

    // C^(-1/2) * step, using the eigen decomposition of C
    const { eigenvectors, eigenvalues } = jacobiEigen(state.covariance);
    const bt = transpose(eigenvectors);
    const invSqrtStep = matVec(eigenvectors, matVec(bt, step).map((v, i) => v / Math.sqrt(Math.max(eigenvalues[i], 1e-20))));

    const pathSigma = state.pathSigma.map((p, i) => (1 - cs) * p + Math.sqrt(cs * (2 - cs) * muEff) * invSqrtStep[i]);
    const pathSigmaNorm = Math.sqrt(pathSigma.reduce((t, v) => t + v * v, 0));
    const generation = state.generation + 1;
    const hsig = pathSigmaNorm / Math.sqrt(1 - (1 - cs) ** (2 * generation)) / chiN < 1.4 + 2 / (n + 1) ? 1 : 0;
    const pathCovariance = state.pathCovariance.map((p, i) => (1 - cc) * p + hsig * Math.sqrt(cc * (2 - cc) * muEff) * step[i]);

    const covariance = state.covariance.map((row, i) => row.map((value, j) => {
        let rankMu = 0;
        best.forEach((x, k) => {
            rankMu += weights[k] * ((x[i] - oldMean[i]) / state.sigma) * ((x[j] - oldMean[j]) / state.sigma);
        });
        return (1 - c1 - cmu) * value
            + c1 * (pathCovariance[i] * pathCovariance[j] + (1 - hsig) * cc * (2 - cc) * value)
            + cmu * rankMu;
    }));
    const sigma = state.sigma * Math.exp((cs / damps) * (pathSigmaNorm / chiN - 1));

    return { ...state, mean, sigma, covariance, pathSigma, pathCovariance, generation };
}

function gaussian(rng: Rng): number {
    return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}

function identity(n: number): number[][] {
    return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
}

function transpose(m: number[][]): number[][] {
    return m[0].map((_, j) => m.map(row => row[j]));
}

function matVec(m: number[][], v: number[]): number[] {
    return m.map(row => row.reduce((total, value, j) => total + value * v[j], 0));
}

/**
 * Eigen decomposition of a small symmetric matrix with the Jacobi rotation method.
 * @returns eigenvectors as the columns of a matrix, and the matching eigenvalues.
 */
export function jacobiEigen(matrix: number[][]): { eigenvectors: number[][], eigenvalues: number[] } {
    const n = matrix.length;
    const a = matrix.map(row => [...row]);
    const v = identity(n);
    for (let sweep = 0; sweep < 100; sweep++) {
        let off = 0;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] ** 2;
        if (off < 1e-20) break;
        for (let p = 0; p < n; p++) {
            for (let q = p + 1; q < n; q++) {
                if (Math.abs(a[p][q]) < 1e-30) continue;
                const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
                const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
                const c = 1 / Math.sqrt(t * t + 1);
                const s = t * c;
                for (let k = 0; k < n; k++) {
                    const akp = a[k][p], akq = a[k][q];
                    a[k][p] = c * akp - s * akq;
                    a[k][q] = s * akp + c * akq;
                }
                for (let k = 0; k < n; k++) {
                    const apk = a[p][k], aqk = a[q][k];
                    a[p][k] = c * apk - s * aqk;
                    a[q][k] = s * apk + c * aqk;
                }
                for (let k = 0; k < n; k++) {
                    const vkp = v[k][p], vkq = v[k][q];
                    v[k][p] = c * vkp - s * vkq;
                    v[k][q] = s * vkp + c * vkq;
                }
            }
        }
    }
    return { eigenvectors: v, eigenvalues: a.map((row, i) => row[i]) };
}
