// Prints the best weight settings across all runs so far (only counting games against the gauntlet opponents).
//   node summarize.mjs [--top N] [--from substring] [--opponents A,B] [--min-games N]
import { GAUNTLET, loadResults, aggregate } from './common.mjs';

const args = process.argv.slice(2);
const option = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i === -1 ? fallback : args[i + 1];
};
const top = Number(option('--top', 15));
const from = option('--from', '');
const minGames = Number(option('--min-games', 0));
const opponents = option('--opponents', GAUNTLET.join(',')).split(',');

const entries = aggregate(loadResults(), opponents, file => file.includes(from)).filter(e => e.games >= minGames);
const pct = x => `${(x * 100).toFixed(1)}%`;
const rows = [['Weights', 'Score', '±', 'W-D-L', 'Draw', ...opponents.map(o => `vs ${o}`), 'Games', 'Runs']];
for (const e of entries.slice(0, top)) {
    rows.push([
        e.key, pct(e.score), pct(e.margin), `${e.wins}-${e.draws}-${e.losses}`, pct(e.drawRate),
        ...opponents.map(o => {
            const v = e.vs[o];
            if (!v) return '-';
            const n = v.wins + v.draws + v.losses;
            return pct((v.wins + v.draws / 2) / n);
        }),
        String(e.games), [...e.files].join(','),
    ]);
}
const widths = rows[0].map((_, c) => Math.max(...rows.map(r => r[c].length)));
for (const r of rows) console.log(r.map((cell, c) => cell.padEnd(widths[c] + 2)).join('').trimEnd());
console.log(`\n${entries.length} weight settings in total (v = vulnerability, m = mobility, s = strongPoints, l = lineExposure; material is always 100)`);
