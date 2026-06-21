/* ================= MODULE PRODUCTION ================= */
function todayStr(){const d=new Date();const p=n=>(n<10?'0':'')+n;return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}
function frDate(s){if(!s)return '—';const m=String(s).split('-');return m.length===3?m[2]+'/'+m[1]+'/'+m[0]:s;}
function dataUrlToFile(durl,name){return fetch(durl).then(r=>r.blob()).then(b=>new File([b],name,{type:b.type||'image/jpeg'}));}
let PF=null;
function embType(p){const a=REFS.find(x=>x.des===p);if(a&&(a.m==='sac'||a.m==='vrac'))return 'sac';return 'carton';}
function freshBlock(){return {p:'',n:'',w_emb:'',w_film:'',w_mel:'',perso:[],photos:[]};}
function freshPF(){return {date:'',agent:(typeof USR!=='undefined'?USR.nom:''),blocks:[freshBlock()],note:''};}
function pfBlockHasInput(b){return (b.p&&num(b.n)>0)||num(b.w_emb)>0||num(b.w_film)>0||num(b.w_mel)>0||(b.perso||[]).some(x=>x.lbl&&num(x.qte)>0);}
function blockDechets(b){
  const emb=embType(b.p);const parts=[];
  if(num(b.w_emb)>0)parts.push((emb==='sac'?'Sac':'Carton')+' '+fmt(num(b.w_emb)));
  if(emb==='carton'&&num(b.w_film)>0)parts.push('Film '+fmt(num(b.w_film)));
  if(num(b.w_mel)>0)parts.push('Mélange '+fmt(num(b.w_mel))+' kg');
  (b.perso||[]).forEach(x=>{if(x.lbl&&num(x.qte)>0)parts.push(x.lbl+' '+fmt(num(x.qte)));});
  return parts;
}
function prodShareText(pf){
  const L=[];L.push('*PRODUCTION — '+frDate(pf.date||todayStr())+'*');
  if(pf.agent)L.push('👤 '+pf.agent);
  const blocks=(pf.blocks||[]).filter(b=>b.p&&num(b.n)>0);
  const multi=blocks.length>1;
  blocks.forEach((b,i)=>{
    L.push('');L.push('*'+(multi?(i+1)+'. ':'')+b.p+' — '+fmt(num(b.n))+'*');
    const d=blockDechets(b);if(d.length)L.push('Déchets : '+d.join(' · '));
  });
  if(pf.note&&pf.note.trim()){L.push('');L.push('📝 '+pf.note.trim());}
  return L.join('\n');
}
async function prodShare(pf){
  const text=prodShareText(pf);
  const photos=[];(pf.blocks||[]).forEach(b=>(b.photos||[]).forEach(p=>photos.push(p)));
  try{
    let files=[];
    for(let i=0;i<photos.length;i++){try{files.push(await dataUrlToFile(photos[i],'production_'+(i+1)+'.jpg'));}catch(e){}}
    if(navigator.canShare&&files.length&&navigator.canShare({files:files})){await navigator.share({text:text,files:files,title:'Production'});return;}
    if(navigator.share){await navigator.share({text:text,title:'Production'});if(files.length)toast('Texte partagé — ajoute les photos manuellement');return;}
  }catch(e){if(e&&e.name==='AbortError')return;}
  try{await navigator.clipboard.writeText(text);toast('Copié — colle dans WhatsApp');}catch(e){alert(text);}
}
async function prodSave(pf){
  const blocks=(pf.blocks||[]).filter(pfBlockHasInput);
  if(!blocks.length){toast('Rien à enregistrer');return false;}
  const rec={id:'prod_'+Date.now(),kind:'prod',date:pf.date||todayStr(),agent:pf.agent||'',blocks:clone(pf.blocks),note:pf.note,savedAt:Date.now()};
  rec._sig=localSig('prod',{date:rec.date,blocks:rec.blocks,note:rec.note||''});
  if(await findLocalDuplicate('prod',rec._sig,rec.id)){toast('Production deja enregistree dans l historique local');return false;}
  try{await idbPut(rec);toast('Production enregistrée');return true;}catch(e){toast('Échec de l\u2019enregistrement');return false;}
}
async function prodSubmit(pf){
  const blocks=(pf.blocks||[]).filter(pfBlockHasInput);
  if(!blocks.length){toast('Rien a soumettre');return false;}
  if(!pf.agent&&typeof USR!=='undefined'&&USR.nom)pf.agent=USR.nom;
  const payload={kind:'production',date:pf.date||todayStr(),agent:pf.agent||'',blocks:clone(pf.blocks),note:pf.note||'',submittedAt:new Date().toISOString()};
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
  const finiOpts=sel=>Object.keys(RECF).map(p=>`<option value="${esc(p)}"${p===sel?' selected':''}>${esc(p)}</option>`).join('');
  let blocksH='';
  PF.blocks.forEach((b,bi)=>{
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
    +'<p class="ref-hint">Une <b>production = un bloc</b> (produit + ses déchets + ses photos). Ajoute un bloc par article fabriqué. Date vide = aujourd\u2019hui. Un bouton <b>Partager</b> pour le groupe WhatsApp.</p>'
    +'<p class="ref-hint" style="background:#eef4fb;border:1px solid #d6e4f2;border-radius:8px;padding:8px 10px">Vos saisies precedentes sont dans l’<b>historique en bas de page</b>. Utilisez le bouton <b>Exporter</b> (Accueil) pour sauvegarder toutes vos donnees.</p>'
    +'<div class="pf-id"><label>Date<input type="date" id="pfDate" value="'+esc(PF.date)+'"></label><label>Opérateur<input id="pfAgent" readonly style="background:#eef2f6;color:var(--mute)" value="'+esc(PF.agent)+'"></label></div>'
    +'<div id="pfBlocks">'+blocksH+'</div>'
    +'<button id="pfAddBlock" class="pf-add" style="margin-bottom:12px">+ Ajouter une production</button>'
    +'<div class="pf-sec"><div class="pf-h">Note</div><textarea id="pfNote" rows="2" placeholder="remarque (option)">'+esc(PF.note)+'</textarea></div>'
    +'<div class="pf-actions"><button id="pfSubmit" class="b-go">Soumettre au serveur</button><button id="pfSave" class="b-sec">Enregistrer localement</button><button id="pfShare" class="b-sec">📤 Secours WhatsApp</button><button id="pfNew" class="b-sec">Nouvelle fiche</button></div>'
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
  $('#pfSubmit').onclick=()=>prodSubmit(PF);
  $('#pfShare').onclick=()=>prodShare(PF);
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
async function loadProdHist(){
  const host=$('#pfHist');if(!host)return;
  let recs=[];try{recs=(await idbAll()).filter(r=>String(r.id).indexOf('prod_')===0).sort((a,b)=>b.savedAt-a.savedAt);}catch(e){}
  host.innerHTML='';
  const serverRows=await sipsRecords('production');
  if(serverRows.length){
    const h=document.createElement('div');h.style.cssText='font-size:12px;font-weight:800;color:var(--green);margin:0 0 6px;text-transform:uppercase';
    h.textContent='Validees serveur';host.append(h);
    serverRows.sort((a,b)=>String(b.validatedAt||'').localeCompare(String(a.validatedAt||''))).forEach(row=>{
      const rec=row.payload||{};
      const blocks=prodRecBlocks(rec);
      const np=blocks.filter(b=>b.p&&num(b.n)>0).length;
      const ph=blocks.reduce((s,b)=>s+((b.photos||[]).length),0);
      const it=document.createElement('div');it.className='hist-item locked';
      it.innerHTML='<div class="info"><b>'+frDate(rec.date)+'</b><span>VALIDEE serveur - '+(rec.agent?esc(rec.agent)+' - ':'')+np+' produit(s) - '+ph+' photo(s)</span></div>';
      const open=document.createElement('button');open.textContent='Voir';open.onclick=()=>{PF={date:rec.date,agent:rec.agent||'',blocks:clone(blocks),note:rec.note||''};renderProduction();};
      it.append(open);host.append(it);
    });
  }
  if(recs.length){
    const h=document.createElement('div');h.style.cssText='font-size:12px;font-weight:800;color:var(--steel-d);margin:'+(serverRows.length?'10px':'0')+' 0 6px;text-transform:uppercase';
    h.textContent='Historique local';host.append(h);
  }
  recs.forEach(rec=>{
    const blocks=migrateProdRec(rec);
    const np=blocks.filter(b=>b.p&&num(b.n)>0).length;
    const ph=blocks.reduce((s,b)=>s+((b.photos||[]).length),0);
    const it=document.createElement('div');it.className='hist-item';
    it.innerHTML='<div class="info"><b>'+frDate(rec.date)+'</b><span>'+(rec.agent||'—')+' · '+np+' produit(s) · '+ph+' photo(s)</span></div>';
    const open=document.createElement('button');open.textContent='Voir';open.onclick=()=>{PF={date:rec.date,agent:rec.agent||'',blocks:clone(blocks),note:rec.note||''};renderProduction();};
    const del=document.createElement('button');del.className='del';del.textContent='Suppr.';del.onclick=async()=>{if(confirm('Supprimer cette production ?')){await idbDel(rec.id);loadProdHist();}};
    it.append(open,del);host.append(it);
  });
  if(!recs.length&&!serverRows.length){host.innerHTML='<p style="color:#6a7280;font-size:13px;margin:0">Aucune production enregistree.</p>';}
}
const MOVCFG={
 sortie:{title:'Sorties',word:'SORTIE',icon:'🚚',refLabel:'Véhicule / plaque / destinataire',refPlace:'ex. camion 1234-AB / labo',pfx:'sortie_',saved:'Sortie enregistrée',hint:'Enregistre une sortie : produits finis expédiés et/ou matières & échantillons (les deux possibles). Date vide = aujourd\u2019hui. Photo véhicule/plaque depuis la galerie.'},
 entree:{title:'Entrées',word:'ENTRÉE',icon:'📦',refLabel:'Fournisseur / référence / BL',refPlace:'ex. fournisseur, n° BL, container',pfx:'entree_',saved:'Entrée enregistrée',hint:'Enregistre une entrée : réceptions de matières premières et/ou retours de produits finis. Date vide = aujourd\u2019hui. Photo si nécessaire.'}
};
let MOVF={sortie:null,entree:null};
function freshMov(){return {date:'',agent:(typeof USR!=='undefined'?USR.nom:''),ref:'',finis:[{a:'',q:''}],mp:[{a:'',q:''}],photos:[],note:''};}
function movArts(catKind){return REFS.filter(r=>catKind==='finis'?r.cat==='fini':r.cat==='mp');}
function movHasInput(mf){return (mf.finis||[]).some(x=>x.a&&num(x.q)>0)||(mf.mp||[]).some(x=>x.a&&num(x.q)>0);}
function movShareText(kind,mf){
  const c=MOVCFG[kind];const L=[];L.push('*'+c.word+' — '+frDate(mf.date||todayStr())+'*');
  if(mf.ref)L.push(c.icon+' '+mf.ref);
  const f=(mf.finis||[]).filter(x=>x.a&&num(x.q)>0);
  const m=(mf.mp||[]).filter(x=>x.a&&num(x.q)>0);
  if(f.length){L.push('');L.push('*Produits finis'+(kind==='entree'?' (retours)':'')+'*');f.forEach(x=>L.push('• '+x.a+' : '+fmt(num(x.q))));}
  if(m.length){L.push('');L.push('*Matières / Échantillons*');m.forEach(x=>L.push('• '+x.a+' : '+fmt(num(x.q))));}
  if(mf.note&&mf.note.trim()){L.push('');L.push('📝 '+mf.note.trim());}
  return L.join('\n');
}
async function movShare(kind,mf){
  const text=movShareText(kind,mf);
  try{let files=[];
    for(let i=0;i<(mf.photos||[]).length;i++){try{files.push(await dataUrlToFile(mf.photos[i],kind+'_'+(i+1)+'.jpg'));}catch(e){}}
    if(navigator.canShare&&files.length&&navigator.canShare({files:files})){await navigator.share({text:text,files:files,title:MOVCFG[kind].word});return;}
    if(navigator.share){await navigator.share({text:text,title:MOVCFG[kind].word});if(files.length)toast('Texte partagé — ajoute les photos manuellement');return;}
  }catch(e){if(e&&e.name==='AbortError')return;}
  try{await navigator.clipboard.writeText(text);toast('Copié — colle dans WhatsApp');}catch(e){alert(text);}
}
async function movSave(kind,mf){
  if(!movHasInput(mf)){toast('Rien à enregistrer');return false;}
  const c=MOVCFG[kind];
  if(!mf.agent&&typeof USR!=='undefined'&&USR.nom)mf.agent=USR.nom;
  const rec={id:c.pfx+Date.now(),kind:kind,date:mf.date||todayStr(),agent:mf.agent||'',ref:mf.ref||'',finis:clone(mf.finis),mp:clone(mf.mp),photos:clone(mf.photos||[]),note:mf.note,savedAt:Date.now()};
  rec._sig=localSig(kind,{date:rec.date,ref:rec.ref,finis:rec.finis,mp:rec.mp,note:rec.note||''});
  if(await findLocalDuplicate(kind,rec._sig,rec.id)){toast(c.word+' deja enregistree dans l historique local');return false;}
  try{await idbPut(rec);toast(c.saved);return true;}catch(e){toast('Échec de l\u2019enregistrement');return false;}
}
async function movSubmit(kind,mf){
  if(!movHasInput(mf)){toast('Rien a soumettre');return false;}
  if(!mf.agent&&typeof USR!=='undefined'&&USR.nom)mf.agent=USR.nom;
  const payload={kind:kind,date:mf.date||todayStr(),agent:mf.agent||'',ref:mf.ref||'',finis:clone(mf.finis),mp:clone(mf.mp),photos:clone(mf.photos||[]),note:mf.note||'',submittedAt:new Date().toISOString()};
  await sipsSubmit(kind,payload,MOVCFG[kind].word+' '+(payload.date||''));
  return true;
}
function movSectionHTML(mf,sec,title){
  const arts=movArts(sec);
  const artOpts=sel=>arts.map(r=>`<option value="${esc(r.des)}"${r.des===sel?' selected':''}>${esc(r.des)}</option>`).join('');
  let rows=mf[sec].map((x,i)=>`<div class="pf-row" data-sec="${sec}" data-li="${i}"><select class="mv-a"><option value="">— article —</option>${artOpts(x.a)}</select><input class="mv-q" inputmode="decimal" placeholder="qté" value="${esc(x.q)}"><button class="mv-del" title="retirer">✕</button></div>`).join('');
  return '<div class="pf-sec"><div class="pf-h">'+title+'</div><div class="mv-lines" data-secwrap="'+sec+'">'+rows+'</div><button class="mv-add pf-add" data-addsec="'+sec+'">+ article</button></div>';
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
    +movSectionHTML(mf,'mp','Matières premières / Échantillons')
    +'<div class="pf-sec"><div class="pf-h">Photo(s)</div><div id="mvPhotos" class="photo-row"></div></div>'
    +'<div class="pf-sec"><div class="pf-h">Note</div><textarea id="mvNote" rows="2" placeholder="remarque (option)">'+esc(mf.note)+'</textarea></div>'
    +'<div class="pf-actions"><button id="mvSubmit" class="b-go">Soumettre au serveur</button><button id="mvSave" class="b-sec">Enregistrer localement</button><button id="mvShare" class="b-sec">📤 Secours WhatsApp</button><button id="mvNew" class="b-sec">Nouvelle fiche</button></div>'
    +'<div class="pf-sec"><div class="pf-h">Historique des '+(kind==='entree'?'entrées':'sorties')+'</div><div id="mvHist">Chargement…</div></div>'
    +'</div>';
  const re=()=>renderMov(kind);
  $('#mvDate').onchange=e=>{mf.date=e.target.value;};
  $('#mvRef').oninput=e=>{mf.ref=e.target.value;};
  $('#mvNote').oninput=e=>{mf.note=e.target.value;};
  app.querySelectorAll('.pf-row[data-sec]').forEach(row=>{const sec=row.dataset.sec;const i=+row.dataset.li;
    row.querySelector('.mv-a').onchange=e=>{mf[sec][i].a=e.target.value;};
    row.querySelector('.mv-q').oninput=e=>{mf[sec][i].q=e.target.value;};
    row.querySelector('.mv-del').onclick=()=>{mf[sec].splice(i,1);if(!mf[sec].length)mf[sec].push({a:'',q:''});re();};});
  app.querySelectorAll('.mv-add').forEach(btn=>{const sec=btn.dataset.addsec;btn.onclick=()=>{mf[sec].push({a:'',q:''});renderMov(kind,sec+'-'+(mf[sec].length-1));};});
  photoArrayUI($('#mvPhotos'),mf.photos,re);
  $('#mvSave').onclick=async()=>{if(await movSave(kind,mf))loadMovHist(kind);};
  $('#mvSubmit').onclick=()=>movSubmit(kind,mf);
  $('#mvShare').onclick=()=>movShare(kind,mf);
  $('#mvNew').onclick=()=>{if(confirm('Vider la fiche en cours ?')){MOVF[kind]=freshMov();re();}};
  loadMovHist(kind);
  if(focusSel){const r=app.querySelector('.pf-row[data-sec="'+focusSel.split('-')[0]+'"][data-li="'+focusSel.split('-')[1]+'"]');if(r)setTimeout(()=>scrollCardIntoView(r),60);}
}
async function loadMovHist(kind){
  const c=MOVCFG[kind];const host=$('#mvHist');if(!host)return;
  let recs=[];try{recs=(await idbAll()).filter(r=>String(r.id).indexOf(c.pfx)===0).sort((a,b)=>b.savedAt-a.savedAt);}catch(e){}
  host.innerHTML='';
  const serverRows=await sipsRecords(kind);
  if(serverRows.length){
    const h=document.createElement('div');h.style.cssText='font-size:12px;font-weight:800;color:var(--green);margin:0 0 6px;text-transform:uppercase';
    h.textContent='Validees serveur';host.append(h);
    serverRows.sort((a,b)=>String(b.validatedAt||'').localeCompare(String(a.validatedAt||''))).forEach(row=>{
      const rec=row.payload||{};
      const nf=(rec.finis||[]).filter(x=>x.a&&num(x.q)>0).length;const nm=(rec.mp||[]).filter(x=>x.a&&num(x.q)>0).length;const ph=(rec.photos||[]).length;
      const it=document.createElement('div');it.className='hist-item locked';
      it.innerHTML='<div class="info"><b>'+frDate(rec.date)+'</b><span>VALIDEE serveur - '+(rec.agent?esc(rec.agent)+' - ':'')+esc(rec.ref||'—')+' - '+nf+' fini(s) - '+nm+' MP - '+ph+' photo(s)</span></div>';
      const open=document.createElement('button');open.textContent='Voir';open.onclick=()=>{MOVF[kind]={date:rec.date,agent:rec.agent||'',ref:rec.ref||'',finis:(rec.finis&&rec.finis.length?clone(rec.finis):[{a:'',q:''}]),mp:(rec.mp&&rec.mp.length?clone(rec.mp):[{a:'',q:''}]),photos:clone(rec.photos||[]),note:rec.note||''};renderMov(kind);};
      it.append(open);host.append(it);
    });
  }
  if(recs.length){
    const h=document.createElement('div');h.style.cssText='font-size:12px;font-weight:800;color:var(--steel-d);margin:10px 0 6px;text-transform:uppercase';
    h.textContent='Historique local';host.append(h);
  }
  recs.forEach(rec=>{
    const nf=(rec.finis||[]).filter(x=>x.a&&num(x.q)>0).length;const nm=(rec.mp||[]).filter(x=>x.a&&num(x.q)>0).length;const ph=(rec.photos||[]).length;
    const it=document.createElement('div');it.className='hist-item';
    it.innerHTML='<div class="info"><b>'+frDate(rec.date)+'</b><span>'+(rec.ref||'—')+' - '+nf+' fini(s) - '+nm+' MP - '+ph+' photo(s)</span></div>';
    const open=document.createElement('button');open.textContent='Voir';open.onclick=()=>{MOVF[kind]={date:rec.date,agent:rec.agent||'',ref:rec.ref||'',finis:(rec.finis&&rec.finis.length?clone(rec.finis):[{a:'',q:''}]),mp:(rec.mp&&rec.mp.length?clone(rec.mp):[{a:'',q:''}]),photos:clone(rec.photos||[]),note:rec.note||''};renderMov(kind);};
    const del=document.createElement('button');del.className='del';del.textContent='Suppr.';del.onclick=async()=>{if(confirm('Supprimer ?')){await idbDel(rec.id);loadMovHist(kind);}};
    it.append(open,del);host.append(it);
  });
  if(!recs.length&&!serverRows.length){host.innerHTML='<p style="color:#6a7280;font-size:13px;margin:0">Aucune '+(kind==='entree'?'entree':'sortie')+' enregistree.</p>';}
}
function renderSorties(f){renderMov('sortie',f);}
function renderEntrees(f){renderMov('entree',f);}

/* ================= SERVEUR LOCAL ================= */
function sipsTypeLabel(t){return ({quality:'Qualite',sortie:'Sortie',entree:'Entree',production:'Production',inventory:'Inventaire',test:'Test'})[t]||t||'Soumission';}
function sipsPayloadSummary(type,payload){
  payload=payload||{};
  if(type==='quality'){const i=payload.informations||{},v=payload.visas||{};const sigs=['operateur','responsableQualite'].filter(k=>v[k]&&v[k].signature).length;return (i.numeroLot||'lot ?')+' - '+(i.refProduit||'produit ?')+' - '+(i.dateProduction||payload.date||'date ?')+' - '+sigs+'/2 signatures obligatoires';}
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
      +sipsLines('Matieres premieres / Echantillons',p.mp,[['a','Article'],['q','Qte']]);
  }
  if(s.type==='quality'){
    const i=p.informations||{},v=p.visas||{};
    const visaRows=['operateur','responsableProd','responsableQualite'].map(k=>{const x=v[k]||{};return {role:k==='operateur'?'Operateur':(k==='responsableProd'?'Resp. production':'Resp. qualite'),nom:x.nom||'',date:x.date||'',signature:x.signature?'oui':'non'};});
    return sipsKV([['Produit',i.refProduit],['Lot',i.numeroLot],['Date production',frDate(i.dateProduction||p.date)],['Heure debut',i.heureDebut],['Heure fin',i.heureFin],['Quantite produite',i.quantiteProduite?i.quantiteProduite+' kg':''],['Taille batch',i.tailleBatch?i.tailleBatch+' kg':''],['Correction de',p.correctionOf&&p.correctionOf.id],['Motif correction',p.correctionNote]])
      +sipsLines('Matieres premieres',p.matieresPremieres,[['designation','Designation'],['code','Code'],['refFournisseur','Ref fournisseur'],['dateProd','Date prod'],['dateExp','Date exp']])
      +sipsLines('Batches / melanges',p.melanges,[['batchNum','Batch'],['heureDebut','Debut'],['heureFin','Fin']])
      +sipsLines('Visas',visaRows,[['role','Role'],['nom','Nom'],['date','Date'],['signature','Signature']]);
  }
  if(s.type==='production'){
    return sipsKV([['Date',frDate(p.date)],['Operateur',p.agent],['Note',p.note]])
      +sipsLines('Productions',p.blocks,[['p','Produit'],['n','Qte'],['w_emb','Dechet emb.'],['w_film','Dechet film'],['w_mel','Melange kg']]);
  }
  if(s.type==='inventory'){
    const detail=Object.keys(p.detail||{}).map(code=>Object.assign({code:code},p.detail[code]));
    return sipsKV([['Date',frDate(p.date)],['Compteur',p.agent],['Articles comptes',p.filled],['Alertes bilan',p.bilan&&p.bilan.nbAlertes],['Ecart total',p.bilan&&p.bilan.total]])
      +sipsLines('Articles comptes',detail.slice(0,80),[['code','Code'],['n','Article'],['p','Physique'],['t','Theorique'],['e','Ecart']]);
  }
  return '<pre style="white-space:pre-wrap;font-size:12px;background:#f7faf8;border:1px solid var(--line);border-radius:8px;padding:8px;margin:8px 0 0">'+esc(JSON.stringify(p,null,2).slice(0,2000))+'</pre>';
}
function sipsSubmissionHTML(s){
  const actor=s.author&&s.author.name?(' - '+esc(s.author.name)):'';
  const status=s.status==='submitted'?'En attente':(s.status==='validated'?'Validee':'Rejetee');
  const summary=sipsPayloadSummary(s.type,s.payload);
  const actions=s.status==='submitted'?'<button data-act="validate">Valider</button>'+(s.type==='quality'?'<button class="del" data-act="correction">Demander correction</button>':'')+'<button class="del" data-act="reject">Rejeter</button>':'';
  return '<div class="hist-item" data-sub="'+esc(s.id)+'"><div class="info"><b>'+esc(sipsTypeLabel(s.type))+' - '+status+'</b><span>'+esc(summary)+actor+' - '+new Date(s.createdAt).toLocaleString('fr-FR')+'</span></div>'+actions+'<div style="flex-basis:100%">'+sipsSubmissionDetailHTML(s)+'</div></div>';
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
    +'<div class="pf-sec"><div class="pf-h">Donnees validees</div><div id="srvRecords">Chargement...</div></div></div>';
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
  try{const data=await sipsFetch('/api/submissions?status=submitted&include=payload',{headers:sipsAdminHeaders()});const rows=data.submissions||[];subs.innerHTML=rows.length?rows.map(sipsSubmissionHTML).join(''):'<p style="color:#6a7280;font-size:13px;margin:0">Aucune soumission en attente.</p>';subs.querySelectorAll('[data-sub]').forEach(el=>{const id=el.dataset.sub;el.querySelectorAll('button[data-act]').forEach(b=>b.onclick=()=>sipsDecide(id,b.dataset.act));});}
  catch(e){subs.innerHTML='<p style="color:var(--red);font-size:13px;margin:0">Impossible de charger les soumissions : '+esc(e.message)+(String(e.message).indexOf('admin')>=0?' - connecte-toi avec un compte admin ou renseigne le PIN serveur.':'')+'</p>';}
  try{const data=await sipsFetch('/api/records?status=validated',{headers:sipsAdminHeaders()});const rows=data.records||[];records.innerHTML=rows.length?rows.map(sipsRecordHTML).join(''):'<p style="color:#6a7280;font-size:13px;margin:0">Aucun enregistrement valide dans la base centrale.</p>';records.querySelectorAll('[data-rec]').forEach(el=>{const id=el.dataset.rec;const b=el.querySelector('button[data-act="cancel"]');if(b)b.onclick=()=>sipsCancelRecord(id);});}
  catch(e){records.innerHTML='<p style="color:var(--red);font-size:13px;margin:0">Impossible de charger les donnees validees : '+esc(e.message)+'</p>';}
}
async function sipsDecide(id,act){
  const isCorrection=act==='correction';
  const apiAct=isCorrection?'reject':act;
  const label=apiAct==='validate'?'valider':(isCorrection?'demander correction sur':'rejeter');
  if(!confirm(label.charAt(0).toUpperCase()+label.slice(1)+' cette soumission ?'))return;
  const note=apiAct==='reject'?prompt(isCorrection?'Correction demandee ?':'Motif du rejet ?','Correction demandee'):null;
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
