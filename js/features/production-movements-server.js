/* ================= MODULE PRODUCTION ================= */
function todayStr(){const d=new Date();const p=n=>(n<10?'0':'')+n;return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}
function frDate(s){if(!s)return '—';const m=String(s).split('-');return m.length===3?m[2]+'/'+m[1]+'/'+m[0]:s;}
let PF=null;
let PFVIEW=null,PF_BACKUP=null;                              // production : fiche serveur vue en lecture seule + brouillon stashe
let MOVVIEW={sortie:null,entree:null},MOV_BACKUP={sortie:null,entree:null};
const HIST_MAX=80;
const HIST_FILTERS={
  production:{mode:'all',value:'',start:'',end:'',article:''},
  sortie:{mode:'all',value:'',start:'',end:'',article:''},
  entree:{mode:'all',value:'',start:'',end:'',article:''},
  qualite:{mode:'all',value:'',start:'',end:'',article:''}
};
function refName(value){
  const r=REFS.find(x=>x.code===value||x.des===value);
  return r?r.des:String(value||'');
}
function refCode(value){
  const r=REFS.find(x=>x.code===value||x.des===value);
  return r?r.code:String(value||'');
}
function prodName(prod){
  const r=(typeof recipeProductRef==='function'&&recipeProductRef(prod))||REFS.find(x=>x.code===prod||x.des===prod);
  return r?r.des:String(prod||'');
}
function nonFinishedRefs(){
  return refsByCode(REFS.filter(r=>r.cat!=='fini'));
}
function histWeekRange(v){
  const m=String(v||'').match(/^(\d{4})-W(\d{2})$/);if(!m)return null;
  const d=new Date(Date.UTC(+m[1],0,1+(+m[2]-1)*7));
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+(day<=4?1-day:8-day));
  const s=d.toISOString().slice(0,10);
  d.setUTCDate(d.getUTCDate()+6);
  return [s,d.toISOString().slice(0,10)];
}
function embType(p){const a=(typeof recipeProductRef==='function'&&recipeProductRef(p))||REFS.find(x=>x.code===p||x.des===p);if(a&&(a.m==='sac'||a.m==='vrac'))return 'sac';return 'carton';}
function freshBlock(){return {p:'',n:'',w_emb:'',w_film:'',w_mel:'',scotch:'',bobines:[],inkChange:false,inkBefore:'',photos:[]};}
function freshPF(){return {date:'',agent:(typeof USR!=='undefined'?USR.nom:''),blocks:[freshBlock()],note:''};}
function pfBlockHasInput(b){return (b.p&&num(b.n)>0)||num(b.w_emb)>0||num(b.w_film)>0||num(b.w_mel)>0||num(b.scotch)>0||prodBobKg(b)>0;}
function pfCompleteBlocks(pf){return (pf.blocks||[]).filter(b=>b&&b.p&&num(b.n)>0);}
function pfMissingProductBlocks(pf){return (pf.blocks||[]).filter(b=>pfBlockHasInput(b)&&(!b.p||num(b.n)<=0));}
function pfProductionGuard(pf){
  const bad=pfMissingProductBlocks(pf);
  if(bad.length){toast('Choisir un produit fini et une quantite pour chaque production renseignee');return null;}
  const blocks=pfCompleteBlocks(pf);
  if(!blocks.length){toast('Rien a soumettre');return null;}
  if(!pfInkGuard(blocks))return null;
  return blocks;
}
/* Changement de cartouches : si coche, « cartons avant changement » doit etre un
   entier valide, >= 0 et <= cartons produits du bloc. */
function pfInkGuard(blocks){
  for(const b of (blocks||[])){
    if(!b||!b.inkChange||(typeof prodUsesInk==='function'&&!prodUsesInk(b.p)))continue;
    const raw=String(b.inkBefore==null?'':b.inkBefore).trim();
    if(raw===''||!/^\d+$/.test(raw)){toast('Cartons avant changement de cartouches : saisir un nombre entier valide ('+prodName(b.p)+')');return false;}
    if(num(raw)>num(b.n)){toast('Cartons avant changement ('+raw+') ne peut pas depasser les cartons produits ('+histQty(b.n)+') pour '+prodName(b.p));return false;}
  }
  return true;
}
function prodBlocksScotch(blocks){
  return (blocks||[]).reduce((sum,b)=>sum+num(b&&b.scotch),0);
}
function prodRecipeRows(prod){
  return typeof recipeForProduct==='function'?recipeForProduct(prod):(RECF&&RECF[prod]||[]);
}
function prodRef(code){
  return REFS.find(r=>r.code===code)||{};
}
function prodIngrText(m){
  return String(((m&&m.des)||'')+' '+((m&&m.code)||'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
}
function prodIngrCat(m){
  return (prodRef(m&&m.code).cat)||'';
}
function prodIsFilmIngr(m){
  return prodIngrCat(m)==='film'||prodIngrText(m).indexOf('FILM')>=0;
}
function prodIsCartonIngr(m){
  return prodIngrCat(m)==='carton'||prodIngrText(m).indexOf('CARTON')>=0;
}
function prodIsSacIngr(m){
  const txt=prodIngrText(m),cat=prodIngrCat(m);
  return txt.indexOf('SAC')>=0||cat==='plast'||cat==='emballage';
}
// Sacs plastique (ex. "SAC PLASTIQUE POUR KRAFT") : ni comptes en dechet, ni deduits du stock. Seul le kraft compte.
function prodIsPlasticSachet(m){return prodIngrText(m).indexOf('PLAST')>=0;}
function prodWasteIngredientRows(prod,kind){
  const recipe=prodRecipeRows(prod).filter(m=>m&&m.code&&num(m.qte)>0);
  if(kind==='film')return recipe.filter(prodIsFilmIngr);
  if(kind==='carton')return recipe.filter(prodIsCartonIngr);
  if(kind==='sac')return recipe.filter(m=>prodIsSacIngr(m)&&!prodIsFilmIngr(m)&&!prodIsCartonIngr(m)&&!prodIsPlasticSachet(m));
  return [];
}
function prodPackagingWasteRows(prod){
  const kind=embType(prod)==='sac'?'sac':'carton';
  let rows=prodWasteIngredientRows(prod,kind);
  if(!rows.length)rows=prodRecipeRows(prod).filter(m=>m&&m.code&&num(m.qte)>0&&!prodIsFilmIngr(m)&&!prodIsPlasticSachet(m)&&(prodIsCartonIngr(m)||prodIsSacIngr(m)));
  return rows;
}
function prodPackagingLabel(prod){return embType(prod)==='sac'?'Sacs kraft':'Cartons';}
function prodFilmLabel(prod){return 'Film';}
/* Applicabilite consommables selon le produit (pour griser les champs non pertinents). */
function prodHasFilm(prod){return !!prod&&prodWasteIngredientRows(prod,'film').length>0;}
function prodHasScotch(prod){return !!prod&&embType(prod)!=='sac';}
// Vide les consommables non applicables au produit courant : sinon des bobines/scotch saisis sur un
// produit puis masques apres changement de produit seraient quand meme soumis (rattaches au mauvais produit).
function prodNormalizeBlock(b){
  if(!prodHasFilm(b&&b.p))b.bobines=[];
  if(!prodHasScotch(b&&b.p))b.scotch='';
  if(typeof prodUsesInk==='function'&&!prodUsesInk(b&&b.p)){b.inkChange=false;b.inkBefore='';}
  return b;
}
/* Section « changement de cartouches » : uniquement pour les produits d'une machine à encre. */
function inkSectionHTML(b){
  if(typeof prodUsesInk!=='function'||!prodUsesInk(b&&b.p))return '';
  const on=!!(b&&b.inkChange);
  return '<div class="pb-ink"><label class="pb-ink-tog"><input type="checkbox" class="pb-ink-chk"'+(on?' checked':'')+'> 🖊️ Changement de cartouches d’encre sur cette production</label>'
    +'<div class="pb-ink-detail'+(on?'':' off')+'"><span class="pb-dl">Cartons imprimés AVANT le changement</span>'
    +'<input class="pb-ink-before" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="ex. 300" value="'+esc((b&&b.inkBefore)||'')+'">'
    +'<div class="pb-ink-hint">Avant → ancien jeu de cartouches ; après → nouveau jeu. Saisir les productions dans l’ordre de fabrication.</div></div></div>';
}
/* Bobines film approvisionnees : liste de poids (kg) par bobine ; nb = nombre de poids saisis, total = somme.
   Indicatif (mvt interne depot->atelier), aucun impact sur le calcul de stock. */
function prodBobList(b){return (b&&Array.isArray(b.bobines))?b.bobines:[];}
function prodBobCount(b){return prodBobList(b).filter(w=>num(w)>0).length;}
function prodBobKg(b){return prodBobList(b).reduce((s,w)=>s+num(w),0);}
function prodBobText(b){
  const n=prodBobCount(b),kg=prodBobKg(b);
  if(!n&&!(kg>0))return '';
  return histQty(n)+' bobine'+(n>1?'s':'')+' · '+histQty(kg)+' kg';
}
function scotchRowHTML(b){
  const on=prodHasScotch(b&&b.p);
  return '<div class="pb-drow'+(on?'':' off')+'"><span class="pb-dl">Scotch (bobines)</span>'
    +'<input class="pb-scotch" inputmode="decimal" placeholder="0" value="'+esc(b.scotch)+'"'
    +(on?'':' disabled title="Pas de scotch pour ce produit (sac)"')+'></div>';
}
function bobRowsHTML(b){
  return prodBobList(b).map((w,i)=>'<div class="pb-bob-row"><span class="pb-bob-lbl">Bobine '+(i+1)+'</span>'
    +'<input class="pb-bob" data-i="'+i+'" inputmode="decimal" placeholder="kg" value="'+esc(w)+'">'
    +'<button type="button" class="pb-bob-del" data-i="'+i+'" title="supprimer">✕</button></div>').join('');
}
/* Met à jour la liste des bobines EN PLACE (sans re-render global) pour ne pas
   faire remonter l'écran sur mobile. */
function bobUpdateSum(card,b){const s=card.querySelector('.pb-bob-sum');if(s)s.textContent=prodBobCount(b)+' bobine(s) · '+histQty(prodBobKg(b))+' kg';}
function bobBind(card,b){
  card.querySelectorAll('.pb-bob').forEach(inp=>{inp.oninput=()=>{if(!Array.isArray(b.bobines))b.bobines=[];b.bobines[+inp.dataset.i]=inp.value;bobUpdateSum(card,b);};});
  card.querySelectorAll('.pb-bob-del').forEach(btn=>{btn.onclick=()=>{if(Array.isArray(b.bobines))b.bobines.splice(+btn.dataset.i,1);bobRefresh(card,b);};});
}
function bobRefresh(card,b){const list=card.querySelector('.pb-bob-list');if(list)list.innerHTML=bobRowsHTML(b);bobBind(card,b);bobUpdateSum(card,b);}
function bobineSectionHTML(b){
  const prod=b&&b.p;
  if(!prodHasFilm(prod)){
    return '<div class="pb-drow off"><span class="pb-dl">Bobine film approvisionnée</span>'
      +'<span class="pb-cons-off">'+(prod?'aucun film pour ce produit':'choisir un produit')+'</span></div>';
  }
  return '<div class="pb-dl" style="margin-bottom:4px">Bobine film approvisionnée <span style="font-weight:400;color:var(--mute)">(1 poids/bobine · indicatif, hors stock)</span></div>'
    +'<div class="pb-bob-list">'+bobRowsHTML(b)+'</div>'
    +'<button type="button" class="pb-bob-add">+ Ajouter une bobine</button>'
    +'<div class="pb-bob-sum">'+prodBobCount(b)+' bobine(s) · '+esc(histQty(prodBobKg(b)))+' kg</div>';
}
function prodBlockWasteDetails(b){
  const out=[],prod=b&&b.p;
  const pack=num(b&&b.w_emb);
  if(pack>0){
    prodPackagingWasteRows(prod).forEach(m=>out.push({
      kind:embType(prod)==='sac'?'sac':'carton',
      product:productCodeOf(prod),
      code:m.code,
      des:(prodRef(m.code).des||m.des||m.code),
      qty:pack*num(m.qte)
    }));
  }
  const film=num(b&&b.w_film),films=prodWasteIngredientRows(prod,'film');
  if(film>0&&films.length){
    const total=films.reduce((s,m)=>s+num(m.qte),0)||1;
    films.forEach(m=>out.push({
      kind:'film',
      product:productCodeOf(prod),
      code:m.code,
      des:(prodRef(m.code).des||m.des||m.code),
      qty:film*num(m.qte)/total
    }));
  }
  return out;
}
function prodBlockWasteText(b){
  const parts=prodBlockWasteDetails(b).sort((a,b)=>String(a.code).localeCompare(String(b.code),'fr',{numeric:true})).map(x=>esc(refName(x.code))+' : <b class="hist-qty">'+esc(histQty(x.qty))+'</b>');
  if(num(b&&b.w_mel)>0)parts.push('mélange '+histQty(b.w_mel)+' kg');
  if(num(b&&b.scotch)>0)parts.push('scotch '+prodScotchText(b.scotch));
  const bob=prodBobText(b);if(bob)parts.push('bobine film '+bob);
  return parts.join(' · ');
}
async function prodSave(pf){
  const blocks=pfProductionGuard(pf);
  if(!blocks)return false;
  blocks.forEach(prodNormalizeBlock);
  const rec={id:'prod_'+Date.now(),kind:'prod',date:pf.date||todayStr(),agent:pf.agent||'',scotch:prodBlocksScotch(blocks),blocks:clone(blocks),note:pf.note,savedAt:Date.now()};
  rec._sig=localSig('prod',{date:rec.date,blocks:rec.blocks,note:rec.note||''});
  if(await findLocalDuplicate('prod',rec._sig,rec.id)){toast('Production deja enregistree dans l historique local');return false;}
  try{await idbPut(rec);toast('Production enregistrée');return true;}catch(e){toast('Échec de l\u2019enregistrement');return false;}
}
async function prodSubmit(pf){
  const blocks=pfProductionGuard(pf);
  if(!blocks)return false;
  blocks.forEach(prodNormalizeBlock);
  if(!pf.agent&&typeof USR!=='undefined'&&USR.nom)pf.agent=USR.nom;
  const payload={kind:'production',date:pf.date||todayStr(),agent:pf.agent||'',scotch:prodBlocksScotch(blocks),blocks:clone(blocks),note:pf.note||'',submittedAt:new Date().toISOString()};
  await sipsSubmit('production',payload,'Production '+(payload.date||''));
  return true;
}
function photoArrayUI(host,arr,redraw){
  host.innerHTML='';
  const camIn=document.createElement('input');camIn.type='file';camIn.accept='image/*';camIn.capture='environment';camIn.style.display='none';
  const galIn=document.createElement('input');galIn.type='file';galIn.accept='image/*';galIn.style.display='none';
  const cam=document.createElement('button');cam.type='button';cam.className='photo-btn';cam.innerHTML='📷 Photo';cam.onclick=()=>camIn.click();
  const gal=document.createElement('button');gal.type='button';gal.className='photo-btn';gal.innerHTML='🖼 Galerie';gal.onclick=()=>galIn.click();
  const onPick=async ev=>{const f=ev.target.files&&ev.target.files[0];if(!f)return;try{arr.push(await compress(f));redraw();toast('Photo ajoutée');}catch(e){toast('Photo non ajoutée');}};
  camIn.onchange=onPick;galIn.onchange=onPick;
  host.append(camIn,galIn,cam,gal);
  arr.forEach((b,i)=>{const th=document.createElement('img');th.className='photo-thumb';th.src=b;th.onclick=()=>openLightbox('Photo',b);host.append(th);
    const rm=document.createElement('button');rm.type='button';rm.className='photo-btn';rm.textContent='✕';rm.onclick=()=>{arr.splice(i,1);redraw();};host.append(rm);});
}
function noteSectionHTML(id,value){
  return '<div class="pf-sec"><div class="pf-h">Note</div><textarea id="'+esc(id)+'" class="note-field" rows="2" placeholder="remarque (option)">'+esc(value||'')+'</textarea></div>';
}
function scrollToHistory(id){
  const el=document.getElementById(id);
  if(el)scrollCardIntoView(el);
}
function renderProduction(focusBi){
  if(!PF)PF=freshPF();
  if(!PF.agent&&typeof USR!=='undefined'&&USR.nom)PF.agent=USR.nom;
  if(!PF.blocks||!PF.blocks.length)PF.blocks=[freshBlock()];
  const app=$('#app');
  const finiOpts=sel=>recipeKeys().map(p=>`<option value="${esc(p)}"${p===productCodeOf(sel)?' selected':''}>${laityOpt(recipeProductLabel(p))}</option>`).join('');
  let blocksH='';
  PF.blocks.forEach((b,bi)=>{
    const current=currentRecipeProductCode(b.p);if(current&&current!==b.p)b.p=current;
    blocksH+='<div class="pb-card" data-bi="'+bi+'">'
      +'<div class="pb-h"><span>Production '+(bi+1)+'</span>'+(PF.blocks.length>1?'<button class="pb-del" title="supprimer">🗑</button>':'')+'</div>'
      +'<div class="pf-row"><select class="pb-p"><option value="">— produit fini —</option>'+finiOpts(b.p)+'</select><input class="pb-n" inputmode="numeric" placeholder="qté" value="'+esc(b.n)+'"></div>'
      +'<div class="pb-dech"><div class="pf-h">Déchets</div>'
      +'<div class="pb-drow"><span class="pb-dl">'+esc(prodPackagingLabel(b.p))+'</span><input class="pb-emb" inputmode="decimal" placeholder="qté" value="'+esc(b.w_emb)+'"></div>'
      +'<div class="pb-drow"><span class="pb-dl">'+esc(prodFilmLabel(b.p))+' (déchet)</span><input class="pb-film" inputmode="decimal" placeholder="qté" value="'+esc(b.w_film)+'"></div>'
      +'<div class="pb-drow"><span class="pb-dl">Mélange (déchet) (kg)</span><input class="pb-mel" inputmode="decimal" placeholder="kg" value="'+esc(b.w_mel)+'"></div></div>'
      +'<div class="pb-cons"><div class="pf-h">Consommables</div>'
      +scotchRowHTML(b)
      +bobineSectionHTML(b)
      +'</div>'
      +inkSectionHTML(b)
      +'<div class="pf-h" style="margin-top:10px">Photo(s)</div><div class="pb-photos photo-row"></div>'
      +'</div>';
  });
  const view=!!PFVIEW,sub=PFVIEW;
  app.innerHTML='<div class="prod-wrap">'
    +'<h2 class="prod-title">Production'+(view?' — consultation':'')+'</h2>'
    +(view?'<p class="ref-hint" style="background:#eef4fb;border:1px solid #d6e4f2;border-radius:8px;padding:8px 10px">Fiche serveur en <b>lecture seule</b>. Valide / Rejette en bas, ou ← Retour.</p>':'<button id="pfGoHist" class="hist-jump">Aller à Historique ⬇</button>')
    +'<div class="pf-id"><label>Date<input type="date" id="pfDate" value="'+esc(PF.date)+'"></label><label>Opérateur<input id="pfAgent" readonly style="background:#eef2f6;color:var(--mute)" value="'+esc(PF.agent)+'"></label></div>'
    +'<div id="pfBlocks">'+blocksH+'</div>'
    +(view?'':'<button id="pfAddBlock" class="pf-add" style="margin-bottom:12px">+ Ajouter une production</button>')
    +noteSectionHTML('pfNote',PF.note)
    +(view?'<div class="pf-actions"><button id="pfViewBack" class="b-sec">← Retour</button><button id="pfViewValidate" class="b-go">✅ Valider</button><button id="pfViewReject" class="del">🚫 Rejeter</button></div>'
          :'<div class="pf-actions"><button id="pfSubmit" class="b-go">Soumettre au serveur</button><button id="pfSave" class="b-sec">Enregistrer localement</button><button id="pfNew" class="b-sec">Nouvelle fiche</button></div>')
    +(view?'':'<div id="pfPending"></div><div class="pf-sec" id="pfHistory"><div class="pf-h">Historique des productions</div><div id="pfHist">Chargement…</div></div>')
    +'</div>';
  const re=()=>renderProduction();
  if(view){
    app.querySelectorAll('.pb-card').forEach(card=>{const bi=+card.dataset.bi;const b=PF.blocks[bi];photoRowReadonly(card.querySelector('.pb-photos'),b&&b.photos);});
    app.querySelectorAll('input,select,textarea,button').forEach(el=>{if(['pfViewBack','pfViewValidate','pfViewReject'].indexOf(el.id)<0)el.disabled=true;});
    $('#pfViewBack').onclick=prodExitView;
    $('#pfViewValidate').onclick=async()=>{if(await sipsDecide(sub.id,'validate'))prodExitView();};
    $('#pfViewReject').onclick=async()=>{if(await sipsDecide(sub.id,'reject'))prodExitView();};
    window.scrollTo(0,0);return;
  }
  $('#pfGoHist').onclick=()=>scrollToHistory('pfHistory');
  $('#pfDate').onchange=e=>{PF.date=e.target.value;};
  $('#pfNote').oninput=e=>{PF.note=e.target.value;};
  app.querySelectorAll('.pb-card').forEach(card=>{
    const bi=+card.dataset.bi;const b=PF.blocks[bi];
    card.querySelector('.pb-p').onchange=e=>{b.p=e.target.value;prodNormalizeBlock(b);re();};
    card.querySelector('.pb-n').oninput=e=>{b.n=e.target.value;};
    card.querySelector('.pb-emb').oninput=e=>{b.w_emb=e.target.value;};
    const fl=card.querySelector('.pb-film');if(fl)fl.oninput=e=>{b.w_film=e.target.value;};
    card.querySelector('.pb-mel').oninput=e=>{b.w_mel=e.target.value;};
    const sc=card.querySelector('.pb-scotch');if(sc)sc.oninput=e=>{b.scotch=e.target.value;};
    bobBind(card,b);
    const addBob=card.querySelector('.pb-bob-add');if(addBob)addBob.onclick=()=>{if(!Array.isArray(b.bobines))b.bobines=[];b.bobines.push('');bobRefresh(card,b);};
    const inkChk=card.querySelector('.pb-ink-chk');
    if(inkChk)inkChk.onchange=e=>{b.inkChange=e.target.checked;const d=card.querySelector('.pb-ink-detail');if(d)d.classList.toggle('off',!e.target.checked);if(!e.target.checked){b.inkBefore='';const bf=card.querySelector('.pb-ink-before');if(bf)bf.value='';}};
    const inkBf=card.querySelector('.pb-ink-before');if(inkBf)inkBf.oninput=e=>{const v=e.target.value.replace(/[^0-9]/g,'');if(v!==e.target.value)e.target.value=v;b.inkBefore=v;};
    const delB=card.querySelector('.pb-del');if(delB)delB.onclick=()=>{PF.blocks.splice(bi,1);if(!PF.blocks.length)PF.blocks.push(freshBlock());re();};
    photoArrayUI(card.querySelector('.pb-photos'),b.photos,re);
  });
  $('#pfAddBlock').onclick=()=>{PF.blocks.push(freshBlock());renderProduction(PF.blocks.length-1);};
  $('#pfSubmit').onclick=async(e)=>{const b=e.currentTarget;if(b.disabled)return;b.disabled=true;const t=b.textContent;b.textContent='Envoi…';try{await prodSubmit(PF);}finally{b.disabled=false;b.textContent=t;}};
  $('#pfSave').onclick=async()=>{if(await prodSave(PF))loadProdHist();};
  $('#pfNew').onclick=()=>{if(confirm('Vider la fiche en cours ?')){PF=freshPF();renderProduction();}};
  loadProdHist();
  sipsLoadPendingInto('pfPending','production',sipsViewProductionForm);
  if(focusBi!=null){const c=app.querySelector('.pb-card[data-bi="'+focusBi+'"]');if(c)setTimeout(()=>scrollCardIntoView(c),60);}
}
function migrateProdRec(rec){
  if(rec.blocks&&rec.blocks.length){
    const blocks=clone(rec.blocks);
    if(num(rec.scotch)>0&&!blocks.some(b=>num(b&&b.scotch)>0))blocks[0].scotch=rec.scotch;
    return blocks;
  }
  const b=freshBlock();const pr=(rec.prods||[]).filter(x=>x.p&&num(x.n)>0);
  if(pr.length){b.p=pr[0].p;b.n=pr[0].n;}
  (rec.dechets||[]).forEach(x=>{if(!x.lbl)return;const l=x.lbl.toLowerCase();if(l.indexOf('carton')>=0||l.indexOf('sac')>=0)b.w_emb=x.qte;else if(l.indexOf('film')>=0)b.w_film=x.qte;});
  (rec.melange||[]).forEach(x=>{if(num(x.kg)>0)b.w_mel=x.kg;});
  if(num(rec.scotch)>0)b.scotch=rec.scotch;
  b.photos=clone(rec.photos||[]);
  const blocks=[b];pr.slice(1).forEach(x=>{const nb=freshBlock();nb.p=x.p;nb.n=x.n;blocks.push(nb);});
  return blocks;
}
function histRecDate(row,isServer){
  const rec=isServer?(row&&row.payload||{}):row;
  return String((rec&&rec.date)||'');
}
function histMatchDate(date,filter){
  if(!filter||filter.mode==='all')return true;
  if(filter.mode==='period')return (!filter.start||date>=filter.start)&&(!filter.end||date<=filter.end);
  if(!filter.value)return true;
  if(filter.mode==='month')return date.indexOf(filter.value)===0;
  if(filter.mode==='year')return date.indexOf(filter.value)===0;
  if(filter.mode==='week'){const r=histWeekRange(filter.value);return !r||(date>=r[0]&&date<=r[1]);}
  if(filter.mode==='day')return date===filter.value;
  return true;
}
function histApply(rows,key,isServer){
  const filter=HIST_FILTERS[key]||HIST_FILTERS.production;
  return (rows||[]).filter(r=>histMatchDate(histRecDate(r,isServer),filter)&&histMatchArticle(r,key,isServer,filter.article));
}
function histClip(rows){
  rows=rows||[];
  return {rows:rows.slice(0,HIST_MAX),hidden:Math.max(0,rows.length-HIST_MAX),total:rows.length};
}
function histFilterText(filter){
  if(!filter||filter.mode==='all')return 'Tout';
  if(filter.mode==='period')return 'Periode '+(filter.start?frDate(filter.start):'...')+' -> '+(filter.end?frDate(filter.end):'...');
  if(!filter.value)return 'Tout';
  if(filter.mode==='month')return 'Mois '+filter.value;
  if(filter.mode==='year')return 'Annee '+filter.value;
  if(filter.mode==='week')return 'Semaine '+filter.value;
  return 'Jour '+frDate(filter.value);
}
function bindHistFilter(host,key,loader){
  const sel=host.querySelector('.hist-filter-mode'),val=host.querySelector('.hist-filter-value'),start=host.querySelector('.hist-filter-start'),end=host.querySelector('.hist-filter-end'),article=host.querySelector('.hist-filter-article');
  if(!sel||!val)return;
  const sync=()=>{
    const f=HIST_FILTERS[key];
    val.style.display=(f.mode==='all'||f.mode==='period')?'none':'block';
    const per=host.querySelector('.hist-filter-period');if(per)per.style.display=f.mode==='period'?'grid':'none';
    val.type=f.mode==='day'?'date':(f.mode==='week'?'week':(f.mode==='month'?'month':'number'));
    val.placeholder=f.mode==='year'?'annee':'';
    val.min=f.mode==='year'?'2000':'';
    val.max=f.mode==='year'?'2100':'';
    val.value=f.value||'';
    if(start)start.value=f.start||'';
    if(end)end.value=f.end||'';
    if(article)article.value=f.article||'';
  };
  sel.onchange=()=>{const f=HIST_FILTERS[key];f.mode=sel.value;f.value='';f.start='';f.end='';sync();loader();};
  val.onchange=()=>{HIST_FILTERS[key].value=val.value;loader();};
  if(start)start.onchange=()=>{HIST_FILTERS[key].start=start.value;loader();};
  if(end)end.onchange=()=>{HIST_FILTERS[key].end=end.value;loader();};
  if(article)article.onchange=()=>{HIST_FILTERS[key].article=article.value;loader();};
  sync();
}
function histArticleHTML(key){
  const f=HIST_FILTERS[key]||HIST_FILTERS.production;
  const opts=rows=>rows.map(r=>'<option value="'+esc(r.code)+'"'+(f.article===r.code?' selected':'')+'>'+laityOpt(r.des)+'</option>').join('');
  if(key==='production'||key==='qualite')return '<select class="hist-filter-article"><option value="">Tous produits finis</option>'+opts(finishedProductRefs())+'</select>';
  return '<select class="hist-filter-article"><option value="">Tous articles</option><optgroup label="Produits finis">'+opts(finishedProductRefs())+'</optgroup><optgroup label="Matieres / emballages / autres">'+opts(nonFinishedRefs())+'</optgroup></select>';
}
function histFilterHTML(key){
  const f=HIST_FILTERS[key]||HIST_FILTERS.production;
  return '<div class="hist-filter"><select class="hist-filter-mode">'
    +'<option value="all"'+(f.mode==='all'?' selected':'')+'>Tout</option>'
    +'<option value="day"'+(f.mode==='day'?' selected':'')+'>Jour</option>'
    +'<option value="week"'+(f.mode==='week'?' selected':'')+'>Semaine</option>'
    +'<option value="period"'+(f.mode==='period'?' selected':'')+'>Periode</option>'
    +'<option value="month"'+(f.mode==='month'?' selected':'')+'>Mois</option>'
    +'<option value="year"'+(f.mode==='year'?' selected':'')+'>Annee</option>'
    +'</select><input class="hist-filter-value" value="'+esc(f.value||'')+'"><div class="hist-filter-period"><input class="hist-filter-start" type="date" value="'+esc(f.start||'')+'"><input class="hist-filter-end" type="date" value="'+esc(f.end||'')+'"></div>'+histArticleHTML(key)+'<span>'+esc(histFilterText(f))+'</span></div>';
}
function histQty(v){return (typeof fmtq==='function')?fmtq(num(v)):String(v||'');}
function histMatchArticle(row,key,isServer,article){
  if(!article)return true;
  const rec=isServer?(row&&row.payload||{}):row;
  if(key==='production')return migrateProdRec(rec||{}).some(b=>b&&b.p&&productCodeOf(b.p)===article);
  if(key==='qualite')return productCodeOf((rec&&rec.informations||{}).refProduit)===article;
  return [].concat((rec&&rec.finis)||[],(rec&&rec.mp)||[]).some(x=>x&&x.a&&refCode(x.a)===article);
}
function histMiniLines(rows,cols,max){
  rows=(rows||[]).filter(r=>r&&cols.some(c=>String(r[c[0]]||'').trim()));
  if(!rows.length)return '';
  const shown=rows.slice(0,max||4);
  let h='<div class="hist-mini">';
  shown.forEach(r=>{
    h+='<div>'+cols.map(c=>{const v=r[c[0]];return v==null||v===''?'':(c[2]?c[2](v):esc(v));}).filter(Boolean).join(' - ')+'</div>';
  });
  if(rows.length>shown.length)h+='<div>+'+(rows.length-shown.length)+' autre(s)...</div>';
  return h+'</div>';
}
function histProdMini(blocks){
  blocks=(blocks||[]).filter(b=>b&&b.p&&num(b.n)>0);
  if(!blocks.length)return '';
  // Compact : 1 ligne par produit (nom ×qte, dechets en incise) au lieu de 2 lignes taguees.
  let h='<div class="hist-mini hist-prod-mini">';
  blocks.slice(0,6).forEach(b=>{
    const waste=prodBlockWasteText(b);
    h+='<div class="hist-prow">'+hlLaity(prodName(b.p))+' ×<b class="hist-qty">'+esc(histQty(b.n))+'</b>'+(waste?' <span class="hist-waste">· déchets '+waste+'</span>':'')+'</div>';
  });
  if(blocks.length>6)h+='<div>+'+(blocks.length-6)+' autre(s)...</div>';
  return h+'</div>';
}
function prodScotchQty(rec){
  const blocks=migrateProdRec(rec||{});
  const byBlock=prodBlocksScotch(blocks);
  return byBlock>0?byBlock:num(rec&&rec.scotch);
}
function prodScotchText(qty){
  return histQty(qty)+' bobine'+(num(qty)>1?'s':'');
}
function prodWasteTotals(rows,isServer){
  return (rows||[]).reduce((tot,row)=>{
    const rec=isServer?(row&&row.payload||{}):row;
    migrateProdRec(rec||{}).forEach(b=>{
      tot.emb+=num(b&&b.w_emb);
      tot.film+=num(b&&b.w_film);
      tot.mel+=num(b&&b.w_mel);
      tot.scotch+=num(b&&b.scotch);
      tot.bobN+=prodBobCount(b);
      tot.bobKg+=prodBobKg(b);
    });
    return tot;
  },{emb:0,film:0,mel:0,scotch:0,bobN:0,bobKg:0});
}
function prodWasteRefTotals(rows,isServer){
  const out={};
  (rows||[]).forEach(row=>{
    const rec=isServer?(row&&row.payload||{}):row;
    migrateProdRec(rec||{}).forEach(b=>{
      prodBlockWasteDetails(b).forEach(x=>{
        const k=x.kind+'|'+x.product+'|'+x.code;
        if(!out[k])out[k]=Object.assign({},x,{qty:0});
        out[k].qty+=num(x.qty);
      });
    });
  });
  return Object.keys(out).map(k=>out[k]).sort((a,b)=>String(a.product).localeCompare(String(b.product),'fr',{numeric:true})||String(a.kind).localeCompare(String(b.kind))||String(a.code).localeCompare(String(b.code),'fr',{numeric:true}));
}
function prodWasteRefRowsHTML(arr){
  const merged={};
  (arr||[]).forEach(x=>{
    const k=x.kind+'|'+x.code;
    if(!merged[k])merged[k]=Object.assign({},x,{qty:0});
    merged[k].qty+=num(x.qty);
  });
  arr=Object.keys(merged).map(k=>merged[k]).sort((a,b)=>String(a.code).localeCompare(String(b.code),'fr',{numeric:true}));
  if(!arr.length)return '';
  return '<div class="hist-mini">'+arr.map(x=>'<div>'+esc(refName(x.code))+' : <b class="hist-qty">'+esc(histQty(x.qty))+'</b></div>').join('')+'</div>';
}
function histMovMini(rec){
  const rows=[];
  (rec.finis||[]).forEach(x=>{if(x&&x.a&&num(x.q)>0)rows.push({t:'PF',a:x.a,q:x.q,exp:''});});
  (rec.mp||[]).forEach(x=>{if(x&&x.a&&num(x.q)>0)rows.push({t:'MP',a:x.a,q:x.q,exp:x.exp||''});});
  return histMiniLines(rows,[
    ['t','Type',v=>esc(v)],
    ['a','Article',v=>hlLaity(v)],
    ['q','Qte',v=>'qte <b class="hist-qty">'+esc(histQty(v))+'</b>'],
    ['exp','Peremption',v=>'peremption '+esc(v)]
  ],5);
}
function renderProdHist(host,recs,serverRows){
  host.innerHTML='';
  host.innerHTML=histFilterHTML('production');
  bindHistFilter(host,'production',loadProdHist);
  recs=histApply(recs,'production',false).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
  serverRows=histApply(serverRows,'production',true).sort((a,b)=>String(b.validatedAt||'').localeCompare(String(a.validatedAt||'')));
  const srvClip=histClip(serverRows),locClip=histClip(recs);
  const srvTotals=prodWasteTotals(serverRows,true),locTotals=prodWasteTotals(recs,false);
  const totals={emb:srvTotals.emb+locTotals.emb,film:srvTotals.film+locTotals.film,mel:srvTotals.mel+locTotals.mel,scotch:srvTotals.scotch+locTotals.scotch,bobN:srvTotals.bobN+locTotals.bobN,bobKg:srvTotals.bobKg+locTotals.bobKg};
  const totalBox=document.createElement('div');
  totalBox.style.cssText='background:#f7faf8;border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:8px 0;font-size:13px';
  const bobLine=(totals.bobN>0||totals.bobKg>0)?' · bobine film <b class="hist-qty">'+esc(histQty(totals.bobN))+'</b> bobine(s) (<b class="hist-qty">'+esc(histQty(totals.bobKg))+'</b> kg)':'';
  totalBox.innerHTML='<b>Totaux sur ce filtre</b> : mélange <b class="hist-qty">'+esc(histQty(totals.mel))+'</b> kg · scotch <b class="hist-qty">'+esc(prodScotchText(totals.scotch))+'</b>'+bobLine+prodWasteRefRowsHTML(prodWasteRefTotals(serverRows,true).concat(prodWasteRefTotals(recs,false)));
  host.append(totalBox);
  if(serverRows.length){
    const h=document.createElement('div');h.style.cssText='font-size:12px;font-weight:800;color:var(--green);margin:0 0 6px;text-transform:uppercase';
    h.textContent='Validees serveur';host.append(h);
    srvClip.rows.forEach(row=>{
      const rec=row.payload||{};
      const blocks=migrateProdRec(rec);
      const np=blocks.filter(b=>b.p&&num(b.n)>0).length;
      const ph=blocks.reduce((s,b)=>s+((b.photos||[]).length),0);
      const it=document.createElement('div');it.className='hist-item locked';
      it.innerHTML='<div class="info"><b>'+frDate(rec.date)+'</b><span>VALIDEE serveur - '+(rec.agent?esc(rec.agent)+' - ':'')+np+' produit(s) - scotch '+prodScotchText(prodScotchQty(rec))+' - '+ph+' photo(s)</span>'+histProdMini(blocks)+'</div>';
      const open=document.createElement('button');open.textContent='Voir';open.onclick=()=>{PF={date:rec.date,agent:rec.agent||'',blocks:clone(blocks),note:rec.note||''};renderProduction();setTimeout(()=>window.scrollTo(0,0),0);};
      it.append(open);host.append(it);
    });
    if(srvClip.hidden){const p=document.createElement('p');p.className='hist-more';p.textContent=srvClip.hidden+' production(s) serveur masquee(s) par la limite d affichage.';host.append(p);}
  }
  if(recs.length){
    const h=document.createElement('div');h.style.cssText='font-size:12px;font-weight:800;color:var(--steel-d);margin:'+(serverRows.length?'10px':'0')+' 0 6px;text-transform:uppercase';
    h.textContent='Locales sur cet appareil';host.append(h);
  }
  locClip.rows.forEach(rec=>{
    const blocks=migrateProdRec(rec);
    const np=blocks.filter(b=>b.p&&num(b.n)>0).length;
    const ph=blocks.reduce((s,b)=>s+((b.photos||[]).length),0);
    const it=document.createElement('div');it.className='hist-item';
    it.innerHTML='<div class="info"><b>'+frDate(rec.date)+'</b><span>'+(rec.agent||'—')+' · '+np+' produit(s) · '+ph+' photo(s)</span>'+histProdMini(blocks)+'</div>';
    const span=it.querySelector('.info span');if(span)span.append(document.createTextNode(' - scotch '+prodScotchText(prodScotchQty(rec))));
    const open=document.createElement('button');open.textContent='Voir';open.onclick=()=>{PF={date:rec.date,agent:rec.agent||'',blocks:clone(blocks),note:rec.note||''};renderProduction();setTimeout(()=>window.scrollTo(0,0),0);};
    const del=document.createElement('button');del.className='del';del.textContent='Suppr.';del.onclick=async()=>{if(confirm('Supprimer cette production ?')){await idbDel(rec.id);loadProdHist();}};
    it.append(open,del);host.append(it);
  });
  if(locClip.hidden){const p=document.createElement('p');p.className='hist-more';p.textContent=locClip.hidden+' production(s) locale(s) masquee(s) par la limite d affichage.';host.append(p);}
  if(!recs.length&&!serverRows.length){const p=document.createElement('p');p.className='hist-empty';p.textContent='Aucune production enregistree pour ce filtre.';host.append(p);}
}
// Local tout de suite, serveur en arriere-plan (voir renderMovHist/loadMovHist).
async function loadProdHist(){
  const host=$('#pfHist');if(!host)return;
  let recs=[];try{recs=(await idbAll()).filter(r=>String(r.id).indexOf('prod_')===0).sort((a,b)=>b.savedAt-a.savedAt);}catch(e){}
  renderProdHist(host,recs,[]);
  try{const serverRows=await sipsRecords('production');if($('#pfHist')===host)renderProdHist(host,recs,serverRows);}catch(e){}
}
const MOVCFG={
 sortie:{title:'Sorties',word:'SORTIE',icon:'🚚',refLabel:'Véhicule / plaque / destinataire',refPlace:'ex. camion 1234-AB / labo',pfx:'sortie_',saved:'Sortie enregistrée',hint:'Enregistre une sortie : produits finis expédiés et/ou matières & échantillons (les deux possibles). Date vide = aujourd\u2019hui. Photo véhicule/plaque depuis la galerie.',
   fieldsTitle:'Transport & destinataire',fields:[
     {key:'matricule',label:'Matricule véhicule',sug:'lep_sug_matricule',place:'ex. 1234 TU 56'},
     {key:'chauffeur',label:'Chauffeur',sug:'lep_sug_chauffeur',place:'ex. nom du chauffeur'},
     {key:'dest',label:'Destinataire',sug:'lep_sug_dest',place:'ex. client / labo'}
   ]},
 entree:{title:'Entrées',word:'ENTRÉE',icon:'📦',refLabel:'Fournisseur / référence / BL',refPlace:'ex. fournisseur, n° BL, container',pfx:'entree_',saved:'Entrée enregistrée',hint:'Enregistre une entrée : réceptions de matières premières et/ou retours de produits finis. Date vide = aujourd\u2019hui. Photo si nécessaire.',
   fieldsTitle:'Transport & provenance',fields:[
     {key:'matricule',label:'Matricule véhicule',sug:'lep_sug_matricule',place:'ex. 1234 TU 56'},
     {key:'chauffeur',label:'Chauffeur',sug:'lep_sug_chauffeur',place:'ex. nom du chauffeur'},
     {key:'dest',label:'Provenance',sug:'lep_sug_provenance',place:'ex. fournisseur'}
   ]}
};
let MOVF={sortie:null,entree:null};
function freshMov(){return {date:'',agent:(typeof USR!=='undefined'?USR.nom:''),ref:'',matricule:'',chauffeur:'',dest:'',finis:[{a:'',q:''}],mp:[{a:'',q:'',exp:''}],photos:[],note:''};}
/* Suggestions évolutives (datalist). Deux sources fusionnées :
   1) PARTAGÉ : dérivé des mouvements VALIDÉS serveur (matricule/chauffeur/dest de tous
      les postes) — pas de nouveau stockage, tout utilisateur qui valide alimente la liste.
   2) LOCAL (localStorage lep_sug_*) : echo immédiat + repli hors-ligne sur cet appareil. */
let MOV_SUG={matricule:[],chauffeur:[],dest_sortie:[],dest_entree:[]};
function sugGet(key){const v=lsGet(key,[]);return Array.isArray(v)?v:[];}
function sugAdd(key,val){val=String(val==null?'':val).trim();if(!val)return;let list=sugGet(key).filter(v=>v!==val);list.unshift(val);if(list.length>50)list=list.slice(0,50);lsSet(key,list);}
/* Liste de masquage manuelle (lep_sughide, clef = f.sug). On ne supprime JAMAIS une
   suggestion automatiquement quand un mouvement est supprime (ce serait perdre de bonnes
   suggestions sur une simple erreur de saisie). L'utilisateur retire a la main les mauvaises
   via le panneau "Gerer les suggestions" ; le masquage couvre aussi les suggestions derivees
   du serveur (qu'on ne peut pas effacer ici). */
function sugHidden(){const v=lsGet('lep_sughide',{});return (v&&typeof v==='object'&&!Array.isArray(v))?v:{};}
function movSugForget(f,val){
  val=String(val||'').trim();if(!val)return;
  lsSet(f.sug,sugGet(f.sug).filter(v=>v!==val));                                   // retire l'echo local
  const h=sugHidden();h[f.sug]=(h[f.sug]||[]).filter(v=>v!==val);h[f.sug].push(val);lsSet('lep_sughide',h);
}
/* Repli sur mf.ref (finding legacy) : un vieux mouvement n'a que `ref` (pas de champs
   structures matricule/chauffeur/dest), et le formulaire ne l'edite pas. Sans ce repli,
   le resave ecraserait la ref historique par '' et changerait la signature de doublon. */
function movRefCombined(mf){const c=[mf.matricule,mf.chauffeur,mf.dest].map(v=>String(v||'').trim()).filter(Boolean).join(' · ');return c||String(mf.ref||'').trim();}
function movRememberSuggestions(kind,mf){(MOVCFG[kind].fields||[]).forEach(f=>sugAdd(f.sug,mf[f.key]));}
function sugUniq(arr){const seen={},out=[];(arr||[]).forEach(v=>{v=String(v||'').trim();if(v&&!seen[v]){seen[v]=1;out.push(v);}});return out;}
/* Liste fusionnée (partagé serveur d'abord, puis local) pour un champ donné. */
function movSugFor(kind,f){
  let shared=[];
  if(f.key==='matricule')shared=MOV_SUG.matricule;
  else if(f.key==='chauffeur')shared=MOV_SUG.chauffeur;
  else if(f.key==='dest')shared=(kind==='sortie'?MOV_SUG.dest_sortie:MOV_SUG.dest_entree);
  const hidden=sugHidden()[f.sug]||[];
  return sugUniq(shared.concat(sugGet(f.sug))).filter(v=>hidden.indexOf(v)<0).slice(0,80);
}
/* Recalcule le cache partagé depuis les mouvements validés serveur (entrées + sorties). */
async function refreshMovSuggestions(){
  let ent=[],sor=[];
  try{ent=await sipsRecords('entree');}catch(e){}
  try{sor=await sipsRecords('sortie');}catch(e){}
  const val=(r,k)=>{const p=(r&&r.payload)?r.payload:(r||{});return p&&p[k]?String(p[k]).trim():'';};
  const collect=(recs,k)=>(recs||[]).map(r=>val(r,k)).filter(Boolean);
  MOV_SUG={
    matricule:sugUniq(collect(ent,'matricule').concat(collect(sor,'matricule'))),
    chauffeur:sugUniq(collect(ent,'chauffeur').concat(collect(sor,'chauffeur'))),
    dest_sortie:sugUniq(collect(sor,'dest')),
    dest_entree:sugUniq(collect(ent,'dest'))
  };
  updateMovDatalists();
}
/* Réinjecte les options dans les datalists du formulaire mouvement actuellement affiché. */
function updateMovDatalists(){
  ['sortie','entree'].forEach(kind=>{
    (MOVCFG[kind].fields||[]).forEach(f=>{
      const dl=document.getElementById('dl_'+kind+'_'+f.key);
      if(dl)dl.innerHTML=movSugFor(kind,f).map(v=>'<option value="'+esc(v)+'"></option>').join('');
    });
  });
}
function movFieldsHTML(kind,mf){
  const c=MOVCFG[kind];
  const flds=(c.fields||[]).map(f=>{
    const dlId='dl_'+kind+'_'+f.key;
    const opts=movSugFor(kind,f).map(v=>'<option value="'+esc(v)+'"></option>').join('');
    return '<label class="mv-fld-lbl">'+esc(f.label)
      +'<input class="mv-fld" data-key="'+f.key+'" list="'+dlId+'" value="'+esc(mf[f.key]||'')+'" placeholder="'+esc(f.place||'')+'" autocomplete="off">'
      +'<datalist id="'+dlId+'">'+opts+'</datalist></label>';
  }).join('');
  return '<div class="pf-sec"><div class="pf-h">'+esc(c.fieldsTitle||c.refLabel)+'</div><div class="mv-flds">'+flds+'</div>'
    +'<button type="button" id="mvSugManage" class="b-sec sug-manage">⚙ Gérer les suggestions</button>'
    +'<div id="mvSugPanel" class="sug-panel" style="display:none"></div></div>';
}
/* Panneau lisible pour retirer a la main les suggestions polluees (une par une). */
function movSugPanelHTML(kind){
  return (MOVCFG[kind].fields||[]).map(f=>{
    const vals=movSugFor(kind,f);
    const chips=vals.length
      ? vals.map(v=>'<span class="sug-chip">'+esc(v)+'<button type="button" class="sug-x" data-fkey="'+esc(f.key)+'" data-val="'+esc(v)+'" title="retirer">✕</button></span>').join('')
      : '<span class="sug-empty">— aucune —</span>';
    return '<div class="sug-grp"><div class="sug-lbl">'+esc(f.label)+'</div><div class="sug-chips">'+chips+'</div></div>';
  }).join('');
}
function movArts(catKind){return catKind==='finis'?finishedProductRefs():nonFinishedRefs();}
function movHasInput(mf){return (mf.finis||[]).some(x=>x.a&&num(x.q)>0)||(mf.mp||[]).some(x=>x.a&&num(x.q)>0);}
function movValidLines(rows){return (rows||[]).filter(x=>x&&x.a&&num(x.q)>0);}
function movIncompleteLines(rows){return (rows||[]).filter(x=>x&&num(x.q)>0&&!x.a);}
function movInputGuard(kind,mf){
  const badFinis=movIncompleteLines(mf.finis);
  const badMp=movIncompleteLines(mf.mp);
  if(badFinis.length||badMp.length){toast('Choisir l article pour chaque ligne avec quantite');return null;}
  const finis=movValidLines(mf.finis),mp=movValidLines(mf.mp);
  if(!finis.length&&!mp.length){toast('Rien a soumettre');return null;}
  return {finis,mp};
}
/* E3/R3-9 : a l'ENTREE, une matiere perissable (g vrac/tare) avec quantite doit avoir
   une date de peremption (fiabilise le FEFO). Emballages non concernes. Renvoie les
   lignes fautives (vide = OK). */
/* Peremption pertinente uniquement pour une matiere perissable (g=vrac ou tare) : les
   emballages (cartons, sacs...) n'ont pas de date. Une seule definition sert a la fois
   a AFFICHER le champ date et au garde-fou FEFO. */
function mpNeedsExp(des){const r=REFS.find(rr=>rr.des===des);return !!(r&&(r.g==='vrac'||r.g==='tare'));}
function entreeMpSansPeremption(kind,mf){
  if(kind!=='entree')return [];
  return (mf.mp||[]).filter(x=>x&&x.a&&num(x.q)>0&&mpNeedsExp(x.a)&&!String(x.exp||'').trim());
}
function movPeremptionGuard(kind,mf){
  const bad=entreeMpSansPeremption(kind,mf);
  if(bad.length){toast('Date de peremption manquante pour '+bad.length+' matiere(s) : '+bad.map(x=>x.a).join(', '));return false;}
  return true;
}
async function movSave(kind,mf){
  const lines=movInputGuard(kind,mf);
  if(!lines)return false;
  if(!movPeremptionGuard(kind,mf))return false;
  const c=MOVCFG[kind];
  if(!mf.agent&&typeof USR!=='undefined'&&USR.nom)mf.agent=USR.nom;
  const rec={id:c.pfx+Date.now(),kind:kind,date:mf.date||todayStr(),agent:mf.agent||'',ref:movRefCombined(mf),matricule:mf.matricule||'',chauffeur:mf.chauffeur||'',dest:mf.dest||'',finis:clone(lines.finis),mp:clone(lines.mp),photos:clone(mf.photos||[]),note:mf.note,savedAt:Date.now()};
  rec._sig=localSig(kind,{date:rec.date,ref:rec.ref,finis:rec.finis,mp:rec.mp,note:rec.note||''});
  if(await findLocalDuplicate(kind,rec._sig,rec.id)){toast(c.word+' deja enregistree dans l historique local');return false;}
  try{await idbPut(rec);movRememberSuggestions(kind,mf);toast(c.saved);return true;}catch(e){toast('Échec de l\u2019enregistrement');return false;}
}
async function movSubmit(kind,mf){
  const lines=movInputGuard(kind,mf);
  if(!lines)return false;
  if(!movPeremptionGuard(kind,mf))return false;
  if(!mf.agent&&typeof USR!=='undefined'&&USR.nom)mf.agent=USR.nom;
  const payload={kind:kind,date:mf.date||todayStr(),agent:mf.agent||'',ref:movRefCombined(mf),matricule:mf.matricule||'',chauffeur:mf.chauffeur||'',dest:mf.dest||'',finis:clone(lines.finis),mp:clone(lines.mp),photos:clone(mf.photos||[]),note:mf.note||'',submittedAt:new Date().toISOString()};
  await sipsSubmit(kind,payload,MOVCFG[kind].word+' '+(payload.date||''));
  movRememberSuggestions(kind,mf);
  return true;
}
function movSectionHTML(mf,sec,title,withExp){
  const arts=movArts(sec);
  const artOpts=sel=>arts.map(r=>`<option value="${esc(r.des)}"${r.des===sel?' selected':''}>${laityOpt(r.des)}</option>`).join('');
  const expCell=x=>withExp?`<input class="mv-exp" type="date" title="date de péremption" value="${esc(x.exp||'')}"${mpNeedsExp(x.a)?'':' style="display:none"'}>`:'';
  let rows=mf[sec].map((x,i)=>`<div class="pf-row${withExp?' pf-row-exp':''}" data-sec="${sec}" data-li="${i}"><select class="mv-a"><option value="">— article —</option>${artOpts(x.a)}</select><input class="mv-q" inputmode="decimal" placeholder="qté" value="${esc(x.q)}">${expCell(x)}<button class="mv-del" title="retirer">✕</button></div>`).join('');
  const hint=withExp?'<small style="display:block;font-size:11px;color:var(--mute);margin:2px 0 6px">Date de péremption demandée seulement pour les matières périssables (vrac/tare), suivi FEFO.</small>':'';
  return '<div class="pf-sec"><div class="pf-h">'+title+'</div>'+hint+'<div class="mv-lines" data-secwrap="'+sec+'">'+rows+'</div><button class="mv-add pf-add" data-addsec="'+sec+'">+ article</button></div>';
}
function renderMov(kind,focusSel){
  const c=MOVCFG[kind];
  if(!MOVF[kind])MOVF[kind]=freshMov();
  const mf=MOVF[kind];
  if(!mf.agent&&typeof USR!=='undefined'&&USR.nom)mf.agent=USR.nom;
  if(!mf.finis||!mf.finis.length)mf.finis=[{a:'',q:''}];
  if(!mf.mp||!mf.mp.length)mf.mp=[{a:'',q:''}];
  const app=$('#app');
  const view=!!MOVVIEW[kind],sub=MOVVIEW[kind];
  app.innerHTML='<div class="prod-wrap">'
    +'<h2 class="prod-title">'+c.title+(view?' — consultation':'')+'</h2>'
    +(view?'<p class="ref-hint" style="background:#eef4fb;border:1px solid #d6e4f2;border-radius:8px;padding:8px 10px">Fiche serveur en <b>lecture seule</b>. Valide / Rejette en bas, ou ← Retour.</p>':'<button id="mvGoHist" class="hist-jump">Aller à Historique ⬇</button>')
    +'<div class="pf-id"><label>Date<input type="date" id="mvDate" value="'+esc(mf.date)+'"></label><label>Opérateur<input id="mvAgent" readonly style="background:#eef2f6;color:var(--mute)" value="'+esc(mf.agent||'')+'"></label></div>'
    +movFieldsHTML(kind,mf)
    +movSectionHTML(mf,'finis',kind==='entree'?'Produits finis (retours)':'Produits finis')
    +movSectionHTML(mf,'mp','Matières premières / Échantillons',kind==='entree')
    +'<div class="pf-sec"><div class="pf-h">Photo(s)</div><div id="mvPhotos" class="photo-row"></div></div>'
    +noteSectionHTML('mvNote',mf.note)
    +(view?'<div class="pf-actions"><button id="mvViewBack" class="b-sec">← Retour</button><button id="mvViewValidate" class="b-go">✅ Valider</button><button id="mvViewReject" class="del">🚫 Rejeter</button></div>'
          :'<div class="pf-actions"><button id="mvSubmit" class="b-go">Soumettre au serveur</button><button id="mvSave" class="b-sec">Enregistrer localement</button><button id="mvNew" class="b-sec">Nouvelle fiche</button></div>')
    +(view?'':'<div id="mvPending"></div><div class="pf-sec" id="mvHistory"><div class="pf-h">Historique des '+(kind==='entree'?'entrées':'sorties')+'</div><div id="mvHist">Chargement…</div></div>')
    +'</div>';
  const re=()=>renderMov(kind);
  if(view){
    photoRowReadonly($('#mvPhotos'),mf.photos);
    app.querySelectorAll('input,select,textarea,button').forEach(el=>{if(['mvViewBack','mvViewValidate','mvViewReject'].indexOf(el.id)<0)el.disabled=true;});
    $('#mvViewBack').onclick=()=>movExitView(kind);
    $('#mvViewValidate').onclick=async()=>{if(await sipsDecide(sub.id,'validate'))movExitView(kind);};
    $('#mvViewReject').onclick=async()=>{if(await sipsDecide(sub.id,'reject'))movExitView(kind);};
    window.scrollTo(0,0);return;
  }
  $('#mvGoHist').onclick=()=>scrollToHistory('mvHistory');
  $('#mvDate').onchange=e=>{mf.date=e.target.value;};
  app.querySelectorAll('.mv-fld').forEach(inp=>{inp.oninput=e=>{mf[e.target.dataset.key]=e.target.value;};});
  const sugPanel=$('#mvSugPanel'),sugBtn=$('#mvSugManage');
  if(sugBtn&&sugPanel){
    const paint=()=>{sugPanel.innerHTML=movSugPanelHTML(kind);
      sugPanel.querySelectorAll('.sug-x').forEach(b=>b.onclick=()=>{
        const f=(MOVCFG[kind].fields||[]).find(ff=>ff.key===b.dataset.fkey);
        if(f){movSugForget(f,b.dataset.val);paint();updateMovDatalists();}});};
    sugBtn.onclick=()=>{const show=sugPanel.style.display==='none';sugPanel.style.display=show?'':'none';if(show)paint();};
  }
  $('#mvNote').oninput=e=>{mf.note=e.target.value;};
  app.querySelectorAll('.pf-row[data-sec]').forEach(row=>{const sec=row.dataset.sec;const i=+row.dataset.li;
    row.querySelector('.mv-a').onchange=e=>{mf[sec][i].a=e.target.value;const ex=row.querySelector('.mv-exp');if(ex){const need=mpNeedsExp(e.target.value);ex.style.display=need?'':'none';if(!need){ex.value='';mf[sec][i].exp='';}}};
    row.querySelector('.mv-q').oninput=e=>{mf[sec][i].q=e.target.value;};
    const ex=row.querySelector('.mv-exp');if(ex)ex.onchange=e=>{mf[sec][i].exp=e.target.value;};
    row.querySelector('.mv-del').onclick=()=>{mf[sec].splice(i,1);if(!mf[sec].length)mf[sec].push({a:'',q:''});re();};});
  app.querySelectorAll('.mv-add').forEach(btn=>{const sec=btn.dataset.addsec;btn.onclick=()=>{mf[sec].push({a:'',q:'',exp:''});renderMov(kind,sec+'-'+(mf[sec].length-1));};});
  photoArrayUI($('#mvPhotos'),mf.photos,re);
  $('#mvSave').onclick=async()=>{if(await movSave(kind,mf))loadMovHist(kind);};
  $('#mvSubmit').onclick=async(e)=>{const b=e.currentTarget;if(b.disabled)return;b.disabled=true;const t=b.textContent;b.textContent='Envoi…';try{await movSubmit(kind,mf);}finally{b.disabled=false;b.textContent=t;}};
  $('#mvNew').onclick=()=>{if(confirm('Vider la fiche en cours ?')){MOVF[kind]=freshMov();re();}};
  loadMovHist(kind);
  sipsLoadPendingInto('mvPending',kind,sipsViewMovementForm);
  refreshMovSuggestions();   // fusionne les suggestions partagées (serveur) dans les datalists
  if(focusSel){const r=app.querySelector('.pf-row[data-sec="'+focusSel.split('-')[0]+'"][data-li="'+focusSel.split('-')[1]+'"]');if(r)setTimeout(()=>scrollCardIntoView(r),60);}
}
function renderMovHist(host,kind,recs,serverRows){
  const c=MOVCFG[kind];
  host.innerHTML='';
  host.innerHTML=histFilterHTML(kind);
  bindHistFilter(host,kind,()=>loadMovHist(kind));
  recs=histApply(recs,kind,false).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
  serverRows=histApply(serverRows,kind,true).sort((a,b)=>String(b.validatedAt||'').localeCompare(String(a.validatedAt||'')));
  const srvClip=histClip(serverRows),locClip=histClip(recs);
  if(serverRows.length){
    const h=document.createElement('div');h.style.cssText='font-size:12px;font-weight:800;color:var(--green);margin:0 0 6px;text-transform:uppercase';
    h.textContent='Validees serveur';host.append(h);
    srvClip.rows.forEach(row=>{
      const rec=row.payload||{};
      const nf=(rec.finis||[]).filter(x=>x.a&&num(x.q)>0).length;const nm=(rec.mp||[]).filter(x=>x.a&&num(x.q)>0).length;const ph=(rec.photos||[]).length;
      const it=document.createElement('div');it.className='hist-item locked';
      it.innerHTML='<div class="info"><b>'+frDate(rec.date)+'</b><span>VALIDEE serveur - '+(rec.agent?esc(rec.agent)+' - ':'')+esc(rec.ref||'—')+' - '+nf+' fini(s) - '+nm+' MP - '+ph+' photo(s)</span>'+histMovMini(rec)+'</div>';
      const open=document.createElement('button');open.textContent='Voir';open.onclick=()=>{MOVF[kind]={date:rec.date,agent:rec.agent||'',ref:rec.ref||'',matricule:rec.matricule||'',chauffeur:rec.chauffeur||'',dest:rec.dest||'',finis:(rec.finis&&rec.finis.length?clone(rec.finis):[{a:'',q:''}]),mp:(rec.mp&&rec.mp.length?clone(rec.mp):[{a:'',q:''}]),photos:clone(rec.photos||[]),note:rec.note||''};renderMov(kind);setTimeout(()=>window.scrollTo(0,0),0);};
      it.append(open);host.append(it);
    });
    if(srvClip.hidden){const p=document.createElement('p');p.className='hist-more';p.textContent=srvClip.hidden+' ligne(s) serveur masquee(s) par la limite d affichage.';host.append(p);}
  }
  if(recs.length){
    const h=document.createElement('div');h.style.cssText='font-size:12px;font-weight:800;color:var(--steel-d);margin:10px 0 6px;text-transform:uppercase';
    h.textContent='Locales sur cet appareil';host.append(h);
  }
  locClip.rows.forEach(rec=>{
    const nf=(rec.finis||[]).filter(x=>x.a&&num(x.q)>0).length;const nm=(rec.mp||[]).filter(x=>x.a&&num(x.q)>0).length;const ph=(rec.photos||[]).length;
    const it=document.createElement('div');it.className='hist-item';
    it.innerHTML='<div class="info"><b>'+frDate(rec.date)+'</b><span>'+(rec.ref||'—')+' - '+nf+' fini(s) - '+nm+' MP - '+ph+' photo(s)</span>'+histMovMini(rec)+'</div>';
    const open=document.createElement('button');open.textContent='Voir';open.onclick=()=>{MOVF[kind]={date:rec.date,agent:rec.agent||'',ref:rec.ref||'',matricule:rec.matricule||'',chauffeur:rec.chauffeur||'',dest:rec.dest||'',finis:(rec.finis&&rec.finis.length?clone(rec.finis):[{a:'',q:''}]),mp:(rec.mp&&rec.mp.length?clone(rec.mp):[{a:'',q:''}]),photos:clone(rec.photos||[]),note:rec.note||''};renderMov(kind);setTimeout(()=>window.scrollTo(0,0),0);};
    const del=document.createElement('button');del.className='del';del.textContent='Suppr.';del.onclick=async()=>{if(confirm('Supprimer ?')){await idbDel(rec.id);loadMovHist(kind);}};
    it.append(open,del);host.append(it);
  });
  if(locClip.hidden){const p=document.createElement('p');p.className='hist-more';p.textContent=locClip.hidden+' ligne(s) locale(s) masquee(s) par la limite d affichage.';host.append(p);}
  if(!recs.length&&!serverRows.length){const p=document.createElement('p');p.className='hist-empty';p.textContent='Aucune '+(kind==='entree'?'entree':'sortie')+' enregistree pour ce filtre.';host.append(p);}
}
// Affiche l'historique LOCAL tout de suite (sans attendre le serveur), puis ajoute
// les records serveur quand ils arrivent. Evite l'ecran vide de plusieurs secondes
// a chaque changement d'onglet quand le serveur est lent ou injoignable.
async function loadMovHist(kind){
  const c=MOVCFG[kind];const host=$('#mvHist');if(!host)return;
  let recs=[];try{recs=(await idbAll()).filter(r=>String(r.id).indexOf(c.pfx)===0).sort((a,b)=>b.savedAt-a.savedAt);}catch(e){}
  renderMovHist(host,kind,recs,[]);
  try{const serverRows=await sipsRecords(kind);if($('#mvHist')===host)renderMovHist(host,kind,recs,serverRows);}catch(e){}
}
function renderSorties(f){renderMov('sortie',f);}
function renderEntrees(f){renderMov('entree',f);}

/* ================= SERVEUR LOCAL ================= */
function sipsTypeLabel(t){return ({quality:'Qualite',sortie:'Sortie',entree:'Entree',production:'Production',inventory:'Inventaire',test:'Test'})[t]||t||'Soumission';}
function sipsQualityAvgBatchTime(payload){
  const rows=(payload&&payload.melanges)||[];
  let total=0,count=0;
  rows.forEach(b=>{
    if(!b||!b.heureDebut||!b.heureFin)return;
    const d=sipsTimeDiffMin(b.heureDebut,b.heureFin);
    if(d>0){total+=d;count++;}
  });
  if(!count)return '';
  return sipsFmtDuration(Math.round(total/count));
}
function sipsTimeDiffMin(start,end){
  const a=String(start||'').split(':'),f=String(end||'').split(':');
  return (parseInt(f[0],10)*60+parseInt(f[1],10))-(parseInt(a[0],10)*60+parseInt(a[1],10));
}
function sipsFmtDuration(min){
  if(!isFinite(min)||min<=0)return '';
  const h=Math.floor(min/60),m=min%60;
  return (h>0?h+'h':'')+(m<10?'0':'')+m+'min';
}
function sipsQualityBatchRows(payload){
  return ((payload&&payload.melanges)||[]).map(b=>{
    const d=(b&&b.heureDebut&&b.heureFin)?sipsFmtDuration(sipsTimeDiffMin(b.heureDebut,b.heureFin)):'';
    return Object.assign({},b,{duree:d});
  });
}
function sipsQualitySignedCount(visas){
  visas=visas||{};
  return (visas.operateur&&visas.operateur.signature?1:0)+((visas.responsableQualite&&visas.responsableQualite.signature)||(visas.responsableProd&&visas.responsableProd.signature)?1:0);
}
function sipsPayloadSummary(type,payload){
  payload=payload||{};
  if(type==='quality'){const i=payload.informations||{},v=payload.visas||{};const sigs=sipsQualitySignedCount(v);const avg=sipsQualityAvgBatchTime(payload);return (i.numeroLot||'lot ?')+' - '+recipeProductLabel(i.refProduit||'produit ?')+' - '+(i.dateProduction||payload.date||'date ?')+' - '+sigs+'/2 signatures obligatoires'+(avg?' - moy. batch '+avg:'');}
  if(type==='sortie'||type==='entree'){const nf=((payload.finis||[]).filter(x=>x.a&&num(x.q)>0).length);const nm=((payload.mp||[]).filter(x=>x.a&&num(x.q)>0).length);return (payload.date||'date ?')+' - '+(payload.ref||'sans ref')+' - '+nf+' fini(s), '+nm+' MP';}
  if(type==='production'){const nb=(payload.blocks||[]).filter(b=>b.p&&num(b.n)>0).length;return (payload.date||'date ?')+' - '+nb+' production(s) - scotch '+prodScotchText(prodScotchQty(payload));}
  if(type==='inventory'){return (payload.date||'date ?')+' - '+(payload.filled||0)+' article(s) comptés';}
  return payload.title||payload.message||'';
}
function sipsKV(rows){return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px;margin-top:8px">'+rows.filter(x=>x&&x[1]!=null&&x[1]!=='').map(x=>'<div style="background:#f7faf8;border:1px solid var(--line);border-radius:8px;padding:7px"><b style="display:block;font-size:11px;color:var(--mute);text-transform:uppercase">'+esc(x[0])+'</b><span style="font-size:13px">'+esc(x[1])+'</span></div>').join('')+'</div>';}
function sipsLines(title,rows,cols){
  rows=(rows||[]).filter(r=>r&&cols.some(c=>String(r[c[0]]||'').trim()));
  if(!rows.length)return '';
  return '<div class="sips-lines"><b>'+esc(title)+'</b>'+rows.map((r,i)=>'<div class="sips-line"><b>'+(i+1)+'.</b> '+cols.map(c=>{const v=r[c[0]];return v==null||v===''?'':'<span>'+esc(c[1])+': '+(c[2]?c[2](v,r):esc(v))+'</span>';}).filter(Boolean).join(' - ')+'</div>').join('')+'</div>';
}
function sipsSubmissionDetailHTML(s){
  const p=s.payload||{};
  if(s.type==='sortie'||s.type==='entree'){
    return sipsKV([['Date',frDate(p.date)],['Operateur',p.agent],['Reference',p.ref],['Photos',(p.photos||[]).length],['Note',p.note]])
      +sipsLines('Produits finis',p.finis,[['a','Article'],['q','Qte']])
      +sipsLines('Matieres premieres / Echantillons',p.mp,s.type==='entree'?[['a','Article'],['q','Qte'],['exp','Peremption']]:[['a','Article'],['q','Qte']]);
  }
  if(s.type==='quality'){
    const i=p.informations||{},v=p.visas||{};
    const visaRows=['operateur','responsableProd','responsableQualite'].map(k=>{const x=v[k]||{};return {role:k==='operateur'?'Operateur':(k==='responsableProd'?'Chef d usine':'Resp. qualite'),nom:x.nom||'',date:x.date||'',signature:x.signature?'oui':'non'};});
    return sipsKV([['Produit',recipeProductLabel(i.refProduit)],['Lot',i.numeroLot],['Date production',frDate(i.dateProduction||p.date)],['Heure debut',i.heureDebut],['Heure fin',i.heureFin],['Temps moyen/batch',sipsQualityAvgBatchTime(p)],['Quantite produite',i.quantiteProduite?i.quantiteProduite+' kg':''],['Taille batch',i.tailleBatch?i.tailleBatch+' kg':''],['Correction de',p.correctionOf&&p.correctionOf.id],['Motif correction',p.correctionNote]])
      +sipsLines('Matieres premieres',p.matieresPremieres,[['designation','Designation'],['code','Code'],['refFournisseur','Ref fournisseur'],['dateProd','Date prod'],['dateExp','Date exp']])
      +sipsLines('Batches / melanges',sipsQualityBatchRows(p),[['batchNum','Batch'],['heureDebut','Debut'],['heureFin','Fin'],['duree','Duree']])
      +sipsLines('Visas',visaRows,[['role','Role'],['nom','Nom'],['date','Date'],['signature','Signature']]);
  }
  if(s.type==='production'){
    const prodBlocks=migrateProdRec(p).map(b=>Object.assign({},b,{bobTxt:prodBobText(b)}));
    return sipsKV([['Date',frDate(p.date)],['Operateur',p.agent],['Scotch utilise',prodScotchText(prodScotchQty(p))],['Note',p.note]])
      +sipsLines('Productions',prodBlocks,[['p','Produit',v=>esc(prodName(v))],['n','Qte',v=>'<b class="hist-qty">'+esc(histQty(v))+'</b>'],['w_emb','Dechet cartons/sacs',v=>'<b class="hist-qty">'+esc(histQty(v))+'</b>'],['w_film','Dechet film',v=>'<b class="hist-qty">'+esc(histQty(v))+'</b>'],['w_mel','Dechet melange (kg)',v=>'<b class="hist-qty">'+esc(histQty(v))+'</b>'],['scotch','Scotch bobines',v=>'<b class="hist-qty">'+esc(histQty(v))+'</b>'],['bobTxt','Bobine film',v=>'<b class="hist-qty">'+esc(v)+'</b>']]);
  }
  if(s.type==='inventory'){
    const detail=Object.keys(p.detail||{}).map(code=>{
      const src=p.st&&p.st.c&&p.st.c[code]||{};
      return Object.assign({code:code,by:src.by||''},p.detail[code]);
    });
    return sipsKV([['Date',frDate(p.date)],['Compteur',p.agent],['Articles comptes',p.filled],['Recomptage de',p.recountOf&&p.recountOf.id],['Alertes bilan',p.bilan&&p.bilan.nbAlertes],['Ecart total',p.bilan&&p.bilan.total]])
      +(s.recountRequested?'<p style="color:var(--red);font-size:12px;margin:6px 0 0">Recomptage demande</p>':'')
      +sipsLines('Articles comptes',detail.slice(0,80),[['code','Code'],['n','Article'],['by','Compté par'],['p','Physique'],['t','Theorique'],['e','Ecart']]);
  }
  return '<pre style="white-space:pre-wrap;font-size:12px;background:#f7faf8;border:1px solid var(--line);border-radius:8px;padding:8px;margin:8px 0 0">'+esc(JSON.stringify(p,null,2).slice(0,2000))+'</pre>';
}
/* Vue de revue plein ecran : compare le snapshot d une soumission inventaire a l ERP admin (ETAT),
   reutilise le moteur Bilan (buildBilanFrom), puis offre Valider / Demander recomptage. */
function sipsOpenInventoryReview(s){
  if(!s){toast('Soumission introuvable');return;}
  const p=s.payload||{};
  if(!p.st||!p.st.c){toast('Soumission sans detail de comptage');return;}
  let r;try{r=buildBilanFrom(p.st);}catch(e){toast('Bilan indisponible : '+e.message);return;}
  // Spec C : attribution par article (compte par X) + cibles de recompte (articles anormaux -> leur compteur).
  r.rows.forEach(x=>{const e=p.st.c[x.code];if(e&&e.by)x.by=e.by;});
  const recountTargets=r.rows.filter(x=>x.counted&&!x.ok&&p.st.c[x.code]&&p.st.c[x.code].byUser)
    .map(x=>({code:x.code,by:p.st.c[x.code].by||'',byUser:p.st.c[x.code].byUser}));
  const counted=r.rows.filter(x=>x.counted).length;
  const who=p.agent||(s.author&&s.author.name)||'—';
  const app=$('#app');
  app.innerHTML='<div class="bilan-wrap">'
    +'<div class="bil-ctrl"><button id="revBack" class="b-sec">← Retour serveur</button>'
    +'<button id="revValidate" class="b-go">✅ Valider</button>'
    +'<button id="revRecount" class="del">↩ Demander recomptage</button></div>'
    +'<h2 class="prod-title">Revue inventaire — '+esc(who)+' '+esc(frDate(p.date)||'')+'</h2>'
    +'<div class="bil-pair '+(r.alertes.length?'warn':'ok')+'">'
      +(r.alertes.length?('⚠ '+r.alertes.length+' ecart(s) a verifier'):'✓ Aucun ecart bloquant')
      +' · ecart total <b>'+fmtq(Math.round(r.total*1000)/1000)+'</b> · '+counted+' article(s) comptes vs etat de stock du <b>'+esc(ETAT_DATE||'—')+'</b></div>'
    +fullTablesHTML(r)+'</div>';
  $('#revBack').onclick=()=>{switchTab('serveur');};
  $('#revValidate').onclick=()=>sipsReviewDecide(s.id,'validate');
  $('#revRecount').onclick=()=>sipsReviewDecide(s.id,'recount',recountTargets);
}
async function sipsReviewDecide(id,kind,targets){
  const actor=(typeof USR!=='undefined'&&USR.nom)||'admin';
  if(kind==='validate'){
    if(!confirm('Valider cet inventaire ?\n\nIl deviendra la base officielle du Bilan.'))return;
    if(typeof authConfirmPassword==='function'&&!(await authConfirmPassword('valider cet inventaire')))return;
    try{await sipsFetch('/api/submissions/'+encodeURIComponent(id)+'/validate',{method:'POST',headers:sipsAdminHeaders(),body:JSON.stringify({actor:actor})});toast('Inventaire valide');}
    catch(e){toast('Erreur serveur : '+e.message);return;}
  }else{
    const note=prompt('Motif du recomptage (articles a revoir) ?','Recompter les ecarts signales');
    if(note===null)return;
    if(typeof authConfirmPassword==='function'&&!(await authConfirmPassword('demander un recomptage')))return;
    const body={actor:actor,note:note||'',recountRequested:true};
    // Spec C : recompte CIBLE -> chaque article anormal repart vers SON compteur (byUser).
    if(targets&&targets.length){
      const names=[...new Set(targets.map(t=>t.by).filter(Boolean))].join(', ');
      if(confirm('Renvoyer '+targets.length+' article(s) anormal(aux) en recompte cible'+(names?' a '+names:'')+' ?\n\nAnnuler = recomptage general (tout l inventaire).'))body.recountArticles=targets;
    }
    try{await sipsFetch('/api/submissions/'+encodeURIComponent(id)+'/reject',{method:'POST',headers:sipsAdminHeaders(),body:JSON.stringify(body)});toast(body.recountArticles?'Recompte cible demande':'Recomptage demande');}
    catch(e){toast('Erreur serveur : '+e.message);return;}
  }
  switchTab('serveur');
}
/* ---- Consultation LECTURE SEULE d'une soumission serveur DANS son formulaire (prod/entree/sortie).
   Comme pour Qualite : le "Voir" est sur l'onglet respectif, pas sur Serveur. On charge le payload
   dans le formulaire reel, en lecture seule, sans ecraser le brouillon en cours (stashe + restaure). */
function photoRowReadonly(host,arr){
  if(!host)return;host.innerHTML='';
  const imgs=(arr||[]).filter(Boolean);
  if(!imgs.length){host.innerHTML='<span style="font-size:12px;color:var(--mute)">Aucune photo</span>';return;}
  imgs.forEach(b=>{const th=document.createElement('img');th.className='photo-thumb';th.src=b;th.onclick=()=>openLightbox('Photo',b);host.append(th);});
}
function prodPFfromPayload(p){p=p||{};return {date:p.date||'',agent:p.agent||'',blocks:clone(migrateProdRec(p)),note:p.note||''};}
function movMFfromPayload(p){p=p||{};return {date:p.date||'',agent:p.agent||'',ref:p.ref||'',matricule:p.matricule||'',chauffeur:p.chauffeur||'',dest:p.dest||'',finis:(p.finis&&p.finis.length?clone(p.finis):[{a:'',q:''}]),mp:(p.mp&&p.mp.length?clone(p.mp):[{a:'',q:''}]),photos:clone(p.photos||[]),note:p.note||''};}
function sipsViewProductionForm(s){
  if(!s||!s.payload){toast('Fiche introuvable');return;}
  if(!PFVIEW)PF_BACKUP=PF;                       // stashe le brouillon operateur une seule fois
  PF=prodPFfromPayload(s.payload);PFVIEW=s;switchTab('prod');
}
function prodExitView(){PF=PF_BACKUP||freshPF();PF_BACKUP=null;PFVIEW=null;switchTab('prod');}
function sipsViewMovementForm(s){
  if(!s||!s.payload){toast('Fiche introuvable');return;}
  const kind=s.type;if(kind!=='sortie'&&kind!=='entree')return;
  if(!MOVVIEW[kind])MOV_BACKUP[kind]=MOVF[kind];
  MOVF[kind]=movMFfromPayload(s.payload);MOVVIEW[kind]=s;switchTab(kind==='entree'?'entree':'sorties');
}
function movExitView(kind){MOVF[kind]=MOV_BACKUP[kind]||freshMov();MOV_BACKUP[kind]=null;MOVVIEW[kind]=null;switchTab(kind==='entree'?'entree':'sorties');}
/* Liste des soumissions EN ATTENTE (non validees) d'un type, avec bouton Voir. Reservee aux
   valideurs (onglet Serveur present). Rendue dans le formulaire de l'onglet correspondant. */
async function sipsLoadPendingInto(hostId,type,onView){
  const host=$('#'+hostId);if(!host)return;
  if(!(typeof hasTab==='function'&&hasTab('serveur'))){host.innerHTML='';return;}
  let rows=[];
  try{const d=await sipsFetch('/api/submissions?status=submitted&type='+type+'&include=payload',{headers:sipsAdminHeaders()});rows=d.submissions||[];}
  catch(e){host.innerHTML='';return;}
  if(!rows.length){host.innerHTML='';return;}
  let h='<div class="pf-sec"><div class="pf-h" style="color:#9a6500">En attente de validation ('+rows.length+')</div>';
  rows.forEach((s,idx)=>{
    const p=s.payload||{};let meta;
    if(type==='production'){const bl=migrateProdRec(p);meta=(p.agent?esc(p.agent)+' - ':'')+bl.filter(b=>b.p&&num(b.n)>0).length+' produit(s) - '+bl.reduce((a,b)=>a+((b.photos||[]).length),0)+' photo(s)';}
    else{const nf=(p.finis||[]).filter(x=>x.a&&num(x.q)>0).length,nm=(p.mp||[]).filter(x=>x.a&&num(x.q)>0).length;meta=(p.agent?esc(p.agent)+' - ':'')+esc(p.ref||'—')+' - '+nf+' fini(s) - '+nm+' MP - '+((p.photos||[]).length)+' photo(s)';}
    h+='<div class="hist-item"><div class="info"><b>'+frDate(p.date)+'</b><span>'+meta+'</span></div><button data-vsub="'+idx+'">Voir</button></div>';
  });
  h+='</div>';host.innerHTML=h;
  host.querySelectorAll('[data-vsub]').forEach(b=>b.onclick=()=>onView(rows[+b.dataset.vsub]));
}
function sipsSubmissionHTML(s){
  const actor=s.author&&s.author.name?(' - '+esc(s.author.name)):'';
  const status=s.status==='submitted'?'En attente':(s.status==='validated'?'Validee':'Rejetee');
  const summary=sipsPayloadSummary(s.type,s.payload);
  const qVisas=(s.payload&&s.payload.visas)||{};
  const qReady=s.type!=='quality'||!!(qVisas.operateur&&qVisas.operateur.signature&&((qVisas.responsableQualite&&qVisas.responsableQualite.signature)||(qVisas.responsableProd&&qVisas.responsableProd.signature)));
  const actions=s.status==='submitted'
    ?(s.type==='inventory'
       ?'<button data-act="compare">Comparer au stock (Bilan)</button><button data-act="validate">Valider</button><button class="del" data-act="reject">Rejeter</button>'
       :(qReady?'<button data-act="validate">Valider</button>':'<button disabled title="Signatures obligatoires manquantes">Validation bloquee</button>')+(s.type==='quality'?'<button class="del" data-act="correction">Demander correction</button>':'')+'<button class="del" data-act="reject">Rejeter</button>')
    :'';
  const hint=s.type==='quality'?'<p class="ref-hint" style="flex-basis:100%;margin:4px 0 0">Ouverture et signature : onglet Qualite, section Fiches serveur a ouvrir / signer.</p>':'';
  return '<div class="hist-item" data-sub="'+esc(s.id)+'"><div class="info"><b>'+esc(sipsTypeLabel(s.type))+' - '+status+'</b><span>'+esc(summary)+actor+' - '+new Date(s.createdAt).toLocaleString('fr-FR')+'</span></div>'+actions+hint+'<div style="flex-basis:100%">'+sipsSubmissionDetailHTML(s)+'</div></div>';
}
function sipsRecordHTML(r){
  const rec=r.payload||{};
  const actor=r.validatedBy?(' - validé par '+esc(r.validatedBy)):'';
  const status=(r.status||'validated')==='cancelled'?'Annulé':'Validé';
  const cancelled=(r.status||'validated')==='cancelled';
  const summary=sipsPayloadSummary(r.type,rec);
  const date=r.validatedAt?new Date(r.validatedAt).toLocaleString('fr-FR'):'date inconnue';
  const extra=cancelled&&r.cancelledAt?(' - annulé le '+new Date(r.cancelledAt).toLocaleString('fr-FR')):'';
  return '<div class="hist-item'+(cancelled?'':' locked')+'" data-rec="'+esc(r.id)+'"><div class="info"><b>'+esc(sipsTypeLabel(r.type))+' - '+status+'</b><span>'+esc(summary)+actor+' - '+date+extra+'</span></div>'+(cancelled?'':'<button class="del" data-act="cancel">Annuler</button>')+'</div>';
}
function sipsPendingStats(rows){
  rows=rows||sipsPending();
  const blocked=rows.filter(r=>r&&r.lastStatus).length;
  return {total:rows.length,blocked:blocked,waiting:rows.length-blocked};
}
function sipsPendingHTML(){
  const rows=sipsPending();
  if(!rows.length)return '<p style="color:#6a7280;font-size:13px;margin:0">Aucune donnee locale en attente serveur.</p>';
  return rows.map((r,i)=>{
    const d=r.createdAt?new Date(r.createdAt).toLocaleString('fr-FR'):'date inconnue';
    const tried=r.lastTriedAt?(' - dernier essai '+new Date(r.lastTriedAt).toLocaleString('fr-FR')):'';
    const state=r.lastStatus?('Bloque serveur '+r.lastStatus):'Attente connexion';
    const cls=r.lastStatus?' blocked':' waiting';
    const err=r.lastError?'<small class="sync-error">'+esc(r.lastError+tried)+'</small>':'';
    return '<div class="sync-row'+cls+'" data-pend="'+i+'"><div class="sync-main"><b>'+esc(sipsTypeLabel(r.type))+' <em>'+esc(state)+'</em></b><span>'+esc(sipsPayloadSummary(r.type,r.payload))+'</span><small>'+esc(d)+' - '+esc((r.author&&r.author.name)||'')+'</small>'+err+'</div><button class="del" data-pdel="'+i+'">Retirer</button></div>';
  }).join('');
}
function renderSyncBox(statusText,statusOk){
  const rows=sipsPending();
  const stats=sipsPendingStats(rows);
  const cls=statusOk===true?' ok':(statusOk===false?' ko':'');
  return '<div class="pf-sec"><div class="pf-h">Synchronisation serveur</div>'
    +'<div class="sync-state'+cls+'"><b>'+(statusText||'Etat non teste')+'</b><span>'+stats.waiting+' attente / '+stats.blocked+' bloquee(s)</span></div>'
    +'<p class="ref-hint" style="margin:8px 0">Quand le serveur redevient joignable, l app essaie d envoyer cette file a la reouverture. Si une ligne est bloquee, le serveur a repondu mais a refuse la donnee : il faut lire la raison affichee.</p>'
    +'<div class="pf-actions"><button id="srvSyncTest" class="b-sec">Tester connexion</button><button id="srvSyncFlush" class="b-go">Envoyer attente ('+rows.length+')</button></div>'
    +'<div id="srvPendingList">'+sipsPendingHTML()+'</div></div>';
}
async function renderServeur(){
  const app=$('#app');const pending=sipsPending();
  app.innerHTML='<div class="prod-wrap"><h2 class="prod-title">Serveur local SIPS</h2>'
    +'<div class="pf-sec"><div class="pf-h">Connexion</div><div class="pf-id"><label>Adresse serveur<input id="srvUrl" placeholder="http://192.168.x.x:3000" value="'+esc((SIPS_SERVER&&SIPS_SERVER.url)||'')+'"></label><label>PIN serveur<input id="srvPin" type="password" value="'+esc((SIPS_SERVER&&SIPS_SERVER.adminPin)||'')+'"></label></div>'
    +'<div class="pf-actions"><button id="srvSave" class="b-sec">Enregistrer</button><button id="srvTest" class="b-go">Tester</button><button id="srvRefresh" class="b-sec">Actualiser liste</button><button id="srvFlush" class="b-sec">Envoyer attente ('+pending.length+')</button><button id="srvBackup" class="b-sec">Sauvegarde serveur</button></div><p id="srvStatus" class="ref-hint">URL active : '+esc(sipsServerUrl())+'</p></div>'
    +'<div id="srvSyncBox">'+renderSyncBox('Etat non teste',null)+'</div>'
    +'<div class="pf-sec"><div class="pf-h">Utilisateurs</div><div class="pf-actions"><button id="srvUserNew" class="b-go">+ Nouvel utilisateur</button><button id="srvUserReload" class="b-sec">Actualiser utilisateurs</button></div><div id="srvUsers">Chargement...</div></div>'
    +'<div class="pf-sec"><div class="pf-h">Soumissions en attente de validation</div><div id="srvSubs">Chargement...</div></div>'
    +'<div class="pf-sec"><div class="pf-h">Donnees validees</div><div id="srvRecords">Chargement...</div></div>'
    +'<div class="pf-sec"><div class="pf-h">Journal (audit)</div><div id="srvJournal">Chargement...</div></div></div>';
  $('#srvSave').onclick=function(){SIPS_SERVER={url:$('#srvUrl').value.trim(),adminPin:$('#srvPin').value.trim()};lsSet('lep_server_cfg',SIPS_SERVER);toast('Configuration serveur enregistree');renderServeur();};
  $('#srvTest').onclick=async function(){SIPS_SERVER={url:$('#srvUrl').value.trim(),adminPin:$('#srvPin').value.trim()};lsSet('lep_server_cfg',SIPS_SERVER);const r=await sipsPing();$('#srvStatus').textContent=r.ok?'Serveur connecte - '+r.data.time:'Hors ligne - '+r.error;};
  $('#srvRefresh').onclick=async function(){SIPS_SERVER={url:$('#srvUrl').value.trim(),adminPin:$('#srvPin').value.trim()};lsSet('lep_server_cfg',SIPS_SERVER);await sipsLoadServeur();toast('Liste serveur actualisee');};
  $('#srvFlush').onclick=async function(){SIPS_SERVER={url:$('#srvUrl').value.trim(),adminPin:$('#srvPin').value.trim()};lsSet('lep_server_cfg',SIPS_SERVER);await sipsFlushPending();renderServeur();};
  $('#srvBackup').onclick=async function(){SIPS_SERVER={url:$('#srvUrl').value.trim(),adminPin:$('#srvPin').value.trim()};lsSet('lep_server_cfg',SIPS_SERVER);await sipsCreateBackup();};
  bindSyncBox();
  $('#srvUserNew').onclick=function(){sipsUserDialog(null,sipsUserRoles||[]);};
  $('#srvUserReload').onclick=function(){sipsLoadUsers();};
  await sipsLoadServeur();
  await sipsLoadUsers();
  await sipsLoadJournal();
}
/* ---- Journal (audit) : lecture admin + suppression CIBLEE (entree / periode) ---- */
let SIPS_AUDIT_FILTER='all';
function sipsAuditLabel(a){return ({
  'submission.created':'Soumission creee','submission.validated':'Validee','submission.rejected':'Rejetee',
  'submission.duplicate':'Doublon ignore','submission.duplicate_lot':'Doublon lot ignore',
  'quality.signature':'Signature qualite','record.cancelled':'Mouvement annule','audit.pruned':'Journal purge'
})[a]||a||'Action';}
function sipsAuditDetail(e){
  const d=(e&&e.details)||{};const bits=[];
  if(d.type)bits.push(sipsTypeLabel(d.type));
  if(d.lot)bits.push('lot '+d.lot);
  if(d.note)bits.push('motif : '+d.note);
  if(d.reason)bits.push('motif : '+d.reason);
  if(typeof d.removed==='number')bits.push(d.removed+' entree(s)'+(d.beforeDate?(' (<= '+d.beforeDate+')'):''));
  if(d.id)bits.push('#'+String(d.id).slice(0,12));
  return bits.join(' · ');
}
async function sipsLoadJournal(){
  const host=$('#srvJournal');if(!host)return;
  let rows=[],total=0;
  try{const data=await sipsFetch('/api/audit?limit=300',{headers:sipsAdminHeaders()});rows=data.audit||[];total=data.total||rows.length;}
  catch(e){host.innerHTML='<p style="color:var(--red);font-size:13px;margin:0">Journal indisponible : '+esc(e.message)+(String(e.message).indexOf('admin')>=0?' - connecte-toi en admin ou renseigne le PIN serveur.':'')+'</p>';return;}
  const cats=[['all','Tout'],['record.cancelled','Annulations'],['submission.rejected','Rejets'],['submission.validated','Validations'],['submission.created','Creations']];
  const filtered=SIPS_AUDIT_FILTER==='all'?rows:rows.filter(r=>r.action===SIPS_AUDIT_FILTER);
  let h='<div class="pf-actions" style="flex-wrap:wrap;gap:6px;align-items:center">'
    +'<select id="audFilter">'+cats.map(c=>'<option value="'+c[0]+'"'+(c[0]===SIPS_AUDIT_FILTER?' selected':'')+'>'+c[1]+'</option>').join('')+'</select>'
    +'<input id="audBefore" type="date" style="max-width:160px">'
    +'<button id="audDelBefore" class="b-sec">Supprimer cette periode et avant</button></div>'
    +'<p class="ref-hint" style="margin:6px 0">'+filtered.length+' entree(s) affichee(s) sur '+total+' au total. Lecture seule ; suppression ciblee (entree ou periode).</p>';
  if(!filtered.length)h+='<p style="color:#6a7280;font-size:13px;margin:0">Aucune entree pour ce filtre.</p>';
  else h+=filtered.slice(0,300).map(function(e){
    const when=e.at?new Date(e.at).toLocaleString('fr-FR'):'?';
    return '<div class="sync-row" data-aud="'+esc(e.id)+'"><div class="sync-main"><b>'+esc(sipsAuditLabel(e.action))+'</b><span>'+esc(sipsAuditDetail(e))+'</span><small>'+esc(when)+' - '+esc(e.actor||'?')+'</small></div><button class="del" data-auddel="'+esc(e.id)+'">Suppr.</button></div>';
  }).join('');
  host.innerHTML=h;
  const fl=$('#audFilter');if(fl)fl.onchange=function(){SIPS_AUDIT_FILTER=fl.value;sipsLoadJournal();};
  const bd=$('#audDelBefore');if(bd)bd.onclick=function(){const d=$('#audBefore').value;if(!d){toast('Choisis une date');return;}sipsAuditDeleteBefore(d);};
  host.querySelectorAll('[data-auddel]').forEach(function(b){b.onclick=function(){sipsAuditDelete([b.dataset.auddel]);};});
}
async function sipsAuditDelete(ids){
  if(!ids||!ids.length)return;
  if(!confirm('Supprimer '+ids.length+' entree(s) du journal ?\n\nCette suppression est elle-meme tracee.'))return;
  if(typeof authConfirmPassword==='function'&&!(await authConfirmPassword('supprimer une entree du journal')))return;
  try{const r=await sipsFetch('/api/audit/delete',{method:'POST',headers:sipsAdminHeaders(),body:JSON.stringify({ids:ids,actor:(typeof USR!=='undefined'&&USR.nom)||'admin'})});toast((r.removed||0)+' entree(s) supprimee(s)');}
  catch(e){toast('Erreur : '+e.message);return;}
  sipsLoadJournal();
}
async function sipsAuditDeleteBefore(beforeDate){
  if(!confirm('Supprimer toutes les entrees du journal datees du '+beforeDate+' ou avant ?\n\nCette suppression est elle-meme tracee.'))return;
  if(typeof authConfirmPassword==='function'&&!(await authConfirmPassword('supprimer une periode du journal')))return;
  try{const r=await sipsFetch('/api/audit/delete',{method:'POST',headers:sipsAdminHeaders(),body:JSON.stringify({beforeDate:beforeDate,actor:(typeof USR!=='undefined'&&USR.nom)||'admin'})});toast((r.removed||0)+' entree(s) supprimee(s)');}
  catch(e){toast('Erreur : '+e.message);return;}
  sipsLoadJournal();
}
function bindSyncBox(){
  const tst=$('#srvSyncTest');if(tst)tst.onclick=async function(){
    SIPS_SERVER={url:$('#srvUrl').value.trim(),adminPin:$('#srvPin').value.trim()};lsSet('lep_server_cfg',SIPS_SERVER);
    const r=await sipsPing();
    const box=$('#srvSyncBox');if(box){box.innerHTML=renderSyncBox(r.ok?'Serveur connecte':'Serveur hors ligne : '+r.error,!!r.ok);bindSyncBox();}
  };
  const fl=$('#srvSyncFlush');if(fl)fl.onclick=async function(){
    SIPS_SERVER={url:$('#srvUrl').value.trim(),adminPin:$('#srvPin').value.trim()};lsSet('lep_server_cfg',SIPS_SERVER);
    await sipsFlushPending();renderServeur();
  };
  document.querySelectorAll('[data-pdel]').forEach(b=>b.onclick=function(){
    const i=Number(b.dataset.pdel),rows=sipsPending();
    if(!rows[i])return;
    if(!confirm('Retirer cet element de la file locale ?\n\nIl ne sera pas envoye au serveur.'))return;
    rows.splice(i,1);sipsSetPending(rows);
    const box=$('#srvSyncBox');if(box){box.innerHTML=renderSyncBox('Element retire',null);bindSyncBox();}
  });
}
async function sipsLoadServeur(){
  const subs=$('#srvSubs'),records=$('#srvRecords');
  if(!subs||!records)return;   // vue plein ecran (Voir la fiche) : hosts absents, rien a recharger
  try{const data=await sipsFetch('/api/submissions?status=submitted&include=payload',{headers:sipsAdminHeaders()});const rows=data.submissions||[];subs.innerHTML=rows.length?rows.map(sipsSubmissionHTML).join(''):'<p style="color:#6a7280;font-size:13px;margin:0">Aucune soumission en attente.</p>';subs.querySelectorAll('[data-sub]').forEach(el=>{const id=el.dataset.sub;el.querySelectorAll('button[data-act]').forEach(b=>{const sub=rows.find(x=>x.id===id);if(b.dataset.act==='compare'){b.onclick=()=>sipsOpenInventoryReview(sub);}else{b.onclick=()=>sipsDecide(id,b.dataset.act);}});});}
  catch(e){subs.innerHTML='<p style="color:var(--red);font-size:13px;margin:0">Impossible de charger les soumissions : '+esc(e.message)+(String(e.message).indexOf('admin')>=0?' - connecte-toi avec un compte admin ou renseigne le PIN serveur.':'')+'</p>';}
  try{const data=await sipsFetch('/api/records?status=validated',{headers:sipsAdminHeaders()});const rows=(data.records||[]).slice().sort((a,b)=>String(b.validatedAt||'').localeCompare(String(a.validatedAt||'')));records.innerHTML=rows.length?rows.map(sipsRecordHTML).join(''):'<p style="color:#6a7280;font-size:13px;margin:0">Aucun enregistrement valide dans la base centrale.</p>';records.querySelectorAll('[data-rec]').forEach(el=>{const id=el.dataset.rec;const b=el.querySelector('button[data-act="cancel"]');if(b)b.onclick=()=>sipsCancelRecord(id);});}
  catch(e){records.innerHTML='<p style="color:var(--red);font-size:13px;margin:0">Impossible de charger les donnees validees : '+esc(e.message)+'</p>';}
}
async function sipsDecide(id,act){
  const isCorrection=act==='correction';
  const apiAct=isCorrection?'reject':act;
  const label=apiAct==='validate'?'valider':(isCorrection?'demander correction sur':'rejeter');
  if(!confirm(label.charAt(0).toUpperCase()+label.slice(1)+' cette soumission ?'))return false;
  const note=apiAct==='reject'?prompt(isCorrection?'Correction demandee ? La fiche sera conservee et reprise par l operateur.':'Motif du rejet ?','Correction demandee'):null;
  if(apiAct==='reject'&&note===null)return false;
  if(typeof authConfirmPassword==='function'&&!(await authConfirmPassword(label+' cette soumission')))return false;
  const row=document.querySelector('[data-sub="'+id+'"]');
  if(row){row.style.opacity=.55;row.querySelectorAll('button').forEach(b=>b.disabled=true);}
  let ok=false;
  try{await sipsFetch('/api/submissions/'+encodeURIComponent(id)+'/'+apiAct,{method:'POST',headers:sipsAdminHeaders(),body:JSON.stringify({actor:(typeof USR!=='undefined'&&USR.nom)||'admin',note:note||'',correction:isCorrection})});toast(apiAct==='validate'?'Soumission validee':(isCorrection?'Correction demandee':'Soumission rejetee'));ok=true;}
  catch(e){
    if(/trait/i.test(e.message||'')){toast('Deja traitee - liste mise a jour');if(row)row.remove();ok=true;}
    else{toast('Erreur serveur : '+e.message);if(row){row.style.opacity='';row.querySelectorAll('button').forEach(b=>b.disabled=false);}}
  }
  // Resynchronise la liste avec le serveur dans tous les cas : un element deja
  // traite (ailleurs / double-clic) disparait au lieu de rester affiche.
  try{await sipsLoadServeur();}catch(e){}
  // Met aussi a jour la pastille de notifications (sinon elle reste figee
  // jusqu'au prochain refresh complet de la page).
  try{await sipsRefreshNotifications();}catch(e){}
  return ok;
}
async function sipsCancelRecord(id){
  const reason=prompt('Motif pour annuler cet enregistrement validé ?','Erreur de saisie');
  if(reason===null)return;
  if(!confirm('Annuler cet enregistrement validé ?\n\nIl restera dans le journal serveur mais sera retiré des historiques officiels.'))return;
  if(typeof authConfirmPassword==='function'&&!(await authConfirmPassword('annuler cet enregistrement')))return;
  const row=document.querySelector('[data-rec="'+id+'"]');
  if(row){row.style.opacity=.55;row.querySelectorAll('button').forEach(b=>b.disabled=true);}
  try{await sipsFetch('/api/records/'+encodeURIComponent(id)+'/cancel',{method:'POST',headers:sipsAdminHeaders(),body:JSON.stringify({actor:(typeof USR!=='undefined'&&USR.nom)||'admin',reason:reason})});toast('Enregistrement annulé');}
  catch(e){
    if(/annul/i.test(e.message||'')){toast('Deja annule - liste mise a jour');if(row)row.remove();}
    else{toast('Erreur serveur : '+e.message);if(row){row.style.opacity='';row.querySelectorAll('button').forEach(b=>b.disabled=false);}}
  }
  try{await sipsLoadServeur();}catch(e){}
}
async function sipsCreateBackup(){
  try{const r=await sipsFetch('/api/backup',{method:'POST',headers:sipsAdminHeaders(),body:JSON.stringify({actor:(typeof USR!=='undefined'&&USR.nom)||'admin'})});toast('Sauvegarde serveur creee : '+(r.backup||''));if(r.backup)await sipsDownloadBackup(r.backup);}
  catch(e){toast('Erreur sauvegarde : '+e.message);}
}
async function sipsDownloadBackup(file){
  const res=await fetch(sipsServerUrl()+'/api/backups/'+encodeURIComponent(file),{headers:sipsAdminHeaders()});
  if(!res.ok)throw new Error('Telechargement impossible');
  const blob=await res.blob();const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=file;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
let sipsUserRows=[],sipsUserRoles=[];
function sipsRoleOptionHTML(roles,selected){
  roles=roles&&roles.length?roles:[{key:'admin',label:'Chef d usine'},{key:'magasinier',label:'Magasinier'},{key:'operateur',label:'Operateur'},{key:'preparateur',label:'Preparateur melanges'},{key:'responsableQualite',label:'Responsable qualite'}];
  return roles.map(r=>'<option value="'+esc(r.key)+'"'+(r.key===selected?' selected':'')+'>'+esc(r.label||r.key)+'</option>').join('');
}
function sipsUserHTML(u){
  const role=(sipsUserRoles||[]).find(r=>r.key===u.role);
  const status=u.enabled===false?'desactive':'actif';
  const pwd=u.mustChangePassword?' - mot de passe temporaire':'';
  const last=u.lastLogin?new Date(u.lastLogin).toLocaleString('fr-FR'):'jamais connecte';
  return '<div class="hist-item" data-user="'+esc(u.id)+'"><div class="info"><b>'+esc(u.nom||u.username||'Utilisateur')+' - '+esc(role?role.label:u.role)+'</b><span>@'+esc(u.username||'')+' - '+status+pwd+' - derniere connexion : '+esc(last)+'</span></div><button data-act="edit">Modifier</button><button class="'+(u.enabled===false?'valid':'del')+'" data-act="toggle">'+(u.enabled===false?'Reactiver':'Desactiver')+'</button></div>';
}
async function sipsLoadUsers(){
  const host=$('#srvUsers');if(!host)return;
  host.innerHTML='<p style="color:#6a7280;font-size:13px;margin:0">Chargement...</p>';
  try{
    const data=await sipsFetch('/api/auth/users',{headers:sipsAdminHeaders()});
    sipsUserRows=data.users||[];sipsUserRoles=data.roles||[];
    host.innerHTML=sipsUserRows.length?sipsUserRows.map(sipsUserHTML).join(''):'<p style="color:#6a7280;font-size:13px;margin:0">Aucun utilisateur.</p>';
    host.querySelectorAll('[data-user]').forEach(el=>{const u=sipsUserRows.find(x=>x.id===el.dataset.user);const b=el.querySelector('button[data-act="edit"]');if(b&&u)b.onclick=()=>sipsUserDialog(u,sipsUserRoles);const t=el.querySelector('button[data-act="toggle"]');if(t&&u)t.onclick=()=>sipsToggleUser(u);});
  }catch(e){
    host.innerHTML='<p style="color:var(--red);font-size:13px;margin:0">Gestion utilisateurs indisponible : '+esc(e.message)+(String(e.message).indexOf('admin')>=0?' - connecte-toi admin ou renseigne le PIN serveur.':'')+'</p>';
  }
}
async function sipsToggleUser(user){
  const enable=user.enabled===false;
  if(!confirm((enable?'Reactiver':'Desactiver')+' le compte '+(user.nom||user.username)+' ?'))return;
  try{
    await sipsFetch('/api/auth/users/'+encodeURIComponent(user.id),{method:'POST',headers:sipsAdminHeaders(),body:JSON.stringify({enabled:enable})});
    toast(enable?'Utilisateur reactive':'Utilisateur desactive');
    await sipsLoadUsers();
  }catch(e){toast('Erreur utilisateur : '+e.message);}
}
function sipsUserDialog(user,roles){
  const editing=!!user;
  const dlg=document.createElement('dialog');
  dlg.style.cssText='border:none;border-radius:14px;padding:0;max-width:92vw;width:420px;box-shadow:0 20px 60px rgba(0,0,0,.35)';
  const enabled=user?user.enabled!==false:true;
  dlg.innerHTML='<div class="dlg-h"><b>'+(editing?'Modifier utilisateur':'Nouvel utilisateur')+'</b><button onclick="this.closest(\'dialog\').close()">×</button></div><div class="dlg-b">'
    +'<div style="margin-bottom:10px"><label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">Nom complet</label><input id="usrNom" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:8px;font-size:14px;box-sizing:border-box" value="'+esc(user?user.nom:'')+'" placeholder="Prenom Nom"></div>'
    +'<div style="margin-bottom:10px"><label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">Identifiant</label><input id="usrName" '+(editing?'readonly':'')+' autocapitalize="none" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:8px;font-size:14px;box-sizing:border-box;'+(editing?'background:#eef2f6;color:var(--mute);':'')+'" value="'+esc(user?user.username:'')+'" placeholder="identifiant"></div>'
    +'<div style="margin-bottom:10px"><label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">Role</label><select id="usrRoleSel" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:8px;font-size:14px;box-sizing:border-box">'+sipsRoleOptionHTML(roles,user?user.role:'operateur')+'</select></div>'
    +(editing?'<label style="display:flex;align-items:center;gap:8px;margin:8px 0 10px;font-size:13px"><input id="usrEnabled" type="checkbox" '+(enabled?'checked':'')+'> Compte actif</label>':'')
    +'<div style="margin-bottom:10px"><label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">'+(editing?'Mot de passe temporaire (optionnel)':'Mot de passe temporaire')+'</label><input id="usrPass" type="password" autocomplete="new-password" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:8px;font-size:14px;box-sizing:border-box" placeholder="'+(editing?'laisser vide pour ne pas changer':'4 caracteres minimum')+'"></div>'
    +'<div id="usrErr" style="display:none;color:#c0392b;font-size:13px;margin-bottom:10px"></div>'
    +'<div class="dlg-actions" style="gap:8px"><button class="b-sec" id="usrCancel" style="flex:1;padding:12px;border-radius:9px;border:1px solid var(--line);font-weight:700;font-size:14px;background:#fff">Annuler</button><button class="b-go" id="usrOk" style="flex:1;padding:12px;border-radius:9px;border:none;font-weight:700;font-size:14px;background:var(--green);color:#fff">Enregistrer</button></div>'
    +'</div>';
  document.body.appendChild(dlg);dlg.showModal();
  dlg.querySelector('#usrCancel').onclick=function(){dlg.close();dlg.remove();};
  dlg.querySelector('#usrOk').onclick=async function(){
    const err=dlg.querySelector('#usrErr');function show(m){err.textContent=m;err.style.display='';}
    const body={nom:dlg.querySelector('#usrNom').value.trim(),role:dlg.querySelector('#usrRoleSel').value};
    const pass=dlg.querySelector('#usrPass').value||'';
    if(editing){body.enabled=dlg.querySelector('#usrEnabled').checked;if(pass)body.password=pass;}
    else{body.username=dlg.querySelector('#usrName').value.trim().toLowerCase();body.password=pass;}
    if(!body.nom||(!editing&&!body.username)||(!editing&&!body.password)){show('Nom, identifiant et mot de passe sont requis.');return;}
    try{
      const path=editing?('/api/auth/users/'+encodeURIComponent(user.id)):'/api/auth/users';
      await sipsFetch(path,{method:'POST',headers:sipsAdminHeaders(),body:JSON.stringify(body)});
      dlg.close();dlg.remove();toast(editing?'Utilisateur mis a jour':'Utilisateur cree');await sipsLoadUsers();
    }catch(e){show(e.message||'Erreur serveur');}
  };
}
