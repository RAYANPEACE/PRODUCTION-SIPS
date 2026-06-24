/* ====== tests/stock-fifo.test.js ======
   Tests purs (sans navigateur, sans serveur) des fonctions FIFO/lots de
   js/features/stock-sheet.js (Spec D). On charge le fichier dans un contexte VM
   avec des stubs minimaux (round2, num) ; les fonctions sont des declarations
   globales -> elles deviennent accessibles sur le contexte.

   Lancer : node tests/stock-fifo.test.js
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(resolve(__dirname, '..', 'js', 'features', 'stock-sheet.js'), 'utf8');

const ctx = {
  round2: n => Math.round((n + Number.EPSILON) * 100) / 100,
  num: v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; },
  REFS: [], RECF: {}, ETAT: {}, ETAT_DATE: '', console
};
vm.createContext(ctx);
vm.runInContext(code, ctx);

let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log('  ✓ ' + label); }
  else { failed++; console.error('  ✗ ' + label); }
}
const close = (a, b) => Math.abs(a - b) < 1e-6;
const sum = arr => arr.reduce((s, l) => s + l.rest, 0);

// desToCode mappe la designation 'P' -> code 'F1'
const desToCode = { 'P': 'F1' };
const today = '2026-06-30';

// ---- buildFinishedLots : base inventaire (plus ancien) + 2 productions datees ----
const prod = [
  { date: '2026-06-10', blocks: [{ p: 'P', n: 30 }] },
  { date: '2026-06-20', blocks: [{ p: 'P', n: 50 }] },
  { date: '2026-06-05', blocks: [{ p: 'AUTRE', n: 99 }] } // autre produit -> ignore
];
const lots = ctx.buildFinishedLots('F1', 100, '2026-06-01', prod, [], desToCode, today);
check('[FIFO] 3 lots (base + 2 productions du produit)', lots.length === 3);
check('[FIFO] lot le plus ancien = base inventaire', lots[0].source === 'inventaire' && lots[0].date === '2026-06-01');
check('[FIFO] lots tries par date croissante', lots[0].date <= lots[1].date && lots[1].date <= lots[2].date);
check('[FIFO] production hors fenetre/produit ignoree', !lots.some(l => l.qty === 99));

// ---- applyFifo : consomme le plus ancien d'abord ----
const l2 = ctx.buildFinishedLots('F1', 100, '2026-06-01', prod, [], desToCode, today); // base100, +30(10), +50(20) = 180
ctx.applyFifo(l2, 120); // consomme 120 : 100 (base) puis 20 sur le lot du 10
check('[FIFO] base inventaire consommee en premier (reste 0)', close(l2[0].rest, 0));
check('[FIFO] 2e lot (10 juin) partiellement consomme : 30-20=10', close(l2[1].rest, 10));
check('[FIFO] 3e lot (20 juin) intact : 50', close(l2[2].rest, 50));
check('[FIFO] somme des restants = stock agrege (180-120=60)', close(sum(l2), 60));

// ---- sorties > stock : dernier lot negatif (incoherence signalee) ----
const l3 = ctx.buildFinishedLots('F1', 10, '2026-06-01', [{ date: '2026-06-10', blocks: [{ p: 'P', n: 5 }] }], [], desToCode, today); // total 15
ctx.applyFifo(l3, 20); // 20 > 15
check('[FIFO] sortie > stock : somme des restants = negatif (15-20=-5)', close(sum(l3), -5));
check('[FIFO] le dernier lot porte le negatif', l3[l3.length - 1].rest < 0);

// ---- entrees de produit fini ajoutent un lot date ----
const l4 = ctx.buildFinishedLots('F1', 0, '2026-06-01', [], [{ date: '2026-06-15', finis: [{ a: 'P', q: 7 }] }], desToCode, today);
check('[FIFO] une entree de produit fini cree un lot', l4.length === 1 && l4[0].source === 'entree' && close(l4[0].qty, 7));

console.log('\n' + passed + ' reussi(s), ' + failed + ' echec(s).');
process.exit(failed ? 1 : 0);
