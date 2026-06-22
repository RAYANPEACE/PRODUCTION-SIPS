/* ====== COMPTAGE FRAGMENTÉ (plusieurs compteurs → fusion automatique) ======
   Modèle IndexedDB, type 'fragsess_<ts>' :
     {id, kind:'fragsess', date, title, createdAt, savedAt, status:'open'|'merged',
      agents:[nom,…], active:nom,
      fragments:{ nom:{agent, status:'pending'|'done', startedAt, savedAt, doneAt,
                        st:{c:{code:entry}, cfg:{code:params}}} },
      mergedInvId}
   La fusion produit un inventaire 'inv_<ts>' classique (visible partout) enrichi
   d'une métadonnée `frag` (agents, fragments, sources par article). */
let FRAG=null;                 // session fragmentée active (l'objet IndexedDB lui-même)
let FRAGED=null;               // nom du compteur dont le fragment est actuellement chargé dans ST

function fragCount(fr){return (fr&&fr.st&&fr.st.c)?Object.values(fr.st.c).filter(e=>e&&e.counted).length:0;}
function fragAllDone(sess){return !!sess&&(sess.agents||[]).length>0&&sess.agents.every(n=>sess.fragments[n]&&sess.fragments[n].status==='done');}
function fragDoneCount(sess){return (sess.agents||[]).filter(n=>sess.fragments[n]&&sess.fragments[n].status==='done').length;}

/* Construit un ST complet et éditable à partir du fragment d'un compteur */
function fragBuildST(fr){
  const st=freshCounts();st.id='frag_'+FRAG.id+'_'+slug(fr.agent);st.agent=fr.agent;st.date=FRAG.date;
  st.cfg=clone((fr.st&&fr.st.cfg)||{});
  REFS.forEach(r=>st.c[r.code]=blankEntry(r));
  if(fr.st&&fr.st.c)Object.keys(fr.st.c).forEach(code=>{if(st.c[code])st.c[code]=clone(fr.st.c[code]);});
  return st;
}
/* Recopie l'état courant (ST) dans le fragment effectivement chargé (FRAGED) */
function fragPersist(){
  if(!FRAG||!FRAGED)return;
  const fr=FRAG.fragments[FRAGED];if(!fr)return;
  fr.st={c:clone(ST.c),cfg:clone(ST.cfg||{})};
  fr.savedAt=Date.now();fr.startedAt=fr.startedAt||fr.savedAt;
  FRAG.savedAt=Date.now();
}
/* Bascule sur le comptage d'un compteur donné */
function fragEnterAgent(name){
  if(!FRAG||!FRAG.fragments[name])return;
  fragPersist();
  FRAG.active=name;FRAGED=name;
  RO=false;document.body.classList.remove('ro');$('#roBanner').style.display='none';
  ST=fragBuildST(FRAG.fragments[name]);mergeAndMigrate();
  $('#agent').value=ST.agent;$('#date').value=ST.date;
  $('#agent').disabled=true;$('#date').disabled=true;
  if(TAB!=='comptage')switchTab('comptage');else render();
  renderFragBanner();
  idbPut(FRAG).catch(()=>{});
}
function fragMarkDone(){
  if(!FRAG||!FRAG.active)return;const fr=FRAG.fragments[FRAG.active];if(!fr)return;
  fragPersist();fr.status='done';fr.doneAt=Date.now();idbPut(FRAG).catch(()=>{});
  renderFragBanner();
  if(fragAllDone(FRAG)){if(confirm('Tous les compteurs ont terminé.\n\nFusionner maintenant les saisies en un inventaire final ?'))fragFinalize();}
  else toast('Part de '+fr.agent+' terminée');
}
function fragReopen(){
  if(!FRAG||!FRAG.active)return;const fr=FRAG.fragments[FRAG.active];if(!fr)return;
  fr.status='pending';fr.doneAt=null;idbPut(FRAG).catch(()=>{});renderFragBanner();
}
function fragAddAgentLive(){
  if(!FRAG)return;const name=(prompt('Nom du nouveau compteur :')||'').trim();if(!name)return;
  if(FRAG.fragments[name]){toast('Ce compteur existe déjà');return;}
  FRAG.agents.push(name);FRAG.fragments[name]={agent:name,status:'pending',startedAt:0,savedAt:0,doneAt:null,st:{c:{},cfg:{}}};
  idbPut(FRAG).catch(()=>{});fragEnterAgent(name);
}

/* Fusion roulante : pour chaque article,
   1) si quelqu'un l'a RECOMPTÉ cette session (fresh), on garde le recomptage le plus récent ;
   2) sinon on REPORTE la valeur héritée du dernier inventaire (base commune aux parts) ;
   3) sinon rien (= théorique).
   `fr.fresh` est l'ensemble des codes recomptés ; absent ⇒ tout compté est considéré frais (rétro-compat). */
function mergeFragments(sess){
  const merged=freshCounts();merged.id='inv_'+Date.now();merged.date=sess.date;
  merged.agent='Fusion · '+(sess.agents||[]).join(', ');merged.cfg={};
  REFS.forEach(r=>merged.c[r.code]=blankEntry(r));
  const srcBy={};
  REFS.forEach(r=>{
    const code=r.code;
    let fEntry=null,fTs=-1,fName=null,fCfg=null;        // meilleur recomptage frais
    let bEntry=null,bSess=-1,bName=null,bCfg=null;       // meilleure valeur de base (report)
    (sess.agents||[]).forEach(name=>{
      const fr=sess.fragments[name];if(!fr||!fr.st||!fr.st.c)return;
      const e=fr.st.c[code];if(!e||!e.counted)return;
      const isFresh=fr.fresh?fr.fresh.has(code):true;
      const cfg=(fr.st.cfg&&fr.st.cfg[code])?fr.st.cfg[code]:null;
      if(isFresh){const ts=(e._ts!=null?e._ts:(fr.doneAt||fr.savedAt||0));
        if(ts>=fTs){fTs=ts;fEntry=e;fName=name;fCfg=cfg;}}
      else{const ss=fr.sessionStart||0;                  // report : on garde la base la plus récente
        if(ss>=bSess){bSess=ss;bEntry=e;bName=name;bCfg=cfg;}}
    });
    const chosen=fEntry||bEntry;
    if(chosen){
      merged.c[code]=clone(chosen);
      srcBy[code]=fEntry?fName:(bName+' · report');
      const cfg=fEntry?fCfg:bCfg;if(cfg)merged.cfg[code]=clone(cfg);
    }
  });
  REFS.forEach(r=>{if(!merged.cfg[r.code])merged.cfg[r.code]={...r.p};});
  return {st:merged,sources:srcBy};
}
/* Coeur partagé : fusionne une session, calcule bilan/détail, archive l'inventaire final.
   Utilisé à la fois par le mode « même téléphone » et le mode « par fichier ». */
async function fragArchiveMerged(sess){
  const {st,sources}=mergeFragments(sess);
  // Calcul du bilan/détail en basculant temporairement ST (réutilise buildBilan/snapshot)
  const prevST=ST,prevRO=RO;ST=st;RO=true;mergeAndMigrate();
  let bilan=null,detail=null;
  try{const b=buildBilan();bilan={total:Math.round(b.total*1000)/1000,nbAlertes:b.alertes.length,nbCounted:b.rows.filter(r=>r.counted).length};
    detail={};b.rows.forEach(r=>{if(r.counted)detail[r.code]={n:r.nom,t:r.theo,p:r.phys,e:r.ecart};});}catch(e){}
  const filled=REFS.filter(r=>st.c[r.code].counted).length;
  const snap=snapshot();
  ST=prevST;RO=prevRO;
  const frag={sessionId:sess.id,date:sess.date,title:sess.title||'',source:sess.source||'device',agents:sess.agents.slice(),
    fragments:sess.agents.map(n=>{const fr=sess.fragments[n]||{};return {agent:n,status:fr.status||'pending',doneAt:fr.doneAt||null,savedAt:fr.savedAt||null,count:fragCount(fr)};}),
    sources:sources};
  const rec={id:st.id,date:st.date,agent:st.agent,savedAt:Date.now(),filled,bilan,detail,st:snap,frag};
  rec._sig=localSig('inv',{date:rec.date,detail:rec.detail||null,st:rec.st&&rec.st.c?rec.st.c:null});
  const dup=await findLocalDuplicate('inv',rec._sig,rec.id);
  if(dup)return {rec:dup,filled};
  await idbPut(rec);
  return {rec,filled};
}
/* Mode « même téléphone » : fusionne la session active, l'archive, ouvre le résultat */
async function fragFinalize(){
  if(!FRAG)return;const sess=FRAG;fragPersist();
  if(!fragDoneCount(sess)&&!confirm('Aucun compteur n’a marqué « j’ai fini ». Fusionner quand même les saisies actuelles ?'))return;
  clearTimeout(_saveTimer);
  const {rec,filled}=await fragArchiveMerged(sess);
  sess.status='merged';sess.mergedInvId=rec.id;sess.savedAt=Date.now();await idbPut(sess);
  fragExitState();
  openArchive(rec);
  toast('Inventaire fusionné · '+filled+' article(s) · '+sess.agents.length+' compteurs');
}

/* Sort du mode fragmenté (réactive les champs, masque le bandeau) sans recharger de brouillon */
function fragExitState(){
  FRAG=null;FRAGED=null;$('#agent').disabled=false;$('#date').disabled=false;renderFragBanner();
}
/* Quitte le mode fragmenté et recharge le brouillon « current » normal */
async function fragLeave(){
  fragExitState();
  const cur=await idbGet('current');ST=(cur&&cur.st)||freshCounts();mergeAndMigrate();
  $('#agent').value=ST.agent;$('#date').value=ST.date;
  if(TAB==='comptage')render();
}

function renderFragBanner(){
  const el=$('#fragBanner');if(!el)return;
  const nm=$('#newInv'),fm=$('#footMain');
  if(!FRAG){el.className='';el.innerHTML='';if(nm)nm.style.display='';if(fm&&TAB==='comptage')fm.style.display='';return;}
  if(nm)nm.style.display='none';if(fm)fm.style.display='none';
  const ready=fragAllDone(FRAG);
  const chips=FRAG.agents.map(n=>{const fr=FRAG.fragments[n]||{};const c=fragCount(fr);
    const cls='fb-chip'+(n===FRAG.active?' active':'')+(fr.status==='done'?' done':'');
    return `<button class="${cls}" data-fa="${esc(n)}">${fr.status==='done'?'<span class="fc-ok">✓</span> ':''}${esc(n)} <span class="fc-n">${c}</span></button>`;}).join('');
  const fr=FRAG.fragments[FRAG.active]||{};const isDone=fr.status==='done';
  el.className='on';
  el.innerHTML=
    `<div class="fb-top">🧩 <b>Session fragmentée</b><span class="fb-meta">${esc(FRAG.date||'')}${FRAG.title?' · '+esc(FRAG.title):''} · ${fragDoneCount(FRAG)}/${FRAG.agents.length} finis</span><button class="fb-quit" data-fq>Quitter</button></div>`+
    `<div class="fb-chips">${chips}<button class="fb-add" data-faadd>+ compteur</button></div>`+
    `<div class="fb-acts">`+
      (isDone?`<button class="fb-reopen" data-freopen>↺ Reprendre la saisie de ${esc(FRAG.active)}</button>`
             :`<button class="fb-done" data-fdone>✓ ${esc(FRAG.active)} a fini</button>`)+
      `<button class="fb-merge${ready?' ready':''}" data-fmerge>⚙ Fusionner & archiver</button>`+
    `</div>`;
  el.querySelectorAll('[data-fa]').forEach(b=>b.onclick=()=>fragEnterAgent(b.dataset.fa));
  const q=el.querySelector('[data-fq]');if(q)q.onclick=()=>{if(confirm('Quitter le mode fragmenté ? La session reste enregistrée et reprenable via « 👥 Fragmenté ».'))fragLeave();};
  const ad=el.querySelector('[data-faadd]');if(ad)ad.onclick=fragAddAgentLive;
  const dn=el.querySelector('[data-fdone]');if(dn)dn.onclick=fragMarkDone;
  const ro=el.querySelector('[data-freopen]');if(ro)ro.onclick=fragReopen;
  const mg=el.querySelector('[data-fmerge]');if(mg)mg.onclick=fragFinalize;
}

/* Dialogue : créer une nouvelle session ou en reprendre une ouverte */
function fragAgentRow(val){
  const row=document.createElement('div');row.className='fa-row';
  row.innerHTML='<input placeholder="Nom du compteur" autocomplete="off"><button type="button" title="Retirer">×</button>';
  if(val)row.querySelector('input').value=val;
  row.querySelector('button').onclick=()=>{const wrap=$('#fragAgents');row.remove();if(!wrap.children.length)wrap.appendChild(fragAgentRow(''));};
  return row;
}
function openFragDlg(){
  FRAGFILES=[];$('#fragMergeTitle').value='';
  const rescue=$('#fragModeFiles');if(rescue)rescue.open=false;
  const d=$('#srvFragDate');if(d&&!d.value)d.value=todayStr();
  fragRenderFileList();srvFragLoadSessions();
  $('#fragDlg').showModal();
}
function fragStartFromDlg(){
  const names=[...$('#fragAgents').querySelectorAll('input')].map(i=>i.value.trim()).filter(Boolean);
  const uniq=[...new Set(names)];
  if(uniq.length<1){alert('Indique au moins un compteur.');return;}
  if(uniq.length!==names.length){alert('Deux compteurs portent le même nom — choisis des noms distincts.');return;}
  const date=$('#fragDate').value||new Date().toISOString().slice(0,10);
  const sess={id:'fragsess_'+Date.now(),kind:'fragsess',date:date,title:$('#fragTitle').value.trim(),
    createdAt:Date.now(),savedAt:Date.now(),status:'open',agents:uniq.slice(),active:null,fragments:{}};
  uniq.forEach(n=>sess.fragments[n]={agent:n,status:'pending',startedAt:0,savedAt:0,doneAt:null,st:{c:{},cfg:{}}});
  idbPut(sess).catch(()=>{});
  $('#fragDlg').close();
  fragResume(sess);
}
function fragResume(sess,wantMerge){
  if(FRAG&&FRAG.id!==sess.id){fragPersist();idbPut(FRAG).catch(()=>{});}
  FRAG=sess;FRAGED=null;
  if(wantMerge){fragFinalize();return;}
  fragEnterAgent(sess.active&&sess.fragments[sess.active]?sess.active:sess.agents[0]);
  toast('Session fragmentée ouverte');
}

/* ====== MODE « CHACUN SON TÉLÉPHONE » : échange de parts par fichier ======
   Chaque personne exporte son comptage (fichier .txt) et l'envoie (WhatsApp,
   mail…). Une personne importe toutes les parts reçues : l'app les fusionne
   (pour chaque article, la part la plus récente gagne — gère aussi le
   comptage étalé sur plusieurs jours). Réutilise le format d'export existant. */

/* Codes des articles réellement (re)comptés pendant la session de comptage en cours */
function freshCodes(){
  const ss=ST.sessionStart||0;
  return REFS.filter(r=>{const e=ST.c[r.code];return e&&e.counted&&e._ts!=null&&e._ts>=ss;}).map(r=>r.code);
}
/* Exporte le comptage courant comme « part » partageable */
function buildFragmentFile(){
  const o=JSON.parse(buildJSON());           // {meta,articles,etat,cfg?}
  o.type='lep-fragment';o.v=2;o.ts=Date.now();
  ST.fragmentPartId=ST.fragmentPartId||('part_'+Date.now()+'_'+Math.random().toString(36).slice(2,8));
  o.partId=ST.fragmentPartId;
  if(o.etat)o.etat.fragmentPartId=ST.fragmentPartId;
  o.sessionStart=ST.sessionStart||0;
  o.freshCodes=freshCodes();                 // articles recomptés cette session (les seuls « frais » à la fusion)
  return JSON.stringify(o,null,2);
}
async function shareFragment(){
  ST.date=$('#date').value;
  const counted=REFS.filter(r=>ST.c[r.code]&&ST.c[r.code].counted).length;
  if(!counted){toast('Compte au moins un article avant d’exporter ta part');return;}
  const fresh=freshCodes().length;
  if(!fresh&&!confirm('Tu n’as recompté aucun article cette session (tout vient d’un inventaire chargé).\n\nÀ la fusion, ta part n’apportera aucun nouveau comptage. Exporter quand même ?'))return;
  if(!String(ST.agent||'').trim()&&!confirm('Aucun nom de compteur saisi. Continuer quand même ?\n(Le nom aide à reconnaître ta part lors de la fusion.)'))return;
  const name='ma_part_'+(ST.date||'sansdate')+(slug(ST.agent)?'_'+slug(ST.agent):'')+'.txt';
  const content=buildFragmentFile();
  let file=null;try{file=new File([content],name,{type:'text/plain'});}catch(_){}
  try{
    if(file&&navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      await navigator.share({files:[file],title:'Ma part d’inventaire',text:'Part d’inventaire '+(ST.date||'')+(ST.agent?(' — '+ST.agent):'')});return;
    }
  }catch(e){}
  download(name,content,'text/plain');
}

/* Transforme un fichier reçu (part OU inventaire complet) en fragment fusionnable.
   Détermine l'ensemble « fresh » = articles réellement recomptés pendant la session
   du compteur (le reste = valeurs héritées de l'inventaire de base, non « frais »). */
function fragIngestFile(o){
  const etat=(o&&o.etat)?o.etat:o;
  if(!etat||!etat.c)return null;
  const agent=(etat.agent||(o.meta&&o.meta.agent)||'Compteur').trim()||'Compteur';
  const partId=String(o.partId||etat.fragmentPartId||'').trim();
  const ts=Date.parse((o.meta&&o.meta.exporte)||'')||o.ts||etat.savedAt||Date.now();
  const sessionStart=(o.sessionStart!=null?o.sessionStart:(etat.sessionStart!=null?etat.sessionStart:0));
  // Valeurs calculées par le compteur = autoritaires (évite tout recalcul avec d'autres réglages)
  if(o&&Array.isArray(o.articles))o.articles.forEach(a=>{const e=etat.c[a.code];if(!e)return;if(a.compte&&a.physique!=null)e._phys=a.physique;});
  // Ensemble des articles recomptés pendant la session du compteur
  let fresh=null;
  if(Array.isArray(o.freshCodes))fresh=new Set(o.freshCodes.filter(c=>etat.c[c]&&etat.c[c].counted));
  else{
    const codesWithTs=Object.keys(etat.c).filter(c=>etat.c[c]&&etat.c[c]._ts!=null);
    const hasSession=(o.sessionStart!=null)||(etat.sessionStart!=null);
    if(!hasSession&&!codesWithTs.length)fresh=null;   // vieux fichier sans horodatage : tout compté = frais (rétro-compat)
    else fresh=new Set(Object.keys(etat.c).filter(c=>{const e=etat.c[c];return e&&e.counted&&e._ts!=null&&e._ts>=sessionStart;}));
  }
  const cnt=Object.values(etat.c).filter(e=>e&&e.counted).length;
  const freshCnt=fresh?fresh.size:cnt;
  return {partId,agent,date:etat.date||'',ts,sessionStart,fresh,count:cnt,freshCount:freshCnt,st:{c:etat.c,cfg:(o.cfg||etat.cfg||{})}};
}

let FRAGFILES=[];   // parts chargées dans le dialogue, en attente de fusion
function fragAddFile(text){
  let o;try{o=JSON.parse(text);}catch(e){toast('Fichier illisible');return;}
  const fr=fragIngestFile(o);
  if(!fr){toast('Format non reconnu (ce n’est pas une part / un inventaire)');return;}
  // Même part renvoyée plusieurs fois : on garde la version la plus récente.
  // Les vieux fichiers sans partId restent dédupliqués par nom de compteur.
  const key=fr.partId?('id:'+fr.partId):('agent:'+fr.agent.toLowerCase());
  const i=FRAGFILES.findIndex(x=>(x.partId?('id:'+x.partId):('agent:'+x.agent.toLowerCase()))===key);
  if(i>=0){if(fr.ts>=FRAGFILES[i].ts){FRAGFILES[i]=fr;toast('Part de '+fr.agent+' mise à jour (plus récente)');}else toast('Part de '+fr.agent+' ignorée (une plus récente est déjà chargée)');}
  else{FRAGFILES.push(fr);toast('Part de '+fr.agent+' ajoutée');}
  fragRenderFileList();
}
function fragRenderFileList(){
  const wrap=$('#fragFileList');if(!wrap)return;wrap.innerHTML='';
  if(!FRAGFILES.length){wrap.innerHTML='<div style="font-size:12.5px;color:#6a7280;padding:4px 0">Aucune part chargée. Ajoute les fichiers reçus des compteurs.</div>';$('#fragMergeFiles').disabled=true;$('#fragMergeFiles').style.opacity=.5;return;}
  FRAGFILES.forEach((fr,i)=>{
    const el=document.createElement('div');el.className='frag-sess';
    const d=new Date(fr.ts);
    el.innerHTML=`<div class="fs-info"><b>${esc(fr.agent)}</b>
      <span><b style="color:var(--green)">${fr.freshCount} recompté(s)</b> · ${fr.count} compté(s) au total · ${fr.date||'—'} · reçu ${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span></div>`;
    const acts=document.createElement('div');acts.className='fs-acts';
    const del=document.createElement('button');del.className='del';del.textContent='Retirer';del.onclick=()=>{FRAGFILES.splice(i,1);fragRenderFileList();};
    acts.append(del);el.append(acts);wrap.append(el);
  });
  const mb=$('#fragMergeFiles');mb.disabled=false;mb.style.opacity=1;mb.textContent='Fusionner '+FRAGFILES.length+' part'+(FRAGFILES.length>1?'s':'')+' secours & archiver';
}
/* ====== MODE SERVEUR : session officielle base + freshCodes ====== */
let SRV_FRAG_SESSIONS=[];
function srvFragSelectedId(){
  const r=document.querySelector('input[name="srvFragPick"]:checked');
  return r?r.value:'';
}
async function srvFragLoadSessions(){
  const host=$('#srvFragList');if(!host)return;
  host.innerHTML='<div style="font-size:12.5px;color:#6a7280;padding:4px 0">Chargement des sessions serveur...</div>';
  try{
    const data=await sipsFetch('/api/inventory-sessions');
    SRV_FRAG_SESSIONS=data.sessions||[];
    srvFragRenderSessions();
  }catch(e){
    host.innerHTML='<div style="font-size:12.5px;color:var(--red);padding:4px 0">Sessions serveur indisponibles : '+esc(e.message)+'</div>';
  }
}
function srvFragRenderSessions(){
  const host=$('#srvFragList');if(!host)return;
  if(!SRV_FRAG_SESSIONS.length){
    host.innerHTML='<div style="font-size:12.5px;color:#6a7280;padding:4px 0">Aucune session ouverte. Un admin peut creer la session ci-dessus.</div>';
    return;
  }
  host.innerHTML=SRV_FRAG_SESSIONS.map((s,i)=>{
    const n=(s.contributions||[]).length;
    const c=(s.contributions||[]).reduce((a,x)=>a+(x.counted||0),0);
    const base=s.baseInventoryId?('Base '+(s.baseDate||s.baseInventoryId)):'Aucune base serveur';
    return '<label class="frag-sess" style="cursor:pointer"><input type="radio" name="srvFragPick" value="'+esc(s.id)+'" '+(i===0?'checked':'')+'>'
      +'<div class="fs-info"><b>'+esc(s.title||('Inventaire '+(s.date||'')))+'</b>'
      +'<span>'+frDate(s.date)+' - '+esc(base)+' - '+n+' part(s), '+c+' article(s) recompte(s)</span></div>'
      +'<div class="fs-acts">'+(ADMIN?'<button type="button" data-srvmerge="'+esc(s.id)+'">Analyser / fusionner</button>':'')+'</div></label>';
  }).join('');
  host.querySelectorAll('[data-srvmerge]').forEach(b=>b.onclick=ev=>{ev.preventDefault();srvFragAnalyze(b.dataset.srvmerge);});
}
function srvFragClearInheritedTimestamps(st){
  if(!st||!st.c)return st;
  Object.keys(st.c).forEach(code=>{if(st.c[code]&&st.c[code]._ts!=null)delete st.c[code]._ts;});
  return st;
}
async function srvFragStartOfflinePart(){
  if(!confirm('Demarrer une part locale hors serveur ?\n\nLes chiffres deja visibles restent une base de reference locale. A partir de maintenant, seuls les articles que tu modifies seront marques comme recomptes et envoyables plus tard.'))return;
  if(FRAG)fragExitState();
  await archiveCurrent();
  RO=false;document.body.classList.remove('ro');$('#roBanner').style.display='none';
  ST=srvFragClearInheritedTimestamps(clone(ST));
  ST.id='offlinefrag_'+Date.now();
  ST.date=$('#date').value||ST.date||todayStr();
  ST.agent=(typeof USR!=='undefined'&&USR.nom)||ST.agent||'';
  ST.sessionStart=Date.now();
  ST.serverFragmentSessionId='';
  ST.serverFragmentBaseId=null;
  ST.offlineFragmentStartedAt=ST.sessionStart;
  mergeAndMigrate();
  $('#agent').value=ST.agent;$('#date').value=ST.date;
  await idbPut({id:'current',date:ST.date,agent:ST.agent,savedAt:Date.now(),st:ST},false);
  $('#fragDlg').close();
  if(TAB!=='comptage')switchTab('comptage');else render();
  window.scrollTo(0,0);
  toast('Part hors serveur demarree - compte uniquement ta partie');
}
async function srvFragLoadBase(){
  const id=srvFragSelectedId();
  if(!id){toast('Choisis une session serveur');return;}
  try{
    const data=await sipsFetch('/api/inventory-sessions/'+encodeURIComponent(id));
    const sess=data.session;
    if(!confirm('Charger la base de cette session dans le comptage ?\n\nLe comptage courant sera archive localement, puis seuls les articles modifies apres chargement seront envoyes comme part officielle.'))return;
    if(FRAG)fragExitState();
    await archiveCurrent();
    RO=false;document.body.classList.remove('ro');$('#roBanner').style.display='none';
    ST=sess.baseSnapshot?clone(sess.baseSnapshot):freshCounts();
    ST=srvFragClearInheritedTimestamps(ST);
    ST.id='srvfrag_'+Date.now();
    ST.date=sess.date||todayStr();
    ST.agent=(typeof USR!=='undefined'&&USR.nom)||ST.agent||'';
    ST.sessionStart=Date.now();
    ST.serverFragmentSessionId=sess.id;
    ST.serverFragmentBaseId=sess.baseInventoryId||null;
    mergeAndMigrate();
    $('#agent').value=ST.agent;$('#date').value=ST.date;
    await idbPut({id:'current',date:ST.date,agent:ST.agent,savedAt:Date.now(),st:ST},false);
    $('#fragDlg').close();
    if(TAB!=='comptage')switchTab('comptage');else render();
    window.scrollTo(0,0);
    toast('Base session chargee - compte uniquement ta partie');
  }catch(e){toast('Erreur chargement session : '+e.message);}
}
function srvFragContributionPayload(){
  ST.date=$('#date').value;
  if(!ST.agent&&typeof USR!=='undefined'&&USR.nom)ST.agent=USR.nom;
  const codes=freshCodes().filter(code=>ST.c[code]&&ST.c[code].counted);
  const counts={},cfg={};
  codes.forEach(code=>{
    counts[code]=clone(ST.c[code]);
    const r=REFS.find(x=>x.code===code);
    cfg[code]=(ST.cfg&&ST.cfg[code])?clone(ST.cfg[code]):(r?clone(pOf(r)):{});
  });
  return {agent:ST.agent||'',sessionId:ST.serverFragmentSessionId||'',baseInventoryId:ST.serverFragmentBaseId||null,offlineStartedAt:ST.offlineFragmentStartedAt||null,freshCodes:codes,counts:counts,cfg:cfg};
}
function srvFragPayloadRows(payload){
  return (payload.freshCodes||[]).map(code=>{
    const r=REFS.find(x=>x.code===code);
    return {code:code,des:r?r.des:'Article',q:srvFragEntryTotal(code,{entry:payload.counts[code],cfg:payload.cfg&&payload.cfg[code]})};
  });
}
function srvFragPreviewMine(){
  const payload=srvFragContributionPayload();
  const rows=srvFragPayloadRows(payload);
  const mode=payload.sessionId?'Base session serveur':(payload.offlineStartedAt?'Part demarree hors serveur':'Comptage courant non lie a une session');
  const dlg=document.createElement('dialog');
  dlg.style.cssText='border:none;border-radius:14px;padding:0;max-width:94vw;width:620px;box-shadow:0 20px 60px rgba(0,0,0,.35)';
  const body=rows.length?rows.map(r=>'<div class="srv-prev-row"><b>'+esc(r.code)+'</b><span>'+esc(r.des)+'</span><small>'+esc(r.q)+'</small></div>').join('')
    :'<p style="color:#6a7280;font-size:13px;margin:0">Aucun article modifie depuis le demarrage de cette part.</p>';
  dlg.innerHTML='<div class="dlg-h"><b>Apercu de ma part</b><button data-close>×</button></div><div class="dlg-b">'
    +'<div class="srv-prev-meta"><b>'+esc(mode)+'</b><span>'+rows.length+' article(s) seront envoyes</span></div>'
    +'<div class="srv-prev-list">'+body+'</div>'
    +'<div class="dlg-actions"><button class="b-go" data-close2>Fermer</button></div></div>';
  document.body.appendChild(dlg);dlg.showModal();
  const close=()=>{dlg.close();dlg.remove();};
  dlg.querySelector('[data-close]').onclick=close;
  dlg.querySelector('[data-close2]').onclick=close;
}
async function srvFragCreateSession(){
  const date=($('#srvFragDate')&&$('#srvFragDate').value)||todayStr();
  const title=($('#srvFragTitle')&&$('#srvFragTitle').value.trim())||('Inventaire '+frDate(date));
  if(typeof authConfirmPassword==='function'&&!(await authConfirmPassword('creer une session inventaire serveur')))return;
  try{
    await sipsFetch('/api/inventory-sessions',{method:'POST',headers:sipsAdminHeaders(),body:JSON.stringify({date:date,title:title})});
    toast('Session inventaire serveur creee');
    await srvFragLoadSessions();
  }catch(e){toast('Erreur session serveur : '+e.message);}
}
async function srvFragSendMine(){
  const id=srvFragSelectedId();
  if(!id){toast('Choisis une session serveur');return;}
  const payload=srvFragContributionPayload();
  if(payload.sessionId&&payload.sessionId!==id&&!confirm('Le comptage courant a ete charge depuis une autre session serveur.\n\nEnvoyer quand meme cette part vers la session selectionnee ?'))return;
  if(!payload.sessionId&&!confirm('Cette part a ete demarree hors serveur.\n\nEnvoyer uniquement les articles modifies depuis le demarrage de cette part ? Les autres articles resteront pris depuis la base de la session serveur.'))return;
  if(!payload.freshCodes.length){toast('Aucun article recompte dans cette session de comptage');return;}
  try{
    await sipsFetch('/api/inventory-sessions/'+encodeURIComponent(id)+'/contributions',{method:'POST',body:JSON.stringify({payload:payload})});
    toast('Part envoyee au serveur : '+payload.freshCodes.length+' article(s)');
    await srvFragLoadSessions();
  }catch(e){toast('Erreur envoi fragment : '+e.message);}
}
function srvFragBuildMerged(sess,resolutions){
  const base=sess.baseSnapshot?clone(sess.baseSnapshot):freshCounts();
  base.id='inv_'+Date.now();base.date=sess.date||todayStr();
  base.agent='Fusion serveur - '+(sess.title||sess.id);
  base.sessionStart=Date.now();
  base.cfg=base.cfg||{};base.c=base.c||{};
  REFS.forEach(r=>{base.c[r.code]??=blankEntry(r);base.cfg[r.code]??=clone(pOf(r));});
  const byCode={},conflicts=[],applied=[];
  (sess.contributions||[]).forEach(c=>{
    const p=c.payload||{};
    Object.keys(p.counts||{}).forEach(code=>{
      byCode[code]=byCode[code]||[];
      byCode[code].push({agent:c.agent||p.agent||'Compteur',entry:p.counts[code],cfg:p.cfg&&p.cfg[code]});
    });
  });
  Object.keys(byCode).forEach(code=>{
    const rows=byCode[code];
    const resolvedIndex=resolutions&&resolutions[code]!=null?Number(resolutions[code]):null;
    if(rows.length===1||resolvedIndex!=null){
      const idx=resolvedIndex!=null?resolvedIndex:0;
      if(!rows[idx]){conflicts.push({code:code,rows:rows});return;}
      base.c[code]=clone(rows[idx].entry);
      if(rows[idx].cfg)base.cfg[code]=clone(rows[idx].cfg);
      if(rows.length>1)applied.push({code:code,agent:rows[idx].agent,choices:rows.map(x=>x.agent)});
    }else conflicts.push({code:code,rows:byCode[code]});
  });
  return {st:base,conflicts:conflicts,changed:Object.keys(byCode).length,resolutions:applied};
}
function srvFragEntryTotal(code,row){
  const r=REFS.find(x=>x.code===code);if(!r)return '';
  const prevST=ST,prevRO=RO;
  ST={id:'tmp_srvfrag',date:todayStr(),agent:'',c:{},cfg:{}};RO=true;
  ST.c[code]=clone(row.entry);ST.cfg[code]=row.cfg?clone(row.cfg):clone(pOf(r));
  try{mergeAndMigrate();return fmt(total(r))+' '+(r.u||'');}
  catch(e){return 'valeur saisie';}
  finally{ST=prevST;RO=prevRO;}
}
function srvFragResolveConflicts(sess,conflicts){
  return new Promise(resolve=>{
    const dlg=document.createElement('dialog');
    dlg.style.cssText='border:none;border-radius:14px;padding:0;max-width:94vw;width:620px;box-shadow:0 20px 60px rgba(0,0,0,.35)';
    const rows=conflicts.map(c=>{
      const r=REFS.find(x=>x.code===c.code);
      const choices=c.rows.map((row,i)=>'<label class="srv-conf-choice"><input type="radio" name="conf_'+esc(c.code)+'" value="'+i+'"> <span><b>'+esc(row.agent)+'</b><small>'+esc(srvFragEntryTotal(c.code,row))+'</small></span></label>').join('');
      return '<div class="srv-conf" data-code="'+esc(c.code)+'"><div class="srv-conf-h"><b>'+esc(c.code)+' - '+esc(r?r.des:'Article')+'</b><span>'+c.rows.length+' comptages</span></div>'+choices+'</div>';
    }).join('');
    dlg.innerHTML='<div class="dlg-h"><b>Conflits inventaire</b><button data-close>×</button></div><div class="dlg-b">'
      +'<p class="ref-hint" style="margin-top:0">Plusieurs compteurs ont recompte le meme article. Choisis explicitement la valeur a garder pour chaque conflit, puis la fusion creera une soumission a valider.</p>'
      +rows
      +'<div id="srvConfErr" style="display:none;color:var(--red);font-size:13px;margin-top:8px"></div>'
      +'<div class="dlg-actions"><button class="b-sec" data-cancel>Annuler</button><button class="b-go" data-ok>Utiliser les choix</button></div></div>';
    document.body.appendChild(dlg);dlg.showModal();
    const close=v=>{dlg.close();dlg.remove();resolve(v);};
    dlg.querySelector('[data-close]').onclick=()=>close(null);
    dlg.querySelector('[data-cancel]').onclick=()=>close(null);
    dlg.querySelector('[data-ok]').onclick=()=>{
      const out={};
      for(const c of conflicts){
        const box=[...dlg.querySelectorAll('.srv-conf')].find(el=>el.dataset.code===c.code);
        const pick=box&&box.querySelector('input[type="radio"]:checked');
        if(!pick){
          const err=dlg.querySelector('#srvConfErr');
          err.textContent='Choisis une valeur pour chaque conflit avant de fusionner.';
          err.style.display='';
          return;
        }
        out[c.code]=Number(pick.value);
      }
      close(out);
    };
  });
}
function srvFragInventoryPayload(sess,merged){
  const prevST=ST,prevRO=RO;ST=merged.st;RO=true;mergeAndMigrate();
  let bilan=null,detail=null;
  try{
    const b=buildBilan();
    bilan={total:Math.round(b.total*1000)/1000,nbAlertes:b.alertes.length,nbCounted:b.rows.filter(r=>r.counted).length};
    detail={};b.rows.forEach(r=>{if(r.counted)detail[r.code]={n:r.nom,t:r.theo,p:r.phys,e:r.ecart};});
  }catch(e){}
  const snap=snapshot();ST=prevST;RO=prevRO;
  const filled=REFS.filter(r=>snap.c[r.code]&&snap.c[r.code].counted).length;
  return {kind:'inventory',date:snap.date||todayStr(),agent:snap.agent||'',filled:filled,bilan:bilan,detail:detail,st:snap,
    frag:{source:'server',sessionId:sess.id,title:sess.title||'',baseInventoryId:sess.baseInventoryId||null,baseDate:sess.baseDate||'',agents:(sess.contributions||[]).map(c=>c.agent||'Compteur'),resolutions:merged.resolutions||[]}};
}
async function srvFragAnalyze(id){
  try{
    const data=await sipsFetch('/api/inventory-sessions/'+encodeURIComponent(id));
    const sess=data.session;
    let merged=srvFragBuildMerged(sess);
    let resolutionMap={};
    let msg='Session '+(sess.title||sess.id)+'\n\nParts : '+(sess.contributions||[]).length+'\nArticles recomptees : '+merged.changed;
    if(merged.conflicts.length){
      const resolutions=await srvFragResolveConflicts(sess,merged.conflicts);
      if(!resolutions)return;
      resolutionMap=resolutions;
      merged=srvFragBuildMerged(sess,resolutions);
      if(merged.conflicts.length){toast('Conflits non resolus');return;}
      msg+='\n\nConflits resolus explicitement : '+merged.resolutions.length+'.';
    }
    msg+='\n\nAucun conflit. Creer une soumission inventaire a valider par admin ?';
    if(!confirm(msg))return;
    if(typeof authConfirmPassword==='function'&&!(await authConfirmPassword('finaliser la session inventaire')))return;
    const payload=srvFragInventoryPayload(sess,merged);
    await sipsFetch('/api/inventory-sessions/'+encodeURIComponent(id)+'/finalize',{
      method:'POST',headers:sipsAdminHeaders(),
      body:JSON.stringify({actor:(typeof USR!=='undefined'&&USR.nom)||'admin',payload:payload,resolutions:resolutionMap,summary:{conflicts:0,resolvedConflicts:(merged.resolutions||[]).length,changed:merged.changed,contributions:(sess.contributions||[]).length}})
    });
    toast('Fusion creee en soumission inventaire - validation admin requise');
    await srvFragLoadSessions();
  }catch(e){toast('Erreur fusion serveur : '+e.message);}
}
if($('#srvFragCreate'))$('#srvFragCreate').onclick=srvFragCreateSession;
if($('#srvFragLoad'))$('#srvFragLoad').onclick=srvFragLoadBase;
if($('#srvFragOffline'))$('#srvFragOffline').onclick=srvFragStartOfflinePart;
if($('#srvFragReload'))$('#srvFragReload').onclick=srvFragLoadSessions;
if($('#srvFragPreview'))$('#srvFragPreview').onclick=srvFragPreviewMine;
if($('#srvFragSend'))$('#srvFragSend').onclick=srvFragSendMine;

async function fragMergeFiles(){
  if(!FRAGFILES.length){toast('Ajoute au moins une part');return;}
  const dates=FRAGFILES.map(f=>f.date).filter(Boolean).sort();
  const date=dates[dates.length-1]||new Date().toISOString().slice(0,10);
  const agents=[],fragments={};
  FRAGFILES.forEach(fr=>{agents.push(fr.agent);
    fragments[fr.agent]={agent:fr.agent,status:'done',startedAt:fr.ts,savedAt:fr.ts,doneAt:fr.ts,sessionStart:fr.sessionStart,fresh:fr.fresh,st:fr.st};});
  const sess={id:'fragsess_files_'+Date.now(),date,title:$('#fragMergeTitle')?$('#fragMergeTitle').value.trim():'',source:'files',agents,fragments};
  const {rec,filled}=await fragArchiveMerged(sess);
  FRAGFILES=[];
  $('#fragDlg').close();
  openArchive(rec);
  toast('Fusion réussie · '+filled+' article(s) · '+agents.length+' compteurs');
}
