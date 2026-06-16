/* ====== tests/inventory.test.js ======
   Tests unitaires minimalistes (sans framework) avec console.assert().
   Lancer :  node tests/inventory.test.js
*/
const { createInventoryFromLastValidated, todayISO } =
  require('../domain/inventory');

let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log('  ✓ ' + label); }
  else { failed++; console.error('  ✗ ' + label); }
  console.assert(cond, label);
}

/* 1) last = null -> null */
check('last = null renvoie null',
  createInventoryFromLastValidated(null) === null);
check('last = undefined renvoie null',
  createInventoryFromLastValidated(undefined) === null);

/* 2) Copie profonde de last.c : modifier last.c ne modifie pas le résultat */
const last = {
  id: 'inv_ref',
  agent: 'Rayan',
  locked: true,
  c: { LAIT: { counted: true, blocks: [{ qty: 10 }] } }
};
const inv = createInventoryFromLastValidated(last);

check('le résultat n\'est pas null pour un last valide', inv !== null);
check('c.LAIT.counted copié', inv.c.LAIT.counted === true);
check('c.LAIT.blocks[0].qty copié', inv.c.LAIT.blocks[0].qty === 10);

// On mute la source en profondeur...
last.c.LAIT.counted = false;
last.c.LAIT.blocks[0].qty = 999;
last.c.NOUVEAU = { counted: true };

check('la copie est profonde (counted inchangé)', inv.c.LAIT.counted === true);
check('la copie est profonde (qty inchangée)', inv.c.LAIT.blocks[0].qty === 10);
check('la copie est profonde (pas de clé ajoutée)', inv.c.NOUVEAU === undefined);
check('références distinctes (c)', inv.c !== last.c);
check('références distinctes (blocks)', inv.c.LAIT.blocks !== last.c.LAIT.blocks);

/* 3) locked = false */
check('locked vaut false', inv.locked === false);

/* 4) la date est aujourd'hui */
check('la date est aujourd\'hui', inv.date === todayISO());

/* ====== Bilan ====== */
console.log('\n' + passed + ' réussi(s), ' + failed + ' échec(s).');
process.exit(failed === 0 ? 0 : 1);
