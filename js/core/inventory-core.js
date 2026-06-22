const $=(s,r=document)=>r.querySelector(s);
const num=v=>{const x=parseFloat(String(v??'').replace(',','.'));return isNaN(x)?0:x;};
const fmt=n=>(Math.round((n+Number.EPSILON)*100)/100).toLocaleString('fr-FR');
function round2(n){return Math.round((n+Number.EPSILON)*100)/100;}

/* ====== LISTE MAÎTRE (table 6bis, sans CHINOIS/PURALAC) ====== */
/* m = méthode ; p = paramètres réglables (sauvegardés en permanence) */
const REFS=[
 {code:'390003',des:'DIAMO LAIT 20G X100',u:'cartons',g:'pf_cart',m:'carton',p:{etPal:15,cartEt:14}},
 {code:'390002',des:'DIAMO LAIT 400G X 10',u:'cartons',g:'pf_cart',m:'carton',p:{etPal:10,cartEt:14}},
 {code:'390004',des:'DIAMO CAFE AU LAIT 30G X 50',u:'cartons',g:'pf_cart',m:'carton',p:{etPal:10,cartEt:27}},
 {code:'390005',des:'DIAMO LAIT 5KG',u:'sacs',g:'pf_sac',m:'sac',p:{etPal:5,sacEt:13}},
 {code:'390006',des:'DIAMO LAIT 10KG',u:'sacs',g:'pf_sac',m:'sac',p:{etPal:5,sacEt:8}},
 {code:'190005',des:'CARTON LEP 20G (vide)',u:'unité',g:'cart_vide',m:'cartvide',p:{pqEt:6,etPal:12,cartPaquet:25}},
 {code:'190006',des:'CARTON CAFE AU LAIT 30G (vide)',u:'unité',g:'cart_vide',m:'cartvide',p:{pqEt:6,etPal:12,cartPaquet:25}},
 {code:'190004',des:'CARTON LEP 400G (vide)',u:'unité',g:'cart_vide',m:'cartvide',p:{pqEt:6,etPal:12,cartPaquet:25}},
 {code:'190021',des:'CARTON LAITY 20G (vide)',u:'unité',g:'cart_vide',m:'cartvide',p:{pqEt:6,etPal:12,cartPaquet:20}},
 {code:'190001',des:'FILM SACHETS 20g LAIT EN POUDRE',u:'Kg',g:'film',m:'bobine',p:{epRef:14.5,poidsRef:207.18}},
 {code:'190002',des:'FILM SACHETS 30G CAFE AU LAIT',u:'Kg',g:'film',m:'bobine',p:{epRef:14.5,poidsRef:207.18}},
 {code:'190003',des:'FILM SACHETS 400G LAIT EN POUDRE',u:'Kg',g:'film',m:'bobine',p:{epRef:17,poidsRef:86.5}},
 {code:'900001',des:'VRAC LAIT EN POUDRE CHAMPION',u:'Kg',g:'vrac',m:'vrac',p:{sacPal:25,kgSac:25}},
 {code:'190016',des:'FAT 50',u:'Kg',g:'vrac',m:'vrac',p:{sacPal:25,kgSac:25}},
 {code:'110113',des:'MALTODEXTRINE',u:'Kg',g:'vrac',m:'vrac',p:{sacPal:25,kgSac:25}},
 {code:'110012',des:'SUCRE',u:'Kg',g:'vrac',m:'vrac',p:{sacPal:0,kgSac:50}},
 {code:'190011',des:'CAFE',u:'Kg',g:'vrac',m:'vrac',p:{sacPal:0,kgSac:20}},
 {code:'190014',des:'AROME CREME',u:'Kg',g:'tare',m:'tare',p:{caisse:0,film:0,kraft:0}},
 {code:'190015',des:'AROME CAFE',u:'Kg',g:'tare',m:'tare',p:{caisse:0,film:0,kraft:0}},
 {code:'190017',des:'AROME LAIT CONCENTRE',u:'Kg',g:'tare',m:'tare',p:{caisse:0,film:0,kraft:0}},
 {code:'190010',des:'DIOXYDE DE SILICONE',u:'Kg',g:'tare',m:'tare',p:{caisse:0,film:0,kraft:0}},
 {code:'190019',des:'CMC',u:'Kg',g:'tare',m:'tare',p:{caisse:0,film:0,kraft:0}},
 {code:'190012',des:'SAC PLASTIQUE POUR KRAFT 5KG',u:'unité',g:'plast',m:'plastique',p:{parPaquet:500,parRouleau:100}},
 {code:'190013',des:'SAC PLASTIQUE POUR KRAFT 10KG',u:'unité',g:'plast',m:'plastique',p:{parPaquet:500,parRouleau:100}},
 {code:'120206',des:'SEAU 20L BLANC AVEC COUVERCLE',u:'unité',g:'divers',m:'simple',p:{}},
 {code:'190007',des:'ZIPPER',u:'m',g:'divers',m:'simple',p:{},note:'Stock énorme — laisser vide = théorique'},
 {code:'190008',des:'SACS KRAFT 5KG DIAMO',u:'unité',g:'divers',m:'simple',p:{},note:'Difficile à compter — laisser vide = théorique'},
 {code:'190009',des:'SACS KRAFT 10KG DIAMO',u:'unité',g:'divers',m:'simple',p:{},note:'Difficile à compter — laisser vide = théorique'},
];
const GROUPS=[
 ['pf_cart','Produits finis — cartons','01'],
 ['pf_sac','Produits finis — sacs','02'],
 ['cart_vide','Cartons d\'emballage vides','03'],
 ['film','Films / bobines','04'],
 ['vrac','Matières en sacs / caisses','05'],
 ['tare','Arômes & petites matières (poids net)','06'],
 ['plast','Sacs plastiques','07'],
 ['divers','Consommables peu suivis','08'],
];
const CATS=[
 {id:'pf',title:'PRODUITS FINIS',subs:['pf_cart','pf_sac']},
 {id:'mp',title:'MATIÈRES PREMIÈRES & EMBALLAGES',subs:['cart_vide','film','vrac','tare','plast','divers']},
];
const STRIPE={carton:'s-cart',sac:'s-sac',cartvide:'s-cv',bobine:'s-bob',vrac:'s-vrac',tare:'s-tare',plastique:'s-pl',simple:'s-simple'};

/* ====== ÉTAT : config (permanent) + comptages (dernier inventaire) ====== */
let CFG=loadCfg();                 // {code:{...params}}
let ST=freshCounts();              // remplacé au chargement IndexedDB
let RO=false;                      // mode consultation (lecture seule)
function mergeAndMigrate(){
  if(!ST.id)ST.id='inv_'+Date.now();
  if(ST.sessionStart==null)ST.sessionStart=Date.now();  // début de la session de comptage en cours
  REFS.forEach(r=>{
    if(CFG[r.code]) Object.assign(r.p,CFG[r.code]);
    ST.c[r.code]??=blankEntry(r);
    const e=ST.c[r.code];
    if(r.m==='tare'&&!Array.isArray(e.weighings)) e.weighings=[{brut:e.brut||'',emb:e.emb||'rien'}];
    if(r.m==='cartvide'&&!Array.isArray(e.autres)){e.autres=[];e.palStd??='';e.paqPlus??='';e.vrac??='';}
    if((r.m==='carton'||r.m==='sac')){
      if(!Array.isArray(e.pleines)) e.pleines=[e.pal||''];
      if(!Array.isArray(e.entamees)) e.entamees=(e.et||e.vrac)?[{et:e.et||'',vrac:e.vrac||''}]:[];}
    if(r.m==='vrac'){
      if(!Array.isArray(e.pleines)) e.pleines=[e.pal||''];
      if(!Array.isArray(e.partielles)) e.partielles=(e.sac?[e.sac]:[]); e.kg??='';}
    if(r.m==='bobine'){if(!Array.isArray(e.pleines))e.pleines=[''];if(!Array.isArray(e.ent))e.ent=[''];}
  });
}

function freshCounts(){return {id:'inv_'+Date.now(),agent:'',date:new Date().toISOString().slice(0,10),c:{},sessionStart:Date.now()};}
function blankEntry(r){
  const e={counted:false};
  if(r.m==='carton'||r.m==='sac') Object.assign(e,{pleines:[''],entamees:[]});
  else if(r.m==='cartvide') Object.assign(e,{palStd:'',autres:[],paqPlus:'',vrac:''});
  else if(r.m==='bobine') Object.assign(e,{pleines:[''],ent:['']});
  else if(r.m==='vrac') Object.assign(e,{pleines:[''],partielles:[],kg:''});
  else if(r.m==='tare') Object.assign(e,{weighings:[{brut:'',emb:'rien'}]});
  else if(r.m==='plastique') Object.assign(e,{paquets:'',rouleaux:'',restant:'',pRest:'',pRoul:''});
  else if(r.m==='simple') Object.assign(e,{val:''});
  return e;
}

/* ====== CALCUL DES TOTAUX ====== */
function pOf(r){return (ST.cfg&&ST.cfg[r.code])?ST.cfg[r.code]:r.p;}
function tareNet(w,p){if(w&&w.net!=null)return w.net;let t=0;if(w.emb==='caisse')t=num(p.caisse);else if(w.emb==='film')t=num(p.film)/1000;else if(w.emb==='kraft')t=num(p.kraft)/1000;return num(w.brut)-t;}
function isMulti(r){return (r.cat==='mp'||r.cat==='fini')&&['carton','sac','vrac','tare','simple'].includes(r.m);}
function blockTotal(r,o,cfg){cfg=cfg||{};
  switch(r.m){
    case 'carton':case 'sac':{const per=r.m==='carton'?num(cfg.cartEt):num(cfg.sacEt);
      let t=0;(o.pleines||[]).forEach(v=>t+=num(v)*num(cfg.etPal)*per);
      (o.entamees||[]).forEach(a=>t+=num(a.et)*per+num(a.vrac));return t;}
    case 'vrac':{let sacs=0;(o.pleines||[]).forEach(v=>sacs+=num(v)*num(cfg.sacPal));
      (o.partielles||[]).forEach(v=>sacs+=num(v));return sacs*num(cfg.kgSac)+num(o.kg);}
    case 'tare':return (o.weighings||[]).reduce((s,w)=>s+tareNet(w,cfg),0);
    case 'simple':return num(o.val);
  }return 0;}
function newBlock(r){const b={cfg:clone(pOf(r)),date:'',photo:''};
  if(r.m==='carton'||r.m==='sac')Object.assign(b,{pleines:[''],entamees:[]});
  else if(r.m==='vrac')Object.assign(b,{pleines:[''],partielles:[],kg:''});
  else if(r.m==='tare')Object.assign(b,{weighings:[{brut:'',emb:'rien'}]});
  else Object.assign(b,{val:''});
  return b;}
/* Migration : convertit l'ancien comptage (et les lots/formats/dates v26) en e.blocks */
function ensureBlocks(r,e){
  if(Array.isArray(e.blocks))return;
  const p=pOf(r);const blocks=[];
  const b0={cfg:clone(p),date:e.date||'',photo:e.photo||''};
  if(r.m==='carton'||r.m==='sac'){b0.pleines=(e.pleines&&e.pleines.length)?clone(e.pleines):[''];b0.entamees=clone(e.entamees||[]);}
  else if(r.m==='vrac'){b0.pleines=(e.pleines&&e.pleines.length)?clone(e.pleines):[''];b0.partielles=clone(e.partielles||[]);b0.kg=e.kg||'';}
  else if(r.m==='tare'){b0.weighings=clone(e.weighings&&e.weighings.length?e.weighings:[{brut:'',emb:'rien'}]);}
  else b0.val=e.val||'';
  blocks.push(b0);
  (e.autresFmt||[]).forEach(a=>{const c=clone(p);c.etPal=a.etPal;if(r.m==='carton')c.cartEt=a.parEt;else c.sacEt=a.parEt;blocks.push({cfg:c,date:'',photo:'',pleines:[a.pal||''],entamees:[]});});
  (e.prodGroups||[]).forEach(g=>{blocks.push({cfg:clone(p),date:g.date||'',photo:'',pleines:(g.pleines&&g.pleines.length)?clone(g.pleines):[''],entamees:clone(g.entamees||[])});
    (g.autresFmt||[]).forEach(a=>{const c=clone(p);c.etPal=a.etPal;if(r.m==='carton')c.cartEt=a.parEt;else c.sacEt=a.parEt;blocks.push({cfg:c,date:g.date||'',photo:'',pleines:[a.pal||''],entamees:[]});});});
  (e.lots||[]).forEach(l=>{const b={cfg:clone(p),date:l.exp||'',photo:l.photo||''};
    if(r.m==='vrac'){b.pleines=[''];b.partielles=[];b.kg=l.q||'';}
    else if(r.m==='tare'){b.weighings=[{brut:l.q||'',emb:'rien'}];}
    else b.val=l.q||'';
    blocks.push(b);});
  e.blocks=blocks;
}
function total(r){
  const e=ST.c[r.code];if(!e)return 0;if(e._phys!=null)return e._phys;const p=pOf(r);
  if(isMulti(r)){ensureBlocks(r,e);return e.blocks.reduce((s,b)=>s+blockTotal(r,b,b.cfg||p),0);}
  switch(r.m){
    case 'carton':case 'sac':{const per=r.m==='carton'?num(p.cartEt):num(p.sacEt);
      let t=0;e.pleines.forEach(v=>t+=num(v)*num(p.etPal)*per);
      (e.entamees||[]).forEach(a=>t+=num(a.et)*per+num(a.vrac));return t;}
    case 'cartvide':{let t=num(e.palStd)*num(p.etPal)*num(p.pqEt)*num(p.cartPaquet);
      (e.autres||[]).forEach(a=>t+=num(a.pal)*num(a.et)*num(a.pe)*num(p.cartPaquet));
      return t+num(e.paqPlus)*num(p.cartPaquet)+num(e.vrac);}
    case 'bobine':{let t=0;e.pleines.forEach(v=>t+=num(v));
      e.ent.forEach(v=>{if(num(p.epRef)>0)t+=num(v)*num(p.poidsRef)/num(p.epRef);});return t;}
    case 'vrac':{let sacs=0;e.pleines.forEach(v=>sacs+=num(v)*num(p.sacPal));
      (e.partielles||[]).forEach(v=>sacs+=num(v));return sacs*num(p.kgSac)+num(e.kg);}
    case 'tare': return (e.weighings||[]).reduce((s,w)=>s+tareNet(w,p),0);
    case 'plastique':{let rest=num(e.restant);
      if(num(e.pRoul)>0&&num(e.pRest)>0) rest=Math.round(num(e.pRest)/num(e.pRoul)*num(p.parRouleau));
      return num(e.paquets)*num(p.parPaquet)+num(e.rouleaux)*num(p.parRouleau)+rest;}
    case 'simple': return num(e.val);
  }
  return 0;
}
function blockHasInput(r,b){
  if(r.m==='carton'||r.m==='sac')return (b.pleines||[]).some(v=>String(v).trim())||(b.entamees||[]).some(a=>[a.et,a.vrac].some(v=>String(v).trim()!==''));
  if(r.m==='vrac')return (b.pleines||[]).some(v=>String(v).trim())||(b.partielles||[]).some(v=>String(v).trim())||String(b.kg).trim()!=='';
  if(r.m==='tare')return (b.weighings||[]).some(w=>String(w.brut).trim()!=='');
  if(r.m==='simple')return String(b.val).trim()!=='';
  return false;}
function hasInput(r){
  const e=ST.c[r.code];
  if(isMulti(r)){ensureBlocks(r,e);return e.blocks.some(b=>blockHasInput(r,b));}
  if(r.m==='bobine') return e.pleines.some(v=>String(v).trim())||e.ent.some(v=>String(v).trim());
  if(r.m==='tare') return (e.weighings||[]).some(w=>String(w.brut).trim()!=='');
  if(r.m==='carton'||r.m==='sac') return e.pleines.some(v=>String(v).trim())
      ||(e.entamees||[]).some(a=>[a.et,a.vrac].some(v=>String(v).trim()!==''));
  if(r.m==='vrac') return e.pleines.some(v=>String(v).trim())
      ||(e.partielles||[]).some(v=>String(v).trim())||String(e.kg).trim()!=='';
  if(r.m==='cartvide') return [e.palStd,e.paqPlus,e.vrac].some(v=>String(v).trim()!=='')
      ||(e.autres||[]).some(a=>[a.pal,a.et,a.pe].some(v=>String(v).trim()!==''));
  return Object.keys(e).some(k=>k!=='counted'&&k!=='emb'&&k[0]!=='_'&&String(e[k]).trim()!=='');
}

/* ====== RENDU ====== */
function render(){
  const app=$('#app');app.innerHTML='';
  CATS.forEach(cat=>{
    const catEl=document.createElement('div');catEl.className='cat open';catEl.dataset.cat=cat.id;
    const ch=document.createElement('div');ch.className='cat-h';
    ch.innerHTML=`<span class="ratio" data-catr="${cat.id}"></span><h2>${cat.title}</h2><span class="chev">▶</span>`;
    ch.onclick=()=>catEl.classList.toggle('open');
    const cbody=document.createElement('div');cbody.className='cat-body';
    cat.subs.forEach(gid=>{
      const refs=REFS.filter(r=>r.g===gid);if(!refs.length)return;
      const title=(GROUPS.find(g=>g[0]===gid)||[])[1]||gid;
      const subEl=document.createElement('div');subEl.className='sub open';subEl.dataset.sub=gid;
      const sh=document.createElement('div');sh.className='sub-h';
      sh.innerHTML=`<span class="ratio sm" data-subr="${gid}"></span><h3>${title}</h3><span class="chev">▶</span>`;
      sh.onclick=()=>{const willOpen=!subEl.classList.contains('open');subEl.classList.toggle('open');
        if(willOpen)setTimeout(()=>scrollCardIntoView(subEl),70);};
      const sbody=document.createElement('div');sbody.className='sub-body';
      refs.forEach(r=>sbody.appendChild(buildCard(r)));
      subEl.append(sh,sbody);cbody.appendChild(subEl);
    });
    catEl.append(ch,cbody);app.appendChild(catEl);
  });
  $('#tot').textContent=REFS.length;refresh();
}
function ratioInfo(refs){const tot=refs.length;const done=refs.filter(r=>ST.c[r.code].counted).length;
  return {tot,done,cls:done===0?'none':(done===tot?'ok':'partial')};}
function scrollCardIntoView(card){
  const header=document.querySelector('header');
  const banner=document.getElementById('roBanner');
  const off=(header?header.offsetHeight:0)+(banner&&banner.style.display!=='none'?banner.offsetHeight:0)+8;
  const top=card.getBoundingClientRect().top+window.scrollY-off;
  window.scrollTo({top:top<0?0:top,behavior:'smooth'});
}
function buildCard(r){
  const e=ST.c[r.code];
  const card=document.createElement('div');card.className='card'+(e.counted?'':' nc');card.dataset.code=r.code;
  card.innerHTML=`<div class="top">
      <div class="stripe ${STRIPE[r.m]}"></div>
      <div class="ttl"><b>${r.des}</b></div>
      <div class="readout" data-ro></div>
      <span class="hasphoto" data-photo style="display:none" title="Photo jointe">📷</span>
      <div class="chev">▶</div></div><div class="body"></div>`;
  const topEl=card.querySelector('.top');
  topEl.onclick=ev=>{if(ev.target.closest('input,select,button'))return;
    const willOpen=!card.classList.contains('open');
    card.classList.toggle('open');
    if(willOpen)setTimeout(()=>scrollCardIntoView(card),70);};
  buildBody(r,card.querySelector('.body'));
  return card;
}
function setCounted(r){ST.c[r.code].counted=hasInput(r);
  const card=$(`.card[data-code="${r.code}"]`);card&&card.classList.toggle('nc',!ST.c[r.code].counted);}

function cfgField(lbl,val,on){const f=document.createElement('div');f.className='cfgcell';
  f.innerHTML=`<label>${lbl}</label><input inputmode="decimal" enterkeyhint="done" value="${val??''}">`;
  f.querySelector('input').addEventListener('input',ev=>{on(ev.target.value);saveCfg();refresh();});return f;}
function inp(lbl,sub,val,on){const f=document.createElement('div');f.className='field';
  f.innerHTML=`<label>${lbl}${sub?`<small>${sub}</small>`:''}</label><input inputmode="decimal" enterkeyhint="done" value="${val??''}">`;
  f.querySelector('input').addEventListener('input',ev=>{on(ev.target.value);refresh();});return f;}

function buildBody(r,b){
  const e=ST.c[r.code],p=pOf(r);
  if(isMulti(r)){buildBlocks(r,b);return;}
  if(r.m==='carton'||r.m==='sac'){
    const isC=r.m==='carton';
    const cfg=document.createElement('div');cfg.className='cfgrow';
    cfg.append(cfgField('Étages/palette',p.etPal,v=>p.etPal=v),
      cfgField(isC?'Cartons/étage':'Sacs/étage',isC?p.cartEt:p.sacEt,v=>isC?p.cartEt=v:p.sacEt=v));
    b.append(cfg,tallyEl(),
      listBlock('Palettes pleines (compte par section)',e.pleines,'+ Ajouter des palettes pleines'),
      entameesBlock(r,e,isC?'cartons':'sacs'));
  }else if(r.m==='cartvide'){
    const cfg=document.createElement('div');cfg.className='cfgrow';
    cfg.append(cfgField('Paquets/étage',p.pqEt,v=>p.pqEt=v),
      cfgField('Étages/palette',p.etPal,v=>p.etPal=v),cfgField('Cartons/paquet',p.cartPaquet,v=>p.cartPaquet=v));
    b.append(cfg,inp('Palettes (format standard)','pilage habituel ci-dessus',e.palStd,v=>e.palStd=v),
      autresBlock(r,e),
      inp('Paquets en plus','hors palette',e.paqPlus,v=>e.paqPlus=v),
      inp('Cartons en vrac','',e.vrac,v=>e.vrac=v));
  }else if(r.m==='bobine'){
    const cfg=document.createElement('div');cfg.className='cfgrow';
    cfg.append(cfgField('Épaisseur réf.',p.epRef,v=>p.epRef=v),cfgField('Poids réf. (kg)',p.poidsRef,v=>p.poidsRef=v));
    b.append(cfg,tallyEl(),
      listBlock('Bobines pleines — poids (kg)',e.pleines,'+ Ajouter une bobine pleine'),
      listBlock('Bobines entamées — épaisseur',e.ent,'+ Ajouter une bobine entamée'));
    const h=document.createElement('div');h.className='hint';
    h.textContent='Les épaisseurs sont converties en kg (produit en croix). Le nombre de bobines saisies est rappelé en haut pour vérifier que ça correspond à ce que tu vois.';b.append(h);
  }else if(r.m==='vrac'){
    const cfg=document.createElement('div');cfg.className='cfgrow';
    cfg.append(cfgField('Sacs/palette',p.sacPal,v=>p.sacPal=v),cfgField('kg/sac',p.kgSac,v=>p.kgSac=v));
    b.append(cfg,tallyEl());
    if(num(p.sacPal)>0)b.append(listBlock('Palettes pleines (compte par section)',e.pleines,'+ Ajouter des palettes pleines'));
    b.append(listBlock(num(p.sacPal)>0?'Palettes entamées (en sacs)':'Sacs / caisses (par lot)',e.partielles,
        num(p.sacPal)>0?'+ Ajouter une palette entamée':'+ Ajouter un lot'),
      inp('Restant (kg)','sac entamé / vrac',e.kg,v=>e.kg=v));
  }else if(r.m==='tare'){
    const cfg=document.createElement('div');cfg.className='cfgrow tare';
    cfg.append(cfgField('Caisse (kg)',p.caisse,v=>p.caisse=v),
      cfgField('Film (g)',p.film,v=>p.film=v),cfgField('Kraft (g)',p.kraft,v=>p.kraft=v));
    b.append(cfg,tareBlock(r,e));
    const h=document.createElement('div');h.className='hint';
    h.textContent='Une pesée par contenant (sac/caisse plein ou entamé). Le poids net se calcule selon l\'emballage choisi, et tout s\'additionne.';b.append(h);
  }else if(r.m==='plastique'){
    const cfg=document.createElement('div');cfg.className='cfgrow';
    cfg.append(cfgField('Pièces/paquet',p.parPaquet,v=>p.parPaquet=v),cfgField('Pièces/rouleau',p.parRouleau,v=>p.parRouleau=v));
    b.append(cfg,inp('Paquets pleins','',e.paquets,v=>e.paquets=v),
      inp('Rouleaux entiers','',e.rouleaux,v=>e.rouleaux=v),
      inp('Restant (pièces)','si comptable',e.restant,v=>e.restant=v));
    const h=document.createElement('div');h.className='hint';
    h.textContent='Restant difficile à compter ? Pèse-le et renseigne les deux champs ci-dessous pour l\'estimer.';b.append(h);
    b.append(inp('Poids du restant (g)','',e.pRest,v=>e.pRest=v),
      inp('Poids d\'un rouleau (g)','rouleau de '+p.parRouleau,e.pRoul,v=>e.pRoul=v));
  }else if(r.m==='simple'){
    if(r.note){const h=document.createElement('div');h.className='hint';h.textContent=r.note;b.append(h);}
    b.append(inp('Quantité comptée','laisser vide = théorique',e.val,v=>e.val=v));
  }
}
function labeledInput(lbl,val,on){
  const w=document.createElement('div');w.className='lf';
  w.innerHTML=`<label>${lbl}</label><input inputmode="decimal" enterkeyhint="done" value="${val??''}" placeholder="0">`;
  w.querySelector('input').addEventListener('input',ev=>{on(ev.target.value);refresh();});
  return w;
}
function focusLastInput(wrap,sel){const els=wrap.querySelectorAll(sel);const last=els[els.length-1];
  if(last){const inp=last.querySelector('input')||last;try{inp.focus();}catch(_){}}}
function listBlock(title,arr,addLabel){
  const wrap=document.createElement('div');wrap.style.marginTop='12px';
  const t=document.createElement('div');t.style.cssText='font-size:13px;font-weight:600;margin-bottom:2px';t.textContent=title;wrap.append(t);
  const grid=document.createElement('div');grid.className='cells';wrap.append(grid);
  function draw(focusLast){
    grid.innerHTML='';
    arr.forEach((v,i)=>{
      const cell=document.createElement('div');cell.className='cell';
      cell.innerHTML=`<input inputmode="decimal" enterkeyhint="done" value="${v||''}" placeholder="0"><button class="rmc" tabindex="-1">×</button>`;
      cell.querySelector('input').addEventListener('input',ev=>{arr[i]=ev.target.value;refresh();});
      cell.querySelector('.rmc').onclick=()=>{arr.splice(i,1);if(!arr.length)arr.push('');draw();refresh();};
      grid.append(cell);
    });
    const add=document.createElement('button');add.className='cell-add';add.textContent='+';add.title=addLabel||'Ajouter';
    add.onclick=()=>{arr.push('');draw(true);refresh();};grid.append(add);
    if(focusLast){const cells=grid.querySelectorAll('.cell');const last=cells[cells.length-1];
      if(last){const inp=last.querySelector('input');if(inp){try{inp.focus();}catch(_){}}}}
  }
  draw();return wrap;
}

function tallyEl(){const d=document.createElement('div');d.className='tally';d.dataset.tally='1';return d;}
function stat(v,l,cls){return `<div class="stat${cls?' '+cls:''}"><b>${v}</b><small>${l}</small></div>`;}
function subInfo(r){
  const e=ST.c[r.code],p=r.p;
  if(r.m==='bobine'){const np=e.pleines.filter(v=>String(v).trim()).length;
    const ne=e.ent.filter(v=>String(v).trim()).length;
    return stat(np+ne,'bobines')+stat(ne,'entamées')+stat(fmt(total(r)),'kg total','tot');}
  if(r.m==='carton'||r.m==='sac'){const np=e.pleines.reduce((s,v)=>s+num(v),0);
    const ne=(e.entamees||[]).filter(a=>[a.et,a.vrac].some(v=>String(v).trim())).length;
    return stat(fmt(np),'pal. pleines')+stat(ne,'entamées')+stat(fmt(total(r)),r.u+' total','tot');}
  if(r.m==='vrac'){const np=e.pleines.reduce((s,v)=>s+num(v),0);
    const ne=(e.partielles||[]).filter(v=>String(v).trim()).length;
    let sacs=0;e.pleines.forEach(v=>sacs+=num(v)*num(p.sacPal));(e.partielles||[]).forEach(v=>sacs+=num(v));
    return stat(fmt(np),'pal. pleines')+stat(ne,'entamées')+stat(fmt(sacs),'sacs')+stat(fmt(total(r)),'kg','tot');}
  return '';
}
function entameesBlock(r,obj,unitWord){
  obj.entamees=obj.entamees||[];
  const wrap=document.createElement('div');wrap.style.marginTop='12px';
  const t=document.createElement('div');t.style.cssText='font-size:13px;font-weight:600;margin-bottom:2px';
  t.textContent='Palettes entamées';wrap.append(t);
  const grid=document.createElement('div');grid.className='ent-wrap';wrap.append(grid);
  function draw(focusLast){
    grid.innerHTML='';
    obj.entamees.forEach((a,i)=>{
      const c=document.createElement('div');c.className='ent-chip';
      c.innerHTML=`<div class="h"><span>P${i+1}</span><button>×</button></div>
        <div class="cols">
          <div class="col"><label>Étages</label><input inputmode="decimal" enterkeyhint="done" value="${a.et||''}" placeholder="0"></div>
          <div class="col"><label>${unitWord} vrac</label><input inputmode="decimal" enterkeyhint="done" value="${a.vrac||''}" placeholder="0"></div>
        </div>`;
      const ins=c.querySelectorAll('input');
      ins[0].addEventListener('input',ev=>{a.et=ev.target.value;refresh();});
      ins[1].addEventListener('input',ev=>{a.vrac=ev.target.value;refresh();});
      c.querySelector('.h button').onclick=()=>{obj.entamees.splice(i,1);draw();refresh();};
      grid.append(c);
    });
    const add=document.createElement('button');add.className='addbtn';add.textContent='+ Ajouter une palette entamée';
    wrap.querySelectorAll('.addbtn').forEach(x=>x.remove());
    add.onclick=()=>{obj.entamees.push({et:'',vrac:''});draw(true);refresh();};wrap.append(add);
    if(focusLast){const chips=grid.querySelectorAll('.ent-chip');const last=chips[chips.length-1];
      if(last){const inp=last.querySelector('input');if(inp){try{inp.focus();}catch(_){}}}}
  }
  draw();return wrap;
}
function isFini(r){return r.cat==='fini'||r.g==='fini';}
/* Délais : mois + jours, pour péremption (à venir) et production (écoulé) */
function monthsDays(days){const m=Math.floor(days/30.44);const j=Math.round(days-m*30.44);return {m:m,j:j};}
function fmtMD(m,j){const a=[];if(m>0)a.push(m+' mois');if(j>0||m===0)a.push(j+' j');return a.join(' ');}
function expInfo(s){
  if(!s)return null;const d=new Date(s+'T00:00:00');if(isNaN(d.getTime()))return null;
  const now=new Date();now.setHours(0,0,0,0);const days=Math.round((d-now)/86400000);
  if(days<0){const md=monthsDays(-days);return {cls:'exp-ko',txt:'⚠ périmé depuis '+fmtMD(md.m,md.j)};}
  if(days===0)return {cls:'exp-ko',txt:'⚠ périme aujourd\u2019hui'};
  const md=monthsDays(days);let cls='exp-ok';if(days<=30)cls='exp-warn';else if(days<=90)cls='exp-soon';
  return {cls:cls,txt:'périme dans '+fmtMD(md.m,md.j)};
}
function prodInfo(s){
  if(!s)return null;const d=new Date(s+'T00:00:00');if(isNaN(d.getTime()))return null;
  const now=new Date();now.setHours(0,0,0,0);const days=Math.round((now-d)/86400000);
  if(days<0)return {cls:'exp-soon',txt:'production à venir ('+(-days)+' j)'};
  if(days===0)return {cls:'exp-ok',txt:'produit aujourd\u2019hui'};
  const md=monthsDays(days);return {cls:'exp-ok',txt:'produit il y a '+fmtMD(md.m,md.j)};
}
function buildLotPhoto(host,r,l,i,redraw){
  host.innerHTML='';
  const fileIn=document.createElement('input');fileIn.type='file';fileIn.accept='image/*';fileIn.capture='environment';fileIn.style.display='none';
  const galIn=document.createElement('input');galIn.type='file';galIn.accept='image/*';galIn.style.display='none';
  const pbtn=document.createElement('button');pbtn.type='button';pbtn.className='photo-btn';pbtn.innerHTML=l.photo?'📷 Reprendre':'📷 Étiquette';pbtn.onclick=()=>fileIn.click();
  const gbtn=document.createElement('button');gbtn.type='button';gbtn.className='photo-btn';gbtn.innerHTML='🖼 Galerie';gbtn.onclick=()=>galIn.click();
  const onPick=async ev=>{const f=ev.target.files&&ev.target.files[0];if(!f)return;try{l.photo=await compress(f);redraw();refresh();toast('Photo ajoutée');}catch(err){toast('Photo non ajoutée');}};
  fileIn.onchange=onPick;galIn.onchange=onPick;
  host.append(fileIn,galIn,pbtn,gbtn);
  if(l.photo){const th=document.createElement('img');th.className='photo-thumb';th.src=l.photo;th.onclick=()=>openLightbox(r.des,l.photo);host.append(th);
    const rm=document.createElement('button');rm.type='button';rm.className='photo-btn';rm.textContent='Suppr.';rm.onclick=()=>{l.photo='';redraw();refresh();};host.append(rm);}
}
/* ===== RENDU MULTI-BLOCS (MP & finis) ===== */
function cfgFieldB(lbl,val,on){const f=document.createElement('div');f.className='cfgcell';
  f.innerHTML=`<label>${lbl}</label><input inputmode="decimal" enterkeyhint="done" value="${val??''}">`;
  f.querySelector('input').addEventListener('input',ev=>{on(ev.target.value);refresh();});return f;}
function blockCfgRow(r,blk){const c=blk.cfg=blk.cfg||clone(pOf(r));const cfg=document.createElement('div');cfg.className='cfgrow';
  if(r.m==='carton'){cfg.append(cfgFieldB('Étages/palette',c.etPal,v=>c.etPal=v),cfgFieldB('Cartons/étage',c.cartEt,v=>c.cartEt=v));}
  else if(r.m==='sac'){cfg.append(cfgFieldB('Étages/palette',c.etPal,v=>c.etPal=v),cfgFieldB('Sacs/étage',c.sacEt,v=>c.sacEt=v));}
  else if(r.m==='vrac'){cfg.append(cfgFieldB('Sacs/palette',c.sacPal,v=>c.sacPal=v),cfgFieldB('kg/sac',c.kgSac,v=>c.kgSac=v));}
  else if(r.m==='tare'){cfg.className='cfgrow tare';cfg.append(cfgFieldB('Caisse (kg)',c.caisse,v=>c.caisse=v),cfgFieldB('Film (g)',c.film,v=>c.film=v),cfgFieldB('Kraft (g)',c.kraft,v=>c.kraft=v));}
  else return document.createElement('span');
  return cfg;}
function tareBlockB(r,blk){blk.weighings=blk.weighings||[{brut:'',emb:'rien'}];
  const wrap=document.createElement('div');wrap.style.marginTop='10px';
  function draw(focusLast){[...wrap.querySelectorAll('.w-card,.addbtn')].forEach(x=>x.remove());
    blk.weighings.forEach((wg,i)=>{
      const card=document.createElement('div');card.className='w-card';
      const cols=document.createElement('div');cols.className='cols';
      cols.innerHTML=`<div class="col brut"><label>Brut (kg)</label><input inputmode="decimal" enterkeyhint="done" value="${wg.brut||''}" placeholder="0"></div>
        <div class="col emb"><label>Emballage</label><select>
          <option value="rien">Sans emb.</option><option value="caisse">Caisse</option>
          <option value="film">Film</option><option value="kraft">Kraft</option></select></div>
        <div class="col net"><label>Net (kg)</label><span class="netv" data-wnet>0</span></div>`;
      const br=cols.querySelector('input'),sel=cols.querySelector('select');sel.value=wg.emb;
      const netSp=cols.querySelector('[data-wnet]');
      const upd=()=>{const nv=tareNet(wg,blk.cfg);netSp.textContent=fmt(nv);netSp.style.color=nv<0?'var(--red)':'var(--green)';};
      br.addEventListener('input',ev=>{wg.brut=ev.target.value;upd();refresh();});
      sel.addEventListener('change',ev=>{wg.emb=ev.target.value;upd();refresh();});upd();
      const rm=document.createElement('button');rm.className='photo-btn';rm.style.cssText='border-color:#e3c7cd;color:var(--red);background:#fbeef0;margin-top:6px';
      rm.textContent='Retirer la pesée';rm.onclick=()=>{blk.weighings.splice(i,1);if(!blk.weighings.length)blk.weighings.push({brut:'',emb:'rien'});draw();refresh();};
      card.append(cols,rm);wrap.append(card);
    });
    const add=document.createElement('button');add.className='addbtn';add.textContent='+ Ajouter une pesée (autre contenant)';
    add.onclick=()=>{blk.weighings.push({brut:'',emb:'rien'});draw(true);refresh();};wrap.append(add);
    if(focusLast){const cs=wrap.querySelectorAll('.w-card');const last=cs[cs.length-1];if(last){const inp=last.querySelector('input');if(inp)try{inp.focus();}catch(_){}}}
  }
  draw();return wrap;}
function renderBlockSaisies(r,blk){const w=document.createElement('div');
  if(r.m==='carton'||r.m==='sac'){const isC=r.m==='carton';blk.pleines=blk.pleines||[''];blk.entamees=blk.entamees||[];
    w.append(listBlock('Palettes pleines (compte par section)',blk.pleines,'+ Ajouter des palettes pleines'),
      entameesBlock(r,blk,isC?'cartons':'sacs'));}
  else if(r.m==='vrac'){blk.pleines=blk.pleines||[''];blk.partielles=blk.partielles||[];const sp=num(blk.cfg.sacPal)>0;
    if(sp)w.append(listBlock('Palettes pleines (compte par section)',blk.pleines,'+ Ajouter des palettes pleines'));
    w.append(listBlock(sp?'Palettes entamées (en sacs)':'Sacs / caisses (par lot)',blk.partielles,sp?'+ Ajouter une palette entamée':'+ Ajouter un lot'),
      inp('Restant (kg)','sac entamé / vrac',blk.kg,v=>blk.kg=v));}
  else if(r.m==='tare'){w.append(tareBlockB(r,blk));}
  else if(r.m==='simple'){w.append(inp('Quantité comptée','laisser vide = théorique',blk.val,v=>blk.val=v));}
  return w;}
function blockMeta(r,blk,bi,isFin,redraw){
  const w=document.createElement('div');w.className='blk-meta';
  const dr=document.createElement('div');dr.className='blk-date';
  dr.innerHTML=`<label>${isFin?'Date de production':'Date de péremption'}</label><input type="date" value="${blk.date||''}"><span class="blk-delay" data-delay></span>`;
  const di=dr.querySelector('input');const dl=dr.querySelector('[data-delay]');
  const updD=()=>{const info=isFin?prodInfo(blk.date):expInfo(blk.date);dl.className='blk-delay'+(info?' '+info.cls:'');dl.textContent=info?info.txt:'';};
  di.addEventListener('change',ev=>{blk.date=ev.target.value;updD();saveCounts();});updD();
  const ph=document.createElement('div');ph.className='lot-photo';buildLotPhoto(ph,r,blk,bi,redraw);
  w.append(dr,ph);return w;}
function buildBlocks(r,b){
  const e=ST.c[r.code];ensureBlocks(r,e);const isFin=isFini(r);
  const host=document.createElement('div');b.append(host);
  function drawAll(){
    host.innerHTML='';
    e.blocks.forEach((blk,bi)=>{
      const box=document.createElement('div');box.className='blk'+(bi===0?' blk-std':'');box.dataset.bi=bi;
      const hd=document.createElement('div');hd.className='blk-h';
      hd.innerHTML=`<span class="blk-t">${(isFin?'Production ':'Lot ')+(bi+1)}</span>`;
      if(bi>0){const x=document.createElement('button');x.className='blk-x';x.textContent='×';x.onclick=()=>{e.blocks.splice(bi,1);drawAll();refresh();};hd.append(x);}
      box.append(hd,blockCfgRow(r,blk),renderBlockSaisies(r,blk),blockMeta(r,blk,bi,isFin,drawAll));
      const st=document.createElement('div');st.className='blk-sub';
      st.innerHTML=`<span>Sous-total</span><b data-blocktot="${bi}">${fmt(blockTotal(r,blk,blk.cfg||pOf(r)))}</b><small>${r.u||''}</small>`;
      box.append(st);host.append(box);
    });
    const add=document.createElement('button');add.className='addbtn blk-add';
    add.textContent=isFin?'+ lot (autre date de production / format)':'+ lot (autre péremption / format)';
    add.onclick=()=>{e.blocks.push(newBlock(r));drawAll();refresh();};host.append(add);
  }
  drawAll();
}
function rowXStyle(){return 'width:36px;height:40px;flex:none;border:1.5px solid var(--line);background:#fff;border-radius:8px;color:var(--red);font-size:18px;font-weight:700';}
function autresBlock(r,e){
  const wrap=document.createElement('div');wrap.style.marginTop='12px';
  const t=document.createElement('div');t.style.cssText='font-size:13px;font-weight:600;margin-bottom:2px';
  t.textContent='Autres palettes (pilage différent)';wrap.append(t);
  const grid=document.createElement('div');grid.className='ent-wrap';wrap.append(grid);
  function draw(focusLast){
    grid.innerHTML='';
    e.autres.forEach((a,i)=>{
      const c=document.createElement('div');c.className='ent-chip';c.style.width='100%';
      c.innerHTML=`<div class="h"><span>Format ${i+1}</span><button>×</button></div>
        <div class="cols">
          <div class="col"><label>Palettes</label><input inputmode="decimal" enterkeyhint="done" value="${a.pal||''}" placeholder="0"></div>
          <div class="col"><label>Étages</label><input inputmode="decimal" enterkeyhint="done" value="${a.et||''}" placeholder="0"></div>
          <div class="col"><label>Paq./ét.</label><input inputmode="decimal" enterkeyhint="done" value="${a.pe||''}" placeholder="0"></div>
        </div>`;
      const ins=c.querySelectorAll('input');
      ins[0].addEventListener('input',ev=>{a.pal=ev.target.value;refresh();});
      ins[1].addEventListener('input',ev=>{a.et=ev.target.value;refresh();});
      ins[2].addEventListener('input',ev=>{a.pe=ev.target.value;refresh();});
      c.querySelector('.h button').onclick=()=>{e.autres.splice(i,1);draw();refresh();};
      grid.append(c);
    });
    wrap.querySelectorAll('.addbtn').forEach(x=>x.remove());
    const add=document.createElement('button');add.className='addbtn';add.textContent='+ Ajouter un format de palette';
    add.onclick=()=>{e.autres.push({pal:'',et:'',pe:''});draw(true);};wrap.append(add);
    if(focusLast){const chips=grid.querySelectorAll('.ent-chip');const last=chips[chips.length-1];
      if(last){const inp=last.querySelector('input');if(inp){try{inp.focus();}catch(_){}}}}
  }
  draw();return wrap;
}
function tareBlock(r,e){
  const wrap=document.createElement('div');wrap.style.marginTop='10px';
  function draw(focusLast){[...wrap.querySelectorAll('.w-card,.addbtn')].forEach(x=>x.remove());
    e.weighings.forEach((w,i)=>{
      const card=document.createElement('div');card.className='w-card';
      const cols=document.createElement('div');cols.className='cols';
      cols.innerHTML=`<div class="col brut"><label>Brut (kg)</label><input inputmode="decimal" enterkeyhint="done" value="${w.brut||''}" placeholder="0"></div>
        <div class="col emb"><label>Emballage</label><select>
          <option value="rien">Sans emb.</option><option value="caisse">Caisse</option>
          <option value="film">Film</option><option value="kraft">Kraft</option></select></div>
        <div class="col net"><label>Net (kg)</label><span class="netv" data-wnet>0</span></div>`;
      const br=cols.querySelector('input'),sel=cols.querySelector('select');sel.value=w.emb;
      br.addEventListener('input',ev=>{w.brut=ev.target.value;refresh();});
      sel.addEventListener('change',ev=>{w.emb=ev.target.value;refresh();});
      const acts=document.createElement('div');acts.className='acts';
      const fileIn=document.createElement('input');fileIn.type='file';fileIn.accept='image/*';fileIn.capture='environment';fileIn.style.display='none';
      const galIn=document.createElement('input');galIn.type='file';galIn.accept='image/*';galIn.style.display='none';
      const pbtn=document.createElement('button');pbtn.className='photo-btn';pbtn.innerHTML=w.photo?'📷 Reprendre':'📷 Photo';
      pbtn.onclick=()=>fileIn.click();
      const gbtn=document.createElement('button');gbtn.className='photo-btn';gbtn.innerHTML='🖼 Galerie';
      gbtn.onclick=()=>galIn.click();
      const onPick=async ev=>{const f=ev.target.files[0];if(!f)return;toast('Compression…');
        try{w.photo=await compress(f);draw();refresh();toast('Photo ajoutée');}catch(err){toast('Photo non ajoutée');}};
      fileIn.onchange=onPick;galIn.onchange=onPick;
      acts.append(fileIn,galIn,pbtn,gbtn);
      if(w.photo){const th=document.createElement('img');th.className='photo-thumb';th.src=w.photo;
        th.onclick=()=>openLightbox(r.des+' — pesée '+(i+1),w.photo);acts.append(th);}
      const rm=document.createElement('button');rm.className='photo-btn';
      rm.style.cssText='border-color:#e3c7cd;color:var(--red);background:#fbeef0;margin-left:auto';
      rm.textContent='Retirer';rm.onclick=()=>{e.weighings.splice(i,1);if(!e.weighings.length)e.weighings.push({brut:'',emb:'rien'});draw();refresh();};
      acts.append(rm);
      card.append(cols,acts);wrap.append(card);
    });
    const add=document.createElement('button');add.className='addbtn';add.textContent='+ Ajouter une pesée (autre contenant)';
    add.onclick=()=>{e.weighings.push({brut:'',emb:'rien'});draw(true);refresh();};wrap.append(add);
    if(focusLast)focusLastInput(wrap,'.w-card');
  }
  draw();return wrap;
}
function refresh(){
  let filled=0;
  REFS.forEach(r=>{
    setCounted(r);
    const card=$(`.card[data-code="${r.code}"]`);if(!card)return;
    const ro=card.querySelector('[data-ro]');const t=total(r);const counted=ST.c[r.code].counted;
    if(counted){filled++;ro.className='readout';ro.innerHTML=`<small>TOTAL</small> ${fmt(t)} <small>${r.du||r.u}</small>`;}
    else{ro.className='badge th';ro.textContent='= théorique';}
    if(r.m==='tare'){const nets=card.querySelectorAll('[data-wnet]');
      (ST.c[r.code].weighings||[]).forEach((w,i)=>{if(nets[i]){const nv=tareNet(w,pOf(r));
        nets[i].textContent=fmt(nv);nets[i].style.color=nv<0?'var(--red)':'var(--green)';}});}
    const ph=card.querySelector('[data-photo]');
    if(ph){const has=(r.m==='tare'&&(ST.c[r.code].weighings||[]).some(w=>w.photo))||(ST.c[r.code].blocks||[]).some(bk=>bk.photo);ph.style.display=has?'inline':'none';}
    if(isMulti(r)){const bls=ST.c[r.code].blocks||[];
      card.querySelectorAll('[data-blocktot]').forEach(el=>{const bi=+el.dataset.blocktot;if(bls[bi])el.textContent=fmt(blockTotal(r,bls[bi],bls[bi].cfg||pOf(r)));});
      if(r.m==='tare')bls.forEach((bk,bi)=>{const box=card.querySelector('.blk[data-bi="'+bi+'"]');if(!box)return;const nets=box.querySelectorAll('[data-wnet]');(bk.weighings||[]).forEach((wg,i)=>{if(nets[i]){const nv=tareNet(wg,bk.cfg);nets[i].textContent=fmt(nv);nets[i].style.color=nv<0?'var(--red)':'var(--green)';}});});}
    const tEl=card.querySelector('[data-tally]');if(tEl){const s=subInfo(r);tEl.innerHTML=s;tEl.style.display=(s&&counted)?'flex':'none';}
  });
  $('#filled').textContent=filled;
  if(typeof CATS!=='undefined')CATS.forEach(cat=>{
    const ri=ratioInfo(REFS.filter(x=>cat.subs.includes(x.g)));
    const ce=document.querySelector(`[data-catr="${cat.id}"]`);
    if(ce){ce.textContent=ri.done+'/'+ri.tot;ce.className='ratio '+ri.cls;}
    cat.subs.forEach(gid=>{const refs=REFS.filter(x=>x.g===gid);if(!refs.length)return;
      const si=ratioInfo(refs);const se=document.querySelector(`[data-subr="${gid}"]`);
      if(se){se.textContent=si.done+'/'+si.tot;se.className='ratio sm '+si.cls;}});
  });
  ST.date=$('#date').value;saveCounts();
}

/* ====== SAUVEGARDE : config (localStorage) + inventaires (IndexedDB) ====== */
function saveCfg(){const o={};REFS.forEach(r=>o[r.code]={...r.p});try{localStorage.setItem('inv_cfg',JSON.stringify(o));}catch(e){}}
function loadCfg(){try{return JSON.parse(localStorage.getItem('inv_cfg'))||{};}catch(e){return {};}}

let _db=null;
function idb(){return new Promise((res,rej)=>{if(_db)return res(_db);
  const rq=indexedDB.open('inv_db',1);
  rq.onupgradeneeded=()=>{const db=rq.result;if(!db.objectStoreNames.contains('inv'))db.createObjectStore('inv',{keyPath:'id'});};
  rq.onsuccess=()=>{_db=rq.result;res(_db);};rq.onerror=()=>rej(rq.error);});}
function idbPut(rec,countChange){if(countChange===undefined)countChange=true;return idb().then(db=>new Promise((res,rej)=>{
  const t=db.transaction('inv','readwrite');t.objectStore('inv').put(rec);t.oncomplete=function(){if(countChange)try{var c=parseInt(localStorage.getItem('lep_changes_since_backup'))||0;localStorage.setItem('lep_changes_since_backup',String(c+1));}catch(e){}res();};t.onerror=()=>rej(t.error);}));}
function idbPutMany(recs){return idb().then(db=>new Promise((res,rej)=>{
  const t=db.transaction('inv','readwrite'),store=t.objectStore('inv');
  recs.forEach(rec=>store.put(rec));
  t.oncomplete=()=>res();
  t.onabort=t.onerror=()=>rej(t.error||new Error('Transaction import annulee'));
}));}
function idbGet(id){return idb().then(db=>new Promise((res,rej)=>{
  const rq=db.transaction('inv','readonly').objectStore('inv').get(id);rq.onsuccess=()=>res(rq.result);rq.onerror=()=>rej(rq.error);}));}
function idbAll(){return idb().then(db=>new Promise((res,rej)=>{
  const rq=db.transaction('inv','readonly').objectStore('inv').getAll();rq.onsuccess=()=>res(rq.result||[]);rq.onerror=()=>rej(rq.error);}));}
function idbDel(id){return idb().then(db=>new Promise((res,rej)=>{
  const t=db.transaction('inv','readwrite');t.objectStore('inv').delete(id);t.oncomplete=res;t.onerror=()=>rej(t.error);}));}
function localRecordKind(r){
  const id=String((r&&r.id)||'');
  if(id.indexOf('sortie_')===0)return 'sortie';
  if(id.indexOf('entree_')===0)return 'entree';
  if(id.indexOf('prod_')===0)return 'prod';
  if(id.indexOf('batch_')===0)return 'quality';
  if(r&&r.st&&id!=='current'&&id.indexOf('fragsess_')!==0)return 'inv';
  return '';
}
function localRecordSig(r){
  if(r&&r._sig)return r._sig;
  const k=localRecordKind(r);
  if(k==='sortie'||k==='entree')return localSig(k,{date:r.date||'',ref:r.ref||'',finis:r.finis||[],mp:r.mp||[],note:r.note||''});
  if(k==='prod')return localSig('prod',{date:r.date||'',blocks:typeof migrateProdRec==='function'?migrateProdRec(r):(r.blocks||[]),note:r.note||''});
  if(k==='quality')return localSig('quality',{informations:r.informations||{},matieresPremieres:r.matieresPremieres||[],melanges:r.melanges||[],visas:r.visas||{}});
  if(k==='inv')return localSig('inv',{date:r.date||'',detail:r.detail||null,st:r.st&&r.st.c?r.st.c:null});
  return '';
}
async function findLocalDuplicate(kind,sig,selfId){
  try{const all=await idbAll();return all.find(r=>r&&r.id!==selfId&&localRecordKind(r)===kind&&localRecordSig(r)===sig)||null;}catch(e){return null;}
}

let _saveTimer=null;
function saveCounts(){if(RO)return;clearTimeout(_saveTimer);
  _saveTimer=setTimeout(()=>{
    if(FRAG){fragPersist();idbPut(FRAG,false).catch(()=>{});}
    else idbPut({id:'current',date:ST.date,agent:ST.agent,savedAt:Date.now(),st:ST},false).catch(()=>{});
  },400);}
function snapshot(){const s=JSON.parse(JSON.stringify(ST));if(!s.cfg){s.cfg={};REFS.forEach(r=>{s.cfg[r.code]={...r.p};});}return s;}
async function archiveCurrent(){ // une fiche par inventaire (mise à jour, pas de doublon)
  if(FRAG)return; // en mode fragmenté, ST est un fragment : jamais archivé seul
  const filled=REFS.filter(r=>ST.c[r.code].counted).length;if(!filled)return;
  if(!ST.id)ST.id='inv_'+Date.now();
  let bilan=null,detail=null;try{const b=buildBilan();bilan={total:Math.round(b.total*1000)/1000,nbAlertes:b.alertes.length,nbCounted:b.rows.filter(r=>r.counted).length};detail={};b.rows.forEach(r=>{if(r.counted)detail[r.code]={n:r.nom,t:r.theo,p:r.phys,e:r.ecart};});}catch(e){}
  const snap=snapshot();
  // Ne jamais écraser un inventaire validé : si l'id courant pointe sur un verrouillé, on archive sous un nouvel id
  try{const ex=await idbGet(ST.id);if(ex&&ex.locked)ST.id='inv_'+Date.now();}catch(e){}
  const rec={id:ST.id,date:ST.date,agent:ST.agent,savedAt:Date.now(),filled,bilan:bilan,detail:detail,st:snap};
  rec._sig=localSig('inv',{date:rec.date,detail:rec.detail||null,st:rec.st&&rec.st.c?rec.st.c:null});
  const dup=await findLocalDuplicate('inv',rec._sig,rec.id);
  if(dup){ST.id=dup.id;return dup;}
  await idbPut(rec);
  return rec;
}

/* ====== PHOTOS ====== */
function compress(file){return new Promise((res,rej)=>{
  const img=new Image();const url=URL.createObjectURL(file);
  img.onload=()=>{URL.revokeObjectURL(url);
    let{width:w,height:h}=img;const max=1100;if(w>max||h>max){if(w>=h){h=Math.round(h*max/w);w=max;}else{w=Math.round(w*max/h);h=max;}}
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.getContext('2d').drawImage(img,0,0,w,h);
    res(cv.toDataURL('image/jpeg',0.6));};
  img.onerror=()=>{URL.revokeObjectURL(url);rej();};img.src=url;});}
function openLightbox(title,src){$('#lbTitle').textContent=title;$('#lbImg').src=src;$('#lightbox').showModal();}
function allPhotos(){const out=[];REFS.filter(r=>r.m==='tare').forEach(r=>{
  (ST.c[r.code].weighings||[]).forEach((w,i)=>{if(w.photo)out.push({des:r.des,idx:i+1,photo:w.photo,
    net:fmt(tareNet(w,pOf(r))),emb:w.emb});});});
  REFS.forEach(r=>{(ST.c[r.code].blocks||[]).forEach((bk,bi)=>{if(bk.photo)out.push({
    des:r.des+' — '+(isFini(r)?'production ':'lot ')+(bi+1)+(bk.date?' ('+bk.date+')':''),idx:bi+1,photo:bk.photo,net:fmt(blockTotal(r,bk,bk.cfg||pOf(r))),emb:''});});});
  return out;}

/* ====== EXPORT ====== */
function nonComptes(){return REFS.filter(r=>!ST.c[r.code].counted);}
function buildSummary(){
  const L=['INVENTAIRE PHYSIQUE — PRODUCTION LEP',
    'Compteur : '+(ST.agent||'—')+'   Date : '+(ST.date||'—'),'—'.repeat(36)];
  GROUPS.forEach(([gid,title])=>{
    const refs=REFS.filter(r=>r.g===gid&&ST.c[r.code].counted);if(!refs.length)return;
    L.push(title.toUpperCase());
    refs.forEach(r=>{let ex='';if(r.m==='tare'){const n=(ST.c[r.code].weighings||[]).filter(w=>String(w.brut).trim()).length;if(n>1)ex=`  (${n} pesées)`;}
      L.push('  '+r.des+' : '+fmt(total(r))+' '+r.u+ex);});
  });
  const nc=nonComptes();
  if(nc.length){L.push('—'.repeat(36),'NON COMPTÉS (= théorique du logiciel) :');nc.forEach(r=>L.push('  '+r.des));}
  const ph=allPhotos().length;if(ph)L.push('—'.repeat(36),ph+' photo(s) jointe(s) — voir le rapport photos.');
  return L.join('\n');
}
function buildJSON(){
  const o={meta:{agent:ST.agent,date:ST.date,exporte:new Date().toISOString()},articles:[]};
  REFS.forEach(r=>{
    const a={code:r.code,designation:r.des,unite:r.u,
      compte:ST.c[r.code].counted, physique:ST.c[r.code].counted?round2(total(r)):null};
    if(r.m==='tare'){a.pesees=(ST.c[r.code].weighings||[]).filter(w=>String(w.brut).trim())
      .map(w=>({brut:num(w.brut),emballage:w.emb,net:round2(tareNet(w,pOf(r)))}));}
    o.articles.push(a);
  });
  o.etat=snapshot();
  return JSON.stringify(o,null,2);
}
function importInventory(text){
  let o;try{o=JSON.parse(text);}catch(e){toast('Fichier illisible');return;}
  const etat=(o&&o.etat)?o.etat:o;
  if(!etat||!etat.c){toast('Format non reconnu');return;}
  if(!etat.id)etat.id='imp_'+Date.now();
  etat.sessionStart=Date.now();   // inventaire reçu = base ; rien n'est « frais » tant qu'on ne recompte pas
  // Valeurs calculées par le compteur = autoritaires (évite tout recalcul avec d'autres réglages)
  if(o&&Array.isArray(o.articles)){
    o.articles.forEach(a=>{const e=etat.c[a.code];if(!e)return;
      if(a.compte&&a.physique!=null)e._phys=a.physique;
      if(Array.isArray(a.pesees)&&Array.isArray(e.weighings)){
        let j=0;e.weighings.forEach(w=>{if(String(w.brut).trim()!==''){if(a.pesees[j]&&a.pesees[j].net!=null)w.net=a.pesees[j].net;j++;}});
      }
    });
  }
  // Réglages : embarqués (nouveaux exports) sinon reconstruits depuis les pesées (tare = brut - net)
  if(o&&o.cfg){etat.cfg=JSON.parse(JSON.stringify(o.cfg));}
  else if(o&&Array.isArray(o.articles)){
    etat.cfg=etat.cfg||{};
    o.articles.forEach(a=>{
      if(!Array.isArray(a.pesees)||!a.pesees.length)return;
      const pr=etat.cfg[a.code]||{};
      a.pesees.forEach(w=>{if(w.net==null||w.brut==null)return;const tare=w.brut-w.net;
        if(w.emballage==='caisse')pr.caisse=round2(tare);
        else if(w.emballage==='film')pr.film=Math.round(tare*1000);
        else if(w.emballage==='kraft')pr.kraft=Math.round(tare*1000);});
      etat.cfg[a.code]=pr;
    });
  }
  const filled=Object.values(etat.c).filter(x=>x&&x.counted).length;
  // Un inventaire reçu ne doit jamais écraser un inventaire validé local : nouvel id en cas de collision
  idbGet(etat.id).then(function(ex){
    if(ex&&ex.locked)etat.id='imp_'+Date.now();
    return idbPut({id:etat.id,date:etat.date,agent:etat.agent,savedAt:Date.now(),filled,st:etat});
  }).then(function(){
    $('#histDlg').close();openArchive({st:etat});toast('Inventaire importé');
  });
}
function slug(s){return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function exportName(){const n=slug(ST.agent);return 'inventaire_'+(ST.date||'sansdate')+(n?'_'+n:'')+'.txt';}
function buildSummaryHTML(){
  let h='';
  GROUPS.forEach(([gid,title])=>{
    const refs=REFS.filter(r=>r.g===gid&&ST.c[r.code].counted);if(!refs.length)return;
    h+='<h4>'+title+'</h4>';
    refs.forEach(r=>{h+='<div class="r"><span>'+r.des+'</span><b>'+fmt(total(r))+' '+(r.du||r.u)+'</b></div>';});
  });
  const nc=nonComptes();
  if(nc.length){h+='<h4>Non comptés (= théorique)</h4><div class="nc">'+nc.map(r=>r.des).join(' · ')+'</div>';}
  return h||'<div class="nc">Aucun article compté.</div>';
}
function buildPhotoReport(){
  const ph=allPhotos();
  const cards=ph.map(p=>`<div style="break-inside:avoid;border:1px solid #ddd;border-radius:10px;padding:10px;margin:0 0 14px">
    <div style="font-weight:700;font-size:15px">${p.des}</div>
    <div style="color:#666;font-size:13px;margin:2px 0 8px">Pesée ${p.idx} · net ${p.net} kg · ${p.emb}</div>
    <img src="${p.photo}" style="max-width:100%;border-radius:6px"></div>`).join('');
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Photos inventaire ${ST.date}</title></head>
    <body style="font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:18px">
    <h1 style="font-size:20px">Photos d'inventaire — Production LEP</h1>
    <p style="color:#555">Compteur : ${ST.agent||'—'} · Date : ${ST.date||'—'} · ${ph.length} photo(s)</p>
    ${cards||'<p>Aucune photo.</p>'}</body></html>`;
}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1600);}
function download(name,content,type){const b=new Blob([content],{type});const a=document.createElement('a');
  a.href=URL.createObjectURL(b);a.download=name;a.click();}

/* ====== HISTORIQUE ====== */
function collectLS(){const o={};try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k==='inv_cfg'||k.indexOf('lep_')===0)o[k]=localStorage.getItem(k);}}catch(e){}return o;}
function shareOrDownload(filename,text,title){
  try{const blob=new Blob([text],{type:'text/plain'});const file=new File([blob],filename,{type:'text/plain'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){return navigator.share({files:[file],title:title||filename});}}catch(e){}
  const blob=new Blob([text],{type:'text/plain'});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  return Promise.resolve();
}
function _resetBackupCounters(){var bc=parseInt(localStorage.getItem('lep_backup_count'))||0;localStorage.setItem('lep_changes_since_backup','0');localStorage.setItem('lep_last_backup_ts',String(Date.now()));localStorage.setItem('lep_backup_count',String(bc+1));}
async function exportAll(){
  try{toast('Préparation de la sauvegarde…');const recs=await idbAll();
    const data={type:'lep-backup',v:1,ts:Date.now(),ls:collectLS(),idb:recs};
    var bc=parseInt(localStorage.getItem('lep_backup_count'))||0;var suffix=(bc%2===0)?'A':'B';var fn='sauvegarde_LEP_'+suffix+'.txt';
    await shareOrDownload(fn,JSON.stringify(data),'Sauvegarde complète LEP');
    _resetBackupCounters();
  }catch(e){toast('Échec de la sauvegarde');}
}
async function exportAllDownload(){
  try{toast('Preparation...');var recs=await idbAll();
    var data={type:'lep-backup',v:1,ts:Date.now(),ls:collectLS(),idb:recs};
    var bc=parseInt(localStorage.getItem('lep_backup_count'))||0;var suffix=(bc%2===0)?'A':'B';var fn='sauvegarde_LEP_'+suffix+'.txt';
    var blob=new Blob([JSON.stringify(data)],{type:'text/plain'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=url;a.download=fn;document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},1500);
    _resetBackupCounters();
    toast('Fichier telecharge : '+fn);
  }catch(e){toast('Echec');}
}
function stripPhotos(o){
  if(Array.isArray(o))return o.map(stripPhotos);
  if(o&&typeof o==='object'){const n={};for(const k in o){if(k==='photo'||k==='photos')continue;n[k]=stripPhotos(o[k]);}return n;}
  return o;
}
async function exportLight(){
  try{toast('Préparation de la sauvegarde légère…');const recs=(await idbAll()).map(stripPhotos);
    const data={type:'lep-backup',v:1,light:true,ts:Date.now(),ls:collectLS(),idb:recs};
    var bc=parseInt(localStorage.getItem('lep_backup_count'))||0;var suffix=(bc%2===0)?'A':'B';var fn='sauvegarde_legere_LEP_'+suffix+'.txt';
    await shareOrDownload(fn,JSON.stringify(data),'Sauvegarde légère LEP');
    _resetBackupCounters();
  }catch(e){toast('Échec de la sauvegarde');}
}
async function importAll(text){
  let data;try{data=JSON.parse(text);}catch(e){alert('Fichier illisible.');return;}
  if(!data||data.type!=='lep-backup'){alert('Ce fichier n\u2019est pas une sauvegarde complète (utilise « Importer un inventaire reçu » pour un inventaire seul).');return;}
  // Fusion intelligente : charger ids locaux, verifier verrous, compter ajouts/sauts
  const localRecs=await idbAll();
  const localIds=new Set(localRecs.map(r=>r.id).filter(id=>id));
  const lockedIds=new Set();
  localRecs.forEach(r=>{if(r&&r.locked)lockedIds.add(r.id);});
  const nLocked=lockedIds.size;
  let toAdd=0, skippedExisting=0, skippedLocked=0, skippedDuplicate=0;
  const toImport=[], importIds=new Set();
  if(Array.isArray(data.idb))for(const rec of data.idb){
    if(!rec||!rec.id)continue;
    if(lockedIds.has(rec.id)){skippedLocked++;continue;}
    if(localIds.has(rec.id)){skippedExisting++;continue;}
    if(importIds.has(rec.id)){skippedDuplicate++;continue;}
    importIds.add(rec.id);toImport.push(rec);
    toAdd++;
  }
  const msg="Importer cette sauvegarde ?\n\nAjouts : "+toAdd+"\nExistants (non touches) : "+skippedExisting+(skippedLocked?("\nValides locaux (proteges) : "+skippedLocked):"")+(skippedDuplicate?("\nDoublons dans le fichier : "+skippedDuplicate):"");
  if(!confirm(msg))return;
  const protectedKeys=new Set(['lep_usr','lep_changes_since_backup','lep_backup_count','lep_last_backup_ts']);
  const lsUpdates=[];
  if(data.ls)Object.keys(data.ls).forEach(k=>{if(!protectedKeys.has(k))lsUpdates.push([k,data.ls[k]]);});
  const allLsUpdates=lsUpdates.concat([['lep_changes_since_backup','0']]);
  const oldLs=new Map();
  allLsUpdates.forEach(pair=>{
    const k=pair[0];
    if(!oldLs.has(k))oldLs.set(k,localStorage.getItem(k));
  });
  function rollbackLS(){
    oldLs.forEach((v,k)=>{try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch(e){}});
  }
  try{
    allLsUpdates.forEach(pair=>localStorage.setItem(pair[0],pair[1]));
    await idbPutMany(toImport);
    alert("Import : "+toImport.length+" ajoutee(s).\nRechargement en cours...");location.reload();
  }catch(e){rollbackLS();alert("Echec de l’import : aucune donnee n'a ete modifiee.");}
}
async function openHistory(){
  const dlg=$('#histDlg');
  const list=$('#histList');list.innerHTML='Chargement…';
  let recs=(await idbAll()).filter(r=>r.id!=='current'&&r.id!==ST.id&&String(r.id).indexOf('prod_')!==0&&String(r.id).indexOf('sortie_')!==0&&String(r.id).indexOf('entree_')!==0&&String(r.id).indexOf('fragsess_')!==0&&String(r.id).indexOf('batch_')!==0).sort((a,b)=>b.savedAt-a.savedAt);
  list.innerHTML='';
  const bk=document.createElement('div');bk.style.cssText='border:1px solid #d4e3f3;border-radius:10px;padding:10px;margin-bottom:12px;background:#f6f9fd';
  bk.innerHTML='<div style="font-weight:700;font-size:13px;margin-bottom:8px">💾 Sauvegarde complète <span style="font-weight:400;color:#6a7280">(réglages, machines, référentiels, inventaires, photos)</span></div>';
  const expB=document.createElement('button');expB.style.cssText='width:100%;margin-bottom:8px;padding:10px;border-radius:8px;border:1.5px solid var(--steel);color:var(--steel-d);background:#fff;font-weight:700;font-size:13px';expB.textContent='Sauvegarde locale complete';expB.onclick=()=>exportAll();
  const expLB=document.createElement('button');expLB.style.cssText='width:100%;margin-bottom:8px;padding:10px;border-radius:8px;border:1.5px solid var(--line);background:#fff;font-weight:600;font-size:13px';expLB.textContent='Secours local sans photos';expLB.onclick=()=>exportLight();
  const fiB=document.createElement('input');fiB.type='file';fiB.accept='.txt,.json,text/plain';fiB.style.display='none';fiB.onchange=function(e){const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=function(){importAll(rd.result);};rd.readAsText(f);};
  const impB=document.createElement('button');impB.style.cssText='width:100%;padding:10px;border-radius:8px;border:1.5px solid var(--line);background:#fff;font-weight:600;font-size:13px';impB.textContent='Restaurer une sauvegarde locale';impB.onclick=function(){fiB.click();};
  bk.append(expB,expLB,fiB,impB);list.append(bk);
  if(dlg&&!dlg.open)dlg.showModal();
  const serverHost=document.createElement('div');list.append(serverHost);
  sipsRecords('inventory',{timeoutMs:1200}).then(serverRows=>{
    if(dlg&&!dlg.open)return;
    if(serverRows.length){
      const h=document.createElement('div');h.style.cssText='font-size:12px;font-weight:800;color:var(--green);margin:0 0 6px;text-transform:uppercase';
      h.textContent='Valides serveur';serverHost.append(h);
      serverRows.sort((a,b)=>String(b.validatedAt||'').localeCompare(String(a.validatedAt||''))).forEach(row=>{
        const rec=row.payload||{};
        const it=document.createElement('div');it.className='hist-item locked';
        const when=row.validatedAt||row.createdAt||rec.submittedAt||'';
        const bilan=rec.bilan||{};
        it.innerHTML='<div class="info"><b>'+esc(rec.date||'—')+'</b><span>OFFICIEL serveur - '+esc(rec.agent||'—')+' - '+(rec.filled||0)+' art. - '+(bilan.nbAlertes||0)+' alerte(s) - '+(when?new Date(when).toLocaleDateString('fr-FR'):'')+'</span></div>';
        const open=document.createElement('button');open.textContent='Voir';open.onclick=()=>{if(!rec.st){toast('Inventaire serveur sans detail consultable');return;}histDlg.close();openArchive({st:rec.st,date:rec.date,agent:rec.agent,filled:rec.filled,savedAt:Date.parse(when)||Date.now(),locked:true,server:true});};
        it.append(open);serverHost.append(it);
      });
    }
  });
  const fi=document.createElement('input');fi.type='file';fi.accept='.txt,.json,text/plain';fi.style.display='none';
  fi.onchange=function(e){const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=function(){importInventory(rd.result);};rd.readAsText(f);};
  const imp=document.createElement('button');imp.style.cssText='width:100%;margin-bottom:10px;padding:10px;border-radius:8px;border:1.5px solid #c5e4d2;color:var(--green);background:#e7f3ec;font-weight:700;font-size:14px';
  imp.textContent='Importer un inventaire reçu (.txt)';imp.onclick=function(){fi.click();};
  list.append(fi,imp);
  if(!recs.length){
    const p=document.createElement('p');p.style.cssText='color:#6a7280;font-size:13px;margin:4px 0 0;line-height:1.5';
    p.textContent='Aucun inventaire local archive pour l\u2019instant. Importe un fichier recu avec le bouton ci-dessus, ou une fiche sera creee quand tu soumets / demarres un inventaire.';
    list.append(p);
  }
  else{
    const localH=document.createElement('div');localH.style.cssText='font-size:12px;font-weight:800;color:var(--steel-d);margin:0 0 6px;text-transform:uppercase';
    localH.textContent='Historique local';list.append(localH);
    const clear=document.createElement('button');clear.className='del';clear.style.cssText='width:100%;margin-bottom:10px;padding:9px;border-radius:8px';
    clear.textContent='Vider tout l\'historique';
    clear.onclick=async()=>{
      const lk=recs.filter(r=>r.locked).length;
      if(!confirm('Effacer les inventaires archivés ?'+(lk?('\n\n'+lk+' inventaire(s) VALIDÉ(S) seront conservés (protégés).'):'')))return;
      for(const r of recs){if(r.locked)continue;await idbDel(r.id);}openHistory();
    };
    list.append(clear);
    recs.forEach(rec=>{
      const ph=(rec.st&&rec.st.c)?Object.values(rec.st.c).reduce((s,e)=>s+((e.weighings||[]).filter(w=>w.photo).length),0):0;
      const d=new Date(rec.savedAt);
      const it=document.createElement('div');it.className='hist-item'+(rec.locked?' locked':'');
      const fragTag=rec.frag?`<span class="frag-tag">🧩 fusion ${(rec.frag.agents||[]).length} compteurs</span>`:'';
      const lockTag=rec.locked?`<span class="lock-tag">🔒 validé</span>`:'';
      it.innerHTML=`<div class="info"><b>${rec.date||'—'}</b>${lockTag}${fragTag}
        <span>${rec.agent||'—'} · ${rec.filled||0} art. · ${ph} photo(s) · ${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span></div>`;
      const open=document.createElement('button');open.textContent='Voir';open.onclick=()=>{histDlg.close();openArchive(rec);};
      it.append(open);
      if(rec.locked){
        const unlock=document.createElement('button');unlock.textContent='Déverrouiller';
        unlock.onclick=async()=>{if(confirm('Déverrouiller cet inventaire validé pour le rendre de nouveau modifiable ?')){rec.locked=false;delete rec.validatedAt;await idbPut(rec);openHistory();toast('Inventaire déverrouillé');}};
        it.append(unlock);
      }else{
        const rep=document.createElement('button');rep.textContent='Reprendre';rep.onclick=()=>{histDlg.close();reprendreArchive(rec);};
        const val=document.createElement('button');val.className='valid';val.textContent='🔒 Valider';
        val.onclick=async()=>{if(confirm('Valider et VERROUILLER cet inventaire ?\n\nIl ne pourra plus être modifié (mais reste déverrouillable) et sera protégé contre l’écrasement lors d’une restauration de sauvegarde.')){rec.locked=true;rec.validatedAt=Date.now();await idbPut(rec);openHistory();toast('Inventaire validé 🔒');}};
        it.append(rep,val);
      }
      const del=document.createElement('button');del.className='del';del.textContent='Suppr.';
      del.onclick=async()=>{
        const msg=rec.locked?'⚠ Cet inventaire est VALIDÉ.\n\nLe supprimer définitivement ? Cette action est irréversible.':'Supprimer cet inventaire ?';
        if(confirm(msg)){await idbDel(rec.id);openHistory();}
      };
      it.append(del);list.append(it);
    });
  }
}
function reprendreArchive(rec){
  if(rec&&rec.locked){toast('Inventaire validé (verrouillé) — déverrouille-le d’abord pour le modifier.');return;}
  if(FRAG)fragExitState();
  archiveCurrent();
  RO=false;document.body.classList.remove('ro');$('#roBanner').style.display='none';
  ST=JSON.parse(JSON.stringify(rec.st));mergeAndMigrate();
  ST.sessionStart=Date.now();   // base chargée : nouvelle session de recomptage (seuls les articles recomptés seront « frais »)
  // On garde les valeurs ET les réglages du compteur (cfg embarqué/reconstruit) : pas de recalcul
  // aveugle. Le recalcul d'un article ne se fait que si on en modifie une saisie (voir #app input).
  $('#agent').value=ST.agent;$('#date').value=ST.date;saveCounts();render();window.scrollTo(0,0);
  toast('Inventaire ouvert — modifiable et renvoyable');
}
function openArchive(rec){
  if(FRAG)fragExitState();
  RO=true;ST=JSON.parse(JSON.stringify(rec.st));mergeAndMigrate();
  $('#agent').value=ST.agent;$('#date').value=ST.date;
  document.body.classList.add('ro');
  let txt='Consultation — inventaire du '+(ST.date||'?')+' (lecture seule)';
  if(rec.frag){const fr=rec.frag;
    txt+=' · 🧩 fusion de '+(fr.agents||[]).map(n=>{const f=(fr.fragments||[]).find(x=>x.agent===n)||{};return n+' ('+(f.count||0)+')';}).join(', ');}
  $('#roText').textContent=txt;
  $('#roBanner').style.display='flex';
  render();window.scrollTo(0,0);
}
async function closeArchive(){
  RO=false;document.body.classList.remove('ro');$('#roBanner').style.display='none';
  const cur=await idbGet('current');ST=(cur&&cur.st)||freshCounts();mergeAndMigrate();
  $('#agent').value=ST.agent;$('#date').value=ST.date;render();
}

$('#date').addEventListener('input',refresh);
// Modifier une saisie d'un article importé/archivé : on lève le "gel" pour recalculer cet article
function unfreezeCard(code){const en=ST.c[code];if(!en)return false;let ch=false;
  if(en._phys!=null){delete en._phys;ch=true;}
  if(Array.isArray(en.weighings))en.weighings.forEach(w=>{if(w&&w.net!=null){delete w.net;ch=true;}});
  return ch;}
['input','change'].forEach(ev=>document.addEventListener(ev,e=>{
  if(RO||!e.target)return;
  const card=e.target.closest&&e.target.closest('.card[data-code]');
  if(!card)return;
  // Horodate l'article réellement édité (sert à distinguer un recomptage frais d'une valeur héritée lors de la fusion)
  if(ST.c[card.dataset.code])ST.c[card.dataset.code]._ts=Date.now();
  if(unfreezeCard(card.dataset.code))refresh();
}));
$('#collapseAll').onclick=()=>document.querySelectorAll('.sub.open,.card.open').forEach(c=>c.classList.remove('open'));
$('#toolsToggle').onclick=()=>{const ct=$('#comptageTools');const collapsed=ct.classList.toggle('tools-collapsed');
  const t=$('#toolsToggle');t.setAttribute('aria-expanded',String(!collapsed));
  t.textContent=collapsed?'▾ Afficher les boutons':'▴ Masquer les boutons';};
// Touche du clavier (coche) = valider et fermer le champ
document.addEventListener('keydown',e=>{if(e.key!=='Enter'||!e.target||e.target.tagName!=='INPUT')return;
  e.preventDefault();
  const cont=e.target.closest('.ent-chip,.w-card,.cfgrow,.cells');
  if(cont){const fs=[...cont.querySelectorAll('input,select')];const idx=fs.indexOf(e.target);
    if(idx>-1&&idx<fs.length-1){fs[idx+1].focus();return;}}
  e.target.blur();});
// Remonter le champ sélectionné au-dessus du clavier
document.addEventListener('focusin',e=>{const t=e.target;if(!t)return;
  if(t.tagName==='INPUT'&&t.type!=='date'){try{t.select();}catch(_){}}
  if(t.tagName==='INPUT'||t.tagName==='SELECT'){
  setTimeout(()=>{try{t.scrollIntoView({block:'center',behavior:'smooth'});}catch(_){}},250);}});
function bindClick(sel,fn){const el=$(sel);if(el)el.onclick=fn;}
function bindChange(sel,fn){const el=$(sel);if(el)el.onchange=fn;}
bindClick('#histBtn',openHistory);
bindClick('#roClose',closeArchive);
bindClick('#fragBtn',()=>openFragDlg());
bindClick('#fragExportMine',()=>shareFragment());
bindClick('#fragImportFiles',()=>{const f=$('#fragFileIn');if(f)f.click();});
bindChange('#fragFileIn',e=>{const fs=[...e.target.files];fs.forEach(f=>{const rd=new FileReader();rd.onload=()=>fragAddFile(rd.result);rd.readAsText(f);});e.target.value='';});
bindClick('#fragMergeFiles',()=>fragMergeFiles());
bindClick('#newInv',async()=>{
  const keep=!confirm('Nouvel inventaire.\n\nOK = vider les comptages (les réglages et l\'historique sont gardés).\nAnnuler = repartir des derniers chiffres.');
  await archiveCurrent();
  if(!keep){REFS.forEach(r=>ST.c[r.code]=blankEntry(r));ST.agent=(typeof USR!=='undefined'&&USR.nom)||'';}
  ST.id='inv_'+Date.now();ST.sessionStart=Date.now();   // nouvelle session de comptage
  ST.date=new Date().toISOString().slice(0,10);$('#date').value=ST.date;$('#agent').value=ST.agent;
  saveCounts();render();toast(keep?'Inventaire archivé · base conservée':'Inventaire archivé · comptages vidés');
});
/* Repartir du DERNIER inventaire validé sans passer par l'Historique :
   copie ses chiffres dans un comptage modifiable daté d'aujourd'hui,
   l'inventaire validé d'origine reste intact et verrouillé. */
bindClick('#resumeValidated',async()=>{
  if(RO){toast('Mode consultation — non modifiable');return;}
  if(FRAG){toast('Quitte d’abord le mode fragmenté');return;}
  let all=[];try{all=await idbAll();}catch(e){}
  const validated=all.filter(r=>r&&r.locked&&r.st);
  if(!validated.length){toast('Aucun inventaire validé à reprendre');return;}
  // Dernier validé à la date du comptage en cours (ou avant) ; sinon le plus récent.
  const ref=ST.date||'';
  let pool=ref?validated.filter(r=>(r.date||'')<=ref):[];
  if(!pool.length)pool=validated;
  pool.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||((b.validatedAt||0)-(a.validatedAt||0)));
  const rec=pool[0];
  if(!confirm('Reprendre le dernier inventaire validé ('+(rec.date||'—')+(rec.agent?(' · '+rec.agent):'')+') ?\n\nSes chiffres sont copiés dans un nouveau comptage modifiable daté d’aujourd’hui. L’inventaire validé d’origine reste intact et verrouillé.'))return;
  await archiveCurrent();
  RO=false;document.body.classList.remove('ro');$('#roBanner').style.display='none';
  ST=InventoryDomain.createInventoryFromLastValidated(rec.st);
  mergeAndMigrate();
  $('#agent').value=ST.agent||'';$('#date').value=ST.date;
  saveCounts();render();window.scrollTo(0,0);
  toast('Repris du dernier inventaire validé');
});
bindClick('#export',()=>{
  const nc=nonComptes();
  if(nc.length){const ul=$('#ncList');ul.innerHTML='';nc.forEach(r=>{const li=document.createElement('li');li.textContent=r.des;ul.append(li);});$('#warn').showModal();}
  else showSummary();
});
bindClick('#confirmExport',()=>{$('#warn').close();showSummary();});
function showSummary(){$('#out').innerHTML=buildSummaryHTML();$('#dlg').showModal();}
function inventoryServerPayload(){
  const filled=REFS.filter(r=>ST.c[r.code].counted).length;
  let bilan=null,detail=null;try{const b=buildBilan();bilan={total:Math.round(b.total*1000)/1000,nbAlertes:b.alertes.length,nbCounted:b.rows.filter(r=>r.counted).length};detail={};b.rows.forEach(r=>{if(r.counted)detail[r.code]={n:r.nom,t:r.theo,p:r.phys,e:r.ecart};});}catch(e){}
  return {kind:'inventory',date:ST.date||todayStr(),agent:ST.agent||'',filled:filled,bilan:bilan,detail:detail,st:snapshot(),submittedAt:new Date().toISOString()};
}
async function submitInventoryServer(){
  if(RO){toast('Mode consultation — non modifiable');return;}
  if(FRAG){toast('Quitte d’abord le mode fragmenté');return;}
  const filled=REFS.filter(r=>ST.c[r.code].counted).length;
  if(!filled){toast('Aucun article compté à soumettre');return;}
  await archiveCurrent();
  await sipsSubmit('inventory',inventoryServerPayload(),'Inventaire '+(ST.date||todayStr()));
}
async function shareJSON(){
  archiveCurrent();
  const name=exportName(),content=buildJSON();
  let file=null;try{file=new File([content],name,{type:'text/plain'});}catch(_){}
  try{
    if(file && navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      await navigator.share({files:[file],title:'Inventaire physique',
        text:'Inventaire '+(ST.date||'')+(ST.agent?(' \u2014 '+ST.agent):'')});
      toast('Partage ouvert');return;
    }
  }catch(err){if(err&&err.name==='AbortError')return;}
  download(name,content,'text/plain');toast('Partage indisponible ici \u2014 fichier enregistré');
}
bindClick('#submitInvBtn',submitInventoryServer);
bindClick('#shareBtn',shareJSON);
$('#dlBtn').onclick=()=>{archiveCurrent();download(exportName(),buildJSON(),'text/plain');toast('Fichier enregistré');};
bindClick('#validBtn',validateCurrent);
/* Valide et verrouille l'inventaire EN COURS (l'archive + locked), puis ouvre un comptage vierge */
async function validateCurrent(){
  if(RO){toast('Mode consultation — non modifiable');return;}
  if(FRAG){toast('Quitte d’abord le mode fragmenté');return;}
  const filled=REFS.filter(r=>ST.c[r.code].counted).length;
  if(!filled){toast('Aucun article compté à valider');return;}
  if(!confirm('Valider et VERROUILLER cet inventaire ('+(ST.date||'—')+(ST.agent?(' · '+ST.agent):'')+') ?\n\nIl devient la référence (Bilan, Capacité, Plan), figé en lecture seule (déverrouillable depuis l’Historique) et protégé contre l’écrasement. Un nouveau comptage vierge sera ouvert.'))return;
  if(!ST.id)ST.id='inv_'+Date.now();
  try{const ex=await idbGet(ST.id);if(ex&&ex.locked)ST.id='inv_'+Date.now();}catch(e){}
  let bilan=null,detail=null;try{const b=buildBilan();bilan={total:Math.round(b.total*1000)/1000,nbAlertes:b.alertes.length,nbCounted:b.rows.filter(r=>r.counted).length};detail={};b.rows.forEach(r=>{if(r.counted)detail[r.code]={n:r.nom,t:r.theo,p:r.phys,e:r.ecart};});}catch(e){}
  try{
    const snap=snapshot();
    const rec={id:ST.id,date:ST.date,agent:ST.agent,savedAt:Date.now(),filled,bilan:bilan,detail:detail,st:snap,locked:true,validatedAt:Date.now()};
    rec._sig=localSig('inv',{date:rec.date,detail:rec.detail||null,st:rec.st&&rec.st.c?rec.st.c:null});
    if(await findLocalDuplicate('inv',rec._sig,rec.id)){toast('Inventaire deja enregistre dans l historique local');return;}
    await idbPut(rec);
  }
  catch(e){toast('Échec de la validation');return;}
  $('#dlg').close();
  REFS.forEach(r=>ST.c[r.code]=blankEntry(r));
  ST.id='inv_'+Date.now();ST.sessionStart=Date.now();
  saveCounts();render();toast('Inventaire validé 🔒 · nouveau comptage ouvert');
}
