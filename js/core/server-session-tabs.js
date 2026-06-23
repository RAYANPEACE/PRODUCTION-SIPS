/* ================= ÉTAPE 1 — RÔLES (PIN) + ONGLETS + RÉFÉRENTIELS ADMIN ================= */
/* Amorçage (catégorie issue de inventaire_lep.py ; unité de base issue du conditionnement) */
const SEED_CAT={"190001":"film","190002":"film","190003":"film","190004":"carton","190005":"carton","190006":"carton","190021":"carton","110012":"mp","110113":"mp","190010":"mp","190011":"mp","190014":"mp","190015":"mp","190016":"mp","190017":"mp","190019":"mp","900001":"mp","390002":"fini","390003":"fini","390004":"fini","390005":"fini","390006":"fini","120206":"emballage","190007":"emballage","190008":"emballage","190009":"emballage","190012":"emballage","190013":"emballage"};
const SEED_UB={"110012":"kg","110113":"kg","120206":"unite","190001":"kg","190002":"kg","190003":"kg","190004":"carton","190005":"carton","190006":"carton","190007":"m","190008":"unite","190009":"unite","190010":"kg","190011":"kg","190012":"unite","190013":"unite","190014":"kg","190015":"kg","190016":"kg","190017":"kg","190019":"kg","190021":"carton","390002":"carton","390003":"carton","390004":"carton","390005":"sac","390006":"sac","900001":"kg"};
const SEED_ETAT={"110012":556,"110113":2000.5,"120206":98,"190001":6637,"190002":4020,"190003":259,"190004":5148,"190005":5892,"190006":3660,"190007":492940,"190008":2520,"190009":9575,"190010":4.237,"190011":323,"190012":684,"190013":4554,"190014":28.585,"190015":45.8,"190016":4301.5,"190017":2.112,"190019":22.6,"190021":939,"390002":400,"390003":1314,"390005":559,"390006":330,"900001":16722};
const SEED_COND={"110012":{"ub":"kg","lv":[["sac",50]]},"110113":{"ub":"kg","lv":[["sac",25]]},"120206":{"ub":"unite","lv":[]},"190001":{"ub":"kg","lv":[]},"190002":{"ub":"kg","lv":[]},"190003":{"ub":"kg","lv":[]},"190004":{"ub":"carton","lv":[["paquet",25],["etage",125]]},"190005":{"ub":"carton","lv":[["paquet",25],["etage",150]]},"190006":{"ub":"carton","lv":[["paquet",25]]},"190007":{"ub":"m","lv":[]},"190008":{"ub":"unite","lv":[]},"190009":{"ub":"unite","lv":[]},"190010":{"ub":"kg","lv":[]},"190011":{"ub":"kg","lv":[["sac",20]]},"190012":{"ub":"unite","lv":[]},"190013":{"ub":"unite","lv":[]},"190014":{"ub":"kg","lv":[]},"190015":{"ub":"kg","lv":[]},"190016":{"ub":"kg","lv":[["sac",25],["etage",75],["palette",625]]},"190017":{"ub":"kg","lv":[]},"190019":{"ub":"kg","lv":[]},"190021":{"ub":"carton","lv":[["paquet",25],["etage",150]]},"390002":{"ub":"carton","lv":[["etage",14],["palette",140]]},"390003":{"ub":"carton","lv":[["etage",14],["palette",210]]},"390004":{"ub":"carton","lv":[["etage",10],["palette",320]]},"390005":{"ub":"sac","lv":[["etage",13],["palette",65]]},"390006":{"ub":"sac","lv":[["etage",8],["palette",40]]},"900001":{"ub":"kg","lv":[["sac",25],["etage",75],["palette",625]]}};
const SEED_RECF={"CARTON LAITY 20G":[{"code":"110113","des":"MALTODEXTRINE","qte":0.5},{"code":"190001","des":"FILM SACHETS 20g LAIT EN POUDRE","qte":0.2},{"code":"190010","des":"DIOXYDE DE SILICONE","qte":0.001},{"code":"190014","des":"AROME CREME","qte":0.001},{"code":"190016","des":"FAT 50","qte":0.5},{"code":"190017","des":"AROME LAIT CONCENTRE","qte":0.0006},{"code":"","des":"FILM SACHETS 20g LAITY","qte":0.2},{"code":"190021","des":"CARTON LAITY 20G","qte":1},{"code":"900001","des":"VRAC LAIT EN POUDRE CHAMPION","qte":1}],"DIAMO LAIT 400G X 10":[{"code":"110113","des":"MALTODEXTRINE","qte":0.8},{"code":"190003","des":"FILM SACHETS 400G LAIT EN POUDRE","qte":0.11},{"code":"190004","des":"CARTON LEP 400G","qte":1},{"code":"190007","des":"ZIPPER","qte":1.6},{"code":"190010","des":"DIOXYDE DE SILICONE","qte":0.002},{"code":"900001","des":"VRAC LAIT EN POUDRE CHAMPION","qte":3.2}],"DIAMO LAIT 20G X100":[{"code":"110113","des":"MALTODEXTRINE","qte":0.5},{"code":"190001","des":"FILM SACHETS 20g LAIT EN POUDRE","qte":0.2},{"code":"190005","des":"CARTON LEP 20G","qte":1},{"code":"190010","des":"DIOXYDE DE SILICONE","qte":0.001},{"code":"190014","des":"AROME CREME","qte":0.001},{"code":"190016","des":"FAT 50","qte":0.5},{"code":"190017","des":"AROME LAIT CONCENTRE","qte":0.0006},{"code":"900001","des":"VRAC LAIT EN POUDRE CHAMPION","qte":1}],"DIAMO CAFE AU LAIT 30G X 50":[{"code":"110012","des":"SUCRE","qte":0.6},{"code":"110113","des":"MALTODEXTRINE","qte":0.204},{"code":"190002","des":"FILM SACHETS 30G CAFE AU LAIT","qte":0.1},{"code":"190006","des":"CARTON CAFE AU LAIT 30G","qte":1},{"code":"190010","des":"DIOXYDE DE SILICONE","qte":0.00075},{"code":"190011","des":"CAFE","qte":0.06},{"code":"190014","des":"AROME CREME","qte":0.00075},{"code":"190015","des":"AROME CAFE","qte":0.0015},{"code":"190016","des":"FAT 50","qte":0.33},{"code":"190017","des":"AROME LAIT CONCENTRE","qte":0.0015},{"code":"190019","des":"CMC","qte":0.0015},{"code":"900001","des":"VRAC LAIT EN POUDRE CHAMPION","qte":0.3}],"DIAMO LAIT 5KG":[{"code":"110113","des":"MALTODEXTRINE","qte":1},{"code":"190008","des":"SACS KRAFT 5KG DIAMO","qte":1},{"code":"190010","des":"DIOXYDE DE SILICONE","qte":0.003},{"code":"190012","des":"SAC PLASTIQUE POUR KRAFT 5KG","qte":1},{"code":"900001","des":"VRAC LAIT EN POUDRE CHAMPION","qte":4}],"DIAMO LAIT 10KG":[{"code":"110113","des":"MALTODEXTRINE","qte":2},{"code":"190009","des":"SACS KRAFT 10KG DIAMO","qte":1},{"code":"190010","des":"DIOXYDE DE SILICONE","qte":0.006},{"code":"190013","des":"SAC PLASTIQUE POUR KRAFT 10KG","qte":1},{"code":"900001","des":"VRAC LAIT EN POUDRE CHAMPION","qte":8}]};

/* Stockage référentiels : localStorage si dispo, sinon mémoire (ex. aperçu artefact Claude) */
const MEM={};
function lsGet(k,def){try{const v=localStorage.getItem(k);if(v!=null)return JSON.parse(v);}catch(e){}return (k in MEM)?MEM[k]:def;}
function lsSet(k,v){MEM[k]=v;try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function clone(o){return JSON.parse(JSON.stringify(o));}
function stableClean(v){
  if(Array.isArray(v))return v.map(stableClean);
  if(v&&typeof v==='object'){
    const out={};
    Object.keys(v).sort().forEach(k=>{
      if(['id','savedAt','submittedAt','validatedAt','cancelledAt','photo','photos','_sig'].includes(k))return;
      out[k]=stableClean(v[k]);
    });
    return out;
  }
  if(typeof v==='string')return v.trim();
  return v;
}
function localSig(type,payload){return JSON.stringify(stableClean({type:type,payload:payload}));}

/* ---------- SERVEUR LOCAL SIPS ---------- */
let SIPS_SERVER=lsGet('lep_server_cfg',{url:'',adminPin:''});
/* ====== SESSION (auth serveur, Phase 2) ======
   SESSION = compte connecte {id,nom,role,tabs,canSign} ou null (mode local legacy).
   Couche de compatibilite : applySession() alimente USR et ADMIN depuis SESSION,
   pour que tous les usages existants de USR.nom / USR.poste / ADMIN continuent de marcher. */
let SESSION=lsGet('sips_session',null);
let SESSION_TOKEN=lsGet('sips_token','');
let SESSION_OFFLINE=false;
let SESSION_LAST_VERIFIED=lsGet('sips_session_verified_at','');
// Timeout par defaut des appels serveur. Sans lui, fetch() reste bloque longtemps
// quand le PC serveur est injoignable (serveur eteint mais Wi-Fi encore actif) :
// statut "Verification..." sans fin, historique local qui ne s'affiche pas,
// soumissions hors-ligne sans retour (l'utilisateur re-clique -> doublons).
const SIPS_FETCH_TIMEOUT=3000;
// ----- Verrou strict hors-ligne (securite auth) -----
// Cet appareil sait-il que le serveur utilise des comptes ? Persistant : une fois
// vrai, reste vrai. Marque quand on confirme un serveur configure ou apres login.
function markAuthConfigured(){try{lsSet('sips_auth_configured',true);}catch(e){}}
function authConfigured(){return !!(lsGet('sips_auth_configured',false)||SESSION||SESSION_TOKEN||SESSION_LAST_VERIFIED);}
// Vrai = comptes serveur actifs MAIS aucune session reelle en cache.
// Dans ce cas : pas d'admin par PIN, pas de soumission serveur sous identite libre.
function sipsRequiresLogin(){return authConfigured()&&!(SESSION&&SESSION_TOKEN);}
function setSessionOffline(v){
  SESSION_OFFLINE=!!v;
  try{document.body.classList.toggle('session-offline',SESSION_OFFLINE);}catch(e){}
}
// Marque la session comme verifiee par le serveur (en ligne) et memorise l'heure.
// Appele apres login/setup, apres /auth/me, et a la reconnexion.
function authMarkVerified(){
  SESSION_LAST_VERIFIED=new Date().toISOString();
  try{lsSet('sips_session_verified_at',SESSION_LAST_VERIFIED);}catch(e){}
  setSessionOffline(false);
}
function authHeader(){return SESSION_TOKEN?{'authorization':'Bearer '+SESSION_TOKEN}:{};}
function sipsServerUrl(){
  const u=String((SIPS_SERVER&&SIPS_SERVER.url)||'').trim().replace(/\/+$/,'');
  if(u)return u;
  if(location.protocol==='http:'||location.protocol==='https:')return location.origin;
  return 'http://localhost:3000';
}
function sipsActor(){
  if(SESSION)return {name:SESSION.nom||'',role:SESSION.role||''};
  return {name:(typeof USR!=='undefined'&&USR.nom)||ST.agent||'',role:(typeof USR!=='undefined'&&USR.poste)||''};
}
async function sipsFetch(path,opt){
  opt=opt||{};
  const headers=Object.assign({'content-type':'application/json'},authHeader(),opt.headers||{});
  const fetchOpt=Object.assign({cache:'no-store'},opt,{headers});
  delete fetchOpt.timeoutMs;
  let timer=null;
  const tmo=opt.timeoutMs||SIPS_FETCH_TIMEOUT;
  if(tmo&&typeof AbortController!=='undefined'){
    const ctl=new AbortController();
    fetchOpt.signal=ctl.signal;
    timer=setTimeout(()=>ctl.abort(),tmo);
  }
  let res;
  try{res=await fetch(sipsServerUrl()+path,fetchOpt);}
  finally{if(timer)clearTimeout(timer);}
  let data=null;try{data=await res.json();}catch(e){}
  if(!res.ok||!data||data.ok===false){
    const err=new Error((data&&data.error)||('HTTP '+res.status));
    err.status=res.status;err.data=data;
    throw err;
  }
  return data;
}
async function sipsPing(){try{return {ok:true,data:await sipsFetch('/api/health')};}catch(e){return {ok:false,error:e.message};}}
function sipsPending(){return lsGet('lep_server_pending',[]);}
function sipsSetPending(rows){lsSet('lep_server_pending',rows||[]);}
function sipsPendingFailure(row,hash,e){
  return Object.assign({},row,{
    hash:hash,
    lastError:(e&&e.message)||'Erreur inconnue',
    lastStatus:(e&&e.status)||null,
    lastTriedAt:new Date().toISOString()
  });
}
function sipsQualityLot(payload){return String(payload&&payload.informations&&payload.informations.numeroLot||'').trim().toUpperCase();}
function sipsQueue(type,payload,note){
  const rows=sipsPending();
  const hash=localSig('server:'+type,payload);
  if(rows.some(r=>(r&&r.hash)===hash||localSig('server:'+((r&&r.type)||''),(r&&r.payload)||{})===hash)){
    return false;
  }
  if(type==='quality'){
    const lot=sipsQualityLot(payload);
    if(lot&&rows.some(r=>r&&r.type==='quality'&&sipsQualityLot(r.payload)===lot))return false;
  }
  rows.push({id:'pend_'+Date.now(),type,payload,hash,author:sipsActor(),note:note||'',createdAt:new Date().toISOString()});
  sipsSetPending(rows);
  return true;
}
async function sipsSubmit(type,payload,note){
  // Verrou strict : des comptes serveur existent mais aucune session reelle en
  // cache -> on refuse de soumettre (et de mettre en file) sous une identite libre.
  if(sipsRequiresLogin()){toast('Connexion requise : reconnecte-toi (serveur disponible) pour soumettre au serveur.');return {ok:false,queued:false,error:'login-required',loginRequired:true};}
  const body={type,payload,author:sipsActor(),note:note||''};
  try{const r=await sipsFetch('/api/submissions',{method:'POST',body:JSON.stringify(body)});toast(r.duplicate?'Deja soumis au serveur':'Soumis au serveur');return {ok:true,duplicate:!!r.duplicate,submission:r.submission};}
  catch(e){
    if(e.status){toast('Erreur serveur : '+e.message);return {ok:false,queued:false,error:e.message,status:e.status};}
    const queued=sipsQueue(type,payload,note);toast(queued?'Serveur indisponible : ajoute en attente':'Soumission deja en attente serveur');return {ok:false,queued:queued,error:e.message};
  }
}
async function sipsFlushPending(){
  const rows=sipsPending();if(!rows.length){toast('Aucune soumission en attente');return {sent:0,failed:0};}
  const keep=[];let sent=0;const seen={},seenQualityLot={};
  for(const row of rows){
    const hash=(row&&row.hash)||localSig('server:'+((row&&row.type)||''),(row&&row.payload)||{});
    if(seen[hash])continue;
    seen[hash]=1;
    if(row&&row.type==='quality'){
      const lot=sipsQualityLot(row.payload);
      if(lot&&seenQualityLot[lot])continue;
      if(lot)seenQualityLot[lot]=1;
    }
    try{await sipsFetch('/api/submissions',{method:'POST',body:JSON.stringify({type:row.type,payload:row.payload,author:row.author,note:row.note||''})});sent++;}
    catch(e){keep.push(sipsPendingFailure(row,hash,e));}
  }
  sipsSetPending(keep);
  const blocked=keep.filter(r=>r&&r.lastStatus).length;
  const waiting=keep.length-blocked;
  toast(sent+' envoyee(s), '+waiting+' en attente connexion, '+blocked+' bloquee(s)');
  return {sent,failed:keep.length,blocked,waiting};
}
// Met a jour la carte "Serveur local" de l'accueil avec l'etat REEL (re-teste a chaque appel).
async function updSrvDash(){
  var el=$('#srvDash');if(!el)return;
  var pend=sipsPending().length;
  var r=await sipsPing();
  el.innerHTML=(r.ok?'<span style="color:var(--green);font-weight:700">Connecte</span>':'<span style="color:var(--red);font-weight:700">Hors ligne</span>')+' - '+esc(sipsServerUrl())+' - '+pend+' en attente';
}
// A la reouverture de l'app (retour au premier plan) : re-teste le serveur,
// envoie les soumissions en attente si joignable, et rafraichit le statut.
async function sipsAutoSyncOnVisible(){
  if(document.hidden)return;
  try{
    var r=await sipsPing();
    if(r.ok){
      // Serveur revenu : revalider une session reprise du cache (Phase 5).
      if(SESSION_TOKEN&&SESSION&&SESSION_OFFLINE){
        try{var me=await sipsFetch('/api/auth/me',{timeoutMs:2500});SESSION=me.user;authStore();applySession();authMarkVerified();if(typeof updateAuthUI==='function')updateAuthUI();}catch(e){}
      }
      if(sipsPending().length)await sipsFlushPending();
    }
  }catch(e){}
  updSrvDash();
  sipsRefreshNotifications();
}
document.addEventListener('visibilitychange',sipsAutoSyncOnVisible);
// Rafraichissement leger du statut quand l'accueil est visible (toutes les 15 s).
setInterval(function(){if(!document.hidden)updSrvDash();},15000);
setInterval(function(){if(!document.hidden)sipsRefreshNotifications();},20000);
function sipsAdminHeaders(){return {'x-sips-admin-pin':String((SIPS_SERVER&&SIPS_SERVER.adminPin)||'')};}
async function sipsRecords(type,opt){
  try{
    opt=opt||{};
    const q=[];if(type)q.push('type='+encodeURIComponent(type));q.push('status=validated');
    const fetchOpt={headers:sipsAdminHeaders()};
    if(opt.timeoutMs)fetchOpt.timeoutMs=opt.timeoutMs;
    const data=await sipsFetch('/api/records'+(q.length?'?'+q.join('&'):''),fetchOpt);
    const rows=data.records||[];
    return rows;
  }catch(e){return [];}
}

let META=lsGet('lep_meta',{});                 // {code:{des?,ub?,cat?}}
let ADDED=lsGet('lep_added',[]);               // [{code,des,ub,cat}]
let ETAT=lsGet('lep_etat',null); if(ETAT===null){ETAT={...SEED_ETAT};lsSet('lep_etat',ETAT);}
let ETAT_DATE=lsGet('lep_etat_date','');   // date de l'état de stock (ERP) : le Bilan s'apparie à l'inventaire ≤ cette date
let COND=lsGet('lep_cond',null); if(COND===null){COND=clone(SEED_COND);lsSet('lep_cond',COND);}
let RECF=lsGet('lep_recf',null); if(RECF===null){RECF=clone(SEED_RECF);lsSet('lep_recf',RECF);}

const UB_OPTS=['kg','carton','sac','unite','m'];
const CAT_OPTS=[['mp','Ingrédient (sachet)'],['film','Film'],['carton','Carton'],['emballage','Emballage divers'],['fini','Produit fini']];

/* Applique les référentiels sur la liste de comptage REFS (catégorie, unité de base, désignation, articles ajoutés) */
function applyReferentials(){
  REFS.forEach(r=>{
    const m=META[r.code]||{};
    r.ub=m.ub||SEED_UB[r.code]||r.u||'unite';
    r.cat=m.cat||SEED_CAT[r.code]||'';
    if(m.des)r.des=m.des;
  });
  ADDED.forEach(a=>{
    if(REFS.some(r=>r.code===a.code))return;
    REFS.push({code:a.code,des:a.des||a.code,u:a.ub||'unité',ub:a.ub||'unite',cat:a.cat||'',g:'divers',m:'simple',p:{},_added:true});
  });
}
function pnum(s){return num(String(s==null?'':s).replace(/[\s\u00a0]/g,''));}
function esc(s){return String(s==null?'':s).replace(/"/g,'&quot;');}
function loadScript(src){return new Promise((res,rej)=>{
  if(document.querySelector('script[data-lib="'+src+'"]'))return res();
  const s=document.createElement('script');s.src=src;s.dataset.lib=src;
  s.onload=()=>res();s.onerror=()=>rej(new Error('Échec chargement '+src));
  document.head.appendChild(s);});}
async function ensureXLSX(){if(window.XLSX)return;await loadScript('xlsx.full.min.js');}
async function ensurePDF(){
  if(!window.PDFLib)await loadScript('pdf-lib.min.js');
  if(!window.pdfjsLib)await loadScript('pdf.min.js');
  if(window.pdfjsLib&&pdfjsLib.GlobalWorkerOptions&&!pdfjsLib.GlobalWorkerOptions.workerSrc)pdfjsLib.GlobalWorkerOptions.workerSrc='pdf.worker.min.js';
}

/* ---------- RÔLES (PIN 4 chiffres) ---------- */
let ADMIN=false;
const ADMIN_PIN='1951';   // Code admin commun à tous — pour le changer, modifier cette valeur ici (GitHub)
function askPin(){
  const t=prompt('Code admin :');
  if(t==null)return false;
  if(t!==ADMIN_PIN){alert('Code incorrect.');return false;}
  return true;
}
function toggleAdmin(){
  if(ADMIN){ADMIN=false;updateAdminUI();switchTab('accueil');toast('Mode employé');return;}
  // Verrou strict : comptes serveur actifs mais pas de session -> pas d'admin par PIN.
  if(sipsRequiresLogin()){toast('Comptes serveur actifs : connecte-toi pour les droits admin.');return;}
  if(askPin()){ADMIN=true;updateAdminUI();toast('Mode admin déverrouillé');}
}
function updateAdminUI(){
  document.body.classList.toggle('admin',ADMIN);
  const lb=$('#lockBtn');if(lb)lb.textContent=ADMIN?'🔓 Admin':'🔒';
  buildTabbar();
  const tb=$('#tabbar');if(tb)tb.style.display='flex';
}

/* ---------- COMPATIBILITE SESSION -> USR / ADMIN ---------- */
var ROLE_LABELS={admin:'Chef d\'usine',magasinier:'Magasinier',operateur:'Opérateur',preparateur:'Préparateur mélanges',responsableQualite:'Responsable qualité'};
function roleLabel(r){return ROLE_LABELS[r]||r||'—';}
// Alimente l'ancien systeme (USR, ADMIN) a partir de la session serveur.
function applySession(){
  if(SESSION){
    if(typeof USR==='undefined')USR={nom:'',poste:''};
    USR.nom=SESSION.nom||'';
    USR.poste=(SESSION.canSign&&SESSION.canSign[0])||'';   // visa signable, pour la qualite
    ADMIN=SESSION.role==='admin';
  }
}
// Onglet visible ? Session = droits serveur ; sinon fallback legacy (adminOnly + PIN).
function hasTab(id){
  if(SESSION&&Array.isArray(SESSION.tabs))return SESSION.tabs.indexOf(id)>=0;
  var t=TABS.find(function(x){return x[0]===id;});if(!t)return false;
  // Verrou strict : sans vrai compte, le PIN ne donne plus acces aux onglets admin.
  if(sipsRequiresLogin())return !t[3];
  return !t[3]||ADMIN;
}

/* ---------- ONGLETS ---------- */
const TABS=[['accueil','Accueil',true,false],['comptage','Comptage',true,false],['prod','Production',true,false],['qualite','Qualité',true,false],['ref','Référentiels',true,true],['bilan','Bilan',true,true],['feuillet','Feuillet',true,true],['capacite','Capacité',true,true],['plan','Plan',true,true],['sorties','Sorties',true,false],['entree','Entrées',true,false],['analyse','Analyses',true,true],['serveur','Serveur',true,true]];
let TAB='accueil';
let SIPS_NOTIF_COUNTS={};
let SIPS_NOTIF_PREV_TOTAL=null;
let SIPS_NOTIF_BUSY=false;
let SIPS_NOTIF_AUDIO=false;
document.addEventListener('pointerdown',function(){SIPS_NOTIF_AUDIO=true;},{once:true});
document.addEventListener('keydown',function(){SIPS_NOTIF_AUDIO=true;},{once:true});
function sipsNotifBeep(){
  if(!SIPS_NOTIF_AUDIO)return;
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
    const ctx=new Ctx(),osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type='sine';osc.frequency.value=880;gain.gain.value=.045;
    osc.connect(gain);gain.connect(ctx.destination);osc.start();
    setTimeout(function(){try{osc.stop();ctx.close();}catch(e){}},130);
  }catch(e){}
}
function sipsApplyNotifBadges(){
  document.querySelectorAll('#tabbar .tab').forEach(function(btn){
    const id=btn.dataset.tab;
    let b=btn.querySelector('.notif-badge');
    if(!b){b=document.createElement('span');b.className='notif-badge';btn.appendChild(b);}
    const n=SIPS_NOTIF_COUNTS[id]||0;
    b.textContent=n>99?'99+':String(n);
    b.classList.toggle('on',n>0);
    btn.title=n>0?n+' notification(s) a traiter':'';
  });
}
function sipsSetNotifCounts(counts){
  SIPS_NOTIF_COUNTS=counts||{};
  sipsApplyNotifBadges();
  const total=Object.keys(SIPS_NOTIF_COUNTS).reduce(function(a,k){return a+(SIPS_NOTIF_COUNTS[k]||0);},0);
  if(SIPS_NOTIF_PREV_TOTAL!==null&&total>SIPS_NOTIF_PREV_TOTAL)sipsNotifBeep();
  SIPS_NOTIF_PREV_TOTAL=total;
}
async function sipsRefreshNotifications(){
  if(SIPS_NOTIF_BUSY)return;
  SIPS_NOTIF_BUSY=true;
  const counts={};
  try{
    const pending=sipsPending().length;
    if(pending&&hasTab('serveur'))counts.serveur=(counts.serveur||0)+pending;
    if(hasTab('serveur')){
      try{
        const data=await sipsFetch('/api/submissions?status=submitted');
        counts.serveur=(counts.serveur||0)+((data.submissions||[]).length);
      }catch(e){}
    }
    if(hasTab('qualite')&&SESSION&&Array.isArray(SESSION.canSign)&&SESSION.canSign.some(function(r){return r==='operateur'||r==='responsableQualite';})){
      try{
        const q=await sipsFetch('/api/submissions?status=submitted&type=quality&include=payload');
        const qRows=q.submissions||[];
        const need=(q.submissions||[]).filter(function(s){
          const v=(s.payload&&s.payload.visas)||{};
          return SESSION.canSign.some(function(role){return (role==='operateur'||role==='responsableQualite')&&(!v[role]||!v[role].signature);});
        }).length;
        counts.qualite=(counts.qualite||0)+need;
        const c=await sipsFetch('/api/submissions?status=rejected&type=quality&include=payload');
        const recs=await sipsRecords('quality');
        const resumed={};
        qRows.forEach(function(s){const id=s&&s.payload&&s.payload.correctionOf&&s.payload.correctionOf.id;if(id)resumed[id]=1;});
        recs.forEach(function(r){const id=r&&r.payload&&r.payload.correctionOf&&r.payload.correctionOf.id;if(id)resumed[id]=1;});
        const corrections=(c.submissions||[]).filter(function(s){return s&&s.correctionRequested&&!resumed[s.id];}).length;
        counts.qualite=(counts.qualite||0)+corrections;
      }catch(e){}
    }
  }finally{
    SIPS_NOTIF_BUSY=false;
    sipsSetNotifCounts(counts);
  }
}
function buildTabbar(){
  const tb=$('#tabbar');if(!tb)return;tb.innerHTML='';
  TABS.forEach(([id,label,ready,adminOnly])=>{
    if(!hasTab(id))return;
    const b=document.createElement('button');
    b.className='tab'+(ready?'':' soon');b.dataset.tab=id;
    b.textContent=ready?label:label+' · à venir';
    b.onclick=()=>{ if(!ready){toast('Module à construire à l\u2019étape suivante');return;} switchTab(id); };
    const badge=document.createElement('span');badge.className='notif-badge';b.appendChild(badge);
    tb.appendChild(b);
  });
  sipsApplyNotifBadges();
  sipsRefreshNotifications();
}
async function switchTab(id){
  TAB=id;
  document.querySelectorAll('#tabbar .tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===id));
  const isC=(id==='comptage');
  const ct=$('#comptageTools');if(ct)ct.style.display=isC?'':'none';
  const fm=$('#footMain');if(fm)fm.style.display=isC?'':'none';
  // Capacité & Plan : stock « vivant » = dernier inventaire + flux depuis sa date (calcul async une fois à l'entrée)
  if(id==='capacite'||id==='plan'){try{await refreshLiveStock();}catch(e){}}
  if(isC){render();}
  else if(id==='accueil'){renderAccueil();}
  else if(id==='ref'){renderRef();}
  else if(id==='bilan'){await renderBilan();}
  else if(id==='feuillet'){renderFeuillet();}
  else if(id==='capacite'){renderCapacite();}
  else if(id==='plan'){renderPlan();}
  else if(id==='prod'){renderProduction();}
  else if(id==='sorties'){renderSorties();}
  else if(id==='entree'){renderEntrees();}
  else if(id==='analyse'){renderAnalyse();}
  else if(id==='qualite'){renderQualite();}
  else if(id==='serveur'){renderServeur();}
  else{$('#app').innerHTML='<div class="placeholder"><b>Module «\u00a0'+id+'\u00a0»</b><br>À construire à l\u2019étape suivante.</div>';}
  if(typeof renderFragBanner==='function')renderFragBanner();
  sipsRefreshNotifications();
  window.scrollTo(0,0);
}

/* ---------- RÉFÉRENTIELS ---------- */
let REFTAB='articles';
function renderRef(){
  const app=$('#app');
  app.innerHTML='<div class="ref-wrap">'
    +'<div class="ref-nav">'
    +'<button data-rt="articles">Articles</button>'
    +'<button data-rt="etat">État de stock</button>'
    +'<button data-rt="cond">Conditionnement</button>'
    +'<button data-rt="recf">Recettes</button>'
    +'<button data-rt="mach">Machines</button>'
    +'</div><div id="refBody"></div>'
    // Bouton de sortie admin : seulement en mode legacy PIN (sans session serveur).
    // En session serveur, la deconnexion se fait via la pastille compte en haut a droite -> redondant.
    +(SESSION?'':'<div class="ref-foot"><button id="adminOut">Quitter le mode admin</button></div>')
    +'</div>';
  app.querySelectorAll('.ref-nav button').forEach(b=>{
    b.classList.toggle('active',b.dataset.rt===REFTAB);
    b.onclick=()=>{REFTAB=b.dataset.rt;renderRef();};
  });
  {const ao=$('#adminOut');if(ao)ao.onclick=toggleAdmin;}
  const body=$('#refBody');
  if(REFTAB==='articles')renderArticles(body);
  else if(REFTAB==='etat')renderEtat(body);
  else if(REFTAB==='cond')renderCond(body);
  else if(REFTAB==='mach')renderMachines(body);
  else renderRecf(body);
}

function saveMetaFor(code,patch){META[code]={...(META[code]||{}),...patch};lsSet('lep_meta',META);}
function renderArticles(body){
  const rows=REFS.map(r=>{
    const opts=UB_OPTS.map(u=>'<option '+(r.ub===u?'selected':'')+'>'+u+'</option>').join('');
    const copts=CAT_OPTS.map(o=>'<option value="'+o[0]+'" '+(r.cat===o[0]?'selected':'')+'>'+o[1]+'</option>').join('');
    return '<div class="ref-row" data-code="'+r.code+'">'
      +'<div class="rc">'+r.code+(r._added?' <span class="addedtag">ajouté</span>':'')+'</div>'
      +'<input class="ades" value="'+esc(r.des)+'">'
      +'<select class="aub">'+opts+'</select>'
      +'<select class="acat"><option value="">— catégorie —</option>'+copts+'</select>'
      +'<span class="amet" title="méthode de comptage (réglée dans l\u2019onglet Comptage)">'+r.m+'</span>'
      +(r._added?'<button class="adel" title="supprimer">✕</button>':'<span class="adel-lock" title="article du référentiel de base">🔒</span>')
      +'</div>';
  }).join('');
  body.innerHTML='<p class="ref-hint">Désignation, unité de base et catégorie. La <b>catégorie</b> pilote les règles d\u2019alerte du Bilan. La <b>méthode de comptage</b> reste réglée dans l\u2019onglet Comptage. Les articles ajoutés ici sont comptés en saisie directe.</p>'
    +'<button class="ref-add" id="artAdd">+ Ajouter un article</button>'
    +'<div class="ref-list">'+rows+'</div>';
  $('#artAdd').onclick=addArticle;
  body.querySelectorAll('.ref-row').forEach(row=>{
    const code=row.dataset.code;const r=REFS.find(x=>x.code===code);
    row.querySelector('.ades').addEventListener('input',e=>{r.des=e.target.value;saveMetaFor(code,{des:e.target.value});});
    row.querySelector('.aub').addEventListener('change',e=>{r.ub=e.target.value;saveMetaFor(code,{ub:e.target.value});});
    row.querySelector('.acat').addEventListener('change',e=>{r.cat=e.target.value;saveMetaFor(code,{cat:e.target.value});});
    const del=row.querySelector('.adel');if(del)del.onclick=()=>delArticle(code);
  });
}
function addArticle(){
  const code=prompt('Code article (6 chiffres) :');if(code==null)return;
  if(!/^\d{6}$/.test(code)){alert('Le code doit faire 6 chiffres.');return;}
  if(REFS.some(r=>r.code===code)){alert('Ce code existe déjà.');return;}
  const des=prompt('Désignation :');if(des==null)return;
  const rec={code:code,des:des||code,ub:'unite',cat:''};
  ADDED.push(rec);lsSet('lep_added',ADDED);
  const ref={code:code,des:rec.des,u:'unité',ub:'unite',cat:'',g:'divers',m:'simple',p:{},_added:true};
  REFS.push(ref);ST.c[code]=blankEntry(ref);saveCounts();
  renderRef();toast('Article ajouté (compté en saisie directe)');
}
function delArticle(code){
  if(!confirm('Supprimer cet article ajouté ?'))return;
  ADDED=ADDED.filter(a=>a.code!==code);lsSet('lep_added',ADDED);
  const i=REFS.findIndex(r=>r.code===code);if(i>-1)REFS.splice(i,1);
  delete ST.c[code];delete META[code];lsSet('lep_meta',META);saveCounts();
  renderRef();toast('Article supprimé');
}

/* Convertit un n° de série Excel (jours depuis 1899-12-30) en date ISO AAAA-MM-JJ */
function excelSerialToISO(n){const ms=Math.round((n-25569)*86400000);const d=new Date(ms);return isNaN(d.getTime())?'':d.toISOString().slice(0,10);}
function renderEtat(body){
  const rows=REFS.map(r=>'<div class="ref-row etat" data-code="'+r.code+'"><div class="rc">'+r.code+'</div><div class="ed">'+esc(r.des)+'</div><input class="eval" inputmode="decimal" enterkeyhint="done" value="'+(ETAT[r.code]!=null?ETAT[r.code]:'')+'"></div>').join('');
  body.innerHTML='<p class="ref-hint">Stock théorique de référence — <b>seule base du Bilan et des écarts</b>. Une valeur par article ; vide = 0.</p>'
    +'<div class="etat-date"><label for="etatDate">📅 Date de cet état de stock</label><input id="etatDate" type="date" value="'+esc(ETAT_DATE||'')+'"><div class="etat-date-h">Le Bilan le comparera automatiquement à l’inventaire du même jour ou juste avant (jamais postérieur).</div></div>'
    +'<button class="ref-add" id="etatXlsx">Importer le fichier Excel (.xlsx)</button>'
    +'<div class="ref-list">'+rows+'</div>';
  const ed=$('#etatDate');if(ed)ed.addEventListener('input',e=>{ETAT_DATE=e.target.value||'';lsSet('lep_etat_date',ETAT_DATE);});
  body.querySelectorAll('.eval').forEach(inp=>{
    const code=inp.closest('.ref-row').dataset.code;
    inp.addEventListener('input',e=>{const v=e.target.value.trim();if(v==='')delete ETAT[code];else ETAT[code]=pnum(v);lsSet('lep_etat',ETAT);});
  });
  $('#etatXlsx').onclick=()=>{
    const fi=document.createElement('input');fi.type='file';fi.accept='.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';fi.style.display='none';
    fi.onchange=async ev=>{const f=ev.target.files[0];if(!f)return;
      try{await ensureXLSX();}catch(e){}
      if(!window.XLSX){toast('Lecture Excel indisponible ici (teste sur l\u2019app déployée)');return;}
      const rd=new FileReader();
      rd.onload=()=>{try{
        const wb=XLSX.read(new Uint8Array(rd.result),{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const arr=XLSX.utils.sheet_to_json(ws,{header:1,raw:true});
        let n=0,foundDate='';
        arr.forEach(row=>{const code=String((row&&row[0])||'').trim();
          if(/^\d{6}$/.test(code)){
            let val=null;for(let k=row.length-1;k>=1;k--){if(typeof row[k]==='number'){val=row[k];break;}}
            if(val!=null){ETAT[code]=val;n++;}
          }else if(!foundDate&&row){   // zone d'en-tête : repérer la date de l'état (n° de série Excel ou texte JJ/MM/AAAA)
            row.forEach(cell=>{if(foundDate)return;
              if(typeof cell==='number'&&cell>=40000&&cell<=60000)foundDate=excelSerialToISO(cell);
              else if(typeof cell==='string'){const m=cell.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);if(m)foundDate=m[3]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0');}
            });
          }});
        if(foundDate){ETAT_DATE=foundDate;lsSet('lep_etat_date',ETAT_DATE);}
        lsSet('lep_etat',ETAT);renderRef();toast(n+' valeur(s) importée(s)'+(foundDate?(' · état daté du '+foundDate):''));
      }catch(err){toast('Excel illisible : '+(err&&err.message||err));}};
      rd.readAsArrayBuffer(f);
    };
    fi.click();
  };
}

function renderCond(body){
  const has=r=>COND[r.code]&&(COND[r.code].lv||[]).length>0;
  const shown=REFS.filter(has);
  const cards=shown.map(r=>{
    const c=COND[r.code]||{ub:r.ub,lv:[]};const lv=c.lv||[];
    let lvHtml='';
    for(let i=0;i<3;i++){
      const nom=lv[i]?lv[i][0]:'';const t=lv[i]?lv[i][1]:'';
      lvHtml+='<div class="condlv"><input class="cnom" placeholder="niveau '+(i+1)+' (paquet, étage…)" value="'+esc(nom)+'"><input class="ctail" inputmode="decimal" placeholder="taille en '+r.ub+'" value="'+(t!==''&&t!=null?t:'')+'"></div>';
    }
    return '<div class="ref-card" data-code="'+r.code+'"><div class="cardh"><b>'+r.code+'</b> '+esc(r.des)+'<span class="ubtag">base : '+r.ub+'</span><button class="cond-del" title="retirer le conditionnement">🗑</button></div><div class="condlvs">'+lvHtml+'</div></div>';
  }).join('');
  const missing=REFS.filter(r=>!has(r));
  const addSel='<div class="cond-add"><select id="condAddSel"><option value="">+ Ajouter un conditionnement…</option>'+missing.map(r=>`<option value="${esc(r.code)}">${esc(r.des)} (${esc(r.code)})</option>`).join('')+'</select></div>';
  body.innerHTML='<p class="ref-hint">Jusqu\u2019à 3 niveaux d\u2019emballage. <b>Taille exprimée en unité de base, déjà multipliée</b> (ex. étage = 150 cartons). Choisis l\u2019article à conditionner dans la liste ci-dessous.</p><div class="ref-cards">'+cards+'</div>'+addSel;
  body.querySelectorAll('.ref-card').forEach(card=>{
    const code=card.dataset.code;
    const save=()=>{
      const arr=[];
      card.querySelectorAll('.condlv').forEach(d=>{const nom=d.querySelector('.cnom').value.trim();const t=d.querySelector('.ctail').value.trim();if(nom&&t!=='')arr.push([nom,pnum(t)]);});
      const r=REFS.find(x=>x.code===code)||{};
      COND[code]={ub:r.ub,lv:arr};lsSet('lep_cond',COND);
    };
    card.querySelectorAll('input').forEach(i=>i.addEventListener('input',save));
    card.querySelector('.cond-del').onclick=()=>{const r=REFS.find(x=>x.code===code)||{};COND[code]={ub:r.ub,lv:[]};lsSet('lep_cond',COND);renderRef();};
  });
  const as=body.querySelector('#condAddSel');
  if(as)as.onchange=()=>{const code=as.value;if(!code)return;const r=REFS.find(x=>x.code===code)||{};COND[code]={ub:r.ub,lv:[['',''],['',''],['','']].slice(0,1)};lsSet('lep_cond',COND);renderRef();};
}

function articleOptions(sel){return REFS.map(a=>`<option value="${esc(a.code)}"${a.code===sel?' selected':''}>${esc(a.des)} (${esc(a.code)})</option>`).join('');}
function renderRecf(body){
  const prods=Object.keys(RECF);
  const cards=prods.map(p=>{
    const rows=RECF[p].map((m,i)=>{
      let extra='';if(m.code&&!REFS.some(a=>a.code===m.code))extra=`<option value="${esc(m.code)}" selected>${esc(m.des||m.code)} (${esc(m.code)})</option>`;
      return '<div class="recrow" data-i="'+i+'"><select class="msel"><option value=""'+(m.code?'':' selected')+'>— choisir un article —</option>'+extra+articleOptions(m.code)+'</select><input class="mqte" inputmode="decimal" placeholder="qté/u" value="'+(m.qte!=null?m.qte:'')+'"><button class="mdel" title="retirer">✕</button></div>';
    }).join('');
    return '<div class="ref-card" data-prod="'+esc(p)+'"><div class="cardh"><b>'+esc(p)+'</b><button class="rec-delprod" title="supprimer la recette">🗑</button></div><div class="recrows">'+rows+'</div><button class="rec-addrow">+ matière</button></div>';
  }).join('');
  body.innerHTML='<p class="ref-hint">Choisis chaque matière dans la liste (articles déjà créés) et sa quantité <b>pour 1 unité de produit fini</b>. Le code se remplit tout seul.</p><div class="ref-cards">'+cards+'</div><button id="recAddProd" class="ref-add">+ Nouveau produit fini</button>';
  body.querySelector('#recAddProd').onclick=()=>{
    const nom=prompt('Nom du nouveau produit fini :');if(nom==null)return;
    const n=nom.trim();if(!n)return;
    if(RECF[n]){alert('Ce produit existe déjà.');return;}
    RECF[n]=[{code:'',des:'',qte:0}];lsSet('lep_recf',RECF);renderRef();
    toast('Produit ajouté — complète ses matières, puis crée l\u2019article fini dans Articles.');
  };
  body.querySelectorAll('.ref-card').forEach(card=>{
    const p=card.dataset.prod;
    const save=()=>{
      const arr=[];
      card.querySelectorAll('.recrow').forEach(row=>{
        const code=row.querySelector('.msel').value;
        const a=REFS.find(x=>x.code===code);
        const q=row.querySelector('.mqte').value.trim();
        if(code||q)arr.push({code:code,des:a?a.des:'',qte:pnum(q)});
      });
      RECF[p]=arr;lsSet('lep_recf',RECF);
    };
    card.querySelectorAll('.msel').forEach(s=>s.addEventListener('change',save));
    card.querySelectorAll('.mqte').forEach(i=>i.addEventListener('input',save));
    card.querySelectorAll('.mdel').forEach(b=>b.onclick=()=>{b.closest('.recrow').remove();save();});
    card.querySelector('.rec-addrow').onclick=()=>{save();RECF[p].push({code:'',des:'',qte:0});lsSet('lep_recf',RECF);renderRef();};
    card.querySelector('.rec-delprod').onclick=()=>{if(confirm('Supprimer la recette « '+p+' » ?')){delete RECF[p];lsSet('lep_recf',RECF);renderRef();}};
  });
}

function renderMachines(body){
  const prodOpts=sel=>Object.keys(RECF).map(p=>`<option value="${esc(p)}"${p===sel?' selected':''}>${esc(p)}</option>`).join('');
  const freqOpts=sel=>['once','parprod'].map(f=>`<option value="${f}"${f===sel?' selected':''}>${f==='once'?'une fois':'par produit'}</option>`).join('');
  let h='<p class="ref-hint">Cadence : soit <b>pistes × sachets/min</b> (débit calculé via «\u00a0sachets/u.b.\u00a0»), soit un <b>débit direct</b> par produit (sacs/h). Les <b>temps morts</b> (démarrage, bobine, fin…) s\u2019ajoutent : «\u00a0une fois\u00a0» (par lancement) ou «\u00a0par produit\u00a0». La charge s\u2019affiche dans le Plan.</p>';
  h+='<div class="prodcfg"><label>Heures/quart<input id="pcHq" inputmode="decimal" value="'+esc(PRODCFG.heuresQuart)+'"></label>'
    +'<label>Quarts/jour<input id="pcQj" inputmode="decimal" value="'+esc(PRODCFG.quartsJour)+'"></label>'
    +'<label class="pc-par"><input type="checkbox" id="pcPar"'+(PRODCFG.parallele?' checked':'')+'> machines en parallèle</label></div>';
  MACHINES.forEach((m,mi)=>{
    const hasCad=m.mode==='sachets';
    let prows='';
    (m.prods||[]).forEach((e,ei)=>{
      const pd=prodDebit(e.p);const eff=pd?pd.eff:0;
      prows+='<div class="mprow'+(hasCad?'':' nos')+'" data-ei="'+ei+'"><select class="mp-p"><option value="">— produit —</option>'+prodOpts(e.p)+'</select>'
        +(hasCad?'<input class="mp-s" inputmode="decimal" placeholder="sach./u.b." value="'+esc(e.sachetsUb)+'">':'')
        +'<input class="mp-d" inputmode="decimal" placeholder="débit u.b./h" value="'+esc(e.debit)+'">'
        +'<button class="mp-del" title="retirer">✕</button>'
        +'<div class="mp-eff">'+(eff>0?'≈ '+fmt(Math.round(eff*10)/10)+' u.b./h':'débit non défini')+'</div></div>';
    });
    let arows='';
    (m.arrets||[]).forEach((a,ai)=>{
      arows+='<div class="arow" data-ai="'+ai+'"><input class="ar-l" placeholder="poste (ex. démarrage)" value="'+esc(a.lbl||'')+'"><input class="ar-m" inputmode="decimal" placeholder="min" value="'+esc(a.min)+'"><select class="ar-f">'+freqOpts(a.freq)+'</select><button class="ar-del" title="retirer">✕</button></div>';
    });
    const modeSel='<div class="mach-mode"><label>Cadence définie par</label><select class="mc-mode"><option value="sachets"'+(hasCad?' selected':'')+'>Pistes × sachets/min (calculé)</option><option value="direct"'+(!hasCad?' selected':'')+'>Débit direct par produit</option></select></div>';
    h+='<div class="mach-card" data-mi="'+mi+'"><div class="mach-h"><input class="mc-nom" value="'+esc(m.nom||'')+'" placeholder="nom de la machine"><button class="mc-del" title="supprimer">🗑</button></div>'
      +modeSel
      +(hasCad?'<div class="mach-cfg2"><label>Pistes<input class="mc-pi" inputmode="decimal" value="'+esc(m.pistes)+'"></label><label>Sachets/min<input class="mc-ca" inputmode="decimal" value="'+esc(m.cadence)+'"></label></div>':'')
      +'<div class="mach-prods">'+prows+'<button class="mp-add">+ produit</button></div>'
      +'<div class="mach-arrets"><div class="ma-t">Temps morts</div>'+arows+'<button class="ar-add">+ poste de temps</button></div></div>';
  });
  h+='<button id="machAdd" class="ref-add">+ Machine</button>';
  body.innerHTML=h;
  const save=()=>saveMachines();
  $('#pcHq').oninput=e=>{PRODCFG.heuresQuart=e.target.value;lsSet('lep_prodcfg',PRODCFG);};
  $('#pcQj').oninput=e=>{PRODCFG.quartsJour=e.target.value;lsSet('lep_prodcfg',PRODCFG);};
  $('#pcPar').onchange=e=>{PRODCFG.parallele=e.target.checked;lsSet('lep_prodcfg',PRODCFG);};
  body.querySelectorAll('.mach-card').forEach(card=>{
    const mi=+card.dataset.mi;const m=MACHINES[mi];
    card.querySelector('.mc-nom').oninput=e=>{m.nom=e.target.value;save();};
    card.querySelector('.mc-mode').onchange=e=>{m.mode=e.target.value;save();renderRef();};
    const piEl=card.querySelector('.mc-pi');if(piEl){piEl.oninput=e=>{m.pistes=e.target.value;save();};piEl.onchange=()=>renderRef();}
    const caEl=card.querySelector('.mc-ca');if(caEl){caEl.oninput=e=>{m.cadence=e.target.value;save();};caEl.onchange=()=>renderRef();}
    card.querySelector('.mc-del').onclick=()=>{if(confirm('Supprimer cette machine ?')){MACHINES.splice(mi,1);save();renderRef();}};
    card.querySelectorAll('.mprow').forEach(row=>{
      const ei=+row.dataset.ei;const e=m.prods[ei];
      const updEff=()=>{const pd=prodDebit(e.p);const eff=pd?pd.eff:0;const el=row.querySelector('.mp-eff');if(el)el.textContent=eff>0?'≈ '+fmt(Math.round(eff*10)/10)+' u.b./h':'débit non défini';};
      row.querySelector('.mp-p').onchange=ev=>{e.p=ev.target.value;save();renderRef();};
      const sEl=row.querySelector('.mp-s');if(sEl)sEl.oninput=ev=>{e.sachetsUb=ev.target.value;save();updEff();};
      row.querySelector('.mp-d').oninput=ev=>{e.debit=ev.target.value;save();updEff();};
      row.querySelector('.mp-del').onclick=()=>{m.prods.splice(ei,1);save();renderRef();};
    });
    card.querySelector('.mp-add').onclick=()=>{m.prods=m.prods||[];m.prods.push({p:'',sachetsUb:'',debit:''});save();renderRef();};
    card.querySelectorAll('.arow').forEach(row=>{
      const ai=+row.dataset.ai;const a=m.arrets[ai];
      row.querySelector('.ar-l').oninput=ev=>{a.lbl=ev.target.value;save();};
      row.querySelector('.ar-m').oninput=ev=>{a.min=ev.target.value;save();};
      row.querySelector('.ar-f').onchange=ev=>{a.freq=ev.target.value;save();};
      row.querySelector('.ar-del').onclick=()=>{m.arrets.splice(ai,1);save();renderRef();};
    });
    card.querySelector('.ar-add').onclick=()=>{m.arrets=m.arrets||[];m.arrets.push({lbl:'',min:'',freq:'once'});save();renderRef();};
  });
  $('#machAdd').onclick=()=>{MACHINES.push({id:'m'+Date.now(),nom:'Nouvelle machine',pistes:'',cadence:'',arrets:clone(SEED_ARRETS),prods:[]});save();renderRef();};
}
function planChargeHTML(items){
  const byM={};const nonEst=[];
  items.forEach(it=>{if(it.n<=0)return;const pd=prodDebit(it.produit);
    if(!pd||pd.eff<=0){nonEst.push(it.produit);return;}
    const h=it.n/pd.eff;const k=pd.m.id;byM[k]=byM[k]||{m:pd.m,prodH:0,nb:0,lines:[]};byM[k].prodH+=h;byM[k].nb++;byM[k].lines.push({p:it.produit,n:it.n,h:h});});
  const ms=Object.keys(byM).map(k=>byM[k]);
  if(!ms.length&&!nonEst.length)return '';
  ms.forEach(m=>{m.downMin=arretsMin(m.m,m.nb);m.totH=m.prodH+m.downMin/60;});
  const hq=num(PRODCFG.heuresQuart)>0?num(PRODCFG.heuresQuart):8;const qj=num(PRODCFG.quartsJour)>0?num(PRODCFG.quartsJour):1;
  const totalH=ms.length?(PRODCFG.parallele?Math.max.apply(null,ms.map(m=>m.totH)):ms.reduce((s,m)=>s+m.totH,0)):0;
  let h='<div class="charge-box"><h4 class="plan-sub">⏱ Charge de production estimée</h4>';
  ms.forEach(m=>{h+='<div class="charge-m"><div class="cm-h"><b>'+esc(m.m.nom)+'</b><span>'+fmtH(m.totH)+'</span></div>';
    m.lines.forEach(l=>{h+='<div class="cm-l">'+esc(l.p)+' — '+fmt(l.n)+' u · '+fmtH(l.h)+'</div>';});
    if(m.downMin>0)h+='<div class="cm-l cm-down">+ temps morts : '+fmtH(m.downMin/60)+'</div>';
    h+='</div>';});
  if(ms.length)h+='<div class="charge-tot">Total : <b>'+fmtH(totalH)+'</b> ≈ <b>'+(Math.round(totalH/hq*10)/10)+'</b> quart(s)'+(qj>1?' ≈ '+(Math.round(totalH/hq/qj*10)/10)+' j':'')+' <small>'+(PRODCFG.parallele?'(parallèle : machine la plus chargée)':'(séquentiel : somme)')+'</small></div>';
  if(nonEst.length)h+='<div class="charge-non">Non estimé (machine ou débit manquant) : '+nonEst.map(esc).join(', ')+'</div>';
  h+='</div>';return h;
}
