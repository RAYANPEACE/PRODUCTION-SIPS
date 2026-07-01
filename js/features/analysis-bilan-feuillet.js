/* ================= MODULE ANALYSES ================= */
const FR_MOIS=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
function moisKey(d){return String(d||'').slice(0,7);}
function moisLabel(k){const m=k.split('-');if(m.length<2)return k;return FR_MOIS[(+m[1])-1]+' '+m[0];}
function barRow(label,val,max,unit,color){const w=max>0?Math.round(val/max*100):0;return '<div class="an-bar"><div class="an-bl">'+esc(label)+'</div><div class="an-row2"><div class="an-bt"><div class="an-bf" style="width:'+w+'%'+(color?';background:'+color:'')+'"></div></div><div class="an-bv">'+fmt(Math.round(val*100)/100)+(unit?' '+unit:'')+'</div></div></div>';}
function groupOf(code){return (REFS.find(x=>x.code===code)||{}).g||'divers';}
function groupLabel(g){return (GROUPS.find(x=>x[0]===g)||[null,g])[1];}
const GRP_COL={pf_cart:'#1b5faa',pf_sac:'#1b5faa',cart_vide:'#b5791f',film:'#1f7a8c',vrac:'#1b5faa',tare:'#7a4f9e',plast:'#1f7a4d',divers:'#6a7280'};
const DCH_COL={carton:'#b5791f',sac:'#1b5faa',film:'#1f7a8c',mel:'#7a4f9e',scotch:'#59636e'};
let ANPER='3';
function dateMonthsAgo(n){const d=new Date();d.setMonth(d.getMonth()-n);const p=x=>(x<10?'0':'')+x;return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}
function analyseSig(type,p){
  p=p||{};
  if(type==='production')return localSig('an-prod',{date:p.date||'',agent:p.agent||'',blocks:typeof migrateProdRec==='function'?migrateProdRec(p):(p.blocks||[]),note:p.note||''});
  if(type==='sortie'||type==='entree')return localSig('an-'+type,{date:p.date||'',ref:p.ref||'',finis:p.finis||[],mp:p.mp||[],note:p.note||''});
  if(type==='quality')return localSig('an-quality',{date:p.date||'',informations:p.informations||{},matieresPremieres:p.matieresPremieres||[],melanges:p.melanges||[]});
  if(type==='inventory')return localSig('an-inv',{date:p.date||'',detail:p.detail||null,st:p.st&&p.st.c?p.st.c:null});
  return localSig('an-'+type,p);
}
function analyseProdBlocks(r){
  return typeof migrateProdRec==='function'?migrateProdRec(r||{}):((r&&r.blocks)||[]);
}
async function analyseLoadData(){
  let local=[];try{local=await idbAll();}catch(e){}
  const out={
    prod:local.filter(r=>String(r.id).indexOf('prod_')===0),
    sort:local.filter(r=>String(r.id).indexOf('sortie_')===0),
    entr:local.filter(r=>String(r.id).indexOf('entree_')===0),
    qual:local.filter(r=>String(r.id).indexOf('batch_')===0),
    inv:local.filter(r=>r&&r.st&&r.id!=='current'&&String(r.id).indexOf('fragsess_')!==0&&String(r.id).indexOf('prod_')!==0&&String(r.id).indexOf('sortie_')!==0&&String(r.id).indexOf('entree_')!==0&&String(r.id).indexOf('batch_')!==0)
  };
  async function addServer(type,key,shape){
    try{
      (await sipsRecords(type,{timeoutMs:1600})).forEach(r=>{
        const p=shape?shape(r):(r&&r.payload||{});
        if(p)out[key].push(p);
      });
    }catch(e){}
  }
  await addServer('production','prod');
  await addServer('sortie','sort');
  await addServer('entree','entr');
  await addServer('quality','qual');
  await addServer('inventory','inv',r=>{const p=r&&r.payload||{};return Object.assign({id:r&&r.id},p,{savedAt:Date.parse(r.validatedAt||r.createdAt||'')||0});});
  ['prod','sort','entr','qual','inv'].forEach(key=>{
    const type={prod:'production',sort:'sortie',entr:'entree',qual:'quality',inv:'inventory'}[key];
    const seen={};
    out[key]=out[key].filter(p=>{const sig=analyseSig(type,p);if(seen[sig])return false;seen[sig]=1;return true;});
  });
  out.recs=out.inv;
  return out;
}
async function renderAnalyse(){
  const app=$('#app');
  app.innerHTML='<div class="prod-wrap"><h2 class="prod-title">Analyses <span style="font-size:12px;color:#6a7280;font-weight:400">(admin)</span></h2><div id="anBody">Chargement…</div></div>';
  const src=await analyseLoadData();
  const recs=src.recs,prod=src.prod,sort=src.sort,entr=src.entr,qual=src.qual;
  // agrégats déchets + production par mois
  const dech={};const prodByProd={};const prodMonths={},batchMonths={},batchByProd={};
  qual.forEach(r=>{
    const info=r.informations||{},prod=productCodeOf(info.refProduit||r.refProduit||''),k=moisKey(info.dateProduction||r.date);
    const n=((r.melanges||[]).filter(b=>b&&(b.heureDebut||b.heureFin||b.batchNum))).length;
    if(k&&n>0)batchMonths[k]=(batchMonths[k]||0)+n;
    if(prod&&n>0)batchByProd[prod]=(batchByProd[prod]||0)+n;
  });
  prod.forEach(r=>{const k=moisKey(r.date);dech[k]=dech[k]||{carton:0,sac:0,film:0,mel:0,scotch:0};
    analyseProdBlocks(r).forEach(b=>{const emb=embType(b.p);
      if(emb==='sac')dech[k].sac+=num(b.w_emb);else dech[k].carton+=num(b.w_emb);
      dech[k].film+=num(b.w_film);dech[k].mel+=num(b.w_mel);dech[k].scotch+=num(b.scotch);
      if(b.p&&num(b.n)>0){prodByProd[b.p]=(prodByProd[b.p]||0)+num(b.n);prodMonths[k]=prodMonths[k]||{};prodMonths[k][b.p]=(prodMonths[k][b.p]||0)+num(b.n);}
    });});
  // mouvements par mois
  const mov={};
  const addMov=(arr,key)=>arr.forEach(r=>{const k=moisKey(r.date);mov[k]=mov[k]||{eF:0,eM:0,sF:0,sM:0};
    const f=(r.finis||[]).reduce((s,x)=>s+(x.a?num(x.q):0),0);const m=(r.mp||[]).reduce((s,x)=>s+(x.a?num(x.q):0),0);
    if(key==='e'){mov[k].eF+=f;mov[k].eM+=m;}else{mov[k].sF+=f;mov[k].sM+=m;}});
  addMov(entr,'e');addMov(sort,'s');
  const months=Array.from(new Set([].concat(Object.keys(dech),Object.keys(mov),Object.keys(prodMonths),Object.keys(batchMonths)))).filter(Boolean).sort().reverse().slice(0,12);
  let h='';
  if(!months.length){h='<div class="placeholder">Pas encore de données. Enregistre des productions, sorties ou entrées pour voir leur évolution ici.</div>';$('#anBody').innerHTML=h;return;}
  h+='<div class="an-note" style="margin-bottom:10px">Données détectées : '+prod.length+' production(s), '+sort.length+' sortie(s), '+entr.length+' entrée(s), '+qual.length+' fiche(s) qualité, '+recs.length+' inventaire(s).</div>';
  // ===== Sections par période (3 / 6 / 12 mois) =====
  const cut=dateMonthsAgo(+ANPER);
  const wProd=prod.filter(r=>String(r.date)>=cut);
  const conso={},prodW={},dW={carton:0,sac:0,film:0,mel:0,scotch:0},prodUnits={carton:0,sac:0};
  wProd.forEach(r=>{analyseProdBlocks(r).forEach(b=>{const n=num(b.n);const emb=embType(b.p);
    if(emb==='sac')dW.sac+=num(b.w_emb);else dW.carton+=num(b.w_emb);
    dW.film+=num(b.w_film);dW.mel+=num(b.w_mel);dW.scotch+=num(b.scotch);
    if(b.p&&n>0){const pc=typeof productCodeOf==='function'?productCodeOf(b.p):b.p;prodW[pc]=(prodW[pc]||0)+n;if(emb==='sac')prodUnits.sac+=n;else prodUnits.carton+=n;
      (typeof recipeForProduct==='function'?recipeForProduct(b.p):(RECF[b.p]||[])).forEach(m=>{const k=m.des||m.code;conso[k]=conso[k]||{q:0,code:m.code};conso[k].q+=n*num(m.qte);});}
  });});
  const perOpts=[['3','3 derniers mois'],['6','6 derniers mois'],['12','12 derniers mois']].map(o=>'<option value="'+o[0]+'"'+(ANPER===o[0]?' selected':'')+'>'+o[1]+'</option>').join('');
  h+='<div class="an-period"><label>Période</label><select id="anPer">'+perOpts+'</select></div>';
  // Consommation de matières estimée
  const consoByGrp={};const nMois=+ANPER||3;
  Object.keys(conso).forEach(k=>{const code=conso[k].code;const g=groupOf(code);(consoByGrp[g]=consoByGrp[g]||[]).push({nom:k,q:conso[k].q,code:code});});
  if(Object.keys(consoByGrp).length){
    h+='<div class="pf-sec"><div class="pf-h">Consommation mensuelle moyenne</div>';
    GROUPS.forEach(gr=>{const g=gr[0];const arr=consoByGrp[g];if(!arr||!arr.length)return;
      arr.sort((a,b)=>b.q-a.q);const mx=Math.max(1,...arr.map(x=>x.q/nMois));const col=GRP_COL[g]||'#1b5faa';
      h+='<div class="an-grp">'+esc(groupLabel(g))+'</div><div class="an-bars">';
      arr.forEach(x=>{const r=REFS.find(z=>z.code===x.code);const moy=x.q/nMois;h+=barRow(x.nom,Math.round(moy*100)/100,mx,(r?r.u:'')+'/mois',col);});
      h+='</div>';});
    h+='<div class="an-note">Moyenne par mois = consommation des '+ANPER+' derniers mois ÷ '+ANPER+' (recettes × productions). Jauges relatives au max de chaque groupe → comparables entre matières d\u2019un même groupe (ex. arômes entre eux).</div></div>';
  }
  // Répartition de la production
  const prodWArr=Object.keys(prodW).map(p=>[p,prodW[p]]).sort((a,b)=>b[1]-a[1]);
  if(prodWArr.length){const totP=prodWArr.reduce((s,e)=>s+e[1],0);const maxPW=Math.max(1,...prodWArr.map(e=>e[1]));
    h+='<div class="pf-sec"><div class="pf-h">Répartition de la production</div><div class="an-bars">';
    prodWArr.forEach(e=>{const pc=totP?Math.round(e[1]/totP*100):0;h+=barRow(prodName(e[0])+' ('+pc+'%)',e[1],maxPW,'u');});
    h+='</div></div>';
  }
  const batchArr=Object.keys(batchByProd).map(p=>[p,batchByProd[p]]).sort((a,b)=>b[1]-a[1]);
  if(batchArr.length){const totalB=batchArr.reduce((s,e)=>s+e[1],0),maxB=Math.max(1,...batchArr.map(e=>e[1]));
    h+='<div class="pf-sec"><div class="pf-h">Batches réalisés</div><div class="an-tiles">'
      +'<div class="an-tile"><div class="at-lbl">Total</div><div class="at-val" style="color:var(--ink)">'+fmt(totalB)+'</div><div class="at-sub">batch(es) sur la période</div></div></div><div class="an-bars">';
    batchArr.forEach(e=>{h+=barRow(prodName(e[0]),e[1],maxB,'batch(es)','#1f7a4d');});
    h+='</div></div>';
  }
  // Taux de déchets — tuiles mises en valeur
  if(wProd.length){
    const txC=prodUnits.carton>0?Math.round(dW.carton/prodUnits.carton*1000)/10:null;
    const txF=prodUnits.carton>0?Math.round(dW.film/prodUnits.carton*1000)/10:null;
    const txS=prodUnits.sac>0?Math.round(dW.sac/prodUnits.sac*1000)/10:null;
    const txCol=t=>t==null?'var(--mute)':(t<1?'var(--green)':(t<=3?'var(--amber)':'var(--red)'));
    const tile=(lbl,val,col,sub)=>'<div class="an-tile"><div class="at-lbl">'+lbl+'</div><div class="at-val" style="color:'+col+'">'+val+'</div><div class="at-sub">'+sub+'</div></div>';
    h+='<div class="pf-sec"><div class="pf-h">Déchets & taux</div><div class="an-tiles">'
      +tile('Carton',txC==null?'—':txC+'%',txCol(txC),fmt(dW.carton)+' déchet / '+fmt(prodUnits.carton)+' prod.')
      +tile('Film',txF==null?'—':txF+'%',txCol(txF),fmt(dW.film)+' déchet / '+fmt(prodUnits.carton)+' cart.')
      +tile('Sac',txS==null?'—':txS+'%',txCol(txS),fmt(dW.sac)+' déchet / '+fmt(prodUnits.sac)+' prod.')
      +tile('Mélange',fmt(dW.mel)+' kg','var(--ink)','perdu sur la période')
      +tile('Scotch',fmt(dW.scotch),'var(--ink)','bobine(s) sur la période')
      +'</div><div class="an-note">Taux = déchets ÷ unités produites sur la période (indicatif). Vert &lt; 1 % · orange 1–3 % · rouge &gt; 3 %.</div></div>';
  }
  const wasteDetail={};
  wProd.forEach(r=>analyseProdBlocks(r).forEach(b=>{
    prodBlockWasteDetails(b).forEach(x=>{
      const k=x.kind+'|'+x.code;
      if(!wasteDetail[k])wasteDetail[k]=Object.assign({},x,{qty:0});
      wasteDetail[k].qty+=num(x.qty);
    });
  }));
  const wasteArr=Object.keys(wasteDetail).map(k=>wasteDetail[k]).sort((a,b)=>String(a.code).localeCompare(String(b.code),'fr',{numeric:true}));
  if(wasteArr.length){
    const maxD=Math.max(1,...wasteArr.map(x=>x.qty));
    h+='<div class="pf-sec"><div class="pf-h">Détail déchets par produit fini et référence</div><div class="an-bars">';
    wasteArr.forEach(x=>{h+=barRow(refName(x.code),x.qty,maxD,'',DCH_COL[x.kind]||'#59636e');});
    h+='<div class="an-note">Cartons, sacs et films sont ventilés sur la référence de recette du produit fini. Le mélange reste suivi globalement.</div></div></div>';
  }
  // ===== Évolution mensuelle (12 derniers mois) =====
  // Déchets — jauge par catégorie dans chaque cellule (relative au max de sa colonne)
  h+='<div class="pf-sec"><div class="pf-h">Déchets de production par mois</div>';
  const dcats=[['carton','Carton'],['sac','Sac'],['film','Film'],['mel','Mélange'],['scotch','Scotch']];
  const colMax={};dcats.forEach(c=>{colMax[c[0]]=Math.max(1,...months.map(m=>(dech[m]||{})[c[0]]||0));});
  h+='<table class="an-tbl andech"><thead><tr><th>Mois</th>'+dcats.map(c=>'<th>'+c[1]+'</th>').join('')+'</tr></thead><tbody>';
  months.forEach(m=>{const d=dech[m]||{};h+='<tr><td>'+moisLabel(m)+'</td>'+dcats.map(c=>{const k=c[0];const v=d[k]||0;const w=Math.round(v/colMax[k]*100);
    return '<td><div class="dc-cell"><span class="dc-v">'+fmt(v)+'</span><div class="dc-bar"><div class="dc-fill" style="width:'+w+'%;background:'+DCH_COL[k]+'"></div></div></div></td>';}).join('')+'</tr>';});
  h+='</tbody></table><div class="an-note">Jauge par catégorie, relative au maximum de sa propre colonne sur la période. Une baisse mois après mois = amélioration.</div></div>';
  // Entrées / Sorties — détail par article sur la période
  const wSort=sort.filter(r=>String(r.date)>=cut),wEntr=entr.filter(r=>String(r.date)>=cut);
  const sF={},sM={},eF={},eM={};
  const agg=(arr,fo,mo)=>arr.forEach(r=>{(r.finis||[]).forEach(x=>{if(x.a&&num(x.q)>0)fo[x.a]=(fo[x.a]||0)+num(x.q);});(r.mp||[]).forEach(x=>{if(x.a&&num(x.q)>0)mo[x.a]=(mo[x.a]||0)+num(x.q);});});
  agg(wSort,sF,sM);agg(wEntr,eF,eM);
  const topList=(obj,title,col)=>{const arr=Object.keys(obj).map(k=>[k,obj[k]]).sort((a,b)=>b[1]-a[1]);if(!arr.length)return '';const mx=Math.max(1,...arr.map(e=>e[1]));let s='<div class="an-grp">'+title+'</div><div class="an-bars">';arr.forEach(e=>{const r=REFS.find(z=>z.des===e[0]);s+=barRow(e[0],e[1],mx,r?r.u:'',col);});s+='</div>';return s;};
  const sortHtml=topList(sF,'Produits finis sortis','#b0455a')+topList(sM,'Matières / échantillons sortis','#b0455a');
  h+='<div class="pf-sec"><div class="pf-h">Sorties par article</div>'+(sortHtml||'<div class="an-note">Aucune sortie sur la période.</div>')+'<div class="an-note">Quel produit / quelle matière sort le plus sur les '+ANPER+' derniers mois.</div></div>';
  const entrHtml=topList(eM,'Matières premières reçues','#1f7a4d')+topList(eF,'Produits finis (retours)','#1f7a4d');
  h+='<div class="pf-sec"><div class="pf-h">Entrées par article</div>'+(entrHtml||'<div class="an-note">Aucune entrée sur la période.</div>')+'<div class="an-note">Quelle matière entre le plus sur les '+ANPER+' derniers mois.</div></div>';
  // Réconciliation entre deux inventaires (physique départ + flux → théorique attendu vs physique réel)
  const invD=recs.filter(r=>r.detail&&Object.keys(r.detail).length&&r.id!=='current').sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
  if(invD.length>=2){
    const opt=sel=>invD.map(r=>'<option value="'+esc(r.id)+'"'+(r.id===sel?' selected':'')+'>'+frDate(r.date)+'</option>').join('');
    h+='<div class="pf-sec"><div class="pf-h">Réconciliation entre deux inventaires</div>'
      +'<div class="cmp-sel"><select id="cmpA">'+opt(invD[1].id)+'</select><span>→</span><select id="cmpB">'+opt(invD[0].id)+'</select></div>'
      +'<div id="cmpBox"></div></div>';
  }
  $('#anBody').innerHTML=h;
  const ps=$('#anPer');if(ps)ps.onchange=e=>{ANPER=e.target.value;renderAnalyse();};
  if(invD.length>=2){
    const byId={};invD.forEach(r=>byId[r.id]=r);
    const desToCode={};REFS.forEach(r=>{desToCode[r.code]=r.code;desToCode[r.des]=r.code;});
    const drawRecon=()=>{
      let a=byId[$('#cmpA').value],b=byId[$('#cmpB').value];if(!a||!b)return;
      // a = départ (le plus ancien), b = arrivée (le plus récent)
      if(String(a.date)>String(b.date)){const t=a;a=b;b=t;}
      const lo=String(a.date),hi=String(b.date);const inWin=r=>{const d=String(r.date);return d>lo&&d<=hi;};
      const prodAdd={},conso={},entrA={},sortA={};
      prod.filter(inWin).forEach(r=>analyseProdBlocks(r).forEach(bk=>{const n=num(bk.n);if(!bk.p||n<=0)return;
        const code=desToCode[bk.p];if(code)prodAdd[code]=(prodAdd[code]||0)+n;
        (typeof recipeForProduct==='function'?recipeForProduct(bk.p):(RECF[bk.p]||[])).forEach(m=>{conso[m.code]=(conso[m.code]||0)+n*num(m.qte);});}));
      const addMov=(arr,obj)=>arr.filter(inWin).forEach(r=>{[].concat(r.finis||[],r.mp||[]).forEach(x=>{if(!x.a)return;const c=desToCode[x.a];if(c&&num(x.q)>0)obj[c]=(obj[c]||0)+num(x.q);});});
      addMov(entr,entrA);addMov(sort,sortA);
      const codes=Array.from(new Set([].concat(Object.keys(a.detail),Object.keys(b.detail),Object.keys(prodAdd),Object.keys(conso),Object.keys(entrA),Object.keys(sortA))));
      const rows=[];
      codes.forEach(c=>{const pA=a.detail[c]?num(a.detail[c].p):null;const pB=b.detail[c]?num(b.detail[c].p):null;
        const pr=prodAdd[c]||0,en=entrA[c]||0,so=sortA[c]||0,co=conso[c]||0;
        if(pA==null||pB==null)return; // réconciliable seulement si départ + arrivée connus
        const theo=pA+pr+en-so-co;const ec=pB-theo;const act=pr+co;const tx=act>0?ec/act*100:null;
        const ref=REFS.find(x=>x.code===c);
        rows.push({nom:(b.detail[c]&&b.detail[c].n)||(ref&&ref.des)||c,u:ref?ref.u:'',pA:pA,pr:pr,en:en,so:so,co:co,theo:theo,pB:pB,ec:ec,tx:tx});});
      if(!rows.length){$('#cmpBox').innerHTML='<div class="an-note">Pas assez de données communes entre ces deux inventaires pour réconcilier.</div>';return;}
      rows.sort((x,y)=>Math.abs(y.ec)-Math.abs(x.ec));
      const nMank=rows.filter(r=>r.ec<-0.5).length,nSurp=rows.filter(r=>r.ec>0.5).length;
      let t='<div class="rec-syn"><div><b>'+rows.length+'</b> articles réconciliés</div><div style="color:var(--red)"><b>'+nMank+'</b> en manque</div><div style="color:var(--amber)"><b>'+nSurp+'</b> en surplus</div></div>';
      rows.forEach(r=>{const col=Math.abs(r.ec)<0.5?'var(--green)':(r.ec<0?'var(--red)':'var(--amber)');
        const det=[];det.push('départ '+fmt(r.pA));if(r.pr)det.push('+ prod '+fmt(r.pr));if(r.en)det.push('+ entrées '+fmt(r.en));if(r.so)det.push('− sorties '+fmt(r.so));if(r.co)det.push('− conso '+fmt(Math.round(r.co*10)/10));
        t+='<div class="rec-card"><div class="rec-head"><span class="rec-nom">'+esc(r.nom)+'</span><span class="rec-ec" style="color:'+col+'">'+fsign(Math.round(r.ec*10)/10)+' '+esc(r.u)+(r.tx!=null?' <small>('+fsign(Math.round(r.tx*10)/10)+'%)</small>':'')+'</span></div>'
          +'<div class="rec-flow">'+det.join(' ')+' = <b>attendu '+fmt(Math.round(r.theo*10)/10)+'</b> · réel <b>'+fmt(r.pB)+'</b></div></div>';});
      t+='<div class="an-note">Écart = <b>physique réel − théorique attendu</b> (négatif = manque/perte probable, positif = surplus inexpliqué). Théorique = physique de départ + production + entrées − sorties − consommation (recettes) sur la période. Taux = écart ÷ activité (production ou consommation), donc les mois sans activité ne faussent pas. Fiable seulement si les flux ont été saisis complètement.</div>';
      $('#cmpBox').innerHTML=t;
    };
    $('#cmpA').onchange=drawRecon;$('#cmpB').onchange=drawRecon;drawRecon();
  }
  window.scrollTo(0,0);
}

/* ================= TABLEAU DE BORD ================= */
function dashAccessButton(id,label){
  if(typeof hasTab==='function'&&!hasTab(id))return '';
  return '<button class="dash-b" data-go="'+id+'"><span class="dash-ico">'+(TAB_ICONS[id]||'\u2022')+'</span><span>'+label+'</span></button>';
}
function dashAccessGroup(title,items){
  const btns=items.map(function(x){return dashAccessButton(x[0],x[1]);}).filter(Boolean).join('');
  if(!btns)return '';
  return '<div class="dash-group"><div class="dash-gh">'+title+'</div><div class="dash-btns dash-grid">'+btns+'</div></div>';
}
function dashLotAlertItemsFromStock(data){
  const out=[];
  ((data&&data.rows)||[]).forEach(function(r){
    const lots=(r.lots||[]).filter(function(l){return Math.abs(num(l.rest))>1e-9||l.imprecise;});
    lots.forEach(function(l,i){
      let st=null,kind='';
      if(r.lotKind==='mp'){
        kind='Matière';
        st=l.imprecise?{rank:1,cls:'pr-warn',txt:'date de péremption manquante'}:perimStatus(l.date);
      }else if(r.lotKind==='fini'){
        kind='Production';
        const pi=l.imprecise?{cls:'exp-ko',txt:'date de production manquante'}:prodInfo(l.date);
        if(pi&&pi.cls==='exp-ko')st={rank:2,cls:'pr-ko',txt:pi.txt};
      }
      if(!st)return;
      out.push({code:r.code,nom:r.des,u:r.unite||'',q:round2(num(l.rest)),n:i+1,date:l.date||'',kind:kind,st:st});
    });
  });
  return out;
}
function dashLotAlertItemsFromCurrent(){
  const out=[];
  REFS.forEach(function(r){
    const e=ST.c[r.code];const blocks=(e&&e.blocks)||[];
    blocks.forEach(function(b,i){
      if(typeof blockHasInput==='function'&&!blockHasInput(r,b))return;
      const q=blockTotal(r,b,b.cfg||pOf(r));
      if(r.cat==='mp'){
        const st=perimStatus(b.date);if(!st)return;
        out.push({code:r.code,nom:r.des,u:r.u||r.ub||'',q:q,n:i+1,date:b.date||'',kind:'Matière',st:st});
      }else if(r.cat==='fini'||r.g==='fini'){
        const pi=prodInfo(b.date);if(!pi||pi.cls!=='exp-ko')return;
        out.push({code:r.code,nom:r.des,u:r.u||r.ub||'',q:q,n:i+1,date:b.date||'',kind:'Production',st:{rank:2,cls:'pr-ko',txt:pi.txt}});
      }
    });
  });
  return out;
}
function dashLotAlertsCard(items){
  if(!items.length)return '';
  items.sort(function(a,b){return b.st.rank-a.st.rank||String(a.nom).localeCompare(String(b.nom));});
  let h='<div class="perim-box dash-alert-card"><h3>⚠ Lots à surveiller <span class="perim-cnt">'+items.length+'</span></h3>';
  items.forEach(function(x){
    h+='<div class="perim-art"><div class="perim-nom"><b>'+esc(x.nom)+'</b> <small>'+esc(x.code)+'</small></div>'
      +'<div class="perim-lot '+x.st.cls+'"><span class="pl-q">'+fmt(x.q)+' '+esc(x.u||'')+'</span><span class="pl-d">'+esc(x.kind)+' · lot '+x.n+(x.date?' · '+esc(x.date):'')+' · '+esc(x.st.txt)+'</span></div></div>';
  });
  h+='</div>';return h;
}
async function dashLotAlertsHTML(){
  try{
    if(typeof computeStockData==='function'){
      const fromStock=dashLotAlertItemsFromStock(await computeStockData());
      if(fromStock.length)return dashLotAlertsCard(fromStock);
    }
  }catch(e){}
  return dashLotAlertsCard(dashLotAlertItemsFromCurrent());
}
function dashRecentLine(ic,txt){return '<div class="dash-rl">'+ic+' '+esc(txt)+'</div>';}
function dashRecentProd(row,isServer){
  const rec=isServer?(row.payload||{}):row;
  const blocks=typeof prodRecBlocks==='function'?prodRecBlocks(rec):(rec.blocks||[]);
  const np=(blocks||[]).filter(function(b){return b.p&&num(b.n)>0;}).length;
  return dashRecentLine('🏭','Production '+frDate(rec.date)+' · '+np+' produit(s)');
}
function dashRecentMov(row,kind,isServer){
  const rec=isServer?(row.payload||{}):row;
  const nl=((rec.finis||[]).filter(function(x){return x.a&&num(x.q)>0;}).length)+((rec.mp||[]).filter(function(x){return x.a&&num(x.q)>0;}).length);
  return dashRecentLine(kind==='entree'?'📦':'🚚',(kind==='entree'?'Entrée ':'Sortie ')+frDate(rec.date)+' · '+nl+' article(s)');
}
function dashRecentQuality(row,isServer){
  const rec=isServer?(row.payload||{}):row;
  const info=rec.informations||{};
  return dashRecentLine('✅','Qualité '+(info.numeroLot||'lot ?')+' · '+frDate(rec.date||info.dateProduction||''));
}
function dashRecentSection(title,html,empty){
  return '<div class="dash-rsec"><div class="dash-rh">'+title+'</div>'+(html||'<div class="dash-empty">'+empty+'</div>')+'</div>';
}
async function renderAccueil(){
  const app=$('#app');
  let h='<div class="prod-wrap"><h2 class="prod-title">Tableau de bord</h2>';
  h+='<div class="dash-card"><div class="dash-t">Accès rapide</div><div class="dash-groups">'
    +dashAccessGroup('Saisies terrain',[['comptage','Comptage'],['prod','Production'],['entree','Entrées'],['sorties','Sorties'],['qualite','Qualité']])
    +dashAccessGroup('Stock & contrôle',[['stock','Stock'],['bilan','Bilan'],['feuillet','Feuillet']])
    +dashAccessGroup('Pilotage',[['analyse','Analyses'],['capacite','Capacité'],['plan','Plan']])
    +dashAccessGroup('Réglages',[['ref','Référentiels'],['serveur','Serveur']])
    +'</div></div>';
  h+='<div id="dashAlerts"></div>';
  h+='<div id="dashRecent" class="dash-card"><div class="dash-t">Dernières saisies</div><div class="dash-rec">Chargement…</div></div>';
  h+='<div class="dash-card"><div class="dash-t">Serveur local</div><div id="srvDash" class="dash-rec">Verification...</div><div class="dash-btns" style="margin-top:8px"><button class="dash-b" id="srvDashTest">Tester</button><button class="dash-b" id="srvDashFlush">Synchroniser</button>'+(ADMIN?'<button class="dash-b" data-go="serveur">Validation</button>':'')+'</div></div>';
  h+='</div>';
  app.innerHTML=h;
  app.querySelectorAll('.dash-b').forEach(b=>{if(b.dataset.go)b.onclick=()=>switchTab(b.dataset.go);});
  var sdt=$('#srvDashTest');if(sdt)sdt.onclick=updSrvDash;
  var sdf=$('#srvDashFlush');if(sdf)sdf.onclick=async()=>{await sipsFlushPending();updSrvDash();};
  updSrvDash();
  dashLotAlertsHTML().then(function(html){const da=$('#dashAlerts');if(da)da.innerHTML=html;});
  let recs=[];try{recs=await idbAll();}catch(e){}
  const pick=(pfx,n)=>recs.filter(r=>String(r.id).indexOf(pfx)===0).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0)).slice(0,n);
  let loc='';
  pick('prod_',3).forEach(r=>{loc+=dashRecentProd(r,false);});
  pick('sortie_',2).forEach(r=>{loc+=dashRecentMov(r,'sortie',false);});
  pick('entree_',2).forEach(r=>{loc+=dashRecentMov(r,'entree',false);});
  pick('batch_',2).forEach(r=>{loc+=dashRecentQuality(r,false);});
  const dr=$('#dashRecent');
  if(dr)dr.querySelector('.dash-rec').innerHTML=dashRecentSection('Validées serveur','Chargement…','Aucune saisie validée serveur.')+dashRecentSection('Locales sur cet appareil',loc,'Aucune saisie locale.');
  let srv='';
  try{(await sipsRecords('production',{timeoutMs:1200})).sort((a,b)=>String(b.validatedAt||'').localeCompare(String(a.validatedAt||''))).slice(0,3).forEach(r=>{srv+=dashRecentProd(r,true);});}catch(e){}
  try{(await sipsRecords('sortie',{timeoutMs:1200})).sort((a,b)=>String(b.validatedAt||'').localeCompare(String(a.validatedAt||''))).slice(0,2).forEach(r=>{srv+=dashRecentMov(r,'sortie',true);});}catch(e){}
  try{(await sipsRecords('entree',{timeoutMs:1200})).sort((a,b)=>String(b.validatedAt||'').localeCompare(String(a.validatedAt||''))).slice(0,2).forEach(r=>{srv+=dashRecentMov(r,'entree',true);});}catch(e){}
  try{(await sipsRecords('quality',{timeoutMs:1200})).sort((a,b)=>String(b.validatedAt||'').localeCompare(String(a.validatedAt||''))).slice(0,2).forEach(r=>{srv+=dashRecentQuality(r,true);});}catch(e){}
  if(dr)dr.querySelector('.dash-rec').innerHTML=dashRecentSection('Validées serveur',srv,'Aucune saisie validée serveur.')+dashRecentSection('Locales sur cet appareil',loc,'Aucune saisie locale.');
  window.scrollTo(0,0);
}

/* ================= ÉTAPE 2 — MODULE BILAN ================= */
/* Seuils & facteur période — repris à l'identique de inventaire_lep.py */
const SEUIL={FILM_PERTE:3.0,FILM_SURPLUS:1.0,CARTON_MANQUE_U:20,CARTON_SURPLUS_U:5,MP_MANQUE:2.0,MP_SURPLUS:10.0,FINI:5.0,EMB_PERTE:5.0,EMB_SURPLUS:1.0,GARDE_FOU:25.0};
const FACTEUR={semaine:0.25,mois:1.0,'2mois':2.0};
let PERIODE=lsGet('lep_periode','mois');

/* Formatage des nombres — calqué sur fmt() / _n() de la référence */
function grp3(s){return String(s).replace(/\B(?=(\d{3})+(?!\d))/g,' ');}
function fmtq(v){
  v=Math.round((Number(v)+Number.EPSILON)*1000)/1000;if(Object.is(v,-0))v=0;
  const neg=v<0;v=Math.abs(v);
  if(Number.isInteger(v))return (neg?'-':'')+grp3(v);
  let s=v.toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
  const parts=s.split('.');return (neg?'-':'')+grp3(parts[0])+(parts[1]?(','+parts[1]):'');
}
function fsign(v){if(v===0)return '0';return (v>0?'+':'-')+fmtq(Math.abs(v));}
function nN(x){x=Math.round(x*10)/10;if(Math.abs(x-Math.round(x))<1e-9)return String(Math.round(x));return x.toFixed(1).replace('.',',');}
function sp(p){return (p>=0?'+':'')+p.toFixed(1);}
function spc(p){return p==null?'—':((p>=0?'+':'')+p.toFixed(1));}
function se(e){return (e>=0?'+':'')+Math.round(e);}

function grpDe(cat){if(cat==='fini')return 'fini';if(cat==='mp')return 'mp';if(cat==='film'||cat==='carton'||cat==='emballage')return 'emballage';return 'autre';}

/* Règles d'alerte — portage fidèle de regles_alerte() */
function reglesAlerte(cat,e,pct,t,p){
  const f=FACTEUR[PERIODE]||1;const fl=[];
  if(t===0&&p>0)return ['théorique = 0 & physique > 0 → mouvement non saisi ?'];
  if(cat==='film'){
    if(pct!=null&&pct>SEUIL.FILM_PERTE*f)fl.push('film : pertes '+sp(pct)+'% (> '+(SEUIL.FILM_PERTE*f).toFixed(1)+'%) → investiguer');
    if(pct!=null&&pct<-SEUIL.FILM_SURPLUS)fl.push('film : physique > théorique ('+sp(pct)+'%) → réception non saisie / erreur comptage');
  }else if(cat==='carton'){
    if(e>SEUIL.CARTON_MANQUE_U*f)fl.push('carton : manque '+se(e)+' u (> '+(SEUIL.CARTON_MANQUE_U*f).toFixed(0)+') → investiguer');
    if(e<-SEUIL.CARTON_SURPLUS_U)fl.push('carton : surplus '+se(e)+' u → réception non saisie / erreur');
  }else if(cat==='mp'){
    if(pct!=null&&pct>SEUIL.MP_MANQUE*f)fl.push('MP : physique < théorique ('+sp(pct)+'%) → surconso/perte/sortie non saisie');
    if(pct!=null&&pct<-SEUIL.MP_SURPLUS*f)fl.push('MP : surplus anormal ('+sp(pct)+'%) → réception/pesée non saisie');
  }else if(cat==='fini'){
    if(pct!=null&&Math.abs(pct)>SEUIL.FINI)fl.push('produit fini : écart '+sp(pct)+'% → production/expédition non saisie');
  }else if(cat==='emballage'){
    if(pct!=null&&pct>SEUIL.EMB_PERTE*f)fl.push('emballage : pertes '+sp(pct)+'% (> '+(SEUIL.EMB_PERTE*f).toFixed(1)+'%) → investiguer');
    if(pct!=null&&pct<-SEUIL.EMB_SURPLUS)fl.push('emballage : physique > théorique ('+sp(pct)+'%) → réception non saisie / erreur comptage');
  }else{
    if(pct!=null&&Math.abs(pct)>SEUIL.GARDE_FOU*f)fl.push('écart '+sp(pct)+'% très élevé → investiguer');
  }
  return fl;
}

/* Conversion d'un écart dans les niveaux de conditionnement */
function convCond(code,ecart){
  const c=COND[code];if(!c||!c.lv||!c.lv.length||ecart==null||ecart===0)return '';
  return c.lv.filter(l=>l[1]).map(l=>nN(ecart/l[1])+' '+l[0]).join(' · ');
}

/* Calcul du bilan : union des codes (état + articles), physique = inventaire chargé */
function bilanLotsForRow(r,grp){
  if(!r||!ST.c[r.code]||!ST.c[r.code].counted)return [];
  if(grp!=='mp'&&grp!=='fini')return [];
  const e=ST.c[r.code];
  if(typeof ensureBlocks==='function')ensureBlocks(r,e);
  const lots=[];
  (e.blocks||[]).forEach((b,bi)=>{
    if(typeof blockHasInput==='function'&&!blockHasInput(r,b))return;
    const q=blockTotal(r,b,b.cfg||pOf(r));
    if(Math.abs(q)<=1e-9)return;
    const date=String((b&&b.date)||'');
    let cls='pr-ok',txt='';
    if(!date){cls='pr-warn';txt=grp==='mp'?'date de peremption manquante':'date de production manquante';}
    else if(grp==='mp'){
      const info=expInfo(date);
      if(info){txt=info.txt;cls=(info.cls==='exp-ko'||info.cls==='exp-warn')?'pr-ko':(info.cls==='exp-soon'?'pr-warn':'pr-ok');}
    }else{
      const info=prodInfo(date);
      if(info){txt=info.txt;cls=info.cls==='exp-ko'?'pr-ko':'pr-ok';}
    }
    lots.push({n:bi+1,date:date,q:q,cls:cls,txt:txt});
  });
  return lots;
}
function buildBilan(){
  const codes=new Set();REFS.forEach(r=>codes.add(r.code));Object.keys(ETAT).forEach(c=>codes.add(c));
  const byCode={};REFS.forEach(r=>byCode[r.code]=r);
  const rows=[];let totEc=0;
  [...codes].sort().forEach(code=>{
    const r=byCode[code];
    const theo=num(ETAT[code]);                 // absent -> 0
    let phys=null;
    if(r&&ST.c[code]&&ST.c[code].counted)phys=round2(total(r));
    const cat=(r&&r.cat)||SEED_CAT[code]||'autre';
    const grp=grpDe(cat);
    const row={code:code,nom:r?r.des:code,cat:cat,grp:grp,unite:r?r.u:'',theo:theo,phys:phys,counted:phys!=null,ecart:null,pct:null,flags:[],ok:true,lots:[]};
    if(phys!=null){
      const e=theo-phys;totEc+=e;
      const pct=theo?(e/theo*100):null;
      row.ecart=Math.round(e*1000)/1000;row.pct=pct;
      row.flags=reglesAlerte(cat,e,pct,theo,phys);row.ok=!row.flags.length;
      row.lots=bilanLotsForRow(r,grp);
    }
    rows.push(row);
  });
  const alertes=rows.filter(r=>r.counted&&!r.ok);
  return {rows:rows,alertes:alertes,total:totEc,reco:alertes.length?'RECOMPTER':'VALIDER'};
}

/* Bilan calcule sur un snapshot physique fourni (soumission/record serveur, inventaire valide)
   au lieu du comptage courant. Reutilise buildBilan en echangeant temporairement ST puis le
   restaure. Decision 9 (non compte = ecart nul) est heritee de buildBilan : un article non
   compte reste phys=null -> ecart null, neutralise (aligne au theorique), exclu de l ecart total. */
function buildBilanFrom(snapshot){
  const prevST=ST,prevRO=RO;
  try{
    ST=snapshot?JSON.parse(JSON.stringify(snapshot)):freshCounts();
    mergeAndMigrate();
    return buildBilan();
  }finally{ST=prevST;RO=prevRO;}
}

function ecartHTML(a,withCond){
  if(a.ecart==null)return '<span class="bc-nc">report état (= théorique)</span>';
  const delta=-a.ecart;
  const pct=a.pct==null?null:-a.pct;
  const arrow=delta<0?'\u25BC':(delta>0?'\u25B2':'');
  const col=a.ok?'var(--green)':'var(--red)';
  const cond=withCond?convCond(a.code,delta):'';
  return '<span class="bc-ec"><b style="color:'+col+'">'+(arrow?arrow+' ':'')+fsign(delta)+' '+esc(a.unite)+'</b> <span class="bc-pct">('+spc(pct)+' %)</span>'+(cond?'<div class="bc-cond">≈ '+cond+'</div>':'')+'</span>';
}
function bilanStockMiniHTML(a){
  const unit=a.unite?(' '+esc(a.unite)):'';
  return '<div class="bc-stocks"><span><small>Théorique</small><b>'+fmtq(a.theo)+unit+'</b></span><span class="bc-stock-phys"><small>Inventaire</small><b>'+fmtq(a.phys)+unit+'</b><div class="bc-stock-diff">'+ecartHTML(a,true)+'</div></span></div>';
}

function lotDateKey(d){return d||'sans date';}
function lotMapFrom(list,qtyField){
  const m={};(list||[]).forEach(l=>{const k=lotDateKey(l.date);m[k]=round2((m[k]||0)+num(l[qtyField]));});return m;
}
function lotDiffsHTML(a){
  if(!a.lotDiffs||!a.lotDiffs.length)return '';
  return '<div class="lot-diffs"><b>FIFO/FEFO à vérifier</b> '+a.lotDiffs.map(d=>esc(d.date)+' : prévu '+fmtq(d.expected)+' / compté '+fmtq(d.actual)).join(' · ')+'</div>';
}
function lotDetailHTML(a){
  if(!a.lots||!a.lots.length)return '';
  let h='<div class="lot-detail">';
  h+=a.lots.map(l=>'<span class="lot-chip '+l.cls+'"><b>'+fmtq(l.q)+' '+esc(a.unite||'')+'</b><small>lot '+l.n+(l.date?' · '+esc(l.date):'')+(l.txt?' · '+esc(l.txt):'')+'</small></span>').join('');
  h+=lotDiffsHTML(a);
  h+='</div>';
  return h;
}
function applyBilanLotDiffs(r,expected){
  if(!expected)return r;
  (r.rows||[]).forEach(a=>{
    const exp=expected[a.code];if(!exp||!a.lots||!a.lots.length)return;
    const em=lotMapFrom(exp,'rest'),am=lotMapFrom(a.lots,'q');
    const keys=Array.from(new Set(Object.keys(em).concat(Object.keys(am))));
    a.lotDiffs=keys.map(k=>({date:k,expected:round2(em[k]||0),actual:round2(am[k]||0)})).filter(d=>Math.abs(d.expected-d.actual)>1e-6);
  });
  return r;
}
function fullTablesHTML(r){
  const fams=[['mp','Matières premières — ingrédients (sachets)','#1f7a4d'],['emballage','Emballages (films, cartons, sacs, zippers…)','#1b5faa'],['fini','Produits finis (code 39…)','#8a6d3b'],['autre','Autres','#6a7280']];
  let h='';
  fams.forEach(fam=>{
    const g=fam[0],title=fam[1],col=fam[2];
    const rs=r.rows.filter(x=>x.grp===g);if(!rs.length)return;
    rs.sort((a,b)=>{const sa=a.counted?(a.ok?1:0):2,sb=b.counted?(b.ok?1:0):2;return sa-sb;});
    h+='<section class="bil-sec"><div class="bil-sec-h" style="background:'+col+'">'+title+' <span class="gn">('+rs.length+')</span></div><div class="bil-lines">';
    rs.forEach(x=>{
      const cls=x.counted?(x.ok?'':' ko'):' nc';
      const pill=x.counted?(x.ok?'<span class="pill ok">OK</span>':'<span class="pill ko">À VÉRIFIER</span>'):'<span class="pill nc">non compté</span>';
      h+='<div class="bil-line'+cls+'">'
        +'<div class="bl-id"><span class="bl-code">'+x.code+'</span> '+esc(x.nom)+(x.by?' <span class="bl-by" style="color:var(--mute);font-size:11px">· compté par '+esc(x.by)+'</span>':'')+'</div>'
        +'<div class="bl-tp">théo <b>'+fmtq(x.theo)+'</b> · phys <b>'+(x.counted?fmtq(x.phys):'—')+'</b></div>'
        +'<div class="bl-ec">'+ecartHTML(x,true)+'</div>'
        +'<div class="bl-st">'+pill+'</div>'+lotDetailHTML(x)+'</div>';
    });
    h+='</div></section>';
  });
  return h;
}

/* Alertes de péremption (MP) pour le Bilan — seuil 6 mois */
function perimStatus(date){
  if(!date)return null;const d=new Date(date+'T00:00:00');if(isNaN(d.getTime()))return null;
  const now=new Date();now.setHours(0,0,0,0);const days=Math.round((d-now)/86400000);
  if(days<0){const md=monthsDays(-days);return {rank:3,cls:'pr-ko',txt:'périmé depuis '+fmtMD(md.m,md.j)};}
  if(days<=30){const md=monthsDays(days);return {rank:2,cls:'pr-ko',txt:'périme dans '+fmtMD(md.m,md.j)};}
  if(days<=183){const md=monthsDays(days);return {rank:1,cls:'pr-warn',txt:'périme dans '+fmtMD(md.m,md.j)};}
  return null;
}
function perimHTML(){
  const arts=[];
  REFS.forEach(r=>{
    if(r.cat!=='mp')return;
    const blocks=(ST.c[r.code]&&ST.c[r.code].blocks)||[];
    const lots=[];let worst=0;
    blocks.forEach((b,bi)=>{const st=perimStatus(b.date);if(!st)return;const q=blockTotal(r,b,b.cfg||pOf(r));lots.push({n:bi+1,q:q,st:st});if(st.rank>worst)worst=st.rank;});
    if(lots.length){lots.sort((a,b)=>b.st.rank-a.st.rank);arts.push({r:r,lots:lots,worst:worst});}
  });
  if(!arts.length)return '';
  arts.sort((a,b)=>b.worst-a.worst);
  const nbU=arts.reduce((s,a)=>s+a.lots.filter(l=>l.st.rank>=2).length,0);
  let h='<div class="perim-box"><h3>⏳ Péremptions à surveiller'+(nbU?' <span class="perim-cnt">'+nbU+' urgent(s)</span>':'')+'</h3>';
  arts.forEach(a=>{
    h+='<div class="perim-art"><div class="perim-nom"><b>'+esc(a.r.des)+'</b> <small>'+a.r.code+'</small></div>';
    a.lots.forEach(l=>{h+='<div class="perim-lot '+l.st.cls+'"><span class="pl-q">'+fmt(l.q)+' '+esc(a.r.u||'')+'</span><span class="pl-d">lot '+l.n+' · '+l.st.txt+'</span></div>';});
    h+='</div>';
  });
  h+='</div>';return h;
}
function prodAgeHTML(){
  const arts=[];
  REFS.forEach(r=>{
    if(r.cat!=='fini'&&r.g!=='fini')return;
    const blocks=(ST.c[r.code]&&ST.c[r.code].blocks)||[];
    const lots=[];let worst=0;
    blocks.forEach((b,bi)=>{
      if(typeof blockHasInput==='function'&&!blockHasInput(r,b))return;
      const st=prodInfo(b.date);if(!st)return;
      const q=blockTotal(r,b,b.cfg||pOf(r));
      const rank=st.cls==='exp-ko'?2:1;
      if(rank<2)return;
      lots.push({n:bi+1,q:q,st:st,rank:rank});
      if(rank>worst)worst=rank;
    });
    if(lots.length){lots.sort((a,b)=>b.rank-a.rank);arts.push({r:r,lots:lots,worst:worst});}
  });
  if(!arts.length)return '';
  arts.sort((a,b)=>b.worst-a.worst);
  const nbU=arts.reduce((s,a)=>s+a.lots.filter(l=>l.rank>=2).length,0);
  let h='<div class="perim-box prod-age-box"><h3>Produits finis - age de production'+(nbU?' <span class="perim-cnt">'+nbU+' a surveiller</span>':'')+'</h3>';
  arts.forEach(a=>{
    h+='<div class="perim-art"><div class="perim-nom"><b>'+esc(a.r.des)+'</b> <small>'+a.r.code+'</small></div>';
    a.lots.forEach(l=>{h+='<div class="perim-lot '+(l.rank>=2?'pr-ko':'pr-ok')+'"><span class="pl-q">'+fmt(l.q)+' '+esc(a.r.u||'')+'</span><span class="pl-d">lot '+l.n+' - '+esc(l.st.txt)+'</span></div>';});
    h+='</div>';
  });
  h+='</div>';return h;
}
function bilPairBanner(swapped,pair,posterior){
  if(swapped){
    if(ETAT_DATE)
      return '<div class="bil-pair ok">📅 État de stock du <b>'+esc(ETAT_DATE)+'</b> comparé à l’inventaire <b>validé 🔒</b> du <b>'+esc(pair.date||'?')+'</b>'+(pair.agent?(' · '+esc(pair.agent)):'')+' — apparié automatiquement (≤ date de l’état).'+(posterior?(' '+posterior+' inventaire(s) validé(s) postérieur(s) ignoré(s).'):'')+'</div>';
    return '<div class="bil-pair ok">🔒 Comparé au dernier inventaire <b>validé</b> du <b>'+esc(pair.date||'?')+'</b>'+(pair.agent?(' · '+esc(pair.agent)):'')+'. Renseigne la <b>date de l’état de stock</b> pour cibler une date précise.</div>';
  }
  if(ETAT_DATE)
    return '<div class="bil-pair warn">⚠ Aucun inventaire <b>validé 🔒</b> daté du <b>'+esc(ETAT_DATE)+'</b> ou avant. Valide l’inventaire de référence (Historique → 🔒 Valider).'+(posterior?(' '+posterior+' inventaire(s) validé(s) postérieur(s) existent mais ne servent pas de référence.'):'')+'</div>';
  return '<div class="bil-pair warn">⚠ Aucun inventaire <b>validé 🔒</b>. Valide un inventaire (Historique → 🔒 Valider) pour comparer l’état de stock à un comptage. (Le brouillon en cours n’est pas utilisé comme référence.)</div>';
}
/* Trouve l'inventaire de reference a apparier a l'etat de stock (ERP). Pool = inventaires VALIDES
   SERVEUR (officiels, payload.st) + inventaires verrouilles LOCAUX (repli transition). Selection :
   le plus recent (<= ETAT_DATE si renseignee, jamais posterieur). A date egale, le serveur l'emporte. */
async function findBilanPair(){
  let recs=[];try{recs=await idbAll();}catch(e){recs=[];}
  const localInvs=recs.filter(r=>r&&r.locked&&r.st&&r.st.c&&r.id!=='current'
    &&String(r.id).indexOf('prod_')!==0&&String(r.id).indexOf('sortie_')!==0
    &&String(r.id).indexOf('entree_')!==0&&String(r.id).indexOf('fragsess_')!==0)
    .map(r=>({date:r.date||'',agent:r.agent||'',st:r.st,savedAt:r.savedAt||0,server:false}));
  let serverInvs=[];
  try{
    const rows=await sipsRecords('inventory',{timeoutMs:1200});
    serverInvs=(rows||[]).filter(r=>r&&r.payload&&r.payload.st&&r.payload.st.c)
      .map(r=>({date:(r.payload.date||''),agent:(r.payload.agent||''),st:r.payload.st,savedAt:Date.parse(r.validatedAt||r.createdAt||'')||0,server:true}));
  }catch(e){serverInvs=[];}
  const pool=serverInvs.concat(localInvs);
  if(!pool.length)return {pair:null,posterior:0};
  // tri : date desc ; a date egale, serveur (officiel) d'abord ; puis savedAt desc
  pool.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||((b.server?1:0)-(a.server?1:0))||((b.savedAt||0)-(a.savedAt||0)));
  if(ETAT_DATE){
    const le=pool.filter(r=>String(r.date||'')<=ETAT_DATE);
    return {pair:le[0]||null,posterior:pool.length-le.length};
  }
  return {pair:pool[0],posterior:0};
}
function bilanApplyMovements(baseDate,endDate,prodRecs,entreeRecs,sortieRecs){
  return stockApplyMovements(baseDate,prodRecs,entreeRecs,sortieRecs,{endDate:String(endDate||todayStr()),refs:REFS,recipes:RECF,num:num,round2:round2});
}
async function bilanExpectedLots(pair){
  if(!pair||!pair.date)return {};
  let invs=[],prod=[],ent=[],sort=[];
  if(pair.server){
    try{invs=(await sipsRecords('inventory',{timeoutMs:1200})).filter(r=>r&&r.payload&&r.payload.st&&r.payload.st.c).map(r=>({date:r.payload.date||'',st:r.payload.st,savedAt:Date.parse(r.validatedAt||r.createdAt||'')||0}));}catch(e){invs=[];}
    try{prod=(await sipsRecords('production',{timeoutMs:1200})).map(r=>r.payload||{});}catch(e){prod=[];}
    try{ent=(await sipsRecords('entree',{timeoutMs:1200})).map(r=>r.payload||{});}catch(e){ent=[];}
    try{sort=(await sipsRecords('sortie',{timeoutMs:1200})).map(r=>r.payload||{});}catch(e){sort=[];}
  }else{
    let recs=[];try{recs=await idbAll();}catch(e){recs=[];}
    invs=recs.filter(r=>r&&r.locked&&r.st&&r.st.c&&r.id!=='current'
      &&String(r.id).indexOf('prod_')!==0&&String(r.id).indexOf('sortie_')!==0
      &&String(r.id).indexOf('entree_')!==0&&String(r.id).indexOf('fragsess_')!==0)
      .map(r=>({date:r.date||'',st:r.st,savedAt:r.savedAt||0}));
    prod=recs.filter(r=>String(r.id).indexOf('prod_')===0);
    ent=recs.filter(r=>String(r.id).indexOf('entree_')===0);
    sort=recs.filter(r=>String(r.id).indexOf('sortie_')===0);
  }
  const prevs=invs.filter(x=>String(x.date||'')<String(pair.date||'')).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||((b.savedAt||0)-(a.savedAt||0)));
  const prev=prevs[0];if(!prev||!prev.st)return {};
  if(typeof stockBaseMap!=='function'||typeof buildFinishedLots!=='function'||typeof buildMpLots!=='function'||typeof applyFifo!=='function')return {};
  const bm=stockBaseMap(prev.st);
  const fl=bilanApplyMovements(prev.date,pair.date,prod,ent,sort);
  const out={};
  REFS.forEach(r=>{
    const c=r.code,grp=grpDe((r&&r.cat)||SEED_CAT[c]||'');
    const bl=(bm.baseLots[c]&&bm.baseLots[c].length)?bm.baseLots[c]:bm.baseMap[c];
    if(grp==='fini'){
      const lots=buildFinishedLots(c,bl,prev.date,prod,ent,fl.desToCode,fl.today);
      applyFifo(lots,(fl.so[c]||0)+(fl.conso[c]||0));out[c]=lots.filter(l=>Math.abs(l.rest)>1e-9||l.imprecise);
    }else if(typeof isPerishableMp==='function'&&isPerishableMp(r)){
      const lots=buildMpLots(c,bl,prev.date,ent,fl.desToCode,fl.today);
      applyFifo(lots,(fl.so[c]||0)+(fl.conso[c]||0));out[c]=lots.filter(l=>Math.abs(l.rest)>1e-9||l.imprecise);
    }
  });
  return out;
}
async function renderBilan(){
  const app=$('#app');
  // Référence physique = dernier inventaire VALIDÉ (≤ date de l'état de stock si renseignée). Jamais le brouillon :
  // sans inventaire validé, on bascule sur un état VIDE (tout reporté au théorique).
  const prevST=ST,prevRO=RO;let pair=null,posterior=0;
  {const f=await findBilanPair();pair=f.pair;posterior=f.posterior;}
  ST=pair?JSON.parse(JSON.stringify(pair.st)):freshCounts();mergeAndMigrate();RO=true;
  const r=buildBilan();
  applyBilanLotDiffs(r,await bilanExpectedLots(pair));
  r.srcDate=pair?(pair.date||''):'';
  r.srcAgent=pair?(pair.agent||''):'';
  const counted=r.rows.filter(x=>x.counted).length;
  const recoOk=r.reco==='VALIDER';
  let h='<div class="bilan-wrap">';
  h+='<div class="bil-ctrl"><label for="bilPeriode">Période entre 2 inventaires</label>'
    +'<select id="bilPeriode">'+['semaine','mois','2mois'].map(p=>'<option value="'+p+'" '+(p===PERIODE?'selected':'')+'>'+(p==='2mois'?'2 mois':p)+'</option>').join('')+'</select>'
    +'<button id="bilPrint" class="bil-print">Imprimer</button><button id="bilPDF" class="bil-print">📄 PDF</button></div>';
  h+=bilPairBanner(!!pair,pair,posterior);
  h+='<div class="bil-src">Référence physique : <b>'+(r.srcDate||'—')+'</b>'+(r.srcAgent?(' · '+esc(r.srcAgent)):'')+' — <b>'+counted+'</b> / '+r.rows.length+' article(s) compté(s)</div>';
  if(!counted)h+='<div class="bil-note">Aucun article compté dans l\u2019inventaire chargé : tout est reporté au théorique. Compte des articles (onglet Comptage) ou ouvre un inventaire via l\u2019Historique.</div>';
  h+='<div class="bil-reco '+(recoOk?'ok':'ko')+'">'+r.reco+'<span class="meta">'+r.alertes.length+' à vérifier / '+r.rows.length+' articles</span></div>';
  if(r.alertes.length){
    h+='<div class="bil-alert"><h3>'+r.alertes.length+' article(s) à vérifier</h3><div class="bil-cards">';
    r.alertes.forEach(a=>{
      h+='<div class="bil-card"><div class="bc-top"><span class="bc-code">'+a.code+'</span></div><div class="bc-nom">'+esc(a.nom)+'</div>'+bilanStockMiniHTML(a)+'<div class="bc-rai">'+a.flags.map(f=>f.split('→').pop().trim()).join(' · ')+'</div></div>';
    });
    h+='</div></div>';
  }else if(counted){
    h+='<div class="bil-okbox">Aucune anomalie détectée — inventaire cohérent avec l\u2019état de stock.</div>';
  }
  h+=perimHTML();
  h+=prodAgeHTML();
  h+='<button id="bilToggle" class="bil-toggle">Voir tous les produits</button>';
  h+='<div id="bilFull" class="bil-full" style="display:none">'+fullTablesHTML(r)+'</div>';
  h+='<div class="bil-foot">Total des écarts (articles comptés, unités mêlées, indicatif) : <b>'+fsign(Math.round(-r.total*1000)/1000)+'</b>.<br>Convention : écart = inventaire physique − théorique ; ▲ surplus (physique &gt; théo), ▼ manque (physique &lt; théo).</div>';
  h+='</div>';
  app.innerHTML=h;
  ST=prevST;RO=prevRO;   // restaure le brouillon : l'appariement n'altère jamais l'état courant
  $('#bilPeriode').onchange=e=>{PERIODE=e.target.value;lsSet('lep_periode',PERIODE);renderBilan();};
  $('#bilPrint').onclick=()=>{const f=$('#bilFull');if(f)f.style.display='block';window.print();};
  $('#bilPDF').onclick=()=>bilanPDF(r);
  $('#bilToggle').onclick=()=>{const f=$('#bilFull');const open=f.style.display==='none';f.style.display=open?'block':'none';$('#bilToggle').textContent=open?'Masquer le détail':'Voir tous les produits';};
}
function shareBlob(filename,bytes,mime,title){
  const blob=new Blob([bytes],{type:mime});const file=new File([blob],filename,{type:mime});
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){navigator.share({files:[file],title:title||filename}).catch(()=>{});return;}}catch(e){}
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function bilanPDF(r){
  try{await ensurePDF();}catch(e){toast('PDF indisponible (hors-ligne, jamais chargé)');return;}
  if(!window.PDFLib){toast('PDF indisponible ici (teste sur l\u2019app déployée)');return;}
  try{
    const doc=await PDFLib.PDFDocument.create();
    const F=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const FB=await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const W=595,H=842,M=40;let page=doc.addPage([W,H]);let y=H-M;
    const INK=PDFLib.rgb(0.07,0.12,0.17),GREY=PDFLib.rgb(0.4,0.45,0.5),RED=PDFLib.rgb(0.69,0.27,0.35);
    const T=(s,x,yy,sz,bold,col)=>page.drawText(String(s==null?'':s),{x:x,y:yy,size:sz,font:bold?FB:F,color:col||INK});
    T('Bilan d\u2019inventaire',M,y,18,true);y-=22;
    T('Etat de stock : '+(ETAT_DATE||'—')+'   Inventaire : '+(r.srcDate||'—')+((r.srcAgent)?(' · '+r.srcAgent):''),M,y,10,false,GREY);y-=14;
    T(r.reco+' — '+r.alertes.length+' à vérifier / '+r.rows.length+' articles',M,y,10,false,GREY);y-=20;
    const cols=[M,M+62,M+300,M+360,M+425,M+500];
    const head=()=>{T('Code',cols[0],y,9,true);T('Article',cols[1],y,9,true);T('Théo',cols[2],y,9,true);T('Phys',cols[3],y,9,true);T('Écart',cols[4],y,9,true);T('%',cols[5],y,9,true);y-=4;page.drawLine({start:{x:M,y:y},end:{x:W-M,y:y},thickness:.7,color:PDFLib.rgb(0.8,0.82,0.8)});y-=12;};
    head();
    r.rows.forEach(x=>{
      if(y<M+30){page=doc.addPage([W,H]);y=H-M;head();}
      const col=(x.counted&&!x.ok)?RED:INK;
      T(x.code,cols[0],y,8,false,col);
      T((x.nom||'').slice(0,42),cols[1],y,8,false,col);
      T(fmtq(x.theo),cols[2],y,8,false,col);
      T(x.counted?fmtq(x.phys):'—',cols[3],y,8,false,col);
      T(x.ecart==null?'—':fsign(-x.ecart),cols[4],y,8,false,col);
      T(x.pct==null?'':(Math.round(-x.pct)+'%'),cols[5],y,8,false,col);
      y-=13;
    });
    y-=6;if(y<M+20){page=doc.addPage([W,H]);y=H-M;}
    T('Total des écarts (indicatif, unités mêlées) : '+fsign(Math.round(-r.total*1000)/1000),M,y,9,true);
    const bytes=await doc.save();
    shareBlob('bilan_'+(r.srcDate||todayStr())+'.pdf',bytes,'application/pdf','Bilan d\u2019inventaire');
    toast('PDF généré');
  }catch(e){toast('Échec de la génération PDF');}
}

/* ================= ÉTAPE 3 — MODULE FEUILLET (PDF) ================= */
/* Libs embarquées : pdf.js (lecture positions) + pdf-lib (écriture). */
if(window.pdfjsLib&&pdfjsLib.GlobalWorkerOptions){pdfjsLib.GlobalWorkerOptions.workerSrc='pdf.worker.min.js';}
const FEU_BLEU=[0,0,0.8];
let FEU={buf:null,name:'',rows:null,xRight:0,npages:0,codes:0,missing:[]};

function feuDateKey(){
  if(ST&&ST.date)return ST.date;
  const d=new Date(),p=n=>(n<10?'0':'')+n;
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
}
function feuFileName(base,date){
  const b=String(base||'feuillet').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'_');
  return b+'_'+date+'_rempli.pdf';
}
function feuFrDate(s){
  if(!s)return '-';
  const m=String(s).split('-');
  return m.length===3?m[2]+'/'+m[1]+'/'+m[0]:String(s);
}
async function feuArchive(bytes,name,fontName){
  const id='feuillet_'+Date.now();
  const fileId=id+'_pdf';
  await idbFilePut({
    id:fileId,
    kind:'feuillet-pdf',
    name:name,
    date:feuDateKey(),
    mime:'application/pdf',
    savedAt:Date.now(),
    data:Array.from(bytes||[])
  });
  const rec={
    id:id,
    kind:'feuillet',
    date:feuDateKey(),
    name:name,
    sourceName:FEU.name||'',
    agent:(ST&&ST.agent)||'',
    savedAt:Date.now(),
    codes:FEU.codes||0,
    missing:clone(FEU.missing||[]),
    font:fontName||'',
    fileId:fileId,
    bytes:bytes&&bytes.byteLength||0
  };
  await idbPut(rec,false);
  feuLoadArchive();
}
async function feuPdfBlob(rec){
  let data=rec&&rec.pdf;
  if(!data&&rec&&rec.fileId){
    const file=await idbFileGet(rec.fileId);
    data=file&&file.data;
  }
  if(data instanceof Uint8Array||data instanceof ArrayBuffer)return new Blob([data],{type:'application/pdf'});
  if(Array.isArray(data))return new Blob([new Uint8Array(data)],{type:'application/pdf'});
  if(data&&typeof data==='object'){
    const ks=Object.keys(data).filter(k=>/^\d+$/.test(k)).sort((a,b)=>Number(a)-Number(b));
    if(ks.length)return new Blob([new Uint8Array(ks.map(k=>data[k]))],{type:'application/pdf'});
  }
  return null;
}
async function feuLoadArchive(){
  const host=$('#feuHist');if(!host)return;
  let rows=[];
  try{rows=(await idbAll()).filter(r=>String(r.id||'').indexOf('feuillet_')===0).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));}catch(e){}
  host.innerHTML='';
  if(!rows.length){host.innerHTML='<p class="feu-empty">Aucun feuillet rempli archive pour le moment.</p>';return;}
  rows.slice(0,20).forEach(rec=>{
    const it=document.createElement('div');it.className='hist-item feu-arch';
    it.innerHTML='<div class="info"><b>'+esc(rec.name||('feuillet_'+(rec.date||'')))+'</b><span>'+feuFrDate(rec.date)+' - '+esc(rec.agent||'sans operateur')+' - '+(rec.codes||0)+' ligne(s)</span></div>';
    const open=document.createElement('button');open.textContent='Ouvrir';open.onclick=async()=>{
      const blob=await feuPdfBlob(rec);if(!blob){toast('Feuillet illisible');return;}
      const url=URL.createObjectURL(blob);
      const w=window.open(url,'_blank');
      if(!w){const a=document.createElement('a');a.href=url;a.download=rec.name||'feuillet.pdf';a.click();}
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    };
    const del=document.createElement('button');del.className='del';del.textContent='Suppr.';del.onclick=async()=>{if(confirm('Supprimer ce feuillet archive ?')){if(rec.fileId)try{await idbFileDel(rec.fileId);}catch(e){}await idbDel(rec.id);feuLoadArchive();}};
    it.append(open,del);host.append(it);
  });
  if(rows.length>20){
    const p=document.createElement('p');p.className='feu-empty';p.textContent=(rows.length-20)+' ancien(s) feuillet(s) masque(s).';host.append(p);
  }
}

/* Police des chiffres Lot1 : Helvetica (standard pdf-lib). */
async function feuFont(pdfDoc){
  return {font:await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica),nom:'Helvetica'};
}

/* Valeur Lot1 d'un code : compté -> physique ; sinon état de stock (0 si absent). Jamais le feuillet. */
function feuValeur(code){
  const r=REFS.find(x=>x.code===code);
  if(r&&ST.c[code]&&ST.c[code].counted)return round2(total(r));
  return num(ETAT[code]);
}

/* Détection des cellules via pdf.js */
async function feuDetect(buf){
  await ensurePDF();
  const doc=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
  const codeRe=/^\d{6}$/;
  const p1=await doc.getPage(1);
  const it1=(await p1.getTextContent()).items.map(i=>({s:i.str.trim(),x:i.transform[4],y:i.transform[5],w:i.width}));
  const H=l=>{const it=it1.find(i=>i.s===l);return it?it.x+it.w/2:null;};
  const cxStock=H('Stock'),cxLot1=H('Lot1'),cxLot2=H('Lot2');
  if(cxStock==null||cxLot1==null||cxLot2==null)throw new Error('Colonnes Stock/Lot1/Lot2 introuvables — gabarit non reconnu.');
  const pitch=cxLot2-cxLot1, lot1L=cxLot1-pitch/2, lot1R=cxLot1+pitch/2;
  let stockRight=null;
  for(const i of it1){const cx=i.x+i.w/2;if(cx>cxStock-40&&cx<cxLot1&&/\d/.test(i.s)){stockRight=i.x+i.w;break;}}
  const pad=(stockRight!=null)?(lot1L-stockRight):3.1;
  const xRight=lot1R-pad;
  const rows={};
  for(let pno=1;pno<=doc.numPages;pno++){
    const pg=await doc.getPage(pno);
    const its=(await pg.getTextContent()).items.map(i=>({s:i.str.trim(),x:i.transform[4],y:i.transform[5],w:i.width}));
    const codes=its.filter(i=>codeRe.test(i.s)&&i.x<70);
    const stocks=its.filter(i=>{const cx=i.x+i.w/2;return cx>cxStock-40&&cx<cxLot1&&/\d/.test(i.s);});
    codes.forEach(c=>{let best=null,bd=1e9;stocks.forEach(s=>{const d=Math.abs(s.y-c.y);if(d<bd){bd=d;best=s.y;}});rows[c.s]={pno:pno,by:(best!=null&&bd<8)?best:c.y};});
  }
  const missing=REFS.filter(r=>ST.c[r.code]&&ST.c[r.code].counted&&!rows[r.code]).map(r=>r.code+' '+r.des);
  return {rows:rows,xRight:xRight,npages:doc.numPages,codes:Object.keys(rows).length,missing:missing};
}

/* Génération du PDF tamponné via pdf-lib */
async function feuGenerate(){
  const btn=$('#feuGen');if(btn){btn.disabled=true;btn.textContent='Génération…';}
  try{
    await ensurePDF();
    const pdfDoc=await PDFLib.PDFDocument.load(FEU.buf.slice(0));
    const ff=await feuFont(pdfDoc);
    const pages=pdfDoc.getPages();
    const col=PDFLib.rgb(FEU_BLEU[0],FEU_BLEU[1],FEU_BLEU[2]);
    for(const code in FEU.rows){
      const {pno,by}=FEU.rows[code];
      const txt=fmtq(feuValeur(code));
      const w=ff.font.widthOfTextAtSize(txt,10);
      pages[pno-1].drawText(txt,{x:FEU.xRight-w,y:by,size:10,font:ff.font,color:col});
    }
    const bytes=await pdfDoc.save();
    const name=feuFileName(FEU.name||'feuillet',feuDateKey());
    try{await feuArchive(bytes,name,ff.nom);}catch(_){}
    let file=null;try{file=new File([bytes],name,{type:'application/pdf'});}catch(_){}
    if(file&&navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      try{await navigator.share({files:[file],title:'Feuillet rempli',text:'Feuillet d\u2019inventaire — Lot1 rempli ('+ff.nom+')'});toast('Partage ouvert');return;}
      catch(err){if(err&&err.name==='AbortError')return;}
    }
    const blob=new Blob([bytes],{type:'application/pdf'});const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download=name;a.click();
    toast('PDF enregistré ('+ff.nom+')');
  }catch(e){toast('Erreur génération : '+(e&&e.message||e));}
  finally{if(btn){btn.disabled=false;btn.textContent='Générer le PDF rempli';}}
}

function feuPick(){
  const fi=document.createElement('input');fi.type='file';fi.accept='application/pdf,.pdf';fi.style.display='none';
  fi.onchange=e=>{const f=e.target.files[0];if(!f)return;
    const rd=new FileReader();
    rd.onload=async()=>{
      FEU.buf=rd.result;FEU.name=f.name;
      const st=$('#feuStatus');if(st)st.innerHTML='<div class="feu-load">Analyse du feuillet…</div>';
      try{const d=await feuDetect(rd.result);FEU.rows=d.rows;FEU.xRight=d.xRight;FEU.npages=d.npages;FEU.codes=d.codes;FEU.missing=d.missing;}
      catch(err){FEU.rows=null;const s=$('#feuStatus');if(s)s.innerHTML='<div class="feu-err">'+(err&&err.message||err)+'</div>';return;}
      renderFeuillet();
    };
    rd.readAsArrayBuffer(f);
  };
  fi.click();
}

function renderFeuillet(){
  const app=$('#app');
  const counted=REFS.filter(r=>ST.c[r.code]&&ST.c[r.code].counted).length;
  let h='<div class="feu-wrap">';
  h+='<p class="ref-hint">Importe le <b>PDF du feuillet du mois</b>. L\u2019app remplit <b>uniquement la colonne Lot1</b> en bleu (compté → physique ; non compté → état de stock, 0 si absent). Le feuillet est conservé à l\u2019identique ; Lot2…Total restent vides.</p>';
  h+='<div class="bil-src">Comptage chargé : <b>'+(ST.date||'—')+'</b>'+(ST.agent?(' · '+esc(ST.agent)):'')+' — '+counted+' / '+REFS.length+' compté(s).</div>';
  h+='<button id="feuPick" class="ref-add">'+(FEU.rows?'Changer de feuillet (PDF)':'Importer le feuillet (PDF)')+'</button>';
  h+='<div id="feuStatus">';
  if(FEU.rows){
    h+='<div class="feu-ok"><b>'+FEU.name+'</b><br>'+FEU.codes+' ligne(s) détectée(s) sur '+FEU.npages+' page(s). Colonne Lot1 calée (bord droit '+FEU.xRight.toFixed(0)+').</div>';
    if(FEU.missing.length){
      h+='<div class="feu-warn"><b>'+FEU.missing.length+' article(s) compté(s) sans ligne sur le feuillet</b> — à ajouter à la main :<ul>'+FEU.missing.map(m=>'<li>'+esc(m)+'</li>').join('')+'</ul></div>';
    }
    h+='<button id="feuGen" class="bil-reco ko" style="width:100%;border:none;cursor:pointer;justify-content:center">Générer le PDF rempli</button>';
    h+='<p class="feu-note">Si Trebuchet MS (<code>trebuc.ttf</code>) est présent dans l\u2019app, il est utilisé automatiquement ; sinon Helvetica de remplacement.</p>';
  }
  h+='</div><div class="pf-sec feu-history"><div class="pf-h">Feuillets remplis archives</div><div id="feuHist" class="feu-hist">Chargement...</div></div></div>';
  app.innerHTML=h;
  const pk=$('#feuPick');if(pk)pk.onclick=feuPick;
  const gn=$('#feuGen');if(gn)gn.onclick=feuGenerate;
  feuLoadArchive();
}
