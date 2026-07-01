/* ====== tests/stock-fifo.test.js ======
   Tests purs (sans navigateur, sans serveur) des fonctions FIFO/lots de
   domain/stock.js. On charge aussi stock-sheet.js pour verifier la compatibilite
   des scripts classiques.

   Lancer : node tests/stock-fifo.test.js
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stockDomainCode = readFileSync(resolve(__dirname, '..', 'domain', 'stock.js'), 'utf8');
const stockSheetCode = readFileSync(resolve(__dirname, '..', 'js', 'features', 'stock-sheet.js'), 'utf8');

const ctx = {
  round2: n => Math.round((n + Number.EPSILON) * 100) / 100,
  num: v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; },
  REFS: [], RECF: {}, ETAT: {}, ETAT_DATE: '', console
};
vm.createContext(ctx);
vm.runInContext(stockDomainCode, ctx);
vm.runInContext(stockSheetCode, ctx);

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
check('[FIFO] lot le plus ancien = base inventaire', lots[0].date === '2026-06-01' && close(lots[0].qty, 100));
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
check('[FIFO] une entree de produit fini cree un lot', l4.length === 1 && l4[0].date === '2026-06-15' && close(l4[0].qty, 7));
const l4Code = ctx.buildFinishedLots('F1', 0, '2026-06-01', [{ date: '2026-06-15', blocks: [{ p: 'F1', n: 9 }] }], [], desToCode, today);
check('[FIFO] une production avec code produit cree un lot', l4Code.length === 1 && l4Code[0].date === '2026-06-15' && close(l4Code[0].qty, 9));

const sameDayFluxOff = ctx.stockApplyMovements('2026-06-10', [{ date: '2026-06-10', blocks: [{ p: 'P', n: 12 }] }], [], [], {
  refs: [{ code: 'F1', des: 'P' }], recipes: {}, today
});
const sameDayFluxOn = ctx.stockApplyMovements('2026-06-10', [{ date: '2026-06-10', blocks: [{ p: 'P', n: 12 }] }], [], [], {
  refs: [{ code: 'F1', des: 'P' }], recipes: {}, today, includeStartDate: true
});
const sameDayLots = ctx.buildFinishedLots('F1', 0, '2026-06-10', [{ date: '2026-06-10', blocks: [{ p: 'P', n: 12 }] }], [], desToCode, today, { includeStartDate: true });
check('[STOCK] par defaut un mouvement le jour de base reste exclu', !sameDayFluxOff.add.F1);
check('[STOCK] option includeStartDate inclut la production du jour de base', close(sameDayFluxOn.add.F1, 12));
check('[STOCK] lots incluent aussi la production du jour de base avec includeStartDate', sameDayLots.length === 1 && close(sameDayLots[0].qty, 12));

const laityRefs = [
  { code: '390007', des: 'LAIT EN POUDRE LAITY 20G X 100', cat: 'fini' },
  { code: '190021', des: 'CARTON LAITY 20G', cat: 'carton' }
];
const laityRecipes = { 'CARTON LAITY 20G': [{ code: '190021', des: 'CARTON LAITY 20G', qte: 1 }] };
const laityFlux = ctx.stockApplyMovements('2026-06-29', [{ date: '2026-06-30', blocks: [{ p: 'CARTON LAITY 20G', n: 512 }] }], [], [], {
  refs: laityRefs, recipes: laityRecipes, today
});
check('[STOCK] recette Laity rattachee au produit fini 390007', close(laityFlux.add['390007'], 512));
check('[STOCK] recette Laity ne credite pas le carton 190021 comme produit fini', !laityFlux.add['190021']);
check('[STOCK] recette Laity deduit le carton 190021 en consommation', close(laityFlux.conso['190021'], 512));
const laityFluxCurrentName = ctx.stockApplyMovements('2026-06-29', [{ date: '2026-06-30', blocks: [{ p: 'LAIT EN POUDRE LAITY 20G X 100', n: 512 }] }], [], [], {
  refs: laityRefs, recipes: laityRecipes, today
});
check('[STOCK] recette Laity trouvee meme si la production utilise le nouveau nom PF', close(laityFluxCurrentName.conso['190021'], 512));

const codeRefs = [
  { code: 'F9', des: 'PRODUIT TEST', cat: 'fini' },
  { code: 'M9', des: 'MP TEST', cat: 'mp' }
];
const codeFlux = ctx.stockApplyMovements('2026-06-29', [{ date: '2026-06-30', blocks: [{ p: 'F9', n: 8 }] }], [], [], {
  refs: codeRefs, recipes: { F9: [{ code: 'M9', des: 'MP TEST', qte: 2 }] }, today
});
check('[STOCK] production code produit credite le PF', close(codeFlux.add.F9, 8));
check('[STOCK] recette par code produit deduit les MP', close(codeFlux.conso.M9, 16));

const wasteRefs = [
  { code: 'F1', des: 'P', cat: 'fini' },
  { code: 'C1', des: 'CARTON P', cat: 'carton' },
  { code: 'L1', des: 'FILM P', cat: 'film' },
  { code: 'M1', des: 'MP 1', cat: 'mp' },
  { code: 'M2', des: 'MP 2', cat: 'mp' }
];
const wasteRecipes = { P: [
  { code: 'C1', des: 'CARTON P', qte: 1 },
  { code: 'L1', des: 'FILM P', qte: 0.2 },
  { code: 'M1', des: 'MP 1', qte: 0.5 },
  { code: 'M2', des: 'MP 2', qte: 1.5 }
] };
const wasteFlux = ctx.stockApplyMovements('2026-06-29', [{ date: '2026-06-30', blocks: [{ p: 'P', n: 10, w_emb: 2, w_film: 3, w_mel: 4 }] }], [], [], {
  refs: wasteRefs, recipes: wasteRecipes, today
});
check('[STOCK] dechet carton/sac deduit en plus de la recette', close(wasteFlux.conso.C1, 12));
check('[STOCK] dechet film deduit en plus de la recette', close(wasteFlux.conso.L1, 5));
check('[STOCK] dechet melange deduit proportionnellement MP1', close(wasteFlux.conso.M1, 6));
check('[STOCK] dechet melange deduit proportionnellement MP2', close(wasteFlux.conso.M2, 18));

const packRefs = [
  { code: 'F2', des: 'SAC P', cat: 'fini' },
  { code: 'E1', des: 'SAC KRAFT', cat: 'emballage' },
  { code: 'E2', des: 'SAC PLASTIQUE', cat: 'emballage' },
  { code: 'M1', des: 'MP 1', cat: 'mp' }
];
const packRecipes = { 'SAC P': [
  { code: 'E1', des: 'SAC KRAFT', qte: 1 },
  { code: 'E2', des: 'SAC PLASTIQUE', qte: 1 },
  { code: 'M1', des: 'MP 1', qte: 5 }
] };
const packFlux = ctx.stockApplyMovements('2026-06-29', [{ date: '2026-06-30', blocks: [{ p: 'SAC P', n: 0, w_emb: 2 }] }], [], [], {
  refs: packRefs, recipes: packRecipes, today
});
check('[STOCK] dechet emballage seul sans quantite produite ignore la ligne incomplete', !packFlux.conso.E1 && !packFlux.conso.E2);
const packFluxWithProd = ctx.stockApplyMovements('2026-06-29', [{ date: '2026-06-30', blocks: [{ p: 'SAC P', n: 3, w_emb: 2 }] }], [], [], {
  refs: packRefs, recipes: packRecipes, today
});
// Kraft (E1) : recette 3*1 + dechet 2*1 = 5. Plastique (E2) : recette 3*1 seule, AUCUN dechet applique.
check('[STOCK] dechet sac applique sur le kraft (recette 3 + dechet 2 = 5)', close(packFluxWithProd.conso.E1, 5));
check('[STOCK] dechet sac PAS applique sur le sachet plastique (recette seule = 3)', close(packFluxWithProd.conso.E2, 3));

// ====== E2 : lots de base REELS par bloc (tableau) ======
// Deux lots de base dates distincts (issus de 2 blocs de l'inventaire) -> dates preservees.
const e1 = ctx.buildFinishedLots('F1', [{ date: '2026-06-02', qty: 40 }, { date: '2026-06-03', qty: 60 }], '2026-06-01', [], [], desToCode, today);
check('[E2] lots de base par bloc : 2 lots dates', e1.length === 2 && e1[0].date === '2026-06-02' && e1[1].date === '2026-06-03');
check('[E2] somme des lots de base = base agregee (40+60=100)', close(e1[0].qty + e1[1].qty, 100));

// Fusion par date : un lot de base et une production le MEME jour fusionnent (cle = date).
const e2 = ctx.buildFinishedLots('F1', [{ date: '2026-06-10', qty: 20 }], '2026-06-01', [{ date: '2026-06-10', blocks: [{ p: 'P', n: 30 }] }], [], desToCode, today);
check('[E2] base + production meme date fusionnees en un lot', e2.length === 1 && e2[0].date === '2026-06-10' && close(e2[0].qty, 50));

// Lot a date vide -> imprecise et trie en premier (FIFO le consomme d'abord).
const e3 = ctx.buildFinishedLots('F1', [{ date: '', qty: 10 }, { date: '2026-06-05', qty: 5 }], '2026-06-01', [], [], desToCode, today);
check('[E2] lot sans date marque imprecise et place en premier', e3[0].imprecise === true && e3[0].date === '' && e3[1].date === '2026-06-05');

// Invariant apres FIFO sur lots de base reels : somme des restants = base - sorties.
const e4 = ctx.buildFinishedLots('F1', [{ date: '2026-06-02', qty: 40 }, { date: '2026-06-08', qty: 60 }], '2026-06-01', [], [], desToCode, today);
ctx.applyFifo(e4, 50); // consomme 40 (02) puis 10 (08)
check('[E2] FIFO sur base reelle : plus ancien epuise (40->0)', close(e4[0].rest, 0));
check('[E2] FIFO sur base reelle : 2e lot 60-10=50', close(e4[1].rest, 50));
check('[E2] invariant somme restants = base-sorties (100-50=50)', close(sum(e4), 50));

// ====== E3 : MATIERES PREMIERES par lot + FEFO (peremption) ======
const dM = { 'LAIT': 'M1' };
// base = 2 blocs avec peremptions ; entree datee par sa peremption (exp) -> tri PEREMPTION croissante (FEFO).
const m1 = ctx.buildMpLots('M1', [{ date: '2026-08-01', qty: 50 }, { date: '2026-07-15', qty: 30 }], '2026-06-01',
  [{ date: '2026-06-10', mp: [{ a: 'LAIT', q: 20, exp: '2026-07-01' }] }], dM, '2026-06-30');
check('[FEFO] tri par peremption croissante', m1[0].date === '2026-07-01' && m1[1].date === '2026-07-15' && m1[2].date === '2026-08-01');
check('[FEFO] lot d entree date par sa peremption (exp)', close(m1[0].qty, 20));
ctx.applyFifo(m1, 35); // FEFO : 20 (01/07) puis 15 (15/07)
check('[FEFO] lot perimant le plus tot epuise en premier', close(m1[0].rest, 0));
check('[FEFO] 2e lot 30-15=15', close(m1[1].rest, 15));
check('[FEFO] 3e lot intact : 50', close(m1[2].rest, 50));
check('[FEFO] invariant somme restants = base+entree-conso (100-35=65)', close(sum(m1), 65));

// lot sans peremption -> place EN DERNIER (peremption inconnue non prioritaire) et imprecise.
const m2 = ctx.buildMpLots('M1', [{ date: '', qty: 10 }, { date: '2026-07-15', qty: 30 }], '2026-06-01', [], dM, '2026-06-30');
check('[FEFO] lot sans peremption place en dernier', m2[0].date === '2026-07-15' && m2[m2.length - 1].imprecise === true);

// base agregee sans dates (nombre) -> un lot imprecise (repli).
const m3 = ctx.buildMpLots('M1', 12, '2026-06-01', [], dM, '2026-06-30');
check('[FEFO] base agregee (nombre) -> lot imprecise unique', m3.length === 1 && m3[0].imprecise === true && close(m3[0].qty, 12));

// ====== R3-8 : aucun lot mais consommation > 0 -> lot synthetique negatif (invariant) ======
const neg = ctx.buildFinishedLots('F1', 0, '2026-06-01', [], [], desToCode, today); // 0 lot
ctx.applyFifo(neg, 5); // sortie/conso 5 sans aucun lot connu
check('[R3-8] aucun lot + conso>0 -> 1 lot synthetique imprecise', neg.length === 1 && neg[0].imprecise === true);
check('[R3-8] le lot synthetique porte le negatif (rest = -conso)', close(neg[0].rest, -5));
check('[R3-8] invariant somme restants = base+flux (0-5=-5)', close(sum(neg), -5));

console.log('\n' + passed + ' reussi(s), ' + failed + ' echec(s).');
process.exit(failed ? 1 : 0);
