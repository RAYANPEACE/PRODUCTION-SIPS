/* ====== tests/lot-gardefou.test.js ======
   Tests purs (sans navigateur, sans serveur) du garde-fou « date de production »
   d'E1 : InventoryDomain.lotsMissingProdDate. Le module domain/inventory.js est
   un UMD (module.exports en Node) -> import direct, pas besoin de VM.

   Lancer : node tests/lot-gardefou.test.js
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(resolve(__dirname, '..', 'domain', 'inventory.js'), 'utf8');
// domain/inventory.js est un UMD : avec un `module` dans le contexte, il pose
// module.exports = api (comme en Node CommonJS), qu'on récupère ensuite.
const ctx = { module: { exports: {} }, console };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const Dom = ctx.module.exports;

let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log('  ✓ ' + label); }
  else { failed++; console.error('  ✗ ' + label); }
}

// Référentiel minimal : un produit fini, une matiere perissable (vrac), un arome
// (tare) et un emballage (film, jamais bloquant).
const REFS = [
  { code: 'F1', des: 'DIAMO 5KG', cat: 'fini', g: 'fini', m: 'carton' },
  { code: 'M1', des: 'LAIT VRAC', cat: 'mp', g: 'vrac', m: 'vrac' },
  { code: 'A1', des: 'AROME CAFE', cat: 'mp', g: 'tare', m: 'tare' },
  { code: 'B1', des: 'FILM 400G', cat: 'mp', g: 'film', m: 'bobine' }
];
// Helpers injectés calqués sur inventory-core. isPerishableMp via le repli (g vrac/tare).
const helpers = {
  isFini: r => r.cat === 'fini' || r.g === 'fini',
  // blockHasInput simplifié pour les modes de test (carton/vrac via pleines/kg ; tare via weighings).
  blockHasInput: (r, b) => !!b && (
    (Array.isArray(b.pleines) && b.pleines.some(v => String(v).trim())) ||
    String(b.kg || '').trim() !== '' ||
    (Array.isArray(b.weighings) && b.weighings.some(w => w && String(w.brut || '').trim()))
  ),
  ensureBlocks: () => {} // les entrées de test fournissent déjà e.blocks
};
const call = entries => Dom.lotsMissingDate(entries, REFS, helpers);

// 1) produit fini compté, un lot saisi SANS date -> signalé (kind fini)
const r1 = call({ F1: { counted: true, blocks: [{ pleines: ['3'], date: '' }] } });
check('[GF] fini compté + lot sans date -> signalé (kind fini)', r1.length === 1 && r1[0].kind === 'fini');

// 2) produit fini compté, lot saisi AVEC date -> non signalé
check('[GF] fini compté + lot daté -> non signalé',
  call({ F1: { counted: true, blocks: [{ pleines: ['3'], date: '2026-06-10' }] } }).length === 0);

// 3) lot sans date mais SANS saisie (quantité vide) -> non signalé
check('[GF] lot sans date mais vide -> non signalé',
  call({ F1: { counted: true, blocks: [{ pleines: [''], date: '' }] } }).length === 0);

// 4) E3 : matiere perissable (vrac) sans peremption -> DESORMAIS signalée (kind mp)
const r4 = call({ M1: { counted: true, blocks: [{ pleines: ['2'], date: '' }] } });
check('[GF] matiere vrac sans date -> signalée (kind mp)', r4.length === 1 && r4[0].kind === 'mp');

// 4bis) arome (tare) sans peremption -> signalé (kind mp)
check('[GF] arome tare sans date -> signalé (kind mp)',
  call({ A1: { counted: true, blocks: [{ weighings: [{ brut: '5' }], date: '' }] } }).length === 1);

// 4ter) emballage (film) sans date -> JAMAIS signalé (choix utilisateur)
check('[GF] emballage film sans date -> non signalé',
  call({ B1: { counted: true, blocks: [{ pleines: ['4'], date: '' }] } }).length === 0);

// 5) produit fini NON compté -> non signalé
check('[GF] fini non compté -> non signalé',
  call({ F1: { counted: false, blocks: [{ pleines: ['3'], date: '' }] } }).length === 0);

// 6) plusieurs lots, un seul sans date -> signalé une fois, nbLots=1
const r6 = call({ F1: { counted: true, blocks: [
  { pleines: ['3'], date: '2026-06-10' },
  { pleines: ['2'], date: '' }
] } });
check('[GF] 1 lot daté + 1 sans date -> signalé une fois', r6.length === 1);
check('[GF] nbLots = 1 (un seul lot fautif)', r6.length === 1 && r6[0].nbLots === 1);

// 7) deux lots sans date -> nbLots = 2
const r7 = call({ F1: { counted: true, blocks: [
  { pleines: ['3'], date: '' },
  { pleines: ['2'], date: '' }
] } });
check('[GF] 2 lots sans date -> nbLots = 2', r7.length === 1 && r7[0].nbLots === 2);

// 8) fini + matiere + emballage sans date : fini et matiere remontes, emballage non
const r8 = call({
  F1: { counted: true, blocks: [{ pleines: ['1'], date: '' }] },
  M1: { counted: true, blocks: [{ pleines: ['9'], date: '' }] },
  B1: { counted: true, blocks: [{ pleines: ['7'], date: '' }] }
});
check('[GF] fini + matiere signalés, emballage non', r8.length === 2 && r8.some(x => x.code === 'F1' && x.kind === 'fini') && r8.some(x => x.code === 'M1' && x.kind === 'mp') && !r8.some(x => x.code === 'B1'));

console.log('\n' + passed + ' reussi(s), ' + failed + ' echec(s).');
process.exit(failed ? 1 : 0);
