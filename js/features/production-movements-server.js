/* ================= MODULE PRODUCTION ================= */
function todayStr(){const d=new Date();const p=n=>(n<10?'0':'')+n;return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}
function frDate(s){if(!s)return '—';const m=String(s).split('-');return m.length===3?m[2]+'/'+m[1]+'/'+m[0]:s;}
let PF=null;
const HIST_MAX=80;
const HIST_FILTERS={
  production:{mode:'all',value:''},
  sortie:{mode:'all',value:''},
  entree:{mode:'all',value:''}
};
function embType(p){const a=(typeof recipeProductRef==='function'&&recipeProductRef(p))||REFS.find(x=>x.code===p||x.des===p);if(a&&(a.m==='sac'||a.m==='vrac'))return 'sac';return 'carton';}
function freshBlock(){return {p:'',n:'',w_emb:'',w_film:'',w_mel:'',perso:[],photos:[]};}
function freshPF(){return {date:'',agent:(typeof USR!=='undefined'?USR.nom:''),blocks:[freshBlock()],note:''};}
function pfBlockHasInput(b){return (b.p&&num(b.n)>0)||num(b.w_emb)>0||num(b.w_film)>0||num(b.w_mel)>0||(b.perso||[]).some(x=>x.lbl&&num(x.qte)>0);}
function pfCompleteBlocks(pf){return (pf.blocks||[]).filter(b=>b&&b.p&&num(b.n)>0);}
function pfMissingProductBlocks(pf){return (pf.blocks||[]).filter(b=>pfBlockHasInput(b)&&(!b.p||num(b.n)<=0));}
function pfProductionGuard(pf){
  const bad=pfMissingProductBlocks(pf);
  if(bad.length){toast('Choisir un produit fini et une quantite pour chaque production renseignee');return null;}
  const blocks=pfCompleteBlocks(pf);
  if(!blocks.length){toast('Rien a soumettre');return null;}
  return blocks;
}
async function prodSave(pf){
  const blocks=pfProductionGuard(pf);
  if(!blocks)return false;
  const rec={id:'prod_'+Date.now(),kind:'prod',date:pf.date||todayStr(),agent:pf.agent||'',blocks:clone(blocks),note:pf.note,savedAt:Date.now()};
  rec._sig=localSig('prod',{date:rec.date,blocks:rec.blocks,note:rec.note||''});
  if(await findLocalDuplicate('prod',rec._sig,rec.id)){toast('Production deja enregistree dans l historique local');return false;}
  try{await idbPut(rec);toast('Production enregistrée');return true;}catch(e){toast('Échec de l\u2019enregistrement');return false;}
}
async function prodSubmit(pf){
  const blocks=pfProductionGuard(pf);
  if(!blocks)return false;
  if(!pf.agent&&typeof USR!=='undefined'&&USR.nom)pf.agent=USR.nom;
  const payload={kind:'production',date:pf.date||todayStr(),agent:pf.agent||'',blocks:clone(blocks),note:pf.note||'',submittedAt:new Date().toISOString()};
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
function renderProduction(focusBi){
  if(!PF)PF=freshPF();
  if(!PF.agent&&typeof USR!=='undefined'&&USR.nom)PF.agent=USR.nom;
  if(!PF.blocks||!PF.blocks.length)PF.blocks=[freshBlock()];
  const app=$('#app');
  const finiOpts=sel=>recipeKeys().map(p=>`<option value="${esc(p)}"${p===productCodeOf(sel)?' selected':''}>${esc(recipeProductLabel(p))}</option>`).join('');
  let blocksH='';
  PF.blocks.forEach((b,bi)=>{
    const current=currentRecipeProductCode(b.p);if(current&&current!==b.p)b.p=current;
    const emb=embType(b.p);const embL=(emb==='sac'?'Sac':'Carton');
    let perso=(b.perso||[]).map((x,pi)=>`<div class="pf-row d" data-pp="${pi}"><input class="pf-pl" placeholder="déchet perso" value="${esc(x.lbl)}"><input class="pf-pq" inputmode="decimal" placeholder="qté" value="${esc(x.qte)}"><button class="pf-delp" title="retirer">✕</button></div>`).join('');
    blocksH+='<div class="pb-card" data-bi="'+bi+'">'
      +'<div class="pb-h"><span>Production '+(bi+1)+'</span>'+(PF.blocks.length>1?'<button class="pb-del" title="supprimer">🗑</button>':'')+'</div>'
      +'<div class="pf-row"><select class="pb-p"><option value="">— produit fini —</option>'+finiOpts(b.p)+'</select><input class="pb-n" inputmode="numeric" placeholder="qté" value="'+esc(b.n)+'"></div>'
      +'<div class="pb-dech"><div class="pf-h">Déchets</div>'
      +'<div class="pb-drow"><span class="pb-dl">'+embL+'</span><input class="pb-emb" inputmode="decimal" placeholder="qté" value="'+esc(b.w_emb)+'"></div>'
      +(emb==='carton'?'<div class="pb-drow"><span class="pb-dl">Film</span><input class="pb-film" inputmode="decimal" placeholder="qté" value="'+esc(b.w_film)+'"></div>':'')
      +'<div class="pb-drow"><span class="pb-dl">Mélange (kg)</span><input class="pb-mel" inputmode="decimal" placeholder="kg" value="'+esc(b.w_mel)+'"></div>'
      +perso+'<button class="pb-addp" type="button">+ déchet personnalisé</button></div>'
      +'<div class="pf-h" style="margin-top:10px">Photo(s)</div><div class="pb-photos photo-row"></div>'
      +'</div>';
  });
  app.innerHTML='<div class="prod-wrap">'
    +'<h2 class="prod-title">Production</h2>'
    +'<p class="ref-hint">Une <b>production = un bloc</b> (produit + ses déchets + ses photos). Ajoute un bloc par article fabriqué. Date vide = aujourd\u2019hui.</p>'
    +'<p class="ref-hint" style="background:#eef4fb;border:1px solid #d6e4f2;border-radius:8px;padding:8px 10px">Vos saisies precedentes sont dans l’<b>historique en bas de page</b>. Utilisez le bouton <b>Exporter</b> (Accueil) pour sauvegarder toutes vos donnees.</p>'
    +'<div class="pf-id"><label>Date<input type="date" id="pfDate" value="'+esc(PF.date)+'"></label><label>Opérateur<input id="pfAgent" readonly style="background:#eef2f6;color:var(--mute)" value="'+esc(PF.agent)+'"></label></div>'
    +'<div id="pfBlocks">'+blocksH+'</div>'
    +'<button id="pfAddBlock" class="pf-add" style="margin-bottom:12px">+ Ajouter une production</button>'
    +'<div class="pf-sec"><div class="pf-h">Note</div><textarea id="pfNote" rows="2" placeholder="remarque (option)">'+esc(PF.note)+'</textarea></div>'
    +'<div class="pf-actions"><button id="pfSubmit" class="b-go">Soumettre au serveur</button><button id="pfSave" class="b-sec">Enregistrer localement</button><button id="pfNew" class="b-sec">Nouvelle fiche</button></div>'
    +'<div class="pf-sec"><div class="pf-h">Historique des productions</div><div id="pfHist">Chargement…</div></div>'
    +'</div>';
  const re=()=>renderProduction();
  $('#pfDate').onchange=e=>{PF.date=e.target.value;};
  $('#pfNote').oninput=e=>{PF.note=e.target.value;};
  app.querySelectorAll('.pb-card').forEach(card=>{
    const bi=+card.dataset.bi;const b=PF.blocks[bi];
    card.querySelector('.pb-p').onchange=e=>{b.p=e.target.value;re();};
    card.querySelector('.pb-n').oninput=e=>{b.n=e.target.value;};
    card.querySelector('.pb-emb').oninput=e=>{b.w_emb=e.target.value;};
    const fl=card.querySelector('.pb-film');if(fl)fl.oninput=e=>{b.w_film=e.target.value;};
    card.querySelector('.pb-mel').oninput=e=>{b.w_mel=e.target.value;};
    const delB=card.querySelector('.pb-del');if(delB)delB.onclick=()=>{PF.blocks.splice(bi,1);if(!PF.blocks.length)PF.blocks.push(freshBlock());re();};
    card.querySelectorAll('.pf-row.d[data-pp]').forEach(row=>{const pi=+row.dataset.pp;
      row.querySelector('.pf-pl').oninput=e=>{b.perso[pi].lbl=e.target.value;};
      row.querySelector('.pf-pq').oninput=e=>{b.perso[pi].qte=e.target.value;};
      row.querySelector('.pf-delp').onclick=()=>{b.perso.splice(pi,1);re();};});
    card.querySelector('.pb-addp').onclick=()=>{b.perso=b.perso||[];b.perso.push({lbl:'',qte:''});re();};
    photoArrayUI(card.querySelector('.pb-photos'),b.photos,re);
  });
  $('#pfAddBlock').onclick=()=>{PF.blocks.push(freshBlock());renderProduction(PF.blocks.length-1);};
  $('#pfSubmit').onclick=async(e)=>{const b=e.currentTarget;if(b.disabled)return;b.disabled=true;const t=b.textContent;b.textContent='Envoi…';try{await prodSubmit(PF);}finally{b.disabled=false;b.textContent=t;}};
  $('#pfSave').onclick=async()=>{if(await prodSave(PF))loadProdHist();};
  $('#pfNew').onclick=()=>{if(confirm('Vider la fiche en cours ?')){PF=freshPF();renderProduction();}};
  loadProdHist();
  if(focusBi!=null){const c=app.querySelector('.pb-card[data-bi="'+focusBi+'"]');if(c)setTimeout(()=>scrollCardIntoView(c),60);}
}
function migrateProdRec(rec){
  if(rec.blocks&&rec.blocks.length)return rec.blocks;
  const b=freshBlock();const pr=(rec.prods||[]).filter(x=>x.p&&num(x.n)>0);
  if(pr.length){b.p=pr[0].p;b.n=pr[0].n;}
  (rec.dechets||[]).forEach(x=>{if(!x.lbl)return;const l=x.lbl.toLowerCase();if(l.indexOf('carton')>=0||l.indexOf('sac')>=0)b.w_emb=x.qte;else if(l.indexOf('film')>=0)b.w_film=x.qte;else if(num(x.qte)>0){b.perso.push({lbl:x.lbl,qte:x.qte});}});
  (rec.melange||[]).forEach(x=>{if(num(x.kg)>0)b.w_mel=x.kg;});
  b.photos=clone(rec.photos||[]);
  const blocks=[b];pr.slice(1).forEach(x=>{const nb=freshBlock();nb.p=x.p;nb.n=x.n;blocks.push(nb);});
  return blocks;
}
function histRecDate(row,isServer){
  const rec=isServer?(row&&row.payload||{}):row;
  return String((rec&&rec.date)||'');
}
function histMatchDate(date,filter){
  if(!filter||filter.mode==='all'||!filter.value)return true;
  if(filter.mode==='month')return date.indexOf(filter.value)===0;
  if(filter.mode==='year')return date.indexOf(filter.value)===0;
  if(filter.mode==='date')return date===filter.value;
  return true;
}
function histApply(rows,key,isServer){
  const filter=HIST_FILTERS[key]||HIST_FILTERS.production;
  return (rows||[]).filter(r=>histMatchDate(histRecDate(r,isServer),filter));
}
function histClip(rows){
  rows=rows||[];
  return {rows:rows.slice(0,HIST_MAX),hidden:Math.max(0,rows.length-HIST_MAX),total:rows.length};
}
function histFilterText(filter){
  if(!filter||filter.mode==='all'||!filter.value)return 'Tout';
  if(filter.mode==='month')return 'Mois '+filter.value;
  if(filter.mode==='year')return 'Annee '+filter.value;
  return 'Date '+frDate(filter.value);
}
function bindHistFilter(host,key,loader){
  const sel=host.querySelector('.hist-filter-mode'),val=host.querySelector('.hist-filter-value');
  if(!sel||!val)return;
  const sync=()=>{
    const f=HIST_FILTERS[key];
    val.style.display=f.mode==='all'?'none':'block';
    val.type=f.mode==='date'?'date':(f.mode==='month'?'month':'number');
    val.placeholder=f.mode==='year'?'annee':'';
    val.min=f.mode==='year'?'2000':'';
    val.max=f.mode==='year'?'2100':'';
    val.value=f.value||'';
  };
  sel.onchange=()=>{const f=HIST_FILTERS[key];f.mode=sel.value;f.value='';sync();loader();};
  val.onchange=()=>{HIST_FILTERS[key].value=val.value;loader();};
  sync();
}
function histFilterHTML(key){
  const f=HIST_FILTERS[key]||HIST_FILTERS.production;
  return '<div class="hist-filter"><select class="hist-filter-mode">'
    +'<option value="all"'+(f.mode==='all'?' selected':'')+'>Tout</option>'
    +'<option value="month"'+(f.mode==='month'?' selected':'')+'>Mois</option>'
    +'<option value="year"'+(f.mode==='year'?' selected':'')+'>Annee</option>'
    +'<option value="date"'+(f.mode==='date'?' selected':'')+'>Date</option>'
    +'</select><input class="hist-filter-value" value="'+esc(f.value||'')+'"><span>'+esc(histFilterText(f))+'</span></div>';
}
function histQty(v){return (typeof fmtq==='function')?fmtq(num(v)):String(v||'');}
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
  return histMiniLines((blocks||[]).filter(b=>b&&b.p&&num(b.n)>0),[
    ['p','Produit',v=>esc(typeof recipeProductLabel==='function'?recipeProductLabel(v):v)],
    ['n','Qte',v=>'qte '+esc(histQty(v))]
  ],4);
}
function histMovMini(rec){
  const rows=[];
  (rec.finis||[]).forEach(x=>{if(x&&x.a&&num(x.q)>0)rows.push({t:'PF',a:x.a,q:x.q,exp:''});});
  (rec.mp||[]).forEach(x=>{if(x&&x.a&&num(x.q)>0)rows.push({t:'MP',a:x.a,q:x.q,exp:x.exp||''});});
  return histMiniLines(rows,[
    ['t','Type',v=>esc(v)],
    ['a','Article',v=>esc(v)],
    ['q','Qte',v=>'qte '+esc(histQty(v))],
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
  if(serverRows.length){
    const h=document.createElement('div');h.style.cssText='font-size:12px;font-weight:800;color:var(--green);margin:0 0 6px;text-transform:uppercase';
    h.textContent='Validees serveur';host.append(h);
    srvClip.rows.forEach(row=>{
      const rec=row.payload||{};
      const blocks=migrateProdRec(rec);
      const np=blocks.filter(b=>b.p&&num(b.n)>0).length;
      const ph=blocks.reduce((s,b)=>s+((b.photos||[]).length),0);
      const it=document.createElement('div');it.className='hist-item locked';
      it.innerHTML='<div class="info"><b>'+frDate(rec.date)+'</b><span>VALIDEE serveur - '+(rec.agent?esc(rec.agent)+' - ':'')+np+' produit(s) - '+ph+' photo(s)</span>'+histProdMini(blocks)+'</div>';
      const open=document.createElement('button');open.textContent='Voir';open.onclick=()=>{PF={date:rec.date,agent:rec.agent||'',blocks:clone(blocks),note:rec.note||''};renderProduction();};
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
    const open=document.createElement('button');open.textContent='Voir';open.onclick=()=>{PF={date:rec.date,agent:rec.agent||'',blocks:clone(blocks),note:rec.note||''};renderProduction();};
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
 sortie:{title:'Sorties',word:'SORTIE',icon:'🚚',refLabel:'Véhicule / plaque / destinataire',refPlace:'ex. camion 1234-AB / labo',pfx:'sortie_',saved:'Sortie enregistrée',hint:'Enregistre une sortie : produits finis expédiés et/ou matières & échantillons (les deux possibles). Date vide = aujourd\u2019hui. Photo véhicule/plaque depuis la galerie.'},
 entree:{title:'Entrées',word:'ENTRÉE',icon:'📦',refLabel:'Fournisseur / référence / BL',refPlace:'ex. fournisseur, n° BL, container',pfx:'entree_',saved:'Entrée enregistrée',hint:'Enregistre une entrée : réceptions de matières premières et/ou retours de produits finis. Date vide = aujourd\u2019hui. Photo si nécessaire.'}
};
let MOVF={sortie:null,entree:null};
function freshMov(){return {date:'',agent:(typeof USR!=='undefined'?USR.nom:''),ref:'',finis:[{a:'',q:''}],mp:[{a:'',q:'',exp:''}],photos:[],note:''};}
function movArts(catKind){return catKind==='finis'?finishedProductRefs():refsByCode(REFS.filter(r=>r.cat==='mp'));}
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
function entreeMpSansPeremption(kind,mf){
  if(kind!=='entree')return [];
  return (mf.mp||[]).filter(x=>{
    if(!x||!x.a||num(x.q)<=0)return false;
    const r=REFS.find(rr=>rr.des===x.a);
    return r&&(r.g==='vrac'||r.g==='tare')&&!String(x.exp||'').trim();
  });
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
  const rec={id:c.pfx+Date.now(),kind:kind,date:mf.date||todayStr(),agent:mf.agent||'',ref:mf.ref||'',finis:clone(lines.finis),mp:clone(lines.mp),photos:clone(mf.photos||[]),note:mf.note,savedAt:Date.now()};
  rec._sig=localSig(kind,{date:rec.date,ref:rec.ref,finis:rec.finis,mp:rec.mp,note:rec.note||''});
  if(await findLocalDuplicate(kind,rec._sig,rec.id)){toast(c.word+' deja enregistree dans l historique local');return false;}
  try{await idbPut(rec);toast(c.saved);return true;}catch(e){toast('Échec de l\u2019enregistrement');return false;}
}
async function movSubmit(kind,mf){
  const lines=movInputGuard(kind,mf);
  if(!lines)return false;
  if(!movPeremptionGuard(kind,mf))return false;
  if(!mf.agent&&typeof USR!=='undefined'&&USR.nom)mf.agent=USR.nom;
  const payload={kind:kind,date:mf.date||todayStr(),agent:mf.agent||'',ref:mf.ref||'',finis:clone(lines.finis),mp:clone(lines.mp),photos:clone(mf.photos||[]),note:mf.note||'',submittedAt:new Date().toISOString()};
  await sipsSubmit(kind,payload,MOVCFG[kind].word+' '+(payload.date||''));
  return true;
}
function movSectionHTML(mf,sec,title,withExp){
  const arts=movArts(sec);
  const artOpts=sel=>arts.map(r=>`<option value="${esc(r.des)}"${r.des===sel?' selected':''}>${esc(r.des)}</option>`).join('');
  const expCell=x=>withExp?`<input class="mv-exp" type="date" title="date de péremption" value="${esc(x.exp||'')}">`:'';
  let rows=mf[sec].map((x,i)=>`<div class="pf-row${withExp?' pf-row-exp':''}" data-sec="${sec}" data-li="${i}"><select class="mv-a"><option value="">— article —</option>${artOpts(x.a)}</select><input class="mv-q" inputmode="decimal" placeholder="qté" value="${esc(x.q)}">${expCell(x)}<button class="mv-del" title="retirer">✕</button></div>`).join('');
  const hint=withExp?'<small style="display:block;font-size:11px;color:var(--mute);margin:2px 0 6px">Renseigne la date de péremption de chaque matière (suivi FEFO).</small>':'';
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
  app.innerHTML='<div class="prod-wrap">'
    +'<h2 class="prod-title">'+c.title+'</h2>'
    +'<p class="ref-hint">'+c.hint+'</p>'
    +'<p class="ref-hint" style="background:#eef4fb;border:1px solid #d6e4f2;border-radius:8px;padding:8px 10px">Vos saisies precedentes sont dans l’<b>historique en bas de page</b>. Utilisez le bouton <b>Exporter</b> (Accueil) pour sauvegarder toutes vos donnees.</p>'
    +'<div class="pf-id"><label>Date<input type="date" id="mvDate" value="'+esc(mf.date)+'"></label><label>Opérateur<input id="mvAgent" readonly style="background:#eef2f6;color:var(--mute)" value="'+esc(mf.agent||'')+'"></label></div>'
    +'<div class="pf-sec"><div class="pf-h">'+c.refLabel+'</div><input id="mvRef" placeholder="'+esc(c.refPlace)+'" value="'+esc(mf.ref)+'" style="width:100%;box-sizing:border-box;border:1.5px solid var(--line);border-radius:8px;padding:9px;font-size:14px;background:#fbfcfb"></div>'
    +movSectionHTML(mf,'finis',kind==='entree'?'Produits finis (retours)':'Produits finis')
    +movSectionHTML(mf,'mp','Matières premières / Échantillons',kind==='entree')
    +'<div class="pf-sec"><div class="pf-h">Photo(s)</div><div id="mvPhotos" class="photo-row"></div></div>'
    +'<div class="pf-sec"><div class="pf-h">Note</div><textarea id="mvNote" rows="2" placeholder="remarque (option)">'+esc(mf.note)+'</textarea></div>'
    +'<div class="pf-actions"><button id="mvSubmit" class="b-go">Soumettre au serveur</button><button id="mvSave" class="b-sec">Enregistrer localement</button><button id="mvNew" class="b-sec">Nouvelle fiche</button></div>'
    +'<div class="pf-sec"><div class="pf-h">Historique des '+(kind==='entree'?'entrées':'sorties')+'</div><div id="mvHist">Chargement…</div></div>'
    +'</div>';
  const re=()=>renderMov(kind);
  $('#mvDate').onchange=e=>{mf.date=e.target.value;};
  $('#mvRef').oninput=e=>{mf.ref=e.target.value;};
  $('#mvNote').oninput=e=>{mf.note=e.target.value;};
  app.querySelectorAll('.pf-row[data-sec]').forEach(row=>{const sec=row.dataset.sec;const i=+row.dataset.li;
    row.querySelector('.mv-a').onchange=e=>{mf[sec][i].a=e.target.value;};
    row.querySelector('.mv-q').oninput=e=>{mf[sec][i].q=e.target.value;};
    const ex=row.querySelector('.mv-exp');if(ex)ex.onchange=e=>{mf[sec][i].exp=e.target.value;};
    row.querySelector('.mv-del').onclick=()=>{mf[sec].splice(i,1);if(!mf[sec].length)mf[sec].push({a:'',q:''});re();};});
  app.querySelectorAll('.mv-add').forEach(btn=>{const sec=btn.dataset.addsec;btn.onclick=()=>{mf[sec].push({a:'',q:'',exp:''});renderMov(kind,sec+'-'+(mf[sec].length-1));};});
  photoArrayUI($('#mvPhotos'),mf.photos,re);
  $('#mvSave').onclick=async()=>{if(await movSave(kind,mf))loadMovHist(kind);};
  $('#mvSubmit').onclick=async(e)=>{const b=e.currentTarget;if(b.disabled)return;b.disabled=true;const t=b.textContent;b.textContent='Envoi…';try{await movSubmit(kind,mf);}finally{b.disabled=false;b.textContent=t;}};
  $('#mvNew').onclick=()=>{if(confirm('Vider la fiche en cours ?')){MOVF[kind]=freshMov();re();}};
  loadMovHist(kind);
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
      const open=document.createElement('button');open.textContent='Voir';open.onclick=()=>{MOVF[kind]={date:rec.date,agent:rec.agent||'',ref:rec.ref||'',finis:(rec.finis&&rec.finis.length?clone(rec.finis):[{a:'',q:''}]),mp:(rec.mp&&rec.mp.length?clone(rec.mp):[{a:'',q:''}]),photos:clone(rec.photos||[]),note:rec.note||''};renderMov(kind);};
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
    const open=document.createElement('button');open.textContent='Voir';open.onclick=()=>{MOVF[kind]={date:rec.date,agent:rec.agent||'',ref:rec.ref||'',finis:(rec.finis&&rec.finis.length?clone(rec.finis):[{a:'',q:''}]),mp:(rec.mp&&rec.mp.length?clone(rec.mp):[{a:'',q:''}]),photos:clone(rec.photos||[]),note:rec.note||''};renderMov(kind);};
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
function sipsPayloadSummary(type,payload){
  payload=payload||{};
  if(type==='quality'){const i=payload.informations||{},v=payload.visas||{};const sigs=['operateur','responsableQualite'].filter(k=>v[k]&&v[k].signature).length;const avg=sipsQualityAvgBatchTime(payload);return (i.numeroLot||'lot ?')+' - '+recipeProductLabel(i.refProduit||'produit ?')+' - '+(i.dateProduction||payload.date||'date ?')+' - '+sigs+'/2 signatures obligatoires'+(avg?' - moy. batch '+avg:'');}
  if(type==='sortie'||type==='entree'){const nf=((payload.finis||[]).filter(x=>x.a&&num(x.q)>0).length);const nm=((payload.mp||[]).filter(x=>x.a&&num(x.q)>0).length);return (payload.date||'date ?')+' - '+(payload.ref||'sans ref')+' - '+nf+' fini(s), '+nm+' MP';}
  if(type==='production'){const nb=(payload.blocks||[]).filter(b=>b.p&&num(b.n)>0).length;return (payload.date||'date ?')+' - '+nb+' production(s)';}
  if(type==='inventory'){return (payload.date||'date ?')+' - '+(payload.filled||0)+' article(s) comptés';}
  return payload.title||payload.message||'';
}
function sipsKV(rows){return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px;margin-top:8px">'+rows.filter(x=>x&&x[1]!=null&&x[1]!=='').map(x=>'<div style="background:#f7faf8;border:1px solid var(--line);border-radius:8px;padding:7px"><b style="display:block;font-size:11px;color:var(--mute);text-transform:uppercase">'+esc(x[0])+'</b><span style="font-size:13px">'+esc(x[1])+'</span></div>').join('')+'</div>';}
function sipsLines(title,rows,cols){
  rows=(rows||[]).filter(r=>r&&cols.some(c=>String(r[c[0]]||'').trim()));
  if(!rows.length)return '';
  return '<div style="margin-top:8px"><b style="font-size:12px;color:var(--steel-d)">'+esc(title)+'</b>'+rows.map((r,i)=>'<div style="font-size:12px;border-bottom:1px solid var(--line);padding:6px 0"><b>'+(i+1)+'.</b> '+cols.map(c=>{const v=r[c[0]];return v==null||v===''?'':'<span>'+esc(c[1])+': '+esc(v)+'</span>';}).filter(Boolean).join(' - ')+'</div>').join('')+'</div>';
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
    const visaRows=['operateur','responsableProd','responsableQualite'].map(k=>{const x=v[k]||{};return {role:k==='operateur'?'Operateur':(k==='responsableProd'?'Resp. production':'Resp. qualite'),nom:x.nom||'',date:x.date||'',signature:x.signature?'oui':'non'};});
    return sipsKV([['Produit',recipeProductLabel(i.refProduit)],['Lot',i.numeroLot],['Date production',frDate(i.dateProduction||p.date)],['Heure debut',i.heureDebut],['Heure fin',i.heureFin],['Temps moyen/batch',sipsQualityAvgBatchTime(p)],['Quantite produite',i.quantiteProduite?i.quantiteProduite+' kg':''],['Taille batch',i.tailleBatch?i.tailleBatch+' kg':''],['Correction de',p.correctionOf&&p.correctionOf.id],['Motif correction',p.correctionNote]])
      +sipsLines('Matieres premieres',p.matieresPremieres,[['designation','Designation'],['code','Code'],['refFournisseur','Ref fournisseur'],['dateProd','Date prod'],['dateExp','Date exp']])
      +sipsLines('Batches / melanges',sipsQualityBatchRows(p),[['batchNum','Batch'],['heureDebut','Debut'],['heureFin','Fin'],['duree','Duree']])
      +sipsLines('Visas',visaRows,[['role','Role'],['nom','Nom'],['date','Date'],['signature','Signature']]);
  }
  if(s.type==='production'){
    return sipsKV([['Date',frDate(p.date)],['Operateur',p.agent],['Note',p.note]])
      +sipsLines('Productions',p.blocks,[['p','Produit'],['n','Qte'],['w_emb','Dechet emb.'],['w_film','Dechet film'],['w_mel','Melange kg']]);
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
function sipsSubmissionHTML(s){
  const actor=s.author&&s.author.name?(' - '+esc(s.author.name)):'';
  const status=s.status==='submitted'?'En attente':(s.status==='validated'?'Validee':'Rejetee');
  const summary=sipsPayloadSummary(s.type,s.payload);
  const qVisas=(s.payload&&s.payload.visas)||{};
  const qReady=s.type!=='quality'||['operateur','responsableQualite'].every(k=>qVisas[k]&&qVisas[k].signature);
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
  try{const data=await sipsFetch('/api/submissions?status=submitted&include=payload',{headers:sipsAdminHeaders()});const rows=data.submissions||[];subs.innerHTML=rows.length?rows.map(sipsSubmissionHTML).join(''):'<p style="color:#6a7280;font-size:13px;margin:0">Aucune soumission en attente.</p>';subs.querySelectorAll('[data-sub]').forEach(el=>{const id=el.dataset.sub;el.querySelectorAll('button[data-act]').forEach(b=>{const sub=rows.find(x=>x.id===id);if(b.dataset.act==='compare'){b.onclick=()=>sipsOpenInventoryReview(sub);}else{b.onclick=()=>sipsDecide(id,b.dataset.act);}});});}
  catch(e){subs.innerHTML='<p style="color:var(--red);font-size:13px;margin:0">Impossible de charger les soumissions : '+esc(e.message)+(String(e.message).indexOf('admin')>=0?' - connecte-toi avec un compte admin ou renseigne le PIN serveur.':'')+'</p>';}
  try{const data=await sipsFetch('/api/records?status=validated',{headers:sipsAdminHeaders()});const rows=data.records||[];records.innerHTML=rows.length?rows.map(sipsRecordHTML).join(''):'<p style="color:#6a7280;font-size:13px;margin:0">Aucun enregistrement valide dans la base centrale.</p>';records.querySelectorAll('[data-rec]').forEach(el=>{const id=el.dataset.rec;const b=el.querySelector('button[data-act="cancel"]');if(b)b.onclick=()=>sipsCancelRecord(id);});}
  catch(e){records.innerHTML='<p style="color:var(--red);font-size:13px;margin:0">Impossible de charger les donnees validees : '+esc(e.message)+'</p>';}
}
async function sipsDecide(id,act){
  const isCorrection=act==='correction';
  const apiAct=isCorrection?'reject':act;
  const label=apiAct==='validate'?'valider':(isCorrection?'demander correction sur':'rejeter');
  if(!confirm(label.charAt(0).toUpperCase()+label.slice(1)+' cette soumission ?'))return;
  const note=apiAct==='reject'?prompt(isCorrection?'Correction demandee ? La fiche sera conservee et reprise par l operateur.':'Motif du rejet ?','Correction demandee'):null;
  if(apiAct==='reject'&&note===null)return;
  if(typeof authConfirmPassword==='function'&&!(await authConfirmPassword(label+' cette soumission')))return;
  const row=document.querySelector('[data-sub="'+id+'"]');
  if(row){row.style.opacity=.55;row.querySelectorAll('button').forEach(b=>b.disabled=true);}
  try{await sipsFetch('/api/submissions/'+encodeURIComponent(id)+'/'+apiAct,{method:'POST',headers:sipsAdminHeaders(),body:JSON.stringify({actor:(typeof USR!=='undefined'&&USR.nom)||'admin',note:note||'',correction:isCorrection})});toast(apiAct==='validate'?'Soumission validee':(isCorrection?'Correction demandee':'Soumission rejetee'));}
  catch(e){
    if(/trait/i.test(e.message||'')){toast('Deja traitee - liste mise a jour');if(row)row.remove();}
    else{toast('Erreur serveur : '+e.message);if(row){row.style.opacity='';row.querySelectorAll('button').forEach(b=>b.disabled=false);}}
  }
  // Resynchronise la liste avec le serveur dans tous les cas : un element deja
  // traite (ailleurs / double-clic) disparait au lieu de rester affiche.
  try{await sipsLoadServeur();}catch(e){}
  // Met aussi a jour la pastille de notifications (sinon elle reste figee
  // jusqu'au prochain refresh complet de la page).
  try{await sipsRefreshNotifications();}catch(e){}
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
