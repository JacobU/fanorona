import { BotSpec, findBuiltInSpec } from './BotSpec.js';
import { GameJob, runGames } from './GamePool.js';
import { DEFAULT_GAMES_PER_PAIR, DEFAULT_MAX_TURNS, TuningConfig, buildVariants } from './TuningConfig.js';

export interface PairRecord {
    wins: number,
    draws: number,
    losses: number,
}

export interface ParticipantResult {
    spec: BotSpec,
    isVariant: boolean,
    wins: number,
    draws: number,
    losses: number,
    games: number,
    // How many of the draws came from the maxTurns safety limit rather than the no-capture rule
    turnLimitDraws: number,
    // Points per game, from 0 to 1 (a win is 1 point and a draw is half a point)
    score: number,
    // Fraction of games won, drawn and lost (these add up to 1)
    winRate: number,
    drawRate: number,
    lossRate: number,
    // Fraction of the games that had a winner which this bot won, or null if every game was drawn.
    // Unlike score this ignores draws, so it shows who comes out on top when games are decisive.
    decisiveWinRate: number | null,
    // Roughly how far score could be from the true value just by chance (95% confidence)
    margin: number,
    msPerTurn: number,
    // Results against each other participant, by name
    vs: Record<string, PairRecord>,
}

export interface TuningResult {
    participants: ParticipantResult[],
    totalGames: number,
    elapsedMs: number,
}

/**
 * Plays the games described by a tuning config and works out how well each bot did.
 * @returns the participants sorted best first (variants first, then opponents, in gauntlet mode).
 */
export async function runTuning(config: TuningConfig, numWorkers: number, onProgress?: (completed: number, total: number) => void): Promise<TuningResult> {
    const start = performance.now();
    const gamesPerPair = config.gamesPerPair ?? DEFAULT_GAMES_PER_PAIR;
    const maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS;
    const mode = config.mode ?? 'gauntlet';

    const variants = buildVariants(config);
    const opponents = (config.opponents ?? []).map(findBuiltInSpec);
    const everyone = [...variants, ...opponents];
    const names = new Set<string>();
    for (const spec of everyone) {
        if (names.has(spec.name)) throw new Error(`"${spec.name}" is used for more than one bot. Rename the variant.`);
        names.add(spec.name);
    }

    let pairs: [BotSpec, BotSpec][] = [];
    if (mode === 'gauntlet') {
        if (opponents.length === 0) throw new Error('Gauntlet mode needs at least one opponent.');
        for (const variant of variants) {
            for (const opponent of opponents) pairs.push([variant, opponent]);
        }
    } else {
        pairs = allPairs(everyone);
    }

    const { participants, totalGames } = await playPairings(everyone, pairs, gamesPerPair, maxTurns, numWorkers, onProgress);
    for (const participant of participants) participant.isVariant = variants.includes(participant.spec);

    participants.sort((x, y) => {
        if (mode === 'gauntlet' && x.isVariant !== y.isVariant) return x.isVariant ? -1 : 1;
        return y.score - x.score;
    });

    return { participants, totalGames, elapsedMs: performance.now() - start };
}

/**
 * Every bot plays every other bot gamesPerPair times.
 * @returns the participants sorted best first.
 */
export async function runRoundRobin(
    bots: BotSpec[],
    gamesPerPair: number,
    maxTurns: number,
    numWorkers: number,
    onProgress?: (completed: number, total: number) => void,
): Promise<TuningResult> {
    const start = performance.now();
    const { participants, totalGames } = await playPairings(bots, allPairs(bots), gamesPerPair, maxTurns, numWorkers, onProgress);
    participants.sort((x, y) => y.score - x.score);
    return { participants, totalGames, elapsedMs: performance.now() - start };
}

function allPairs(bots: BotSpec[]): [BotSpec, BotSpec][] {
    const pairs: [BotSpec, BotSpec][] = [];
    for (let i = 0; i < bots.length; i++) {
        for (let j = i + 1; j < bots.length; j++) pairs.push([bots[i], bots[j]]);
    }
    return pairs;
}

/**
 * Plays gamesPerPair games for each pair (spread over numWorkers threads) and adds up each bot's results.
 * Every participant is returned with isVariant set to false and in no particular order.
 */
async function playPairings(
    everyone: BotSpec[],
    pairs: [BotSpec, BotSpec][],
    gamesPerPair: number,
    maxTurns: number,
    numWorkers: number,
    onProgress?: (completed: number, total: number) => void,
): Promise<{ participants: ParticipantResult[], totalGames: number }> {
    // Colours alternate each game so neither bot gets the advantage of always moving first.
    const jobs: (GameJob & { a: BotSpec, b: BotSpec, aIsWhite: boolean })[] = [];
    for (const [a, b] of pairs) {
        for (let game = 0; game < gamesPerPair; game++) {
            const aIsWhite = game % 2 === 0;
            jobs.push({ white: aIsWhite ? a : b, black: aIsWhite ? b : a, maxTurns, a, b, aIsWhite });
        }
    }

    const stats = await runGames(jobs.map(({ white, black, maxTurns }) => ({ white, black, maxTurns })), numWorkers, onProgress);

    const totals = new Map<string, { record: PairRecord, turnLimitDraws: number, ms: number, turns: number, vs: Record<string, PairRecord> }>();
    for (const spec of everyone) totals.set(spec.name, { record: { wins: 0, draws: 0, losses: 0 }, turnLimitDraws: 0, ms: 0, turns: 0, vs: {} });

    const addResult = (name: string, opponentName: string, result: keyof PairRecord, isTurnLimitDraw: boolean, ms: number, turns: number) => {
        const t = totals.get(name)!;
        t.record[result]++;
        if (isTurnLimitDraw) t.turnLimitDraws++;
        t.vs[opponentName] ??= { wins: 0, draws: 0, losses: 0 };
        t.vs[opponentName][result]++;
        t.ms += ms;
        t.turns += turns;
    };

    jobs.forEach((job, i) => {
        const game = stats[i];
        const aWon = game.result !== 'DRAW' && (game.result === 'WHITE') === job.aIsWhite;
        const aResult: keyof PairRecord = game.result === 'DRAW' ? 'draws' : aWon ? 'wins' : 'losses';
        const bResult: keyof PairRecord = game.result === 'DRAW' ? 'draws' : aWon ? 'losses' : 'wins';
        const whiteTurns = Math.ceil(game.turns / 2);
        const blackTurns = Math.floor(game.turns / 2);
        const isTurnLimitDraw = game.drawReason === 'TURN_LIMIT';
        addResult(job.a.name, job.b.name, aResult, isTurnLimitDraw, job.aIsWhite ? game.whiteMs : game.blackMs, job.aIsWhite ? whiteTurns : blackTurns);
        addResult(job.b.name, job.a.name, bResult, isTurnLimitDraw, job.aIsWhite ? game.blackMs : game.whiteMs, job.aIsWhite ? blackTurns : whiteTurns);
    });

    const participants: ParticipantResult[] = everyone
        .map(spec => {
            const t = totals.get(spec.name)!;
            const games = t.record.wins + t.record.draws + t.record.losses;
            const score = games > 0 ? (t.record.wins + t.record.draws / 2) / games : 0;
            const decisiveGames = t.record.wins + t.record.losses;
            return {
                spec,
                isVariant: false,
                ...t.record,
                games,
                turnLimitDraws: t.turnLimitDraws,
                score,
                winRate: games > 0 ? t.record.wins / games : 0,
                drawRate: games > 0 ? t.record.draws / games : 0,
                lossRate: games > 0 ? t.record.losses / games : 0,
                decisiveWinRate: decisiveGames > 0 ? t.record.wins / decisiveGames : null,
                margin: games > 0 ? 1.96 * Math.sqrt(score * (1 - score) / games) : 0,
                msPerTurn: t.turns > 0 ? t.ms / t.turns : 0,
                vs: t.vs,
            };
        })
        .filter(p => p.games > 0);

    return { participants, totalGames: jobs.length };
}
