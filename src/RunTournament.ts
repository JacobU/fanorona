import { availableParallelism } from 'os';
import { ALL_PRESETS } from './ai/presets.js';
import { DEFAULT_MAX_TURNS } from './ai/Tournament.js';
import { RANDOM_SPEC, findBuiltInSpec, specFromPreset } from './ai/tuning/BotSpec.js';
import { runRoundRobin } from './ai/tuning/Tuner.js';

// Usage: npm run tournament -- [gamesPerPair] [botNames...] [--workers N]
// e.g.   npm run tournament -- 20 Greedy Lookahead Random
// With no names given, every preset plus Random plays. Games are spread over all CPU cores but one.

const args = process.argv.slice(2);
const workersIndex = args.indexOf('--workers');
const workers = workersIndex === -1 ? Math.max(1, availableParallelism() - 1) : parseInt(args[workersIndex + 1], 10);
if (workersIndex !== -1) args.splice(workersIndex, 2);
if (isNaN(workers)) throw new Error('--workers needs a number.');

const gamesArg = args.find(arg => /^\d+$/.test(arg));
const gamesPerPair = gamesArg ? parseInt(gamesArg, 10) : 10;
const requestedNames = args.filter(arg => arg !== gamesArg);

const bots = requestedNames.length === 0
    ? [RANDOM_SPEC, ...ALL_PRESETS.map(specFromPreset)]
    : requestedNames.map(findBuiltInSpec);

console.log(`Round robin: ${bots.map(b => b.name).join(', ')} (${gamesPerPair} games per pair, ${workers} worker${workers === 1 ? '' : 's'})`);

let lastPrinted = 0;
const result = await runRoundRobin(bots, gamesPerPair, DEFAULT_MAX_TURNS, workers, (completed, total) => {
    const now = Date.now();
    if (completed === total || now - lastPrinted > 1000) {
        process.stdout.write(`\r  ${completed}/${total} games played`);
        lastPrinted = now;
    }
});
console.log(` in ${(result.elapsedMs / 1000).toFixed(1)}s`);

// Show bots in the order they were asked for in the head to head table, and best first in the standings.
const names = bots.map(b => b.name);
const byName = new Map(result.participants.map(p => [p.spec.name, p]));
const width = Math.max(...names.map(n => n.length), 'Decisive'.length) + 2;
const pad = (text: string | number) => String(text).padEnd(width);
const percent = (count: number, games: number) => games > 0 ? `${Math.round(100 * count / games)}%` : '-';

console.log('\nHead to head (row\'s wins-draws-losses against column):');
console.log(pad('') + names.map(pad).join(''));
for (const row of names) {
    const cells = names.map(column => {
        const r = byName.get(row)?.vs[column];
        return pad(r ? `${r.wins}-${r.draws}-${r.losses}` : '-');
    });
    console.log(pad(row) + cells.join(''));
}

console.log('\nStandings (Points: win 1, draw ½. Decisive = share of the games with a winner that the bot won):');
console.log(pad('Bot') + pad('Points') + pad('W-D-L') + pad('Win') + pad('Draw') + pad('Loss') + pad('Decisive') + 'ms/turn');
for (const p of result.participants) {
    console.log(pad(p.spec.name) + pad(p.wins + p.draws / 2) + pad(`${p.wins}-${p.draws}-${p.losses}`)
        + pad(percent(p.wins, p.games)) + pad(percent(p.draws, p.games)) + pad(percent(p.losses, p.games))
        + pad(percent(p.wins, p.wins + p.losses)) + p.msPerTurn.toFixed(1));
}

const turnLimitDraws = result.participants.reduce((total, p) => total + p.turnLimitDraws, 0) / 2;
if (turnLimitDraws > 0) {
    console.log(`\nNote: ${turnLimitDraws} game(s) reached the ${DEFAULT_MAX_TURNS} turn safety limit and were counted as draws.`);
}
