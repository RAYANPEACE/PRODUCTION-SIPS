/* ====== MODULE QUALITE — Suivi Qualite (Fiche de Lot) ====== */

/* --- State --- */
function freshQS(){
  return {
    id:'',
    informations:{refProduit:'',dateProduction:todayStr(),heureDebut:'',heureFin:'',numeroLot:'',quantiteProduite:0,tailleBatch:250},
    matieresPremieres:[],
    melanges:[{batchNum:1,heureDebut:'',heureFin:''}],
    visas:{
      operateur:{nom:'',signature:'',date:''},
      responsableProd:{nom:'',signature:'',date:''},
      responsableQualite:{nom:'',signature:'',date:''}
    }
  };
}
var QS=freshQS();
var QS_SERVER_VIEW=false;
var QS_SERVER_PENDING_ID='';
var QS_CORRECTION_OF=null;
var QS_CORRECTION_NOTE='';
var QSERVER_RECORDS=[];
var QSERVER_PENDING=[];
var QSERVER_CORRECTIONS=[];
var QLOCAL_BATCHES=[];
var _qSigPads={};

function qIsMP(code){
  if(!code)return true;
  var r=REFS.find(function(x){return x.code===code;});
  if(!r)return true;
  if(r.cat==='mp')return true;
  return false;
}

function qMPsFromRecipe(produit){
  var recipe=typeof recipeForProduct==='function'?recipeForProduct(produit):RECF[produit];
  if(!recipe)return [];
  return recipe.filter(function(ing){return qIsMP(ing.code);}).map(function(ing){
    return {designation:ing.des,code:ing.code||'',refFournisseur:'',dateProd:'',dateExp:''};
  });
}

async function qNextLotNum(){
  // Le max doit inclure le SERVEUR : un operateur qui SOUMET sans garder de fiche locale
  // n'a aucun batch_ en idb -> sinon le numero reste bloque sur LOT-001.
  // ponytail: numerotation cote client (plus haut LOT vu partout +1). Deux fiches creees au
  // meme instant peuvent viser le meme numero ; le dedup lot|date (local + serveur) l'attrape.
  // Passer a une attribution serveur si les collisions deviennent un vrai probleme.
  var max=0;
  function scan(numeroLot){var m=String(numeroLot||'').match(/LOT-(\d+)/i);if(m){var n=parseInt(m[1],10);if(n>max)max=n;}}
  function scanRec(r){var p=(r&&r.payload)||r||{};if(p&&p.informations)scan(p.informations.numeroLot);}
  try{(await idbAll()).forEach(function(r){if(String(r.id).indexOf('batch_')===0)scanRec(r);});}catch(e){}
  (QSERVER_RECORDS||[]).forEach(scanRec);(QSERVER_PENDING||[]).forEach(scanRec);   // deja en memoire (offline)
  try{
    var res=await Promise.all([
      sipsRecords('quality',{timeoutMs:1800}).catch(function(){return [];}),
      sipsFetch('/api/submissions?status=submitted&type=quality&include=payload',{timeoutMs:1800}).catch(function(){return {submissions:[]};})
    ]);
    (res[0]||[]).forEach(scanRec);
    ((res[1]&&res[1].submissions)||[]).forEach(scanRec);
  }catch(e){}
  return 'LOT-'+String(max+1).padStart(3,'0');
}

/* --- Computed helpers --- */
function qComputeTimes(){
  var mel=QS.melanges;
  if(!mel.length)return;
  var first='',last='';
  for(var i=0;i<mel.length;i++){
    if(mel[i].heureDebut&&(!first||mel[i].heureDebut<first))first=mel[i].heureDebut;
    if(mel[i].heureFin&&(!last||mel[i].heureFin>last))last=mel[i].heureFin;
  }
  QS.informations.heureDebut=first;
  QS.informations.heureFin=last;
  QS.informations.quantiteProduite=qCompletedBatchCount()*QS.informations.tailleBatch;
}

function qCompletedBatchCount(){
  var n=0;
  QS.melanges.forEach(function(b){if(b.heureDebut&&b.heureFin)n++;});
  return n;
}

function qAvgBatchTime(){
  var total=0,count=0;
  QS.melanges.forEach(function(b){
    if(b.heureDebut&&b.heureFin){
      var d=qTimeDiffMin(b.heureDebut,b.heureFin);
      if(d>0){total+=d;count++;}
    }
  });
  if(count===0)return '';
  var avg=Math.round(total/count);
  var h=Math.floor(avg/60);var m=avg%60;
  return (h>0?h+'h':'')+(m<10?'0':'')+m+'min';
}

function qTimeDiffMin(a,b){
  var pa=a.split(':'),pb=b.split(':');
  return (parseInt(pb[0],10)*60+parseInt(pb[1],10))-(parseInt(pa[0],10)*60+parseInt(pa[1],10));
}

function qNowTime(){
  var d=new Date();
  return (d.getHours()<10?'0':'')+d.getHours()+':'+(d.getMinutes()<10?'0':'')+d.getMinutes();
}

function qValidateBatches(){
  for(var i=0;i<QS.melanges.length;i++){
    var b=QS.melanges[i];
    if((b.heureDebut&&!b.heureFin)||(!b.heureDebut&&b.heureFin)){
      return 'Batch '+(i+1)+' : renseigner debut et fin, ou laisser les deux vides';
    }
    if(b.heureDebut&&b.heureFin){
      if(qTimeDiffMin(b.heureDebut,b.heureFin)<=0)
        return 'Batch '+(i+1)+' : heure fin doit etre apres heure debut';
    }
    if(i>0){
      var prev=QS.melanges[i-1];
      if(prev.heureFin&&b.heureDebut){
        if(qTimeDiffMin(prev.heureFin,b.heureDebut)<0)
          return 'Batch '+(i+1)+' : heure debut doit etre apres fin du batch precedent';
      }
    }
  }
  return '';
}

function qCanSignRole(role){
  if(SESSION&&Array.isArray(SESSION.canSign))return SESSION.canSign.indexOf(role)>=0;
  return usrVisaKey()===role;
}
function qHasServerVisa(role){
  var visa=QS.visas&&QS.visas[role];
  return !!(visa&&visa.signature&&visa.serverStamp&&visa.serverStamp.by==='sips-server');
}
function qCanEditVisa(role){
  if(QS_SERVER_VIEW)return false;
  if(!qCanSignRole(role))return false;
  if(QS_SERVER_PENDING_ID&&qHasServerVisa(role))return false;
  if(QS_SERVER_PENDING_ID&&qIsSecondQualityRole(role)&&qHasQualitySecondServerVisa())return false;
  return true;
}
function qQualitySecondRoles(){
  return ['responsableQualite','responsableProd'];
}
function qQualitySignableRoles(){
  return ['operateur','responsableQualite','responsableProd'];
}
function qIsSecondQualityRole(role){
  return qQualitySecondRoles().indexOf(role)>=0;
}
function qHasQualitySecondSignature(visas){
  visas=visas||QS.visas||{};
  return qQualitySecondRoles().some(function(k){return visas[k]&&visas[k].signature;});
}
function qHasQualitySecondServerVisa(){
  return qQualitySecondRoles().some(function(k){return qHasServerVisa(k);});
}
function qQualitySignedCount(visas){
  visas=visas||QS.visas||{};
  return (visas.operateur&&visas.operateur.signature?1:0)+(qHasQualitySecondSignature(visas)?1:0);
}
function qQualityKeyFromPayload(p){
  var info=p&&p.informations||{};
  var lot=String(info.numeroLot||'').trim().toUpperCase();
  var dt=String((p&&p.date)||info.dateProduction||'').trim();
  return lot&&dt?lot+'|'+dt:'';
}
function qMyPendingSignRole(){
  if(!QS_SERVER_PENDING_ID)return '';
  if(!qHasServerVisa('operateur'))return qCanSignRole('operateur')?'operateur':'';
  if(qHasQualitySecondServerVisa())return '';
  if(qCanSignRole('responsableQualite'))return 'responsableQualite';
  if(qCanSignRole('responsableProd'))return 'responsableProd';
  return '';
}
function qClearServerQualityState(){
  QS_SERVER_VIEW=false;
  QS_SERVER_PENDING_ID='';
  QS_CORRECTION_OF=null;
  QS_CORRECTION_NOTE='';
}
function qSignerName(){
  return SESSION?(SESSION.nom||''):(USR&&USR.nom)||'';
}
function qNormalizeVisas(visas){
  var base=freshQS().visas;
  visas=visas||{};
  ['operateur','responsableProd','responsableQualite'].forEach(function(role){
    base[role]=Object.assign({},base[role],visas[role]||{});
  });
  return base;
}
function qApplyAccountVisaNames(){
  QS.visas=qNormalizeVisas(QS.visas);
  ['operateur','responsableProd','responsableQualite'].forEach(function(role){
    if(qCanEditVisa(role)){
      var name=qSignerName();
      if(name)QS.visas[role].nom=name;
    }
  });
}

/* --- Signature pad --- */
function qInitSigPad(canvasId,role,editable){
  var cv=document.getElementById(canvasId);
  if(!cv)return;
  var dispW=cv.offsetWidth||400;
  var dispH=cv.offsetHeight||100;
  cv.width=dispW;
  cv.height=dispH;
  var ctx=cv.getContext('2d');
  ctx.clearRect(0,0,cv.width,cv.height);
  _qSigPads[role]={canvas:cv,ctx:ctx,clear:function(){
    ctx.clearRect(0,0,cv.width,cv.height);
    QS.visas[role].signature='';QS.visas[role].date='';
    var tsEl=document.getElementById('qSigTs_'+role);
    if(tsEl)tsEl.textContent='';
    var st=document.getElementById('qSigState_'+role);
    if(st)st.textContent='Non signe';
  }};
  if(QS.visas[role].signature){
    var img=new Image();img.onload=function(){ctx.drawImage(img,0,0,cv.width,cv.height);};
    img.src=QS.visas[role].signature;
  }
}
function qOpenSigDlg(role){
  if(!qCanEditVisa(role)){toast('Signature non modifiable');return;}
  var visa=QS.visas[role]||{};
  var dlg=document.createElement('dialog');
  dlg.className='q-sig-dialog';
  dlg.innerHTML='<div class="dlg-h"><b>SIGNER</b><button type="button" data-close>x</button></div>'
    +'<div class="dlg-b q-sig-dialog-body"><canvas class="q-sig-pad-big"></canvas>'
    +'<div class="q-sig-dialog-actions"><button type="button" class="b-sec" data-clear>Effacer</button><button type="button" class="b-go" data-save>Valider la signature</button></div></div>';
  document.body.appendChild(dlg);
  var cv=dlg.querySelector('canvas'),ctx=cv.getContext('2d'),drawing=false,hasInk=false;
  function fit(){
    var rect=cv.getBoundingClientRect();
    cv.width=Math.max(320,Math.round(rect.width));
    cv.height=Math.max(260,Math.round(rect.height));
    ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#13202b';
    if(visa.signature){
      var img=new Image();img.onload=function(){ctx.drawImage(img,0,0,cv.width,cv.height);hasInk=true;};img.src=visa.signature;
    }
  }
  function pos(e){
    var rect=cv.getBoundingClientRect();
    var t=e.touches?e.touches[0]:(e.changedTouches?e.changedTouches[0]:e);
    return {x:(t.clientX-rect.left)*(cv.width/rect.width),y:(t.clientY-rect.top)*(cv.height/rect.height)};
  }
  function start(e){e.preventDefault();drawing=true;hasInk=true;var p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);}
  function move(e){if(!drawing)return;e.preventDefault();var p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();}
  function end(e){if(!drawing)return;if(e)e.preventDefault();drawing=false;}
  cv.addEventListener('pointerdown',start);
  cv.addEventListener('pointermove',move);
  cv.addEventListener('pointerup',end);
  cv.addEventListener('pointerleave',end);
  cv.addEventListener('touchstart',start,{passive:false});
  cv.addEventListener('touchmove',move,{passive:false});
  cv.addEventListener('touchend',end,{passive:false});
  dlg.querySelector('[data-close]').onclick=function(){dlg.close();};
  dlg.querySelector('[data-clear]').onclick=function(){ctx.clearRect(0,0,cv.width,cv.height);hasInk=false;};
  dlg.querySelector('[data-save]').onclick=function(){
    if(!hasInk){toast('Tracez votre signature');return;}
    var name=qSignerName();if(name)QS.visas[role].nom=name;
    QS.visas[role].signature=cv.toDataURL();
    QS.visas[role].date=todayStr()+' '+qNowTime();
    dlg.close();
    renderQualite();
  };
  dlg.addEventListener('close',function(){dlg.remove();});
  dlg.showModal();
  setTimeout(fit,30);
}
function qSigButtonText(role){
  return (QS.visas[role]&&QS.visas[role].signature)?'RESIGNER':'SIGNER';
}

/* --- Render main --- */
async function renderQualite(){
  _qSigPads={};
  if(!QS.informations.numeroLot){
    QS.informations.numeroLot=await qNextLotNum();
  }
  qApplyAccountVisaNames();
  qComputeTimes();
  var app=$('#app');
  var h='<div class="q-wrap">';
  h+='<h2 class="q-title">Suivi Qualité — Fiche de Lot</h2>';
  h+='<button id="qGoHist" class="hist-jump">Aller à Historique ⬇</button>';
  if(QS_SERVER_VIEW)h+='<p class="ref-hint" style="background:#eef4fb;border:1px solid #d6e4f2;border-radius:8px;padding:8px 10px">Consultation officielle serveur : lecture seule. Utilisez PDF pour exporter, ou Nouvelle fiche pour reprendre la saisie locale.</p>';
  if(QS_CORRECTION_OF)h+='<p class="ref-hint" style="background:#fff3f0;border:1px solid #efc9c0;border-radius:8px;padding:8px 10px"><b>Correction demandee</b> : '+esc(QS_CORRECTION_NOTE||'Motif non renseigne')+'<br><small>Ancienne soumission : '+esc(QS_CORRECTION_OF.id||'')+'. Corrigez la fiche puis signez operateur avant resoumission.</small></p>';

  if(QS_SERVER_PENDING_ID)h+='<p class="ref-hint" style="background:#fff8e8;border:1px solid #f1d79a;border-radius:8px;padding:8px 10px">Fiche serveur en attente : les donnees sont verrouillees. Seule la signature autorisee par votre compte peut etre ajoutee.</p>';

  /* Section A: Informations */
  h+='<div class="q-sec open" id="qSecA"><div class="q-sec-h" onclick="this.parentElement.classList.toggle(\'open\')"><h3>A — Informations produit</h3><span class="chev">▸</span></div>';
  h+='<div class="q-sec-body">';
  h+='<div class="q-field"><label>Produit<small>Choisir la reference</small></label>';
  h+='<select id="qRefProd" onchange="qOnProdChange(this.value)">';
  h+='<option value="">— Choisir —</option>';
  var curProd=currentRecipeProductCode(QS.informations.refProduit);if(curProd&&curProd!==QS.informations.refProduit)QS.informations.refProduit=curProd;
  var prods=recipeKeys();
  prods.forEach(function(p){h+='<option value="'+esc(p)+'"'+(productCodeOf(QS.informations.refProduit)===p?' selected':'')+'>'+laityOpt(recipeProductLabel(p))+'</option>';});
  h+='</select></div>';
  h+='<div class="q-field"><label>Date de production</label><input type="date" id="qDateProd" value="'+esc(QS.informations.dateProduction)+'" onchange="QS.informations.dateProduction=this.value"></div>';
  h+='<div class="q-field"><label>Heure debut<small>Auto (1er batch)</small></label><input type="text" id="qHDeb" value="'+esc(QS.informations.heureDebut)+'" readonly></div>';
  h+='<div class="q-field"><label>Heure fin<small>Auto (dernier batch)</small></label><input type="text" id="qHFin" value="'+esc(QS.informations.heureFin)+'" readonly></div>';
  h+='<div class="q-field"><label>Numero de lot<small>Auto-incremente</small></label><input type="text" id="qLot" value="'+esc(QS.informations.numeroLot)+'" readonly></div>';
  h+='<div class="q-field"><label>Quantite produite (kg)<small>Batches x taille</small></label><input type="text" id="qQte" value="'+QS.informations.quantiteProduite+'" readonly></div>';
  var qProdRef=recipeProductRef(QS.informations.refProduit);
  var isCafe=qProdRef&&qProdRef.des.toUpperCase().indexOf('CAFE AU LAIT')!==-1;
  h+='<div class="q-field"><label>Taille batch (kg)'+(isCafe?'<small>Auto 225 kg (Cafe au lait)</small>':'')+'</label>';
  h+='<select id="qBatchSize" onchange="qOnBatchSize(this.value)"'+(isCafe?' disabled':'')+'>';
  [200,225,250,400,500].forEach(function(v){h+='<option value="'+v+'"'+(QS.informations.tailleBatch===v?' selected':'')+'>'+v+' kg</option>';});
  h+='</select></div>';
  var nbCompleted=0;QS.melanges.forEach(function(b){if(b.heureDebut&&b.heureFin)nbCompleted++;});
  h+='<div class="q-field"><label>Nombre de batches<small>Batches debut+fin remplis</small></label><input type="text" id="qNbBatch" value="'+nbCompleted+'" readonly></div>';
  var avgTime=qAvgBatchTime();
  h+='<div class="q-field"><label>Temps moyen par batch<small>Duree moyenne</small></label><input type="text" id="qAvgTime" value="'+(avgTime||'—')+'" readonly></div>';
  h+='</div></div>';

  /* Section B: Matieres Premieres */
  h+='<div class="q-sec open" id="qSecB"><div class="q-sec-h" onclick="this.parentElement.classList.toggle(\'open\')"><h3>B — Matieres Premieres</h3><span class="chev">▸</span></div>';
  h+='<div class="q-sec-body">';
  if(QS.matieresPremieres.length){
    h+='<div style="overflow-x:auto">';
    h+='<table class="q-tbl"><thead><tr><th>#</th><th>Designation</th><th>Ref lot fourn.</th><th>Date prod.</th><th>Date exp.</th></tr></thead><tbody>';
    QS.matieresPremieres.forEach(function(mp,i){
      h+='<tr>';
      h+='<td style="font:700 12px ui-monospace,monospace;color:var(--steel-d)">'+(i+1)+'</td>';
      h+='<td><div class="q-mp-des">'+esc(mp.designation)+'</div><div class="q-mp-code">'+esc(mp.code)+'</div></td>';
      h+='<td><input type="text" data-qi="'+i+'" data-qf="refFournisseur" value="'+esc(mp.refFournisseur)+'" oninput="qMPInput(this)" placeholder="N. lot"></td>';
      h+='<td><input type="date" data-qi="'+i+'" data-qf="dateProd" value="'+esc(mp.dateProd)+'" onchange="qMPInput(this)"></td>';
      h+='<td><input type="date" data-qi="'+i+'" data-qf="dateExp" value="'+esc(mp.dateExp)+'" onchange="qMPInput(this)"></td>';
      h+='</tr>';
    });
    h+='</tbody></table></div>';
  }else{
    h+='<p style="color:var(--mute);font-size:13px">Choisir un produit pour charger les matieres premieres.</p>';
  }
  h+='<button class="q-add" onclick="qAddMP()">+ Ajouter une matiere premiere</button>';
  h+='<button class="q-add" style="border-color:#c5e4d2;color:var(--green);background:#eef8f1;margin-top:6px" onclick="qLoadLastBatch()">Charger les derniers lots MP</button>';
  h+='</div></div>';

  /* Section C: Melanges */
  h+='<div class="q-sec open" id="qSecC"><div class="q-sec-h" onclick="this.parentElement.classList.toggle(\'open\')"><h3>C — Feuille de Melange</h3><span class="chev">▸</span></div>';
  h+='<div class="q-sec-body">';
  QS.melanges.forEach(function(b,i){
    h+='<div class="q-batch-row">';
    h+='<div class="q-batch-num">#'+(i+1)+'</div>';
    h+='<div class="q-batch-time"><input type="time" placeholder="Debut" data-bi="'+i+'" data-bf="heureDebut" value="'+esc(b.heureDebut)+'" onchange="qBatchInput(this)"></div>';
    h+='<button class="q-now" onclick="qBatchNow('+i+',\'heureDebut\')">🕒</button>';
    h+='<div class="q-batch-time"><input type="time" placeholder="Fin" data-bi="'+i+'" data-bf="heureFin" value="'+esc(b.heureFin)+'" onchange="qBatchInput(this)"></div>';
    h+='<button class="q-now" onclick="qBatchNow('+i+',\'heureFin\')">🕒</button>';
    h+='</div>';
  });
  h+='<button class="q-add" onclick="qAddBatch()">+ Ajouter un batch</button>';
  if(QS.melanges.length>1){
    h+='<button class="q-rm" onclick="qRmBatch()">Supprimer le dernier batch</button>';
  }
  h+='</div></div>';

  /* Section D: Visas */
  h+='<div class="q-sec open" id="qSecD"><div class="q-sec-h" onclick="this.parentElement.classList.toggle(\'open\')"><h3>D — Visas / Signatures</h3><span class="chev">▸</span></div>';
  h+='<div class="q-sec-body">';
  var roles=[['operateur','Operateur'],['responsableProd','Chef d usine'],['responsableQualite','Responsable qualite']];
  roles.forEach(function(rr){
    var key=rr[0],label=rr[1];
    var v=QS.visas[key];
    var canEdit=qCanEditVisa(key);
    var canSign=qCanSignRole(key);
    var lockName=!!SESSION||!canEdit;
    h+='<div class="q-sig-block'+(canEdit?'':' q-sig-locked')+'">';
    h+='<div class="q-sig-title">'+esc(label)+(key==='operateur'?' <span style="color:var(--red);font-size:11px">(obligatoire)</span>':'');
    if(!canEdit)h+=' <span style="color:var(--mute);font-size:10px;font-style:italic">'+(canSign&&v.signature?'(deja signe)':'(lecture seule)')+'</span>';
    else if(SESSION)h+=' <span style="color:var(--green);font-size:10px;font-style:italic">(compte connecte)</span>';
    h+='</div>';
    h+='<input class="q-sig-nom" type="text" id="qSigNom_'+key+'" value="'+esc(v.nom)+'" placeholder="Nom"'+(lockName?' readonly style="background:#eef2f6;color:var(--mute)"':' oninput="QS.visas.'+key+'.nom=this.value"')+'>';
    h+='<div class="q-sig-preview-row"><canvas class="q-sig-canvas" id="qSigCv_'+key+'" width="400" height="100"></canvas><div class="q-sig-side">';
    h+='<div class="q-sig-state" id="qSigState_'+key+'">'+(v.signature?'Signe':'Non signe')+'</div>';
    if(canEdit){h+='<button class="q-sign-btn" onclick="qOpenSigDlg(\''+key+'\')">'+qSigButtonText(key)+'</button><button class="q-sig-clear" onclick="qClearSig(\''+key+'\')">Effacer</button>';}
    h+='</div></div>';
    h+='<div class="q-sig-ts" id="qSigTs_'+key+'">'+esc(v.date)+'</div>';
    h+='</div>';
  });
  h+='</div></div>';

  /* Actions */
  h+='<div class="q-actions">';
  if(QS_SERVER_PENDING_ID){
    var pendingRole=qMyPendingSignRole();
    if(pendingRole)h+='<button class="q-save" onclick="qSignServerPending()">Enregistrer ma signature serveur</button>';
    else h+='<span style="color:var(--mute);font-size:13px;align-self:center">Votre signature obligatoire est deja presente.</span>';
  }else if(!QS_SERVER_VIEW){
    h+='<button class="q-save" onclick="qSubmitServer()">Soumettre au serveur</button>';
    h+='<button class="q-save" onclick="qSave()">Enregistrer localement</button>';
  }
  h+='<button class="q-pdf" onclick="qExportPDF()">PDF</button>';
  if(!QS_SERVER_VIEW&&!QS_SERVER_PENDING_ID){
    h+='<button class="q-json" onclick="qExportJSON()">Secours fichier signature</button>';
  }
  h+='<button class="q-new" onclick="qNew()">Nouvelle fiche</button>';
  h+='</div>';

  /* History */
  h+='<div id="qHistory" style="margin-top:20px"><h3 style="font-size:14px;font-weight:700;margin-bottom:8px">Historique des fiches</h3>';
  h+='<div id="qHistFilter"></div>';
  h+='<div id="qHistRecap"></div>';
  h+='<div id="qHistList"></div></div>';

  h+='</div>';
  app.innerHTML=h;
  var qGoHist=$('#qGoHist');
  if(qGoHist)qGoHist.onclick=function(){var el=document.getElementById('qHistory');if(el)scrollCardIntoView(el);};
  if(QS_SERVER_VIEW){
    app.querySelectorAll('input,select,textarea,button.q-add,button.q-rm,button.q-now,button.q-sig-clear').forEach(function(el){el.disabled=true;});
  }
  if(QS_SERVER_PENDING_ID){
    app.querySelectorAll('input:not(.q-sig-nom),select,textarea,button.q-add,button.q-rm,button.q-now').forEach(function(el){el.disabled=true;});
  }

  /* Init sig pads */
  roles.forEach(function(rr){qInitSigPad('qSigCv_'+rr[0],rr[0],qCanEditVisa(rr[0]));});
  /* Paste button — for WhatsApp received files */
  var qpb=$('#qPasteBtn');
  if(qpb)qpb.onclick=function(){
    var dlg=document.createElement('dialog');
    dlg.style.cssText='border:none;border-radius:14px;padding:0;max-width:92vw;width:500px;box-shadow:0 20px 60px rgba(0,0,0,.35)';
    dlg.innerHTML='<div class="dlg-h"><b>Coller la fiche reçue</b><button onclick="this.closest(\'dialog\').close()">x</button></div>'
      +'<div class="dlg-b"><p style="margin:0 0 8px;font-size:13px;color:#6a7280;line-height:1.5">Ouvrez le fichier .txt recu sur WhatsApp, selectionnez tout le texte, copiez-le, puis collez-le ici :</p>'
      +'<textarea id="qPasteTxt" style="width:100%;height:180px;font:12px/1.4 ui-monospace,monospace;border:1px solid var(--line);border-radius:8px;padding:10px;box-sizing:border-box" placeholder="Collez le contenu du fichier ici..."></textarea>'
      +'<div class="dlg-actions" style="margin-top:10px"><button class="b-sec" onclick="this.closest(\'dialog\').close()">Annuler</button><button class="b-go" id="qPasteOk">Valider</button></div></div>';
    document.body.appendChild(dlg);dlg.showModal();
    dlg.querySelector('#qPasteOk').onclick=function(){var txt=dlg.querySelector('#qPasteTxt').value;dlg.close();dlg.remove();if(txt&&txt.trim())qImportJSON(txt);else toast('Rien a coller');};
  };
  /* Load history */
  qLoadHist();
}

/* --- Event handlers --- */
function qOnProdChange(val){
  QS.informations.refProduit=val;
  if(val){
    QS.matieresPremieres=qMPsFromRecipe(val);
    var r=recipeProductRef(val);
    if(r&&r.des.toUpperCase().indexOf('CAFE AU LAIT')!==-1){
      QS.informations.tailleBatch=225;
    }
  }else{
    QS.matieresPremieres=[];
  }
  qComputeTimes();
  renderQualite();
}

function qOnBatchSize(val){
  QS.informations.tailleBatch=parseInt(val,10)||250;
  qComputeTimes();
  var qte=$('#qQte');if(qte)qte.value=QS.informations.quantiteProduite;
}

function qMPInput(el){
  var i=parseInt(el.dataset.qi,10);
  var f=el.dataset.qf;
  if(!QS.matieresPremieres[i])return;
  QS.matieresPremieres[i][f]=el.value;
  if(f==='dateExp'&&el.value){
    var dp=QS.matieresPremieres[i].dateProd;
    if(dp&&el.value<=dp){
      toast('Date expiration doit etre apres date production (MP '+(i+1)+')');
      el.value='';QS.matieresPremieres[i].dateExp='';
    }
  }
  if(f==='dateProd'&&el.value){
    var de=QS.matieresPremieres[i].dateExp;
    if(de&&de<=el.value){
      toast('Date expiration doit etre apres date production (MP '+(i+1)+')');
      QS.matieresPremieres[i].dateExp='';
      var deEl=document.querySelector('input[data-qi="'+i+'"][data-qf="dateExp"]');
      if(deEl)deEl.value='';
    }
  }
}

function qAddMP(){
  QS.matieresPremieres.push({designation:'',code:'',refFournisseur:'',dateProd:'',dateExp:''});
  renderQualite();
}

function qBatchInput(el){
  var i=parseInt(el.dataset.bi,10);
  var f=el.dataset.bf;
  if(QS.melanges[i])QS.melanges[i][f]=el.value;
  qComputeTimes();
  var hd=$('#qHDeb');if(hd)hd.value=QS.informations.heureDebut;
  var hf=$('#qHFin');if(hf)hf.value=QS.informations.heureFin;
  var qq=$('#qQte');if(qq)qq.value=QS.informations.quantiteProduite;
  qUpdateBatchStats();
}
function qUpdateBatchStats(){
  var nb=qCompletedBatchCount();
  var nbEl=$('#qNbBatch');if(nbEl)nbEl.value=nb;
  var avgEl=$('#qAvgTime');if(avgEl)avgEl.value=qAvgBatchTime()||'—';
}

function qBatchNow(idx,field){
  QS.melanges[idx][field]=qNowTime();
  var sel='input[data-bi="'+idx+'"][data-bf="'+field+'"]';
  var el=document.querySelector(sel);
  if(el)el.value=QS.melanges[idx][field];
  qComputeTimes();
  var hd=$('#qHDeb');if(hd)hd.value=QS.informations.heureDebut;
  var hf=$('#qHFin');if(hf)hf.value=QS.informations.heureFin;
  var qq=$('#qQte');if(qq)qq.value=QS.informations.quantiteProduite;
  qUpdateBatchStats();
}

function qAddBatch(){
  var n=QS.melanges.length+1;
  QS.melanges.push({batchNum:n,heureDebut:'',heureFin:''});
  qComputeTimes();
  renderQualite();
}

function qRmBatch(){
  if(QS.melanges.length>1){QS.melanges.pop();qComputeTimes();renderQualite();}
}

function qClearSig(role){
  if(_qSigPads[role])_qSigPads[role].clear();
}

/* --- Save --- */
async function qSave(){
  if(QS_SERVER_VIEW){toast('Fiche serveur en lecture seule');return;}
  if(!QS.informations.refProduit){toast('Choisir un produit');return;}
  if(!QS.informations.tailleBatch){toast('Choisir une taille de batch');return;}
  if(!QS.visas.operateur.signature){toast('Signature operateur obligatoire');return;}
  for(var i=0;i<QS.matieresPremieres.length;i++){
    var mp=QS.matieresPremieres[i];
    if(!mp.dateProd||!mp.dateExp){toast('Dates manquantes pour MP '+(i+1)+' ('+mp.designation+')');return;}
    if(mp.dateExp<=mp.dateProd){toast('Date expiration doit etre strictement apres date production pour MP '+(i+1)+' ('+mp.designation+')');return;}
  }
  var bErr=qValidateBatches();
  if(bErr){toast(bErr);return;}
  qComputeTimes();
  var wasUpdate=!!QS.id;
  var recId=QS.id||'batch_'+Date.now();
  var duplicate=null;
  try{
    var all=await idbAll();
    duplicate=all.find(function(r){
      if(!r||String(r.id).indexOf('batch_')!==0||r.id===recId||!r.informations)return false;
      var sameLot=QS.informations.numeroLot&&r.informations.numeroLot===QS.informations.numeroLot;
      var sameProductDate=productCodeOf(r.informations.refProduit)===productCodeOf(QS.informations.refProduit)&&r.informations.dateProduction===QS.informations.dateProduction;
      return sameLot||sameProductDate;
    })||null;
  }catch(e){}
  if(duplicate){
    var di=duplicate.informations||{};
    toast('Fiche qualite deja enregistree : '+recipeProductLabel(di.refProduit||'produit')+' '+frDate(di.dateProduction||duplicate.date||''));
    return;
  }
  var rec={
    id:recId,
    kind:'batch',
    date:QS.informations.dateProduction||todayStr(),
    informations:clone(QS.informations),
    matieresPremieres:clone(QS.matieresPremieres),
    melanges:clone(QS.melanges),
    visas:clone(QS.visas),
    savedAt:Date.now()
  };
  rec._sig=localSig('quality',{informations:rec.informations,matieresPremieres:rec.matieresPremieres,melanges:rec.melanges,visas:rec.visas});
  await idbPut(rec);
  QS.id=rec.id;
  toast(wasUpdate?'Fiche mise a jour':'Fiche enregistree');
  qLoadHist();
}

async function qSubmitServer(){
  if(QS_SERVER_VIEW){toast('Fiche serveur en lecture seule');return;}
  if(!QS.informations.refProduit){toast('Choisir un produit');return;}
  if(!QS.informations.tailleBatch){toast('Choisir une taille de batch');return;}
  if(!QS.visas.operateur.signature){toast('Signature operateur obligatoire');return;}
  for(var i=0;i<QS.matieresPremieres.length;i++){
    var mp=QS.matieresPremieres[i];
    if(!mp.dateProd||!mp.dateExp){toast('Dates manquantes pour MP '+(i+1)+' ('+mp.designation+')');return;}
    if(mp.dateExp<=mp.dateProd){toast('Date expiration doit etre strictement apres date production pour MP '+(i+1)+' ('+mp.designation+')');return;}
  }
  var bErr=qValidateBatches();
  if(bErr){toast(bErr);return;}
  qComputeTimes();
  var curKey=qQualityKeyFromPayload({date:QS.informations.dateProduction,informations:QS.informations});
  var serverDuplicate=QSERVER_PENDING.find(function(s){return qQualityKeyFromPayload(s&&s.payload)===curKey;});
  if(serverDuplicate){toast('Fiche deja en attente serveur : ouvrez-la dans "Fiches serveur a ouvrir / signer".');return;}
  const payload={id:QS.id||'batch_draft_'+Date.now(),date:QS.informations.dateProduction||todayStr(),informations:clone(QS.informations),matieresPremieres:clone(QS.matieresPremieres),melanges:clone(QS.melanges),visas:clone(QS.visas),submittedAt:new Date().toISOString()};
  if(QS_CORRECTION_OF){
    payload.correctionOf=clone(QS_CORRECTION_OF);
    payload.correctionNote=QS_CORRECTION_NOTE||'';
  }
  const res=await sipsSubmit('quality',payload,(QS_CORRECTION_OF?'Correction fiche qualite ':'Fiche qualite ')+(QS.informations.numeroLot||''));
  if(res&&res.ok&&QS_CORRECTION_OF){
    qClearServerQualityState();
    QS=freshQS();
    renderQualite();
  }
}

/* --- History --- */
/* Recap tonnage : fiches VALIDEES serveur uniquement (choix terrain), sur tout le filtre
   courant (pas seulement les lignes affichees). Global + detail par produit fini. */
function qKg(kg){return (typeof fmtq==='function'?fmtq(num(kg)):String(num(kg)))+' kg';}
function qRecapHTML(recordsF){
  var recap={},total=0;
  (recordsF||[]).forEach(function(o){
    var info=((o.r.payload||{}).informations)||{};
    var kg=num(info.quantiteProduite);if(kg<=0)return;
    var code=productCodeOf(info.refProduit)||String(info.refProduit||'?');
    recap[code]=(recap[code]||0)+kg;total+=kg;
  });
  if(!total)return '<div class="q-recap q-recap-empty">Aucune fiche validée serveur pour ce filtre.</div>';
  var codes=Object.keys(recap).sort(function(a,b){return recap[b]-recap[a];});
  var rows=codes.map(function(c){return '<div class="q-recap-row"><span>'+hlLaity(recipeProductLabel(c))+'</span><b>'+esc(qKg(recap[c]))+'</b></div>';}).join('');
  return '<div class="q-recap"><div class="q-recap-total">Tonnage validé serveur : <b>'+esc(qKg(total))+'</b> — '+codes.length+' produit(s)</div>'+rows+'</div>';
}
async function qLoadHist(){
  var list=$('#qHistList');if(!list)return;
  try{
    QSERVER_PENDING=[];
    QSERVER_CORRECTIONS=[];
    if(SESSION&&(SESSION.role==='admin'||qQualitySignableRoles().some(function(role){return qCanSignRole(role);}))){
      try{
        var pdata=await sipsFetch('/api/submissions?status=submitted&type=quality&include=payload');
        QSERVER_PENDING=pdata.submissions||[];
      }catch(pErr){}
      try{
        if(SESSION.role==='admin'||qCanSignRole('operateur')){
        var cdata=await sipsFetch('/api/submissions?status=rejected&type=quality&include=payload');
        QSERVER_CORRECTIONS=(cdata.submissions||[]).filter(function(s){return s&&s.correctionRequested;});
        }
      }
      catch(cErr){}
    }
    QSERVER_RECORDS=(await sipsRecords('quality')).sort(function(a,b){return String(b.validatedAt||'').localeCompare(String(a.validatedAt||''));});
    var resumedCorrections={};
    var correctionsById={};
    QSERVER_CORRECTIONS.forEach(function(s){if(s&&s.id)correctionsById[s.id]=s;});
    function markResumedCorrection(id){
      while(id&&!resumedCorrections[id]){
        resumedCorrections[id]=1;
        var parent=correctionsById[id];
        id=parent&&parent.payload&&parent.payload.correctionOf&&parent.payload.correctionOf.id;
      }
    }
    QSERVER_PENDING.forEach(function(s){markResumedCorrection(s&&s.payload&&s.payload.correctionOf&&s.payload.correctionOf.id);});
    QSERVER_RECORDS.forEach(function(r){markResumedCorrection(r&&r.payload&&r.payload.correctionOf&&r.payload.correctionOf.id);});
    QSERVER_CORRECTIONS=QSERVER_CORRECTIONS.filter(function(s){return !resumedCorrections[s.id];});
    var serverQualityKeys={};
    QSERVER_PENDING.concat(QSERVER_CORRECTIONS).forEach(function(s){var k=qQualityKeyFromPayload(s&&s.payload);if(k)serverQualityKeys[k]=1;});
    QSERVER_RECORDS.forEach(function(r){var k=qQualityKeyFromPayload(r&&r.payload);if(k)serverQualityKeys[k]=1;});
    var all=await idbAll();
    var batches=all.filter(function(r){
      if(String(r.id).indexOf('batch_')!==0)return false;
      return !serverQualityKeys[qQualityKeyFromPayload(r)];
    }).sort(function(a,b){return (b.savedAt||0)-(a.savedAt||0);});
    QLOCAL_BATCHES=batches;
    /* Filtres temporel + produit fini (memes composants que Entree/Sortie/Production).
       Le loader re-execute qLoadHist (re-fetch serveur), comme les autres onglets. */
    var qf=$('#qHistFilter');
    if(qf){qf.innerHTML=histFilterHTML('qualite');bindHistFilter(qf,'qualite',qLoadHist);}
    var QF=HIST_FILTERS.qualite;
    function qPass(row,isServer){return histMatchDate(histRecDate(row,isServer),QF)&&histMatchArticle(row,'qualite',isServer,QF.article);}
    var pendingF=QSERVER_PENDING.map(function(s,idx){return {s:s,idx:idx};}).filter(function(o){return qPass(o.s,true);});
    var corrF=QSERVER_CORRECTIONS.map(function(s,idx){return {s:s,idx:idx};}).filter(function(o){return qPass(o.s,true);});
    var recordsF=QSERVER_RECORDS.map(function(r,idx){return {r:r,idx:idx};}).filter(function(o){return qPass(o.r,true);});
    var batchesF=batches.filter(function(b){return qPass(b,false);});
    var recapEl=$('#qHistRecap');if(recapEl)recapEl.innerHTML=qRecapHTML(recordsF);
    var htm='';
    if(pendingF.length){
      htm+='<div style="font-size:12px;font-weight:800;color:#9a6500;margin:0 0 6px;text-transform:uppercase">Fiches serveur a ouvrir / signer</div>';
      pendingF.forEach(function(o){var s=o.s,idx=o.idx;
        var b=s.payload||{},info=b.informations||{},visas=b.visas||{};
        var sigs=qQualitySignedCount(visas);
        var mine=typeof sipsNeedsMyQualitySignature==='function'
          ? sipsNeedsMyQualitySignature(b,(SESSION&&SESSION.canSign)||[])
          : false;
        htm+='<div class="q-hist-item">';
        htm+='<div class="info"><b>'+hlLaity(recipeProductLabel(info.refProduit||'---'))+'</b>';
        htm+='<span>'+esc(info.numeroLot||'')+' - '+frDate(b.date||info.dateProduction||'')+' - '+sigs+'/2 signature(s) obligatoires - '+(mine?'votre signature est attendue':'en attente admin/autre signature')+'</span></div>';
        htm+='<button data-qpend="'+idx+'">'+(mine?'Ouvrir et signer':'Ouvrir')+'</button>';
        htm+='</div>';
      });
    }
    if(corrF.length){
      htm+='<div style="font-size:12px;font-weight:800;color:var(--red);margin:10px 0 6px;text-transform:uppercase">Corrections demandees</div>';
      corrF.forEach(function(o){var s=o.s,idx=o.idx;
        var b=s.payload||{},info=b.informations||{};
        htm+='<div class="q-hist-item">';
        htm+='<div class="info"><b>'+hlLaity(recipeProductLabel(info.refProduit||'---'))+'</b>';
        htm+='<span>'+esc(info.numeroLot||'')+' - '+frDate(b.date||info.dateProduction||'')+' - '+esc(s.decisionNote||'Correction demandee')+'</span></div>';
        htm+='<button data-qcorr="'+idx+'">Reprendre correction</button>';
        htm+='</div>';
      });
    }
    if(recordsF.length){
      htm+='<div style="font-size:12px;font-weight:800;color:var(--green);margin:0 0 6px;text-transform:uppercase">Validees serveur</div>';
      recordsF.forEach(function(o){var r=o.r,idx=o.idx;
        var b=r.payload||{},info=b.informations||{},visas=b.visas||{};
        var sigs=qQualitySignedCount(visas);
        htm+='<div class="q-hist-item">';
        htm+='<div class="info"><b>'+hlLaity(recipeProductLabel(info.refProduit||'—'))+'</b>';
        htm+='<span>'+esc(info.numeroLot||'')+' — '+frDate(b.date||info.dateProduction||'')+' — '+sigs+'/2 signature(s) obligatoires — officielle serveur</span></div>';
        htm+='<button data-qserv="'+idx+'">Voir</button>';
        htm+='</div>';
      });
    }
    if(batchesF.length){
      htm+='<div style="font-size:12px;font-weight:800;color:var(--steel-d);margin:'+(recordsF.length?'10px':'0')+' 0 6px;text-transform:uppercase">Locales sur cet appareil</div>';
    }
    batchesF.forEach(function(b){
      var info=b.informations||{};
      var visas=b.visas||{};
      var sigs=qQualitySignedCount(visas);
      htm+='<div class="q-hist-item">';
      htm+='<div class="info"><b>'+hlLaity(recipeProductLabel(info.refProduit||'—'))+'</b>';
      htm+='<span>'+esc(info.numeroLot||'')+' — '+frDate(b.date)+' — '+sigs+'/2 signature(s) obligatoires</span></div>';
      htm+='<button data-qlocal="'+esc(b.id)+'">Voir</button>';
      htm+='<button class="del" data-qdel="'+esc(b.id)+'">Suppr</button>';
      htm+='</div>';
    });
    list.innerHTML=htm||'<p style="color:var(--mute);font-size:13px">Aucune fiche pour ce filtre.</p>';
    qBindHistButtons(list);
  }catch(e){list.innerHTML='<p style="color:var(--red)">Erreur chargement</p>';}
}

function qBindHistButtons(list){
  list.querySelectorAll('[data-qpend]').forEach(function(b){
    b.addEventListener('click',function(){qLoadPendingBatch(parseInt(b.dataset.qpend,10));});
  });
  list.querySelectorAll('[data-qcorr]').forEach(function(b){
    b.addEventListener('click',function(){qLoadCorrectionBatch(parseInt(b.dataset.qcorr,10));});
  });
  list.querySelectorAll('[data-qserv]').forEach(function(b){
    b.addEventListener('click',function(){qLoadServerBatch(parseInt(b.dataset.qserv,10));});
  });
  list.querySelectorAll('[data-qlocal]').forEach(function(b){
    b.addEventListener('click',function(){qLoadBatch(b.dataset.qlocal);});
  });
  list.querySelectorAll('[data-qdel]').forEach(function(b){
    b.addEventListener('click',function(){qDelBatch(b.dataset.qdel);});
  });
}

async function qLoadBatch(id){
  try{
    var rec=await idbGet(id);
    if(!rec){toast('Fiche introuvable');return;}
    qClearServerQualityState();
    QS.id=rec.id;
    QS.informations=rec.informations||freshQS().informations;
    QS.matieresPremieres=rec.matieresPremieres||[];
    QS.melanges=rec.melanges||[{batchNum:1,heureDebut:'',heureFin:''}];
    QS.visas=qNormalizeVisas(rec.visas);
    await renderQualite();
    toast('Fiche chargee');
    window.scrollTo(0,0);
  }catch(e){toast('Erreur chargement');}
}

async function qLoadPendingBatch(idx){
  var row=QSERVER_PENDING[idx];
  try{await qOpenSubmittedQuality(row);}
  catch(e){toast('Ouverture impossible : '+((e&&e.message)||e));}
}

async function qOpenSubmittedQuality(row){
  if(!row||!row.payload){toast('Fiche serveur introuvable');return;}
  var rec=row.payload;
  TAB='qualite';
  document.querySelectorAll('#tabbar .tab').forEach(function(t){t.classList.toggle('active',t.dataset.tab==='qualite');});
  var mt=$('#tabMoreToggle');if(mt)mt.classList.remove('active');
  var openMore=document.querySelector('#tabbar .tabmore[open]');if(openMore)openMore.open=false;
  QS_SERVER_VIEW=false;
  QS_SERVER_PENDING_ID=row.id;
  QS_CORRECTION_OF=null;
  QS_CORRECTION_NOTE='';
  QS.id=rec.id||'';
  QS.informations=rec.informations||freshQS().informations;
  if(!QS.informations.numeroLot)QS.informations.numeroLot=rec.numeroLot||'LOT-SERVEUR';
  QS.matieresPremieres=rec.matieresPremieres||[];
  QS.melanges=rec.melanges||[{batchNum:1,heureDebut:'',heureFin:''}];
  QS.visas=qNormalizeVisas(rec.visas);
  await renderQualite();
  toast('Fiche serveur en attente chargee');
  window.scrollTo(0,0);
}

async function qLoadCorrectionBatch(idx){
  if(SESSION&&SESSION.role!=='admin'&&!qCanSignRole('operateur')){toast('Correction reservee a l operateur');return;}
  var row=QSERVER_CORRECTIONS[idx];
  if(!row||!row.payload){toast('Correction introuvable');return;}
  var rec=row.payload;
  qClearServerQualityState();
  QS.id='batch_correction_'+Date.now();
  QS.informations=clone(rec.informations||freshQS().informations);
  QS.matieresPremieres=clone(rec.matieresPremieres||[]);
  QS.melanges=clone(rec.melanges||[{batchNum:1,heureDebut:'',heureFin:''}]);
  QS.visas=freshQS().visas;
  QS_CORRECTION_OF={id:row.id,lot:(QS.informations&&QS.informations.numeroLot)||'',decidedAt:row.decidedAt||'',decidedBy:row.decidedBy||''};
  QS_CORRECTION_NOTE=row.decisionNote||'Correction demandee';
  await renderQualite();
  toast('Correction chargee');
  window.scrollTo(0,0);
}

async function qSignServerPending(){
  if(!QS_SERVER_PENDING_ID){toast('Aucune fiche serveur en attente');return;}
  var role=qMyPendingSignRole();
  if(!role){toast('Votre signature est deja presente');return;}
  var visa=QS.visas[role]||{};
  if(!visa.signature){toast('Tracez votre signature avant d enregistrer');return;}
  try{
    var data=await sipsFetch('/api/submissions/'+encodeURIComponent(QS_SERVER_PENDING_ID)+'/quality-sign',{
      method:'POST',
      body:JSON.stringify({role:role,visa:{signature:visa.signature,date:visa.date||todayStr()+' '+qNowTime()}})
    });
    QS.visas=qNormalizeVisas(data.submission&&data.submission.payload&&data.submission.payload.visas||QS.visas);
    toast(data.missing&&data.missing.length?'Signature enregistree - reste : '+data.missing.join(', '):'Signature enregistree - fiche prete pour validation admin');
    qClearServerQualityState();
    QS=freshQS();
    renderQualite();
  }catch(e){toast('Erreur signature serveur : '+e.message);}
}

async function qLoadServerBatch(idx){
  var row=QSERVER_RECORDS[idx];
  if(!row||!row.payload){toast('Fiche serveur introuvable');return;}
  var rec=row.payload;
  qClearServerQualityState();
  QS_SERVER_VIEW=true;
  QS.id='';
  QS.informations=rec.informations||freshQS().informations;
  QS.matieresPremieres=rec.matieresPremieres||[];
  QS.melanges=rec.melanges||[{batchNum:1,heureDebut:'',heureFin:''}];
  QS.visas=qNormalizeVisas(rec.visas);
  await renderQualite();
  toast('Fiche serveur chargee');
  window.scrollTo(0,0);
}

async function qDelBatch(id){
  if(!confirm('Supprimer cette fiche ?'))return;
  await idbDel(id);
  toast('Fiche supprimee');
  qLoadHist();
}

/* --- Load latest MP lots, all finished products combined --- */
function qSameMP(a,b){
  if(!a||!b)return false;
  var ca=String(a.code||'').trim(),cb=String(b.code||'').trim();
  if(ca&&cb&&ca===cb)return true;
  return String(a.designation||'').trim().toUpperCase()===String(b.designation||'').trim().toUpperCase();
}

async function qLoadLastBatch(){
  if(!QS.informations.refProduit){toast('Choisir un produit d\'abord');return;}
  try{
    var all=await idbAll();
    var local=all.filter(function(r){
      return String(r.id).indexOf('batch_')===0&&r.id!==QS.id&&Array.isArray(r.matieresPremieres);
    }).map(function(r){r._qSortAt=r.savedAt||0;return r;});
    var server=[];
    try{
      server=(await sipsRecords('quality',{timeoutMs:1800})).map(function(r){
        var p=r.payload||{};
        p._qSortAt=Date.parse(r.validatedAt||r.createdAt||'')||0;
        return p;
      }).filter(function(r){return Array.isArray(r.matieresPremieres);});
    }catch(e){}
    try{
      var pend=await sipsFetch('/api/submissions?status=submitted&type=quality&include=payload',{timeoutMs:1800});
      (pend.submissions||[]).forEach(function(s){
        var p=s.payload||{};
        if(!Array.isArray(p.matieresPremieres))return;
        p._qSortAt=Date.parse(s.createdAt||p.submittedAt||'')||0;
        server.push(p);
      });
    }catch(e){}
    var prev=local.concat(server).sort(function(a,b){return (b._qSortAt||0)-(a._qSortAt||0);});
    if(!prev.length){toast('Aucune fiche precedente avec matieres premieres');return;}
    var filled=0,missing=[];
    for(var i=0;i<QS.matieresPremieres.length;i++){
      var cur=QS.matieresPremieres[i];
      var pmp=null;
      for(var j=0;j<prev.length&&!pmp;j++){
        pmp=(prev[j].matieresPremieres||[]).find(function(x){return qSameMP(x,cur);})||null;
      }
      if(pmp){
        cur.refFournisseur=pmp.refFournisseur||'';
        cur.dateProd=pmp.dateProd||'';
        cur.dateExp=pmp.dateExp||'';
        filled++;
      }else{
        missing.push(cur.designation||cur.code||('MP '+(i+1)));
      }
    }
    renderQualite();
    toast(filled+' MP chargee(s). Verifiez toujours que ce ne sont pas de nouveaux lots avant de valider.');
    if(missing.length)toast('A completer manuellement : '+missing.slice(0,3).join(', ')+(missing.length>3?'...':''));
  }catch(e){toast('Erreur');}
}

/* --- New form --- */
async function qNew(){
  var qHasData=QS.id||QS.informations.refProduit||QS.informations.quantiteProduite||QS.matieresPremieres.length>0||QS.informations.heureDebut;
  if(qHasData&&!confirm('Creer une nouvelle fiche ? Les modifications non enregistrees seront perdues.'))return;
  qClearServerQualityState();
  QS=freshQS();
  QS.informations.numeroLot=await qNextLotNum();
  renderQualite();
  toast('Nouvelle fiche');
}

/* --- JSON Export/Import --- */
async function qExportJSON(){
  try{
    qComputeTimes();
    var lot=QS.informations.numeroLot||'draft';
    var dt=QS.informations.dateProduction||todayStr();
    var mps=clone(QS.matieresPremieres);mps.forEach(function(mp){delete mp.photo;});
    var obj={
      id:QS.id||'batch_'+Date.now(),
      kind:'batch',
      type:'qualite',
      date:dt,
      informations:QS.informations,
      matieresPremieres:mps,
      melanges:QS.melanges,
      visas:QS.visas,
      savedAt:Date.now()
    };
    var jsonStr=JSON.stringify(obj,null,2);
    var fn='qualite_'+lot+'_'+dt+'.txt';
    var file=null;try{file=new File([jsonStr],fn,{type:'text/plain'});}catch(e2){}
    try{
      if(file&&navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
        await navigator.share({files:[file],title:'Fiche qualite '+lot,text:'Fiche qualite lot '+lot+' du '+frDate(dt)+' - a signer et renvoyer'});
        toast('Partage ouvert');return;
      }
    }catch(err){if(err&&err.name==='AbortError')return;}
    var blob=new Blob([jsonStr],{type:'text/plain'});var url=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=url;a.download=fn;document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},1500);
    toast('Fichier enregistre : '+fn);
  }catch(e){toast('Erreur export');}
}
function qImportJSON(text){
  if(!text||!text.trim()){toast('Fichier vide');return;}
  var obj;
  try{obj=JSON.parse(text);}catch(e){toast('Fichier non reconnu (pas un JSON valide)');return;}
  if(!obj.informations&&!obj.type){toast('Ce fichier ne contient pas une fiche qualite');return;}
  if(obj.type==='lep-backup'){toast('Ceci est une sauvegarde complete, pas une fiche qualite. Utilisez Importer dans Accueil.');return;}
  qClearServerQualityState();
  QS.id=obj.id||'';
  QS.informations=obj.informations||freshQS().informations;
  QS.matieresPremieres=obj.matieresPremieres||[];
  QS.matieresPremieres.forEach(function(mp){delete mp.photo;});
  QS.melanges=obj.melanges||[{batchNum:1,heureDebut:'',heureFin:''}];
  QS.visas=qNormalizeVisas(obj.visas);
  renderQualite();
  toast('Fiche qualite importee');
}

/* --- PDF Export --- */
async function qExportPDF(){
  qComputeTimes();
  try{
    await ensurePDF();
    var PDFDocument=PDFLib.PDFDocument;
    var rgb=PDFLib.rgb;
    var doc=await PDFDocument.create();
    var font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    var fontB=await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    var W=595.28,H=841.89;
    var page=doc.addPage([W,H]);
    var y=H-40;
    var lm=40;

    function drawText(txt,x,yy,opts){
      opts=opts||{};
      page.drawText(String(txt),{x:x,y:yy,size:opts.size||10,font:opts.bold?fontB:font,color:opts.color||rgb(0.075,0.125,0.17)});
    }
    function drawLine(x1,yy,x2){
      page.drawLine({start:{x:x1,y:yy},end:{x:x2,y:yy},thickness:0.5,color:rgb(0.8,0.82,0.8)});
    }
    function newPageIfNeeded(need){
      if(y<need){page=doc.addPage([W,H]);y=H-40;}
    }

    /* Header */
    drawText("Hunter's Food — Fiche de Lot",lm,y,{size:16,bold:true});
    y-=18;
    drawText('Suivi Qualite — Production',lm,y,{size:10,color:rgb(0.4,0.45,0.5)});
    y-=20;
    drawLine(lm,y,W-40);y-=16;

    /* Section A: Informations */
    drawText('A — Informations produit',lm,y,{size:12,bold:true});y-=16;
    var infoRows=[
      ['Produit',recipeProductLabel(QS.informations.refProduit)],
      ['Date production',frDate(QS.informations.dateProduction)],
      ['Heure debut',QS.informations.heureDebut||'—'],
      ['Heure fin',QS.informations.heureFin||'—'],
      ['Numero de lot',QS.informations.numeroLot],
      ['Quantite produite',QS.informations.quantiteProduite+' kg'],
      ['Taille batch',QS.informations.tailleBatch+' kg']
    ];
    infoRows.forEach(function(row){
      drawText(row[0]+' :',lm,y,{size:9,bold:true});
      drawText(row[1],lm+140,y,{size:9});
      y-=14;
    });
    y-=8;drawLine(lm,y,W-40);y-=16;

    /* Section B: Matieres Premieres */
    newPageIfNeeded(100);
    drawText('B — Matieres Premieres',lm,y,{size:12,bold:true});y-=16;
    if(QS.matieresPremieres.length){
      var colsB=[lm,lm+20,lm+150,lm+250,lm+350,lm+440];
      drawText('#',colsB[0],y,{size:8,bold:true});
      drawText('Designation',colsB[1],y,{size:8,bold:true});
      drawText('Ref lot fourn.',colsB[2],y,{size:8,bold:true});
      drawText('Date prod.',colsB[3],y,{size:8,bold:true});
      drawText('Date exp.',colsB[4],y,{size:8,bold:true});
      y-=4;drawLine(lm,y,W-40);y-=12;
      QS.matieresPremieres.forEach(function(mp,i){
        newPageIfNeeded(30);
        drawText(String(i+1),colsB[0],y,{size:8});
        var des=mp.designation.length>22?mp.designation.substring(0,22)+'..':mp.designation;
        drawText(des,colsB[1],y,{size:8});
        drawText(mp.refFournisseur||'—',colsB[2],y,{size:8});
        drawText(frDate(mp.dateProd),colsB[3],y,{size:8});
        drawText(frDate(mp.dateExp),colsB[4],y,{size:8});
        y-=13;
      });
    }else{
      drawText('Aucune matiere premiere.',lm,y,{size:9,color:rgb(0.5,0.5,0.5)});y-=14;
    }
    y-=8;drawLine(lm,y,W-40);y-=16;

    /* Section C: Melanges */
    newPageIfNeeded(80);
    drawText('C — Feuille de Melange',lm,y,{size:12,bold:true});y-=16;
    drawText('#',lm,y,{size:8,bold:true});
    drawText('Heure debut',lm+30,y,{size:8,bold:true});
    drawText('Heure fin',lm+130,y,{size:8,bold:true});
    drawText('Duree',lm+230,y,{size:8,bold:true});
    y-=4;drawLine(lm,y,W-40);y-=12;
    QS.melanges.forEach(function(b,i){
      newPageIfNeeded(20);
      drawText(String(i+1),lm,y,{size:8});
      drawText(b.heureDebut||'—',lm+30,y,{size:8});
      drawText(b.heureFin||'—',lm+130,y,{size:8});
      if(b.heureDebut&&b.heureFin){
        var dm=qTimeDiffMin(b.heureDebut,b.heureFin);
        var dh=Math.floor(dm/60);var dmn=dm%60;
        drawText((dh>0?dh+'h':'')+String(dmn).padStart(2,'0')+'min',lm+230,y,{size:8});
      }
      y-=13;
    });
    var avgTxt=qAvgBatchTime();
    if(avgTxt){y-=4;drawText('Temps moyen par batch : '+avgTxt,lm,y,{size:8,bold:true});y-=14;}
    y-=8;drawLine(lm,y,W-40);y-=16;

    /* Section D: Visas */
    newPageIfNeeded(120);
    drawText('D — Visas / Signatures',lm,y,{size:12,bold:true});y-=16;
    var visaRoles=[['operateur','Operateur'],['responsableProd','Chef d usine'],['responsableQualite','Responsable qualite']];
    for(var vi=0;vi<visaRoles.length;vi++){
      newPageIfNeeded(60);
      var vk=visaRoles[vi][0],vl=visaRoles[vi][1];
      var vv=QS.visas[vk];
      drawText(vl,lm,y,{size:9,bold:true});y-=12;
      drawText('Nom : '+(vv.nom||'—'),lm+10,y,{size:8});y-=12;
      if(vv.signature){
        try{
          var sigImg=await doc.embedPng(vv.signature);
          var dims=sigImg.scale(0.5);
          if(dims.width>200){var sc=200/dims.width;dims={width:200,height:dims.height*sc};}
          newPageIfNeeded(dims.height+20);
          page.drawImage(sigImg,{x:lm+10,y:y-dims.height,width:dims.width,height:dims.height});
          y-=dims.height+4;
        }catch(sigErr){
          drawText('[Signature]',lm+10,y,{size:8,color:rgb(0.5,0.5,0.5)});y-=12;
        }
      }else{
        drawText('[Pas de signature]',lm+10,y,{size:8,color:rgb(0.5,0.5,0.5)});y-=12;
      }
      drawText('Date : '+(vv.date||'—'),lm+10,y,{size:8});y-=16;
    }

    var pdfBytes=await doc.save();
    var blob=new Blob([pdfBytes],{type:'application/pdf'});
    var fn='fiche-lot-'+(QS.informations.numeroLot||'draft')+'.pdf';
    var file=new File([blob],fn,{type:'application/pdf'});
    try{
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        navigator.share({files:[file],title:'Fiche de lot'}).catch(function(){});return;
      }
    }catch(e){}
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=url;a.download=fn;document.body.appendChild(a);a.click();
    setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},200);
    toast('PDF genere');
  }catch(e){toast('Erreur PDF : '+e.message);console.error(e);}
}
