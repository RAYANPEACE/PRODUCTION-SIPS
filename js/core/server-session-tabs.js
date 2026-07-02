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
    try{
      if(row.type==='frag-contribution'){
        // Spec C : part d'inventaire hors-ligne -> manche ouverte (sans sessionId).
        await sipsFetch('/api/inventory-rounds/contribution',{method:'POST',body:JSON.stringify({payload:row.payload,note:row.note||''})});
      }else{
        await sipsFetch('/api/submissions',{method:'POST',body:JSON.stringify({type:row.type,payload:row.payload,author:row.author,note:row.note||''})});
      }
      sent++;
    }
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
    if(opt.compact)q.push('compact=1');
    const fetchOpt={headers:sipsAdminHeaders()};
    if(opt.timeoutMs)fetchOpt.timeoutMs=opt.timeoutMs;
    const data=await sipsFetch('/api/records'+(q.length?'?'+q.join('&'):''),fetchOpt);
    const rows=data.records||[];
    return rows;
  }catch(e){if(opt&&opt.strict)throw e;return [];}
}

let META=lsGet('lep_meta',{});                 // {code:{des?,ub?,cat?}}
let ADDED=lsGet('lep_added',[]);               // [{code,des,ub,cat}]
let ETAT=lsGet('lep_etat',null); if(ETAT===null){ETAT={...SEED_ETAT};lsSet('lep_etat',ETAT);}
let ETAT_DATE=lsGet('lep_etat_date','');   // date de l'état de stock (ERP) : le Bilan s'apparie à l'inventaire ≤ cette date
let COND=lsGet('lep_cond',null); if(COND===null){COND=clone(SEED_COND);lsSet('lep_cond',COND);}
let RECF=lsGet('lep_recf',null); if(RECF===null){RECF=clone(SEED_RECF);lsSet('lep_recf',RECF);}
let ETAT_PUSH_TIMER=null;

const UB_OPTS=['kg','carton','sac','unite','m'];
const CAT_OPTS=[['mp','Ingrédient (sachet)'],['film','Film'],['carton','Carton'],['emballage','Emballage divers'],['fini','Produit fini']];
const METHOD_OPTS=[['simple','Simple'],['carton','Cartons/palettes'],['sac','Sacs/palettes'],['cartvide','Cartons vides'],['bobine','Bobine'],['vrac','Sacs/vrac'],['tare','Pesée avec tare'],['plastique','Sacs plastique']];
let REF_PUSH_TIMER=null;
function refSort(a,b){return String(a.code||'').localeCompare(String(b.code||''),'fr',{numeric:true});}
function refsByCode(rows){return (rows||[]).slice().sort(refSort);}
function finishedProductRefs(){return refsByCode(REFS.filter(r=>r.cat==='fini'));}
function recipeProductTokens(s){
  const stop={CARTON:1,LAIT:1,EN:1,POUDRE:1,X:1,DE:1,DU:1,LA:1,LE:1};
  const parts=String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().match(/[A-Z0-9]+/g)||[];
  return parts.filter(t=>!stop[t]);
}
function recipeProductRef(prod){
  const byCode=REFS.find(r=>r.cat==='fini'&&r.code===prod);
  if(byCode)return byCode;
  const exact=REFS.find(r=>r.cat==='fini'&&r.des===prod);
  if(exact)return exact;
  const want=recipeProductTokens(prod);
  let best=null,bestScore=0;
  REFS.filter(r=>r.cat==='fini').forEach(r=>{
    const got=recipeProductTokens(r.des);
    const score=want.filter(t=>got.includes(t)).length;
    if(score>bestScore){best=r;bestScore=score;}
  });
  return bestScore>=2?best:null;
}
function recipeProductCode(prod){const r=recipeProductRef(prod);return r?r.code:'';}
function recipeProductLabel(prod){const r=recipeProductRef(prod);return r?(r.code+' - '+r.des):prod;}
// LAITY en bleu : distinguer visuellement le produit LAITY de DIAMO dans toute l'UI.
function isLaity(txt){return String(txt||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().indexOf('LAITY')>=0;}
// Renvoie le texte esc-apé, avec le mot LAITY coloré (contenu HTML uniquement, jamais dans un attribut).
function hlLaity(txt){const s=esc(String(txt==null?'':txt));return isLaity(txt)?s.replace(/(LAITY)/gi,'<span class="laity">$1</span>'):s;}
function recipeProductSort(a,b){return String(recipeProductCode(a)||'999999').localeCompare(String(recipeProductCode(b)||'999999'),'fr',{numeric:true})||String(a).localeCompare(String(b),'fr');}
function recipeForProduct(prod){
  if(RECF&&RECF[prod])return RECF[prod];
  const r=recipeProductRef(prod);
  if(!r)return [];
  return (RECF&&RECF[r.code])||(RECF&&RECF[r.des])||[];
}
function recipeKeys(){return finishedProductRefs().filter(r=>recipeForProduct(r.code).length||RECF&&RECF[r.code]).map(r=>r.code).sort(recipeProductSort);}
function currentRecipeProductCode(prod){const r=recipeProductRef(prod);return r&&recipeForProduct(r.code).length?r.code:'';}
function productCodeOf(prod){const r=recipeProductRef(prod);return r?r.code:String(prod||'');}
function productArticleOptions(selectedName){
  return finishedProductRefs().map(r=>'<option value="'+esc(r.code)+'"'+(r.code===productCodeOf(selectedName)?' selected':'')+(isLaity(r.des)?' class="laity"':'')+'>'+esc(r.code+' - '+r.des)+'</option>').join('');
}
function methodDefaults(m){
  if(m==='carton')return {etPal:1,cartEt:1};
  if(m==='sac')return {etPal:1,sacEt:1};
  if(m==='cartvide')return {pqEt:1,etPal:1,cartPaquet:1};
  if(m==='bobine')return {epRef:1,poidsRef:1};
  if(m==='vrac')return {sacPal:1,kgSac:1};
  if(m==='tare')return {caisse:0,film:0,kraft:0};
  if(m==='plastique')return {parPaquet:1,parRouleau:1};
  return {};
}
function groupForRef(r){
  if(r.cat==='fini'&&r.m==='carton')return 'pf_cart';
  if(r.cat==='fini'&&r.m==='sac')return 'pf_sac';
  if(r.m==='cartvide')return 'cart_vide';
  if(r.m==='bobine')return 'film';
  if(r.m==='vrac')return 'vrac';
  if(r.m==='tare')return 'tare';
  if(r.m==='plastique')return 'plast';
  return 'divers';
}
function persistReferentials(){
  lsSet('lep_meta',META);lsSet('lep_added',ADDED);lsSet('lep_cond',COND);lsSet('lep_recf',RECF);
}
function renameProductReferences(from,to){
  from=String(from||'').trim();to=String(to||'').trim();
  if(!from||!to||from===to)return false;
  let changed=false;
  if(RECF&&RECF[from]){
    if(!RECF[to])RECF[to]=RECF[from];
    delete RECF[from];changed=true;
  }
  if(typeof PLAN!=='undefined'&&PLAN&&PLAN[from]){
    if(!PLAN[to])PLAN[to]=PLAN[from];
    delete PLAN[from];changed=true;
  }
  if(typeof MACHINES!=='undefined'&&Array.isArray(MACHINES)){
    MACHINES.forEach(m=>(m.prods||[]).forEach(e=>{if(e&&e.p===from){e.p=to;changed=true;}}));
  }
  return changed;
}
function normalizeProductReferences(){
  let changed=false;
  Object.keys(RECF||{}).forEach(prod=>{
    const r=recipeProductRef(prod);
    if(r&&r.code!==prod)changed=renameProductReferences(prod,r.code)||changed;
  });
  Object.keys(typeof PLAN!=='undefined'&&PLAN||{}).forEach(prod=>{
    const r=recipeProductRef(prod);
    if(r&&r.code!==prod)changed=renameProductReferences(prod,r.code)||changed;
  });
  if(typeof MACHINES!=='undefined'&&Array.isArray(MACHINES)){
    MACHINES.forEach(m=>(m.prods||[]).forEach(e=>{
      const r=recipeProductRef(e&&e.p);
      if(e&&r&&r.code!==e.p){e.p=r.code;changed=true;}
    }));
  }
  if(changed){
    lsSet('lep_recf',RECF);
    if(typeof savePlan==='function')savePlan(false);
    if(typeof saveMachines==='function')saveMachines(false);
  }
  return changed;
}
function referentialsPayload(){
  normalizeProductReferences();
  return {
    meta:META,added:ADDED,cond:COND,recf:RECF,
    machines:typeof MACHINES!=='undefined'?MACHINES:[],
    prodcfg:typeof PRODCFG!=='undefined'?PRODCFG:{},
    plan:typeof PLAN!=='undefined'?PLAN:{}
  };
}
async function sipsLoadReferentials(){
  if(!SESSION_TOKEN)return false;
  try{
    const data=await sipsFetch('/api/referentials',{timeoutMs:1800});
    const r=(data&&data.referentials)||{};
    if(!r.updatedAt&&!Object.keys(r.meta||{}).length&&!((r.added||[]).length))return false;
    const localMeta=META,localAdded=ADDED,localCond=COND,localRecf=RECF;
    if(SESSION&&SESSION.role==='admin'){
      META=Object.assign({},localMeta,r.meta||{});
      const byCode={};(localAdded||[]).concat(Array.isArray(r.added)?r.added:[]).forEach(a=>{if(a&&a.code)byCode[a.code]=a;});
      ADDED=Object.keys(byCode).map(k=>byCode[k]);
      COND=Object.assign({},localCond,r.cond||{});
      RECF=Object.assign({},localRecf,r.recf||{});
    }else{
      META=r.meta||{};ADDED=Array.isArray(r.added)?r.added:[];COND=r.cond||COND;RECF=r.recf||RECF;
    }
    if(typeof MACHINES!=='undefined'&&Array.isArray(r.machines)&&r.machines.length)MACHINES=r.machines;
    if(typeof PRODCFG!=='undefined'&&r.prodcfg)PRODCFG=r.prodcfg;
    if(typeof PLAN!=='undefined'&&r.plan)PLAN=r.plan;
    persistReferentials();
    if(typeof saveMachines==='function')saveMachines(false);
    if(typeof savePlan==='function')savePlan(false);
    applyReferentials();mergeAndMigrate();
    return true;
  }catch(e){return false;}
}
async function sipsPushReferentials(){
  if(!SESSION_TOKEN||!SESSION||SESSION.role!=='admin')return false;
  await sipsFetch('/api/referentials',{method:'POST',headers:sipsAdminHeaders(),body:JSON.stringify({referentials:referentialsPayload()})});
  return true;
}
function scheduleReferentialsPush(){
  normalizeProductReferences();
  persistReferentials();
  clearTimeout(REF_PUSH_TIMER);
  REF_PUSH_TIMER=setTimeout(function(){sipsPushReferentials().catch(function(){});},700);
}
async function refSyncPull(){
  const ok=await sipsLoadReferentials();
  if(ok){renderRef();toast('Referentiels serveur actualises');}
  else toast('Aucun referentiel serveur recupere. Si le serveur vient d etre mis a jour, redemarre-le.');
}
async function refSyncPush(){
  persistReferentials();
  if(!SESSION_TOKEN||!SESSION||SESSION.role!=='admin'){
    toast('Connecte-toi avec le compte Chef d usine, puis reessaie.');
    return;
  }
  try{
    await sipsPushReferentials();
    toast('Referentiels envoyes au serveur');
  }catch(e){
    if(e&&e.status===401)toast('Session admin non reconnue par le serveur : deconnecte-toi puis reconnecte-toi.');
    else if(e&&e.status===403)toast(e.message||'Action admin bloquee par le serveur');
    else if(e&&e.status===404)toast('Serveur a redemarrer : cette version ne connait pas encore les referentiels.');
    else toast('Envoi impossible : '+((e&&e.message)||'serveur indisponible'));
  }
}

/* Applique les référentiels sur la liste de comptage REFS (catégorie, unité de base, désignation, articles ajoutés) */
function applyReferentials(){
  REFS.forEach(r=>{
    const m=META[r.code]||{};
    const nextCat=m.cat||SEED_CAT[r.code]||'';
    const nextDes=m.des||r.des;
    if((r.cat==='fini'||nextCat==='fini')&&r.code)renameProductReferences(r.des,r.code);
    r.ub=m.ub||SEED_UB[r.code]||r.u||'unite';
    r.cat=nextCat;
    if(m.m)r.m=m.m;
    if(m.g)r.g=m.g;else r.g=groupForRef(r);
    if(m.p)r.p=Object.assign(methodDefaults(r.m),m.p);
    if(m.des)r.des=m.des;
  });
  ADDED.forEach(a=>{
    const existing=REFS.find(r=>r.code===a.code);
    const m=META[a.code]||{};
    const nextDes=m.des||a.des||a.code;
    const nextCat=m.cat||a.cat||'';
    if(existing){
      if((existing.cat==='fini'||nextCat==='fini')&&existing.code)renameProductReferences(existing.des,existing.code);
      existing.des=nextDes;existing.u=m.ub||a.ub||existing.u||'unité';existing.ub=m.ub||a.ub||existing.ub||'unite';existing.cat=nextCat;existing.m=m.m||a.m||existing.m||'simple';existing.g=m.g||a.g||groupForRef(existing);existing.p=Object.assign(methodDefaults(existing.m),m.p||a.p||existing.p||{});existing._added=true;
      return;
    }
    const ref={code:a.code,des:m.des||a.des||a.code,u:m.ub||a.ub||'unité',ub:m.ub||a.ub||'unite',cat:m.cat||a.cat||'',m:m.m||a.m||'simple',p:m.p||a.p||{},_added:true};
    ref.g=m.g||a.g||groupForRef(ref);ref.p=Object.assign(methodDefaults(ref.m),ref.p||{});
    REFS.push(ref);
  });
  REFS.sort(refSort);
  normalizeProductReferences();
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
async function sipsLoadEtat(){
  if(!SESSION_TOKEN)return false;
  try{
    const data=await sipsFetch('/api/etat',{timeoutMs:1800});
    const incoming=data&&data.etat||{};
    if(!Object.keys(incoming).length&&!data.date)return false;
    ETAT=incoming;ETAT_DATE=data.date||'';
    lsSet('lep_etat',ETAT);lsSet('lep_etat_date',ETAT_DATE);
    return true;
  }catch(e){return false;}
}
async function sipsPushEtat(){
  if(!SESSION_TOKEN||!SESSION||SESSION.role!=='admin')return false;
  try{
    await sipsFetch('/api/etat',{method:'POST',body:JSON.stringify({etat:ETAT,date:ETAT_DATE})});
    return true;
  }catch(e){return false;}
}
function scheduleEtatPush(){
  clearTimeout(ETAT_PUSH_TIMER);
  ETAT_PUSH_TIMER=setTimeout(sipsPushEtat,700);
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
  if(id==='stock')return true;   // Feuille etat de stock : lecture seule, visible par tous les roles.
  if(SESSION&&Array.isArray(SESSION.tabs))return SESSION.tabs.indexOf(id)>=0;
  var t=TABS.find(function(x){return x[0]===id;});if(!t)return false;
  // Verrou strict : sans vrai compte, le PIN ne donne plus acces aux onglets admin.
  if(sipsRequiresLogin())return !t[3];
  return !t[3]||ADMIN;
}

/* ---------- ONGLETS ---------- */
const TABS=[['accueil','Accueil',true,false],['comptage','Comptage',true,false],['prod','Production',true,false],['qualite','Qualité',true,false],['stock','Stock',true,false],['ref','Référentiels',true,true],['bilan','Bilan',true,true],['feuillet','Feuillet',true,true],['capacite','Capacité',true,true],['plan','Plan',true,true],['sorties','Sorties',true,false],['entree','Entrées',true,false],['analyse','Analyses',true,true],['serveur','Serveur',true,true]];
const TAB_ICONS={accueil:'🏠',stock:'📦',prod:'🏭',comptage:'🧮',entree:'⬇️',sorties:'⬆️',qualite:'✅',bilan:'📊',analyse:'📈',feuillet:'📄',capacite:'⏱️',plan:'📅',ref:'⚙️',serveur:'🖥️'};
const TAB_MAIN=['accueil','stock','comptage','prod','entree','sorties','qualite'];
const TAB_MORE_GROUPS=[
  ['Documents',['feuillet']],
  ['Pilotage',['bilan','analyse','capacite','plan']],
  ['Réglages',['ref','serveur']]
];
let TAB='accueil';
let SIPS_NOTIF_COUNTS={};
let SIPS_NOTIF_PREV_TOTAL=null;
let SIPS_NOTIF_BUSY=false;
let SIPS_NOTIF_AUDIO=false;
document.addEventListener('pointerdown',function(){SIPS_NOTIF_AUDIO=true;},{once:true});
document.addEventListener('keydown',function(){SIPS_NOTIF_AUDIO=true;},{once:true});
document.addEventListener('pointerdown',function(e){
  const m=document.querySelector('#tabbar .tabmore[open]');
  if(m&&!m.contains(e.target))m.open=false;
});
function sipsPlaceMorePanel(more){
  if(!more||!window.matchMedia('(max-width:640px)').matches)return;
  const sum=more.querySelector('summary'),panel=more.querySelector('.tabmore-panel');
  if(!sum||!panel)return;
  const r=sum.getBoundingClientRect();
  const w=Math.min(270,window.innerWidth-24);
  let left=Math.max(12,Math.min(r.left,window.innerWidth-w-12));
  let top=Math.max(8,r.bottom+7);
  panel.style.setProperty('--tabmore-left',left+'px');
  panel.style.setProperty('--tabmore-top',top+'px');
  panel.style.setProperty('--tabmore-width',w+'px');
  panel.style.setProperty('--tabmore-maxh',Math.max(160,window.innerHeight-top-12)+'px');
}
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
  document.querySelectorAll('#tabbar .tab[data-tab]').forEach(function(btn){
    const id=btn.dataset.tab;
    let b=btn.querySelector('.notif-badge');
    if(!b){b=document.createElement('span');b.className='notif-badge';btn.appendChild(b);}
    const n=SIPS_NOTIF_COUNTS[id]||0;
    b.textContent=n>99?'99+':String(n);
    b.classList.toggle('on',n>0);
    btn.title=n>0?n+' notification(s) a traiter':'';
  });
  const mb=$('#tabMoreBadge');
  if(mb){
    const n=Object.keys(SIPS_NOTIF_COUNTS).reduce(function(a,k){return a+(TAB_MAIN.indexOf(k)<0?(SIPS_NOTIF_COUNTS[k]||0):0);},0);
    mb.textContent=n>99?'99+':String(n);
    mb.classList.toggle('on',n>0);
  }
}
function sipsSetNotifCounts(counts){
  SIPS_NOTIF_COUNTS=counts||{};
  sipsApplyNotifBadges();
  const total=Object.keys(SIPS_NOTIF_COUNTS).reduce(function(a,k){return a+(SIPS_NOTIF_COUNTS[k]||0);},0);
  if(SIPS_NOTIF_PREV_TOTAL!==null&&total>SIPS_NOTIF_PREV_TOTAL)sipsNotifBeep();
  SIPS_NOTIF_PREV_TOTAL=total;
}
function sipsHasServerQualityVisa(visas,role){
  var visa=visas&&visas[role];
  return !!(visa&&visa.signature&&visa.role===role&&visa.serverStamp&&visa.serverStamp.by==='sips-server');
}
function sipsNeedsMyQualitySignature(payload,canSign){
  canSign=Array.isArray(canSign)?canSign:[];
  var visas=(payload&&payload.visas)||{};
  if(!sipsHasServerQualityVisa(visas,'operateur')){
    return canSign.indexOf('operateur')>=0;
  }
  if(sipsHasServerQualityVisa(visas,'responsableQualite')||sipsHasServerQualityVisa(visas,'responsableProd')){
    return false;
  }
  return canSign.indexOf('responsableQualite')>=0||canSign.indexOf('responsableProd')>=0;
}
function sipsQualityCorrectionOfId(payload){
  return payload&&payload.correctionOf&&payload.correctionOf.id||'';
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
    if(hasTab('qualite')&&SESSION&&Array.isArray(SESSION.canSign)&&SESSION.canSign.some(function(r){return r==='operateur'||r==='responsableQualite'||r==='responsableProd';})){
      try{
        const q=await sipsFetch('/api/submissions?status=submitted&type=quality&include=payload');
        const qRows=q.submissions||[];
        const need=(q.submissions||[]).filter(function(s){
          return sipsNeedsMyQualitySignature(s&&s.payload,SESSION.canSign);
        }).length;
        counts.qualite=(counts.qualite||0)+need;
        if(SESSION.canSign.indexOf('operateur')>=0){
          const c=await sipsFetch('/api/submissions?status=rejected&type=quality&include=payload');
          const recs=await sipsRecords('quality');
          const correctionsById={};
          const resumed={};
          (c.submissions||[]).forEach(function(s){if(s&&s.id)correctionsById[s.id]=s;});
          function markResumed(id){
            while(id&&!resumed[id]){
              resumed[id]=1;
              var parent=correctionsById[id];
              id=sipsQualityCorrectionOfId(parent&&parent.payload);
            }
          }
          qRows.forEach(function(s){markResumed(sipsQualityCorrectionOfId(s&&s.payload));});
          recs.forEach(function(r){markResumed(sipsQualityCorrectionOfId(r&&r.payload));});
          const corrections=(c.submissions||[]).filter(function(s){return s&&s.correctionRequested&&!resumed[s.id];}).length;
          counts.qualite=(counts.qualite||0)+corrections;
        }
      }catch(e){}
    }
  }finally{
    SIPS_NOTIF_BUSY=false;
    sipsSetNotifCounts(counts);
  }
}
function buildTabbar(){
  const tb=$('#tabbar');if(!tb)return;tb.innerHTML='';
  const visible=TABS.filter(function(t){return hasTab(t[0]);});
  const byId={};visible.forEach(function(t){byId[t[0]]=t;});
  const makeBtn=function(t,inMore){
    const id=t[0],label=t[1],ready=t[2];
    const b=document.createElement('button');
    b.className='tab'+(ready?'':' soon');b.dataset.tab=id;
    const ico=document.createElement('span');ico.className='tab-ico';ico.textContent=TAB_ICONS[id]||'\u2022';
    const txt=document.createElement('span');txt.className='tab-label';txt.textContent=ready?label:label+' · à venir';
    b.append(ico,txt);
    b.onclick=()=>{ if(!ready){toast('Module à construire à l\u2019étape suivante');return;} if(inMore){const d=b.closest('details');if(d)d.open=false;} switchTab(id); };
    const badge=document.createElement('span');badge.className='notif-badge';b.appendChild(badge);
    return b;
  };
  TAB_MAIN.forEach(function(id){if(byId[id])tb.appendChild(makeBtn(byId[id],false));});
  const rest=visible.filter(function(t){return TAB_MAIN.indexOf(t[0])<0;});
  if(rest.length){
    const more=document.createElement('details');more.className='tabmore';
    const sum=document.createElement('summary');sum.className='tab more-toggle';sum.id='tabMoreToggle';
    const ico=document.createElement('span');ico.className='tab-ico';ico.textContent='\u22EF';
    const txt=document.createElement('span');txt.className='tab-label';txt.textContent='Plus';
    const badge=document.createElement('span');badge.className='notif-badge';badge.id='tabMoreBadge';
    sum.append(ico,txt,badge);more.appendChild(sum);
    sum.onclick=function(e){e.preventDefault();more.open=!more.open;if(more.open)sipsPlaceMorePanel(more);};
    sum.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();more.open=!more.open;if(more.open)sipsPlaceMorePanel(more);}};
    const panel=document.createElement('div');panel.className='tabmore-panel';
    TAB_MORE_GROUPS.forEach(function(g){
      const ids=g[1].filter(function(id){return byId[id];});
      if(!ids.length)return;
      const title=document.createElement('div');title.className='tabmore-title';title.textContent=g[0];panel.appendChild(title);
      ids.forEach(function(id){panel.appendChild(makeBtn(byId[id],true));});
    });
    rest.forEach(function(t){if(!panel.querySelector('[data-tab="'+t[0]+'"]'))panel.appendChild(makeBtn(t,true));});
    more.appendChild(panel);tb.appendChild(more);
  }
  sipsApplyNotifBadges();
  sipsRefreshNotifications();
}
async function switchTab(id){
  TAB=id;
  document.querySelectorAll('#tabbar .tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===id));
  {const mt=$('#tabMoreToggle');if(mt)mt.classList.toggle('active',TAB_MAIN.indexOf(id)<0);}
  const isC=(id==='comptage');
  const ct=$('#comptageTools');if(ct)ct.style.display=isC?'':'none';
  const fm=$('#footMain');if(fm)fm.style.display=isC?'':'none';
  // Capacité & Plan : stock « vivant » = dernier inventaire + flux depuis sa date (calcul async une fois à l'entrée)
  if(id==='capacite'||id==='plan'){try{await refreshLiveStock();}catch(e){}}
  if(id==='capacite'&&typeof refreshInk==='function'){try{await refreshInk();}catch(e){}}
  if(isC){render();}
  else if(id==='accueil'){renderAccueil();}
  else if(id==='ref'){renderRef();}
  else if(id==='bilan'){await sipsLoadEtat();await renderBilan();}
  else if(id==='feuillet'){renderFeuillet();}
  else if(id==='capacite'){renderCapacite();}
  else if(id==='plan'){renderPlan();}
  else if(id==='prod'){renderProduction();}
  else if(id==='sorties'){renderSorties();}
  else if(id==='entree'){renderEntrees();}
  else if(id==='analyse'){renderAnalyse();}
  else if(id==='qualite'){renderQualite();}
  else if(id==='stock'){await renderStock();}
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
    +'</div><div class="ref-sync"><button id="refPull">Actualiser serveur</button>'+(SESSION&&SESSION.role==='admin'?'<button id="refPush">Envoyer serveur</button>':'')+'</div><div id="refBody"></div>'
    // Bouton de sortie admin : seulement en mode legacy PIN (sans session serveur).
    // En session serveur, la deconnexion se fait via la pastille compte en haut a droite -> redondant.
    +(SESSION?'':'<div class="ref-foot"><button id="adminOut">Quitter le mode admin</button></div>')
    +'</div>';
  app.querySelectorAll('.ref-nav button').forEach(b=>{
    b.classList.toggle('active',b.dataset.rt===REFTAB);
    b.onclick=()=>{REFTAB=b.dataset.rt;renderRef();};
  });
  {const ao=$('#adminOut');if(ao)ao.onclick=toggleAdmin;}
  {const rp=$('#refPull');if(rp)rp.onclick=refSyncPull;}
  {const rs=$('#refPush');if(rs)rs.onclick=refSyncPush;}
  const body=$('#refBody');
  if(REFTAB==='articles')renderArticles(body);
  else if(REFTAB==='etat')renderEtat(body);
  else if(REFTAB==='cond')renderCond(body);
  else if(REFTAB==='mach')renderMachines(body);
  else renderRecf(body);
}

function saveMetaFor(code,patch){
  META[code]={...(META[code]||{}),...patch};lsSet('lep_meta',META);
  const a=ADDED.find(x=>x.code===code);
  if(a){Object.assign(a,patch);lsSet('lep_added',ADDED);}
  scheduleReferentialsPush();
}
function renderArticles(body){
  const rows=refsByCode(REFS).map(r=>{
    const opts=UB_OPTS.map(u=>'<option '+(r.ub===u?'selected':'')+'>'+u+'</option>').join('');
    const copts=CAT_OPTS.map(o=>'<option value="'+o[0]+'" '+(r.cat===o[0]?'selected':'')+'>'+o[1]+'</option>').join('');
    const mopts=METHOD_OPTS.map(o=>'<option value="'+o[0]+'" '+(r.m===o[0]?'selected':'')+'>'+o[1]+'</option>').join('');
    return '<div class="ref-row" data-code="'+r.code+'">'
      +'<div class="rc">'+r.code+(r._added?' <span class="addedtag">ajouté</span>':'')+'</div>'
      +'<input class="ades" value="'+esc(r.des)+'">'
      +'<select class="aub">'+opts+'</select>'
      +'<select class="acat"><option value="">— catégorie —</option>'+copts+'</select>'
      +'<select class="amet" title="methode de comptage">'+mopts+'</select>'
      +(r._added?'<button class="adel" title="supprimer">✕</button>':'<span class="adel-lock" title="article du référentiel de base">🔒</span>')
      +'</div>';
  }).join('');
  body.innerHTML='<p class="ref-hint">Désignation, unité de base et catégorie. La <b>catégorie</b> pilote les règles d\u2019alerte du Bilan. La <b>méthode de comptage</b> reste réglée dans l\u2019onglet Comptage. Les articles ajoutés ici sont comptés en saisie directe.</p>'
    +'<button class="ref-add" id="artAdd">+ Ajouter un article</button>'
    +'<div class="ref-list">'+rows+'</div>';
  $('#artAdd').onclick=addArticle;
  body.querySelectorAll('.ref-row').forEach(row=>{
    const code=row.dataset.code;const r=REFS.find(x=>x.code===code);
    row.querySelector('.ades').addEventListener('input',e=>{const old=r.des;r.des=e.target.value;if(r.cat==='fini')renameProductReferences(old,r.code);saveMetaFor(code,{des:e.target.value});});
    row.querySelector('.aub').addEventListener('change',e=>{r.ub=e.target.value;saveMetaFor(code,{ub:e.target.value});});
    row.querySelector('.acat').addEventListener('change',e=>{r.cat=e.target.value;r.g=groupForRef(r);saveMetaFor(code,{cat:r.cat,g:r.g});});
    row.querySelector('.amet').addEventListener('change',e=>{
      r.m=e.target.value;r.g=groupForRef(r);r.p=Object.assign(methodDefaults(r.m),{});
      ST.c[code]=blankEntry(r);saveCounts();saveMetaFor(code,{m:r.m,g:r.g,p:r.p});renderRef();
    });
    const del=row.querySelector('.adel');if(del)del.onclick=()=>delArticle(code);
  });
}
function addArticle(){
  const code=prompt('Code article (6 chiffres) :');if(code==null)return;
  if(!/^\d{6}$/.test(code)){alert('Le code doit faire 6 chiffres.');return;}
  if(REFS.some(r=>r.code===code)){alert('Ce code existe déjà.');return;}
  const des=prompt('Désignation :');if(des==null)return;
  const rec={code:code,des:des||code,ub:'unite',cat:'',m:'simple',g:'divers',p:{}};
  ADDED.push(rec);lsSet('lep_added',ADDED);
  const ref={code:code,des:rec.des,u:'unité',ub:'unite',cat:'',g:'divers',m:'simple',p:{},_added:true};
  REFS.push(ref);REFS.sort(refSort);ST.c[code]=blankEntry(ref);saveCounts();scheduleReferentialsPush();
  renderRef();toast('Article ajouté (compté en saisie directe)');
}
function delArticle(code){
  if(!confirm('Supprimer cet article ajouté ?'))return;
  ADDED=ADDED.filter(a=>a.code!==code);lsSet('lep_added',ADDED);
  const i=REFS.findIndex(r=>r.code===code);if(i>-1)REFS.splice(i,1);
  delete ST.c[code];delete META[code];lsSet('lep_meta',META);saveCounts();scheduleReferentialsPush();
  renderRef();toast('Article supprimé');
}

/* Convertit un n° de série Excel (jours depuis 1899-12-30) en date ISO AAAA-MM-JJ */
function excelSerialToISO(n){const ms=Math.round((n-25569)*86400000);const d=new Date(ms);return isNaN(d.getTime())?'':d.toISOString().slice(0,10);}
function renderEtat(body){
  const rows=refsByCode(REFS).map(r=>'<div class="ref-row etat" data-code="'+r.code+'"><div class="rc">'+r.code+'</div><div class="ed">'+esc(r.des)+'</div><input class="eval" inputmode="decimal" enterkeyhint="done" value="'+(ETAT[r.code]!=null?ETAT[r.code]:'')+'"></div>').join('');
  body.innerHTML='<p class="ref-hint">Stock théorique de référence — <b>seule base du Bilan et des écarts</b>. Une valeur par article ; vide = 0.</p>'
    +'<div class="etat-date"><label for="etatDate">📅 Date de cet état de stock</label><input id="etatDate" type="date" value="'+esc(ETAT_DATE||'')+'"><div class="etat-date-h">Le Bilan le comparera automatiquement à l’inventaire du même jour ou juste avant (jamais postérieur).</div></div>'
    +'<button class="ref-add" id="etatXlsx">Importer le fichier Excel (.xlsx)</button>'
    +'<div class="ref-list">'+rows+'</div>';
  const ed=$('#etatDate');if(ed)ed.addEventListener('input',e=>{ETAT_DATE=e.target.value||'';lsSet('lep_etat_date',ETAT_DATE);scheduleEtatPush();});
  body.querySelectorAll('.eval').forEach(inp=>{
    const code=inp.closest('.ref-row').dataset.code;
    inp.addEventListener('input',e=>{const v=e.target.value.trim();if(v==='')delete ETAT[code];else ETAT[code]=pnum(v);lsSet('lep_etat',ETAT);scheduleEtatPush();});
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
        lsSet('lep_etat',ETAT);renderRef();sipsPushEtat();toast(n+' valeur(s) importée(s)'+(foundDate?(' · état daté du '+foundDate):''));
      }catch(err){toast('Excel illisible : '+(err&&err.message||err));}};
      rd.readAsArrayBuffer(f);
    };
    fi.click();
  };
}

function renderCond(body){
  const has=r=>COND[r.code]&&(COND[r.code].lv||[]).length>0;
  const shown=refsByCode(REFS.filter(has));
  const cards=shown.map(r=>{
    const c=COND[r.code]||{ub:r.ub,lv:[]};const lv=c.lv||[];
    let lvHtml='';
    for(let i=0;i<3;i++){
      const nom=lv[i]?lv[i][0]:'';const t=lv[i]?lv[i][1]:'';
      lvHtml+='<div class="condlv"><input class="cnom" placeholder="niveau '+(i+1)+' (paquet, étage…)" value="'+esc(nom)+'"><input class="ctail" inputmode="decimal" placeholder="taille en '+r.ub+'" value="'+(t!==''&&t!=null?t:'')+'"></div>';
    }
    return '<div class="ref-card" data-code="'+r.code+'"><div class="cardh"><b>'+r.code+'</b> '+esc(r.des)+'<span class="ubtag">base : '+r.ub+'</span><button class="cond-del" title="retirer le conditionnement">🗑</button></div><div class="condlvs">'+lvHtml+'</div></div>';
  }).join('');
  const missing=refsByCode(REFS.filter(r=>!has(r)));
  const addSel='<div class="cond-add"><select id="condAddSel"><option value="">+ Ajouter un conditionnement…</option>'+missing.map(r=>`<option value="${esc(r.code)}"${isLaity(r.des)?' class="laity"':''}>${esc(r.des)} (${esc(r.code)})</option>`).join('')+'</select></div>';
  body.innerHTML='<p class="ref-hint">Jusqu\u2019à 3 niveaux d\u2019emballage. <b>Taille exprimée en unité de base, déjà multipliée</b> (ex. étage = 150 cartons). Choisis l\u2019article à conditionner dans la liste ci-dessous.</p><div class="ref-cards">'+cards+'</div>'+addSel;
  body.querySelectorAll('.ref-card').forEach(card=>{
    const code=card.dataset.code;
    const save=()=>{
      const arr=[];
      card.querySelectorAll('.condlv').forEach(d=>{const nom=d.querySelector('.cnom').value.trim();const t=d.querySelector('.ctail').value.trim();if(nom&&t!=='')arr.push([nom,pnum(t)]);});
      const r=REFS.find(x=>x.code===code)||{};
      COND[code]={ub:r.ub,lv:arr};lsSet('lep_cond',COND);scheduleReferentialsPush();
    };
    card.querySelectorAll('input').forEach(i=>i.addEventListener('input',save));
    card.querySelector('.cond-del').onclick=()=>{const r=REFS.find(x=>x.code===code)||{};COND[code]={ub:r.ub,lv:[]};lsSet('lep_cond',COND);scheduleReferentialsPush();renderRef();};
  });
  const as=body.querySelector('#condAddSel');
  if(as)as.onchange=()=>{const code=as.value;if(!code)return;const r=REFS.find(x=>x.code===code)||{};COND[code]={ub:r.ub,lv:[['',''],['',''],['','']].slice(0,1)};lsSet('lep_cond',COND);scheduleReferentialsPush();renderRef();};
}

function articleOptions(sel){return refsByCode(REFS).map(a=>`<option value="${esc(a.code)}"${a.code===sel?' selected':''}>${esc(a.des)} (${esc(a.code)})</option>`).join('');}
function renderRecf(body){
  const prods=recipeKeys();
  const cards=prods.map(p=>{
    const rows=recipeForProduct(p).map((m,i)=>{
      let extra='';if(m.code&&!REFS.some(a=>a.code===m.code))extra=`<option value="${esc(m.code)}" selected>${esc(m.des||m.code)} (${esc(m.code)})</option>`;
      return '<div class="recrow" data-i="'+i+'"><select class="msel"><option value=""'+(m.code?'':' selected')+'>— choisir un article —</option>'+extra+articleOptions(m.code)+'</select><input class="mqte" inputmode="decimal" placeholder="qté/u" value="'+(m.qte!=null?m.qte:'')+'"><button class="mdel" title="retirer">✕</button></div>';
    }).join('');
    return '<div class="ref-card" data-prod="'+esc(p)+'"><div class="cardh"><b>'+hlLaity(recipeProductLabel(p))+'</b><button class="rec-delprod" title="supprimer la recette">🗑</button></div><div class="recrows">'+rows+'</div><button class="rec-addrow">+ matière</button></div>';
  }).join('');
  const addable=finishedProductRefs().filter(r=>!recipeForProduct(r.code).length);
  body.innerHTML='<p class="ref-hint">Crée d’abord l’article en <b>Produit fini</b>. La recette est liée à son code article.</p><div class="ref-cards">'+cards+'</div><div class="cond-add"><select id="recAddSel"><option value="">+ Ajouter la recette d’un produit fini…</option>'+addable.map(r=>'<option value="'+esc(r.code)+'"'+(isLaity(r.des)?' class="laity"':'')+'>'+esc(r.code+' - '+r.des)+'</option>').join('')+'</select></div>';
  const addSel=body.querySelector('#recAddSel');
  if(addSel)addSel.onchange=()=>{const p=addSel.value;if(!p)return;RECF[p]=[{code:'',des:'',qte:0}];lsSet('lep_recf',RECF);scheduleReferentialsPush();renderRef();};
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
      RECF[p]=arr;lsSet('lep_recf',RECF);scheduleReferentialsPush();
    };
    card.querySelectorAll('.msel').forEach(s=>s.addEventListener('change',save));
    card.querySelectorAll('.mqte').forEach(i=>i.addEventListener('input',save));
    card.querySelectorAll('.mdel').forEach(b=>b.onclick=()=>{b.closest('.recrow').remove();save();});
    card.querySelector('.rec-addrow').onclick=()=>{save();RECF[p]=recipeForProduct(p).slice();RECF[p].push({code:'',des:'',qte:0});lsSet('lep_recf',RECF);scheduleReferentialsPush();renderRef();};
    card.querySelector('.rec-delprod').onclick=()=>{if(confirm('Supprimer la recette « '+p+' » ?')){delete RECF[p];lsSet('lep_recf',RECF);scheduleReferentialsPush();renderRef();}};
  });
}
function renderMachines(body){
  const prodOpts=sel=>recipeKeys().map(p=>`<option value="${esc(p)}"${p===productCodeOf(sel)?' selected':''}${isLaity(recipeProductLabel(p))?' class="laity"':''}>${esc(recipeProductLabel(p))}</option>`).join('');
  const freqOpts=sel=>['once','parprod'].map(f=>`<option value="${f}"${f===sel?' selected':''}>${f==='once'?'une fois':'par produit'}</option>`).join('');
  let h='<p class="ref-hint">Cadence : soit <b>pistes × sachets/min</b> (débit calculé via «\u00a0sachets/u.b.\u00a0»), soit un <b>débit direct</b> par produit (sacs/h). Dans le Plan, <b>Démarrage</b> sert au lancement du jour, <b>Fin</b> réserve seulement une fin de journée quand la production déborde, et <b>Changement/Bobine</b> sert aux transitions entre produits.</p>';
  h+='<div class="prodcfg"><label>Heures/quart<input id="pcHq" inputmode="decimal" value="'+esc(PRODCFG.heuresQuart)+'"></label>'
    +'<label>Quarts/jour<input id="pcQj" inputmode="decimal" value="'+esc(PRODCFG.quartsJour)+'"></label>'
    +'<label class="pc-par"><input type="checkbox" id="pcPar"'+(PRODCFG.parallele?' checked':'')+'> machines en parallèle</label></div>';
  MACHINES.forEach((m,mi)=>{
    m.prods=(m.prods||[]).filter(e=>!e.p||currentRecipeProductCode(e.p)).map(e=>{const p=currentRecipeProductCode(e.p);if(p)e.p=p;return e;});
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
      +'<label class="mc-encre-lbl"><input type="checkbox" class="mc-encre"'+(m.encre?' checked':'')+'> Utilise de l’encre (suivi cartouches)</label>'
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
    const enEl=card.querySelector('.mc-encre');if(enEl)enEl.onchange=e=>{m.encre=e.target.checked;save();};
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
  const est=(typeof planEstimateItems==='function')?planEstimateItems(items):null;
  const ms=est?est.ms:[];
  const nonEst=est?est.nonEst:[];
  if(!ms.length&&!nonEst.length)return '';
  let h='<div class="charge-box"><h4 class="plan-sub">⏱ Charge de production estimée</h4>';
  ms.forEach(m=>{h+='<div class="charge-m"><div class="cm-h"><b>'+esc(m.m.nom)+'</b><span>'+fmtH(m.totH)+'</span></div>';
    m.lines.forEach(l=>{h+='<div class="cm-l">'+hlLaity(recipeProductLabel(l.p))+' — '+fmt(l.n)+' u · '+fmtH(l.h)+'</div>';});
    const bits=[];
    if(m.startupMin>0)bits.push('démarrage '+fmtH(m.startupMin/60));
    if(m.restartMin>0)bits.push('reprise/bascule '+fmtH(m.restartMin/60));
    if(m.changeMin>0)bits.push('changement produit/bobine '+fmtH(m.changeMin/60));
    if(m.endDayMin>0)bits.push('fin de journée '+fmtH(m.endDayMin/60));
    if(m.otherMin>0)bits.push('autres préparatifs '+fmtH(m.otherMin/60));
    if(bits.length)h+='<div class="cm-l cm-down">+ temps non productifs : '+bits.join(' · ')+'</div>';
    h+='</div>';});
  if(ms.length)h+='<div class="charge-tot">Total : <b>'+fmtH(est.totalH)+'</b> ≈ <b>'+(Math.round(est.quarters*10)/10)+'</b> quart(s)'+(est.workDays>0?' ≈ '+(Math.round(est.workDays*10)/10)+' j':'')+' <small>('+esc(est.modeText)+')</small></div>'
    +'<div class="cm-note">Démarrage compté au lancement, reprise plus courte le lendemain, fin de journée seulement quand une production déborde sur le jour suivant.</div>';
  if(nonEst.length)h+='<div class="charge-non">Non estimé (machine ou débit manquant) : '+nonEst.map(esc).join(', ')+'</div>';
  h+='</div>';return h;
}
