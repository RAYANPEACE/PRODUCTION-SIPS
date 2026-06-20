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
var QSERVER_RECORDS=[];
var _qSigPads={};

function qIsMP(code){
  if(!code)return true;
  var r=REFS.find(function(x){return x.code===code;});
  if(!r)return true;
  if(r.cat==='mp')return true;
  return false;
}

function qMPsFromRecipe(produit){
  var recipe=RECF[produit];
  if(!recipe)return [];
  return recipe.filter(function(ing){return qIsMP(ing.code);}).map(function(ing){
    return {designation:ing.des,code:ing.code||'',refFournisseur:'',dateProd:'',dateExp:''};
  });
}

async function qNextLotNum(){
  try{
    var all=await idbAll();
    var max=0;
    all.forEach(function(r){
      if(String(r.id).indexOf('batch_')===0&&r.informations&&r.informations.numeroLot){
        var m=r.informations.numeroLot.match(/LOT-(\d+)/);
        if(m){var n=parseInt(m[1],10);if(n>max)max=n;}
      }
    });
    var next=max+1;
    return 'LOT-'+String(next).padStart(3,'0');
  }catch(e){return 'LOT-001';}
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
function qSignerName(){
  return SESSION?(SESSION.nom||''):(USR&&USR.nom)||'';
}
function qApplyAccountVisaNames(){
  ['operateur','responsableProd','responsableQualite'].forEach(function(role){
    if(qCanSignRole(role)){
      var name=qSignerName();
      if(name)QS.visas[role].nom=name;
    }
  });
}

/* --- Signature pad --- */
function qInitSigPad(canvasId,role,editable){
  var cv=document.getElementById(canvasId);
  if(!cv)return;
  /* Fix 4: scale canvas internal resolution to match CSS display size */
  var dispW=cv.offsetWidth||400;
  var dispH=cv.offsetHeight||100;
  cv.width=dispW;
  cv.height=dispH;
  var ctx=cv.getContext('2d');
  var drawing=false;
  function pos(e){
    var rect=cv.getBoundingClientRect();
    var t=e.touches?e.touches[0]:e;
    return {x:(t.clientX-rect.left)*(cv.width/rect.width),y:(t.clientY-rect.top)*(cv.height/rect.height)};
  }
  if(editable){
    function start(e){
      e.preventDefault();drawing=true;
      var name=qSignerName();if(name)QS.visas[role].nom=name;
      var p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);
    }
    function move(e){
      if(!drawing)return;e.preventDefault();
      var p=pos(e);ctx.lineWidth=2;ctx.lineCap='round';ctx.strokeStyle='#13202b';
      ctx.lineTo(p.x,p.y);ctx.stroke();
    }
    function end(){
      if(!drawing)return;drawing=false;
      QS.visas[role].signature=cv.toDataURL();
      if(!QS.visas[role].date)QS.visas[role].date=todayStr()+' '+qNowTime();
      var tsEl=document.getElementById('qSigTs_'+role);
      if(tsEl)tsEl.textContent=QS.visas[role].date;
    }
    cv.addEventListener('pointerdown',start);
    cv.addEventListener('pointermove',move);
    cv.addEventListener('pointerup',end);
    cv.addEventListener('pointerleave',end);
  }
  _qSigPads[role]={canvas:cv,ctx:ctx,clear:function(){
    ctx.clearRect(0,0,cv.width,cv.height);
    QS.visas[role].signature='';QS.visas[role].date='';
    var tsEl=document.getElementById('qSigTs_'+role);
    if(tsEl)tsEl.textContent='';
  }};
  if(QS.visas[role].signature){
    var img=new Image();img.onload=function(){ctx.drawImage(img,0,0,cv.width,cv.height);};
    img.src=QS.visas[role].signature;
  }
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
  if(QS_SERVER_VIEW)h+='<p class="ref-hint" style="background:#eef4fb;border:1px solid #d6e4f2;border-radius:8px;padding:8px 10px">Consultation officielle serveur : lecture seule. Utilisez PDF pour exporter, ou Nouvelle fiche pour reprendre la saisie locale.</p>';

  /* Section A: Informations */
  h+='<div class="q-sec open" id="qSecA"><div class="q-sec-h" onclick="this.parentElement.classList.toggle(\'open\')"><h3>A — Informations produit</h3><span class="chev">▸</span></div>';
  h+='<div class="q-sec-body">';
  h+='<div class="q-field"><label>Produit<small>Choisir la reference</small></label>';
  h+='<select id="qRefProd" onchange="qOnProdChange(this.value)">';
  h+='<option value="">— Choisir —</option>';
  var prods=Object.keys(RECF);
  prods.forEach(function(p){h+='<option value="'+esc(p)+'"'+(QS.informations.refProduit===p?' selected':'')+'>'+esc(p)+'</option>';});
  h+='</select></div>';
  h+='<div class="q-field"><label>Date de production</label><input type="date" id="qDateProd" value="'+esc(QS.informations.dateProduction)+'" onchange="QS.informations.dateProduction=this.value"></div>';
  h+='<div class="q-field"><label>Heure debut<small>Auto (1er batch)</small></label><input type="text" id="qHDeb" value="'+esc(QS.informations.heureDebut)+'" readonly></div>';
  h+='<div class="q-field"><label>Heure fin<small>Auto (dernier batch)</small></label><input type="text" id="qHFin" value="'+esc(QS.informations.heureFin)+'" readonly></div>';
  h+='<div class="q-field"><label>Numero de lot<small>Auto-incremente</small></label><input type="text" id="qLot" value="'+esc(QS.informations.numeroLot)+'" readonly></div>';
  h+='<div class="q-field"><label>Quantite produite (kg)<small>Batches x taille</small></label><input type="text" id="qQte" value="'+QS.informations.quantiteProduite+'" readonly></div>';
  var isCafe=QS.informations.refProduit&&QS.informations.refProduit.toUpperCase().indexOf('CAFE AU LAIT')!==-1;
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
  h+='<button class="q-add" style="border-color:#c5e4d2;color:var(--green);background:#eef8f1;margin-top:6px" onclick="qLoadLastBatch()">Charger la derniere fiche (memes MP)</button>';
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
  var roles=[['operateur','Operateur'],['responsableProd','Responsable production'],['responsableQualite','Responsable qualite']];
  roles.forEach(function(rr){
    var key=rr[0],label=rr[1];
    var v=QS.visas[key];
    var isMine=qCanSignRole(key);
    var lockName=!!SESSION||!isMine;
    h+='<div class="q-sig-block'+(isMine?'':' q-sig-locked')+'">';
    h+='<div class="q-sig-title">'+esc(label)+(key==='operateur'?' <span style="color:var(--red);font-size:11px">(obligatoire)</span>':'');
    if(!isMine)h+=' <span style="color:var(--mute);font-size:10px;font-style:italic">(lecture seule)</span>';
    else if(SESSION)h+=' <span style="color:var(--green);font-size:10px;font-style:italic">(compte connecte)</span>';
    h+='</div>';
    h+='<input class="q-sig-nom" type="text" id="qSigNom_'+key+'" value="'+esc(v.nom)+'" placeholder="Nom"'+(lockName?' readonly style="background:#eef2f6;color:var(--mute)"':' oninput="QS.visas.'+key+'.nom=this.value"')+'>';
    h+='<canvas class="q-sig-canvas" id="qSigCv_'+key+'" width="400" height="100"'+(isMine?'':' style="pointer-events:none;opacity:0.6"')+'></canvas>';
    if(isMine){h+='<button class="q-sig-clear" onclick="qClearSig(\''+key+'\')">Effacer</button>';}
    h+='<div class="q-sig-ts" id="qSigTs_'+key+'">'+esc(v.date)+'</div>';
    h+='</div>';
  });
  h+='</div></div>';

  /* Actions */
  h+='<div class="q-actions">';
  if(!QS_SERVER_VIEW){
    h+='<button class="q-save" onclick="qSubmitServer()">Soumettre au serveur</button>';
    h+='<button class="q-save" onclick="qSave()">Enregistrer localement</button>';
  }
  h+='<button class="q-pdf" onclick="qExportPDF()">PDF</button>';
  if(!QS_SERVER_VIEW){
    h+='<button class="q-json" onclick="qExportJSON()">Secours fichier signature</button>';
    h+='<button class="q-import-json" id="qPasteBtn">Coller fiche de secours</button>';
  }
  h+='<button class="q-new" onclick="qNew()">Nouvelle fiche</button>';
  h+='</div>';

  /* History */
  h+='<div style="margin-top:20px"><h3 style="font-size:14px;font-weight:700;margin-bottom:8px">Historique des fiches</h3>';
  h+='<div id="qHistList"></div></div>';

  h+='</div>';
  app.innerHTML=h;
  if(QS_SERVER_VIEW){
    app.querySelectorAll('input,select,textarea,button.q-add,button.q-rm,button.q-now,button.q-sig-clear').forEach(function(el){el.disabled=true;});
  }

  /* Init sig pads */
  roles.forEach(function(rr){qInitSigPad('qSigCv_'+rr[0],rr[0],!QS_SERVER_VIEW&&myRole===rr[0]);});
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
    if(val.toUpperCase().indexOf('CAFE AU LAIT')!==-1){
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
      var sameProductDate=r.informations.refProduit===QS.informations.refProduit&&r.informations.dateProduction===QS.informations.dateProduction;
      return sameLot||sameProductDate;
    })||null;
  }catch(e){}
  if(duplicate){
    var di=duplicate.informations||{};
    toast('Fiche qualite deja enregistree : '+(di.refProduit||'produit')+' '+frDate(di.dateProduction||duplicate.date||''));
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
  const payload={id:QS.id||'batch_draft_'+Date.now(),date:QS.informations.dateProduction||todayStr(),informations:clone(QS.informations),matieresPremieres:clone(QS.matieresPremieres),melanges:clone(QS.melanges),visas:clone(QS.visas),submittedAt:new Date().toISOString()};
  await sipsSubmit('quality',payload,'Fiche qualite '+(QS.informations.numeroLot||''));
}

/* --- History --- */
async function qLoadHist(){
  var list=$('#qHistList');if(!list)return;
  try{
    QSERVER_RECORDS=(await sipsRecords('quality')).sort(function(a,b){return String(b.validatedAt||'').localeCompare(String(a.validatedAt||''));});
    var all=await idbAll();
    var batches=all.filter(function(r){return String(r.id).indexOf('batch_')===0;}).sort(function(a,b){return (b.savedAt||0)-(a.savedAt||0);});
    var htm='';
    if(QSERVER_RECORDS.length){
      htm+='<div style="font-size:12px;font-weight:800;color:var(--green);margin:0 0 6px;text-transform:uppercase">Validees serveur</div>';
      QSERVER_RECORDS.forEach(function(r,idx){
        var b=r.payload||{},info=b.informations||{},visas=b.visas||{};
        var sigs=['operateur','responsableQualite'].filter(function(k){return visas[k]&&visas[k].signature;}).length;
        htm+='<div class="q-hist-item">';
        htm+='<div class="info"><b>'+esc(info.refProduit||'—')+'</b>';
        htm+='<span>'+esc(info.numeroLot||'')+' — '+frDate(b.date||info.dateProduction||'')+' — '+sigs+'/2 signature(s) obligatoires — officielle serveur</span></div>';
        htm+='<button onclick="qLoadServerBatch('+idx+')">Voir</button>';
        htm+='</div>';
      });
    }
    if(batches.length){
      htm+='<div style="font-size:12px;font-weight:800;color:var(--steel-d);margin:'+(QSERVER_RECORDS.length?'10px':'0')+' 0 6px;text-transform:uppercase">Historique local</div>';
    }
    batches.forEach(function(b){
      var info=b.informations||{};
      var visas=b.visas||{};
      var sigs=['operateur','responsableQualite'].filter(function(k){return visas[k]&&visas[k].signature;}).length;
      htm+='<div class="q-hist-item">';
      htm+='<div class="info"><b>'+esc(info.refProduit||'—')+'</b>';
      htm+='<span>'+esc(info.numeroLot||'')+' — '+frDate(b.date)+' — '+sigs+'/2 signature(s) obligatoires</span></div>';
      htm+='<button onclick="qLoadBatch(\''+esc(b.id)+'\')">Voir</button>';
      htm+='<button class="del" onclick="qDelBatch(\''+esc(b.id)+'\')">Suppr</button>';
      htm+='</div>';
    });
    list.innerHTML=htm||'<p style="color:var(--mute);font-size:13px">Aucune fiche enregistree.</p>';
  }catch(e){list.innerHTML='<p style="color:var(--red)">Erreur chargement</p>';}
}

async function qLoadBatch(id){
  try{
    var rec=await idbGet(id);
    if(!rec){toast('Fiche introuvable');return;}
    QS_SERVER_VIEW=false;
    QS.id=rec.id;
    QS.informations=rec.informations||freshQS().informations;
    QS.matieresPremieres=rec.matieresPremieres||[];
    QS.melanges=rec.melanges||[{batchNum:1,heureDebut:'',heureFin:''}];
    QS.visas=rec.visas||freshQS().visas;
    renderQualite();
    toast('Fiche chargee');
    window.scrollTo(0,0);
  }catch(e){toast('Erreur chargement');}
}

async function qLoadServerBatch(idx){
  var row=QSERVER_RECORDS[idx];
  if(!row||!row.payload){toast('Fiche serveur introuvable');return;}
  var rec=row.payload;
  QS_SERVER_VIEW=true;
  QS.id='';
  QS.informations=rec.informations||freshQS().informations;
  QS.matieresPremieres=rec.matieresPremieres||[];
  QS.melanges=rec.melanges||[{batchNum:1,heureDebut:'',heureFin:''}];
  QS.visas=rec.visas||freshQS().visas;
  renderQualite();
  toast('Fiche serveur chargee');
  window.scrollTo(0,0);
}

async function qDelBatch(id){
  if(!confirm('Supprimer cette fiche ?'))return;
  await idbDel(id);
  toast('Fiche supprimee');
  qLoadHist();
}

/* --- Load last batch (same product) --- */
async function qLoadLastBatch(){
  if(!QS.informations.refProduit){toast('Choisir un produit d\'abord');return;}
  try{
    var all=await idbAll();
    var same=all.filter(function(r){
      return String(r.id).indexOf('batch_')===0&&r.informations&&r.informations.refProduit===QS.informations.refProduit;
    }).sort(function(a,b){return (b.savedAt||0)-(a.savedAt||0);});
    if(!same.length){toast('Aucune fiche precedente pour ce produit');return;}
    var prev=same[0];
    if(prev.matieresPremieres){
      for(var i=0;i<QS.matieresPremieres.length;i++){
        var pmp=prev.matieresPremieres.find(function(x){return x.code===QS.matieresPremieres[i].code&&x.designation===QS.matieresPremieres[i].designation;});
        if(pmp){
          QS.matieresPremieres[i].refFournisseur=pmp.refFournisseur||'';
          QS.matieresPremieres[i].dateProd=pmp.dateProd||'';
          QS.matieresPremieres[i].dateExp=pmp.dateExp||'';
        }
      }
    }
    renderQualite();
    toast('Donnees MP chargees depuis la derniere fiche');
  }catch(e){toast('Erreur');}
}

/* --- New form --- */
async function qNew(){
  var qHasData=QS.id||QS.informations.refProduit||QS.informations.quantiteProduite||QS.matieresPremieres.length>0||QS.informations.heureDebut;
  if(qHasData&&!confirm('Creer une nouvelle fiche ? Les modifications non enregistrees seront perdues.'))return;
  QS_SERVER_VIEW=false;
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
  QS_SERVER_VIEW=false;
  QS.id=obj.id||'';
  QS.informations=obj.informations||freshQS().informations;
  QS.matieresPremieres=obj.matieresPremieres||[];
  QS.matieresPremieres.forEach(function(mp){delete mp.photo;});
  QS.melanges=obj.melanges||[{batchNum:1,heureDebut:'',heureFin:''}];
  QS.visas=obj.visas||freshQS().visas;
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
      ['Produit',QS.informations.refProduit],
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
    var visaRoles=[['operateur','Operateur'],['responsableProd','Responsable production'],['responsableQualite','Responsable qualite']];
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
