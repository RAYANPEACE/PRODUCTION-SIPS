/* ====== PROFIL UTILISATEUR ====== */
var USR_ROLES=[['operateur','Opérateur'],['responsableProd','Responsable production'],['responsableQualite','Responsable qualité']];
var USR=lsGet('lep_usr',{nom:'',poste:''});
function usrVisaKey(){return USR.poste||'';}
function usrUpdateBar(){
  var bar=$('#usrBar');if(!bar)return;
  var name=SESSION?SESSION.nom:USR.nom;
  if(!name){bar.style.display='none';return;}
  bar.style.display='flex';
  var lbl=$('#usrLabel');if(lbl)lbl.textContent=name;
  var rl=$('#usrRole');
  if(rl){
    if(SESSION)rl.textContent=roleLabel(SESSION.role);
    else{var r=USR_ROLES.find(function(x){return x[0]===USR.poste;});rl.textContent=r?r[1]:'—';}
  }
  var ed=$('#usrEdit');
  if(ed){
    if(SESSION){ed.textContent='Déconnexion';ed.onclick=authLogoutPrompt;}
    else{ed.textContent='Modifier';ed.onclick=usrAskProfile;}
  }
}
function usrAskProfile(){
  var dlg=document.createElement('dialog');
  dlg.style.cssText='border:none;border-radius:14px;padding:0;max-width:92vw;width:400px;box-shadow:0 20px 60px rgba(0,0,0,.35)';
  var h='<div class="dlg-h"><b>Votre profil</b><button onclick="this.closest(\'dialog\').close()">×</button></div><div class="dlg-b">';
  h+='<div style="margin-bottom:10px"><label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">Votre nom</label><input id="usrDlgNom" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:8px;font-size:14px;box-sizing:border-box" value="'+esc(USR.nom)+'" placeholder="Prénom Nom"></div>';
  h+='<div style="margin-bottom:10px"><label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">Votre poste</label><select id="usrDlgPoste" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:8px;font-size:14px;box-sizing:border-box">';
  USR_ROLES.forEach(function(x){h+='<option value="'+x[0]+'"'+(USR.poste===x[0]?' selected':'')+'>'+x[1]+'</option>';});
  h+='</select></div><div class="dlg-actions"><button class="b-go" id="usrDlgOk" style="flex:1;padding:12px;border-radius:9px;border:none;font-weight:700;font-size:14px;background:var(--green);color:#fff">Valider</button></div></div>';
  dlg.innerHTML=h;document.body.appendChild(dlg);dlg.showModal();
  dlg.querySelector('#usrDlgOk').onclick=function(){
    var n=(dlg.querySelector('#usrDlgNom').value||'').trim();
    var p=dlg.querySelector('#usrDlgPoste').value;
    if(!n){toast('Veuillez renseigner votre nom');return;}
    USR.nom=n;USR.poste=p;lsSet('lep_usr',USR);
    ST.agent=n;$('#agent').value=n;saveCounts();
    dlg.close();dlg.remove();usrUpdateBar();toast('Profil enregistré : '+n);
  };
}

/* ====== AUTHENTIFICATION SERVEUR (Phase 2) ====== */
function updateAuthUI(){
  document.body.classList.toggle('admin',ADMIN);
  var lb=$('#lockBtn');
  if(lb){
    if(SESSION){lb.textContent='👤 '+(SESSION.nom||'');lb.title='Compte connecté';lb.onclick=authLogoutPrompt;}
    else{lb.textContent=ADMIN?'🔓 Admin':'🔒';lb.title='Mode administrateur';lb.onclick=toggleAdmin;}
  }
  usrUpdateBar();
}
function authStore(){
  try{lsSet('sips_session',SESSION);lsSet('sips_token',SESSION_TOKEN);}catch(e){}
}
function authClear(){
  SESSION=null;SESSION_TOKEN='';
  try{localStorage.removeItem('sips_session');localStorage.removeItem('sips_token');}catch(e){}
}
function authLogoutPrompt(){
  if(!SESSION)return;
  if(!confirm('Se déconnecter de '+(SESSION.nom||'ce compte')+' ?'))return;
  authClear();location.reload();
}
// Petit utilitaire de dialog auth (login / setup). Renvoie une Promise resolue
// avec true (connecte) ou false (ignore / mode local).
function authDialog(cfg){
  return new Promise(function(resolve){
    var dlg=document.createElement('dialog');
    dlg.style.cssText='border:none;border-radius:14px;padding:0;max-width:92vw;width:380px;box-shadow:0 20px 60px rgba(0,0,0,.35)';
    var h='<div class="dlg-h"><b>'+esc(cfg.title)+'</b></div><div class="dlg-b">';
    if(cfg.intro)h+='<p style="margin:0 0 12px;font-size:13px;color:#5a6472;line-height:1.5">'+esc(cfg.intro)+'</p>';
    if(cfg.withNom)h+='<div style="margin-bottom:10px"><label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">Votre nom</label><input id="authNom" autocomplete="name" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:8px;font-size:14px;box-sizing:border-box" placeholder="Prénom Nom"></div>';
    h+='<div style="margin-bottom:10px"><label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">Identifiant</label><input id="authUser" autocomplete="username" autocapitalize="none" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:8px;font-size:14px;box-sizing:border-box" placeholder="identifiant"></div>';
    h+='<div style="margin-bottom:10px"><label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px">Mot de passe</label><input id="authPass" type="password" autocomplete="current-password" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:8px;font-size:14px;box-sizing:border-box" placeholder="••••••"></div>';
    h+='<div id="authErr" style="display:none;color:#c0392b;font-size:13px;margin-bottom:10px"></div>';
    h+='<div class="dlg-actions" style="gap:8px"><button class="b-go" id="authOk" style="flex:1;padding:12px;border-radius:9px;border:none;font-weight:700;font-size:14px;background:var(--green);color:#fff">'+esc(cfg.okLabel)+'</button></div>';
    if(cfg.allowSkip)h+='<button id="authSkip" style="width:100%;margin-top:10px;padding:9px;border-radius:8px;border:1px solid var(--line);background:#fff;font-size:13px;color:#5a6472">'+esc(cfg.skipLabel||'Continuer en mode local')+'</button>';
    h+='</div>';
    dlg.innerHTML=h;document.body.appendChild(dlg);dlg.showModal();
    dlg.addEventListener('cancel',function(e){if(!cfg.allowSkip)e.preventDefault();});
    var err=dlg.querySelector('#authErr');
    function showErr(m){err.textContent=m;err.style.display='';}
    function val(id){var el=dlg.querySelector(id);return el?(el.value||'').trim():'';}
    var okBtn=dlg.querySelector('#authOk');
    okBtn.onclick=async function(){
      var nom=cfg.withNom?val('#authNom'):'';
      var username=val('#authUser');
      var password=dlg.querySelector('#authPass').value||'';
      if((cfg.withNom&&!nom)||!username||!password){showErr('Tous les champs sont requis.');return;}
      okBtn.disabled=true;
      try{
        var body=cfg.withNom?{nom:nom,username:username,password:password}:{username:username,password:password};
        var r=await sipsFetch(cfg.endpoint,{method:'POST',body:JSON.stringify(body)});
        SESSION=r.user;SESSION_TOKEN=r.token;authStore();applySession();
        dlg.close();dlg.remove();resolve(true);
      }catch(e){okBtn.disabled=false;showErr(e.message||'Échec de la connexion.');}
    };
    if(cfg.allowSkip){var sk=dlg.querySelector('#authSkip');if(sk)sk.onclick=function(){dlg.close();dlg.remove();resolve(false);};}
  });
}
function showLoginDialog(allowSkip){
  return authDialog({title:'Connexion',endpoint:'/api/auth/login',okLabel:'Se connecter',allowSkip:allowSkip,skipLabel:'Continuer en mode local'});
}
function showSetupDialog(){
  return authDialog({title:'Première configuration',intro:'Aucun compte n’existe encore. Créez le compte administrateur (chef d’usine).',withNom:true,endpoint:'/api/auth/setup',okLabel:'Créer l’administrateur',allowSkip:true,skipLabel:'Configurer plus tard'});
}
// Resout l'etat d'authentification au demarrage.
// Non bloquant pour le mode 100% local : si le serveur est injoignable ou
// sans compte, on retombe sur l'ancien systeme (profil + PIN).
async function authBootstrap(){
  applySession();
  var setupInfo=null;
  try{setupInfo=await sipsFetch('/api/auth/setup');}catch(e){setupInfo=null;}
  if(!setupInfo)return;                 // serveur injoignable -> session cachee ou legacy
  if(setupInfo.needsSetup){await showSetupDialog();return;}
  if(SESSION_TOKEN){
    try{var me=await sipsFetch('/api/auth/me');SESSION=me.user;authStore();applySession();return;}
    catch(e){authClear();}
  }
  await showLoginDialog(true);
}

/* ====== INITIALISATION ====== */
(async function init(){
  try{var cur=await idbGet('current');if(cur&&cur.st)ST=cur.st;}catch(e){}
  applyReferentials();mergeAndMigrate();
  $('#agent').value=ST.agent;$('#date').value=ST.date;
  try{await authBootstrap();}catch(e){}
  applySession();
  updateAuthUI();
  buildTabbar();
  var tb=$('#tabbar');if(tb)tb.style.display='flex';
  // Profil legacy seulement en mode local (pas de session serveur)
  if(!SESSION&&!USR.nom)setTimeout(usrAskProfile,300);
  if(USR.nom){ST.agent=USR.nom;$('#agent').value=USR.nom;}
  switchTab('accueil');
})();
