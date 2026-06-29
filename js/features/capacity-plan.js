/* ================= ÉTAPES 4 & 5 — CAPACITÉ + PLAN ================= */
const SEED_PLAN={"DIAMO LAIT 5KG":{prio:1,objectif:207,part:''},"DIAMO LAIT 20G X100":{prio:2,objectif:'',part:2},"DIAMO LAIT 10KG":{prio:3,objectif:'',part:1},"DIAMO LAIT 400G X 10":{prio:4,objectif:'',part:1},"CARTON LAITY 20G":{prio:5,objectif:'',part:''},"DIAMO CAFE AU LAIT 30G X 50":{prio:'',objectif:'',part:''}};
let PLAN=lsGet('lep_plan',null); if(PLAN===null){PLAN=clone(SEED_PLAN);lsSet('lep_plan',PLAN);}
const SEED_ARRETS=[{lbl:'Démarrage',min:30,freq:'once'},{lbl:'Changement de bobine',min:30,freq:'parprod'},{lbl:'Fin de production',min:30,freq:'once'}];
const SEED_MACHINES=[
 {id:'m20',nom:'Machine 20 g',pistes:6,cadence:40,arrets:clone(SEED_ARRETS),prods:[{p:'DIAMO LAIT 20G X100',sachetsUb:100,debit:''},{p:'DIAMO CAFE AU LAIT 30G X 50',sachetsUb:50,debit:''},{p:'CARTON LAITY 20G',sachetsUb:100,debit:''}]},
 {id:'m400',nom:'Machine 400 g',pistes:1,cadence:30,arrets:clone(SEED_ARRETS),prods:[{p:'DIAMO LAIT 400G X 10',sachetsUb:10,debit:''}]},
 {id:'msac',nom:'Machine sacs (5 / 10 kg)',pistes:'',cadence:'',arrets:clone(SEED_ARRETS),prods:[{p:'DIAMO LAIT 5KG',sachetsUb:'',debit:30},{p:'DIAMO LAIT 10KG',sachetsUb:'',debit:18}]}
];
let MACHINES=lsGet('lep_machines',null); if(MACHINES===null){MACHINES=clone(SEED_MACHINES);lsSet('lep_machines',MACHINES);}
let MACHINES_MIGRATED=false;
MACHINES.forEach(m=>{
  if(!Array.isArray(m.arrets))m.arrets=clone(SEED_ARRETS);
  if(!m.mode)m.mode=num(m.cadence)>0?'sachets':'direct';
  if(m.id==='m400'&&m.mode==='sachets'){
    if(!(num(m.pistes)>0)){m.pistes=1;MACHINES_MIGRATED=true;}
    if(!(num(m.cadence)>0)){m.cadence=30;MACHINES_MIGRATED=true;}
    (m.prods||[]).forEach(e=>{if(e&&e.p==='DIAMO LAIT 400G X 10'&&!(num(e.sachetsUb)>0)){e.sachetsUb=10;MACHINES_MIGRATED=true;}});
  }
});
if(MACHINES_MIGRATED)lsSet('lep_machines',MACHINES);
let PRODCFG=lsGet('lep_prodcfg',{heuresQuart:8,quartsJour:1,parallele:false});
function saveMachines(){lsSet('lep_machines',MACHINES);}
function machineForProd(prod){for(const m of MACHINES){const e=(m.prods||[]).find(x=>x.p===prod);if(e)return {m:m,e:e};}return null;}
function prodDebit(prod){
  const f=machineForProd(prod);if(!f)return null;
  const calc=(num(f.m.pistes)>0&&num(f.m.cadence)>0&&num(f.e.sachetsUb)>0)?num(f.m.pistes)*num(f.m.cadence)*60/num(f.e.sachetsUb):0;
  let d=(f.m.mode==='sachets'&&calc>0)?calc:num(f.e.debit);
  if(!(d>0)&&calc>0)d=calc;
  return {m:f.m,debit:d,eff:d>0?d:0};
}
function arretsMin(m,nbProds){return (m.arrets||[]).reduce((s,a)=>s+num(a.min)*(a.freq==='parprod'?Math.max(0,nbProds):1),0);}
function fmtH(h){const H=Math.floor(h);const mn=Math.round((h-H)*60);if(H<=0&&mn<=0)return '0 min';return (H>0?H+' h ':'')+(mn>0?mn+' min':'').trim();}
function planDailyHours(){return Math.max(0.25,(num(PRODCFG.heuresQuart)>0?num(PRODCFG.heuresQuart):8)*(num(PRODCFG.quartsJour)>0?num(PRODCFG.quartsJour):1));}
function arretKey(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function machineStops(m){
  const out={startup:0,endDay:0,change:0,otherOnce:0};
  (m&&m.arrets||[]).forEach(a=>{
    const minutes=num(a.min);if(!(minutes>0))return;
    const lbl=arretKey(a.lbl);
    if(lbl.indexOf('fin')>=0)out.endDay+=minutes;
    else if(lbl.indexOf('demarrage')>=0||lbl.indexOf('prepar')>=0)out.startup+=minutes;
    else if(a.freq==='parprod'||lbl.indexOf('changement')>=0||lbl.indexOf('bobine')>=0||lbl.indexOf('transition')>=0)out.change+=minutes;
    else out.otherOnce+=minutes;
  });
  return out;
}
function machineRestartMin(m){
  const s=machineStops(m);
  return Math.round((s.startup>0?s.startup/2:s.change/2)*10)/10;
}
function addEstimateStat(stats,m,key,minutes){
  if(!(minutes>0))return;
  const id=(m&&m.id)||'unknown';
  stats.byMachine[id]=stats.byMachine[id]||{m:m||{id:id,nom:'Machine'},prodMin:0,startupMin:0,restartMin:0,endDayMin:0,changeMin:0,otherMin:0,lines:[]};
  stats.byMachine[id][key]=(stats.byMachine[id][key]||0)+minutes;
  stats.totalMin+=minutes;
  stats.dayUsed+=minutes;
}
function closeEstimateDay(stats,m){
  const end=machineStops(m).endDay;
  if(end>0)addEstimateStat(stats,m,'endDayMin',end);
  stats.days+=1;
  stats.dayUsed=0;
}
function addEstimateOverhead(stats,m,key,minutes){
  if(!(minutes>0))return;
  const daily=stats.dailyMin;
  if(stats.dayUsed>0&&stats.dayUsed+minutes>daily)closeEstimateDay(stats,m);
  addEstimateStat(stats,m,key,minutes);
}
function addEstimateProduction(stats,line){
  let remaining=Math.max(0,num(line.h)*60);
  const m=line.m;
  while(remaining>0){
    const end=machineStops(m).endDay;
    const limit=Math.max(1,stats.dailyMin-(end>0?end:0));
    if(stats.dayUsed>=limit){
      closeEstimateDay(stats,m);
      addEstimateOverhead(stats,m,'restartMin',machineRestartMin(m));
    }
    const room=Math.max(1,limit-stats.dayUsed);
    const chunk=Math.min(remaining,room);
    const id=(m&&m.id)||'unknown';
    stats.byMachine[id]=stats.byMachine[id]||{m:m||{id:id,nom:'Machine'},prodMin:0,startupMin:0,restartMin:0,endDayMin:0,changeMin:0,otherMin:0,lines:[]};
    stats.byMachine[id].prodMin+=chunk;
    stats.totalMin+=chunk;
    stats.dayUsed+=chunk;
    remaining-=chunk;
    if(remaining>0){
      closeEstimateDay(stats,m);
      addEstimateOverhead(stats,m,'restartMin',machineRestartMin(m));
    }
  }
}
function planEstimateSequence(lines){
  const stats={dailyMin:planDailyHours()*60,totalMin:0,dayUsed:0,days:lines&&lines.length?1:0,byMachine:{}};
  let prev=null;
  (lines||[]).forEach(line=>{
    const id=(line.m&&line.m.id)||'unknown';
    stats.byMachine[id]=stats.byMachine[id]||{m:line.m||{id:id,nom:'Machine'},prodMin:0,startupMin:0,restartMin:0,endDayMin:0,changeMin:0,otherMin:0,lines:[]};
    stats.byMachine[id].lines.push(line);
    const stops=machineStops(line.m);
    if(!prev){
      addEstimateOverhead(stats,line.m,'startupMin',stops.startup);
      addEstimateOverhead(stats,line.m,'otherMin',stops.otherOnce);
    }else if(prev.m!==line.m){
      addEstimateOverhead(stats,line.m,'restartMin',machineRestartMin(line.m));
    }else if(prev.p!==line.p){
      addEstimateOverhead(stats,line.m,'changeMin',stops.change);
    }
    addEstimateProduction(stats,line);
    prev=line;
  });
  const ms=Object.keys(stats.byMachine).map(k=>{
    const m=stats.byMachine[k];
    m.downMin=m.startupMin+m.restartMin+m.endDayMin+m.changeMin+m.otherMin;
    m.totH=(m.prodMin+m.downMin)/60;
    return m;
  });
  return {totalH:stats.totalMin/60,days:stats.days,ms:ms};
}
function planEstimateItems(items){
  const lines=[];const nonEst=[];
  (items||[]).forEach(it=>{if(num(it.n)<=0)return;const pd=prodDebit(it.produit);
    if(!pd||pd.eff<=0){nonEst.push(it.produit);return;}
    lines.push({p:it.produit,n:num(it.n),h:num(it.n)/pd.eff,m:pd.m});
  });
  const hq=num(PRODCFG.heuresQuart)>0?num(PRODCFG.heuresQuart):8;
  const qj=num(PRODCFG.quartsJour)>0?num(PRODCFG.quartsJour):1;
  let est;
  if(PRODCFG.parallele){
    const byM={};lines.forEach(l=>{const id=(l.m&&l.m.id)||'unknown';byM[id]=byM[id]||[];byM[id].push(l);});
    const parts=Object.keys(byM).map(k=>planEstimateSequence(byM[k]));
    const byId={};parts.forEach(p=>p.ms.forEach(m=>{byId[(m.m&&m.m.id)||'unknown']=m;}));
    const totalH=parts.length?Math.max.apply(null,parts.map(p=>p.totalH)):0;
    est={totalH:totalH,days:parts.length?Math.max.apply(null,parts.map(p=>p.days)):0,ms:Object.keys(byId).map(k=>byId[k])};
  }else{
    est=planEstimateSequence(lines);
  }
  est.quarters=hq>0?est.totalH/hq:0;
  est.workDays=(hq>0&&qj>0)?est.totalH/hq/qj:0;
  est.nonEst=nonEst;
  est.modeText=PRODCFG.parallele?'parallèle : machine la plus chargée':'séquentiel : ordre du plan';
  return est;
}

/* ====== STOCK « VIVANT » (dernier inventaire VALIDÉ + flux depuis sa date) ======
   Base = physique du dernier inventaire VALIDÉ (verrouillé, daté) par article,
   sinon état de stock manuel. Puis projection : + production + entrées − sorties
   − conso (recettes) pour tous les mouvements postérieurs à la date de cet
   inventaire, jusqu'à aujourd'hui. Même formule que la réconciliation d'Analyses.
   Recalculé à l'entrée des onglets Capacité / Plan (voir switchTab). */
let LIVESTOCK=null;                       // {code:qté} ou null si pas encore calculé
let LIVEMETA={hasBase:false,baseDate:null,nbMov:0};
async function refreshLiveStock(){
  LIVESTOCK={};LIVEMETA={hasBase:false,baseDate:null,nbMov:0};
  let recs=[];try{recs=await idbAll();}catch(e){recs=[];}
  // Dernier inventaire VALIDÉ (verrouillé), par date
  const invs=recs.filter(r=>r.locked&&r.st&&r.st.c&&r.id!=='current'
    &&String(r.id).indexOf('prod_')!==0&&String(r.id).indexOf('sortie_')!==0
    &&String(r.id).indexOf('entree_')!==0&&String(r.id).indexOf('fragsess_')!==0)
    .sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||((a.savedAt||0)-(b.savedAt||0)));
  const base=invs[invs.length-1]||null;
  // Base par code : physique du dernier inventaire VALIDÉ (calculé depuis son état) ;
  // à défaut, l'état de stock manuel daté (ETAT_DATE) sert de base.
  const baseMap={};
  REFS.forEach(r=>{const v=ETAT[r.code];baseMap[r.code]=(v!=null&&v!=='')?num(v):0;});
  let baseDate='',baseKind='';
  if(base&&base.st){
    baseDate=String(base.date||'');baseKind='inventory';
    const prevST=ST,prevRO=RO;ST=JSON.parse(JSON.stringify(base.st));RO=true;mergeAndMigrate();
    REFS.forEach(r=>{if(ST.c[r.code]&&ST.c[r.code].counted)baseMap[r.code]=round2(total(r));});
    ST=prevST;RO=prevRO;
  }else if(ETAT_DATE){
    baseDate=ETAT_DATE;baseKind='etat';
  }
  LIVEMETA.hasBase=!!baseDate;LIVEMETA.baseDate=baseDate||null;LIVEMETA.baseKind=baseKind;
  // Flux postérieurs à la date de base, jusqu'à aujourd'hui
  const desToCode={};REFS.forEach(r=>{desToCode[r.des]=r.code;});
  const today=new Date().toISOString().slice(0,10);
  // Sans inventaire daté, on ne projette aucun flux (impossible de savoir lesquels sont « postérieurs »)
  const inWin=r=>{if(!baseDate)return false;const d=String(r.date||'');return d>baseDate&&d<=today;};
  const prod=real.filter(r=>String(r.id).indexOf('prod_')===0&&inWin(r));
  const entr=real.filter(r=>String(r.id).indexOf('entree_')===0&&inWin(r));
  const sort=real.filter(r=>String(r.id).indexOf('sortie_')===0&&inWin(r));
  LIVEMETA.nbMov=prod.length+entr.length+sort.length;
  const add={},conso={},en={},so={};
  prod.forEach(r=>(r.blocks||[]).forEach(bk=>{const n=num(bk.n);if(!bk.p||n<=0)return;
    const code=desToCode[bk.p];if(code)add[code]=(add[code]||0)+n;
    (RECF[bk.p]||[]).forEach(m=>{if(m&&m.code)conso[m.code]=(conso[m.code]||0)+n*num(m.qte);});}));
  const addMov=(arr,obj)=>arr.forEach(r=>[].concat(r.finis||[],r.mp||[]).forEach(x=>{if(!x||!x.a)return;
    const c=desToCode[x.a];if(c&&num(x.q)>0)obj[c]=(obj[c]||0)+num(x.q);}));
  addMov(entr,en);addMov(sort,so);
  REFS.forEach(r=>{const c=r.code;
    LIVESTOCK[c]=num(baseMap[c])+(add[c]||0)+(en[c]||0)-(so[c]||0)-(conso[c]||0);});
}
/* Note explicative affichée sur Capacité / Plan */
function liveStockNote(){
  if(LIVEMETA&&LIVEMETA.hasBase){
    const src=LIVEMETA.baseKind==='inventory'
      ?('dernier inventaire <b>validé 🔒</b> du <b>'+esc(LIVEMETA.baseDate||'?')+'</b>')
      :('<b>état de stock</b> du <b>'+esc(LIVEMETA.baseDate||'?')+'</b>');
    return 'Stock estimé = '+src+' + production + entrées − sorties − consommation depuis ('+LIVEMETA.nbMov+' mouvement(s) pris en compte).';
  }
  return 'Stock estimé = <b>état de stock manuel</b> (aucune date de référence : flux non projetés). Valide un inventaire (Historique → 🔒 Valider) ou renseigne la date de l’état de stock.';
}
/* Stock disponible d'une matière pour Capacité/Plan : stock VIVANT prioritaire
   (dernier inventaire validé + production + entrées − sorties − conso depuis sa date).
   Le brouillon en cours n'est PAS utilisé ici. Repli : état de stock manuel. */
function stockDispo(code){
  if(!code)return 0;
  if(LIVESTOCK&&code in LIVESTOCK)return LIVESTOCK[code];
  const r=REFS.find(x=>x.code===code);
  if(r&&ST.c[code]&&ST.c[code].counted)return round2(total(r));
  const v=ETAT[code];return (v!=null&&v!=='')?num(v):0;
}
function catOf(code){const r=REFS.find(x=>x.code===code);return (r&&r.cat)||SEED_CAT[code]||'';}
function poidsUnite(prod){return (RECF[prod]||[]).reduce((s,m)=>s+(catOf(m.code)==='mp'?num(m.qte):0),0);}
function matNom(m){return m.des||m.code||'?';}

/* ---------- CAPACITÉ ---------- */
function computeCapaciteFromStock(stockMap){
  return Object.keys(RECF).map(prod=>{
    let cap=null,goulot=null;const lignes=[];
    (RECF[prod]||[]).forEach(m=>{
      const q=num(m.qte);const s=(stockMap&&m.code&&(m.code in stockMap))?num(stockMap[m.code]):stockDispo(m.code);
      const poss=q?s/q:null;
      lignes.push({nom:matNom(m),code:m.code,q:q,stock:s,poss:poss});
      if(poss!=null&&(cap==null||poss<cap)){cap=poss;goulot=matNom(m);}
    });
    lignes.sort((a,b)=>(a.poss==null?1:0)-(b.poss==null?1:0)||((a.poss==null?9e18:a.poss)-(b.poss==null?9e18:b.poss)));
    return {produit:prod,cap:cap,goulot:goulot,lignes:lignes};
  });
}
function computeCapacite(){
  return computeCapaciteFromStock(null);
}
function renderCapacite(){
  const app=$('#app');const res=computeCapacite();
  const counted=REFS.filter(r=>ST.c[r.code]&&ST.c[r.code].counted).length;
  let h='<div class="cap-wrap">';
  h+='<p class="ref-hint">Production possible par produit avec le <b>stock disponible</b>. Calcul autonome par produit : non cumulable (matières partagées).</p>';
  h+='<div class="bil-src">'+liveStockNote()+'</div>';
  h+='<button id="capPDF" class="bil-print" style="width:100%;margin:4px 0 12px">📄 Exporter PDF (capacité & stock)</button>';
  res.forEach(p=>{
    const capN=p.cap==null?0:Math.floor(p.cap);
    h+='<div class="cap-card"><div class="cap-h"><div class="cap-prod">'+esc(p.produit)+'</div>'
      +'<div class="cap-val'+(capN<=0?' zero':'')+'"><b>'+fmtq(capN)+'</b><small>unités</small></div></div>'
      +'<div class="cap-goulot"><span>goulot</span><b>'+esc(p.goulot||'—')+'</b></div>'
      +'<details class="cap-det"><summary>Détail des matières</summary><div class="cap-lines">';
    p.lignes.forEach(l=>{
      const isG=l.nom===p.goulot;
      h+='<div class="cap-line'+(isG?' g':'')+'"><div class="cl-l"><span class="cl-nom">'+esc(l.nom)+'</span>'
        +'<span class="cl-sub">'+fmtq(l.q)+'/u · stock '+fmtq(l.stock)+'</span></div>'
        +'<div class="cl-r">≈ '+(l.poss==null?'—':fmtq(Math.floor(l.poss)))+'<small>u</small></div></div>';
    });
    h+='</div></details></div>';
  });
  h+='</div>';
  app.innerHTML=h;
  // STANDARD : centrer l'écran sur la zone quand on plie/déplie une section
  app.querySelectorAll('details.cap-det').forEach(d=>d.addEventListener('toggle',()=>{
    const card=d.closest('.cap-card')||d;setTimeout(()=>scrollCardIntoView(card),60);
  }));
  const cp=$('#capPDF');if(cp)cp.onclick=()=>capacitePDF();
}
async function capacitePDF(){
  try{await ensurePDF();}catch(e){toast('PDF indisponible (hors-ligne, jamais chargé)');return;}
  if(!window.PDFLib){toast('PDF indisponible ici (teste sur l\u2019app déployée)');return;}
  try{
    if(!LIVESTOCK)await refreshLiveStock();
    const prods=computeCapacite();
    if(!prods.length){toast('Aucun produit/recette');return;}
    const matMap={};prods.forEach(p=>p.lignes.forEach(l=>{if(!matMap[l.code])matMap[l.code]={nom:l.nom,stock:l.stock};}));
    const matCodes=Object.keys(matMap).sort((a,b)=>String(matMap[a].nom).localeCompare(String(matMap[b].nom)));
    const hq=num(PRODCFG.heuresQuart)>0?num(PRODCFG.heuresQuart):8;const qj=num(PRODCFG.quartsJour)>0?num(PRODCFG.quartsJour):1;
    const doc=await PDFLib.PDFDocument.create();
    const F=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const FB=await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const INK=PDFLib.rgb(0.07,0.12,0.17),GREY=PDFLib.rgb(0.4,0.45,0.5),WHITE=PDFLib.rgb(1,1,1);
    const C_RED=PDFLib.rgb(0.85,0.2,0.3),C_ORA=PDFLib.rgb(1,0.86,0.6),C_GRN=PDFLib.rgb(0.82,0.93,0.84),C_ZERO=PDFLib.rgb(0.55,0.1,0.15),C_NA=PDFLib.rgb(0.93,0.94,0.92),C_MAT=PDFLib.rgb(0.96,0.97,0.95),BORD=PDFLib.rgb(0.8,0.82,0.8),C_HEAD=PDFLib.rgb(0.07,0.12,0.17);
    const W=842,H=595,M=26;const matColW=196;const pcount=prods.length;
    const prodColW=Math.max(70,Math.min(120,(W-2*M-matColW)/pcount));
    const rowH=15,headH=48;
    let page,y;
    const pdfText=s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/[–—−]/g,'-')
      .replace(/→/g,'->').replace(/≈/g,'~').replace(/≤/g,'<=').replace(/≥/g,'>=')
      .replace(/·/g,'-').replace(/…/g,'...').replace(/[^\x20-\x7E]/g,'');
    const T=(s,x,yy,sz,bold,col)=>page.drawText(pdfText(s),{x:x,y:yy,size:sz,font:bold?FB:F,color:col||INK});
    const rect=(x,yTop,w,hgt,col)=>page.drawRectangle({x:x,y:yTop-hgt,width:w,height:hgt,color:col,borderColor:BORD,borderWidth:0.5});
    const short=(s,n)=>{s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s;};
    const drawHeader=()=>{
      rect(M,y,matColW,headH,C_HEAD);T('Matière / emballage  [stock]',M+4,y-14,8,true,WHITE);T('Production possible →',M+4,y-30,7,false,PDFLib.rgb(0.6,0.75,0.9));
      let x=M+matColW;
      prods.forEach(p=>{const capN=p.cap==null?0:Math.floor(p.cap);
        const pd=prodDebit(p.produit);const rate=pd&&pd.eff>0?pd.eff*hq*qj:0;const days=rate>0&&p.cap!=null?p.cap/rate:null;
        rect(x,y,prodColW,headH,C_HEAD);
        T(short(p.produit,17),x+3,y-12,6.5,true,WHITE);
        T('cap '+fmtq(capN),x+3,y-26,7,true,PDFLib.rgb(1,0.8,0.55));
        T(days!=null?('~'+(Math.round(days*10)/10)+' j prod.'):'—',x+3,y-38,6.5,false,PDFLib.rgb(0.7,0.85,0.95));
        x+=prodColW;});
      y-=headH;
    };
    page=doc.addPage([W,H]);y=H-M;
    T('Capacité de production & stock réel',M,y,15,true);y-=18;
    T((LIVEMETA&&LIVEMETA.hasBase?('Stock = inventaire du '+(LIVEMETA.baseDate||'?')+' + production + entrees - sorties - conso depuis.'):'Stock = etat de stock manuel (aucun inventaire date).'),M,y,9,false,GREY);y-=16;
    drawHeader();
    matCodes.forEach(code=>{
      if(y<M+28){page=doc.addPage([W,H]);y=H-M;drawHeader();}
      const mm=matMap[code];
      rect(M,y,matColW,rowH,mm.stock<=0?PDFLib.rgb(0.99,0.9,0.9):C_MAT);
      T(short(mm.nom,30),M+4,y-10,6.8,false,INK);
      T('['+fmtq(mm.stock)+']',M+matColW-46,y-10,6.8,true,mm.stock<=0?C_RED:GREY);
      let x=M+matColW;
      prods.forEach(p=>{const l=p.lignes.find(z=>z.code===code);
        if(!l||l.poss==null){rect(x,y,prodColW,rowH,C_NA);}
        else{const cap=p.cap==null?0:p.cap;let fill=C_GRN,tc=INK,bold=false;
          if(mm.stock<=0){fill=C_ZERO;tc=WHITE;bold=true;}
          else if(l.poss<=cap*1.0001){fill=C_RED;tc=WHITE;bold=true;}
          else if(l.poss<=cap*1.15){fill=C_ORA;}
          rect(x,y,prodColW,rowH,fill);T(fmtq(Math.floor(l.poss)),x+4,y-10,7,bold,tc);}
        x+=prodColW;});
      y-=rowH;
    });
    y-=10;if(y<M+10){page=doc.addPage([W,H]);y=H-M;}
    T('Légende :  Rouge = goulot (limite la production)   ·   Orange = à risque (proche du goulot)   ·   Vert = suffisant   ·   Rouge foncé = stock nul   ·   Vide = absent de la recette.',M,y,7,false,GREY);
    const bytes=await doc.save();
    shareBlob('capacite_'+(ST.date||todayStr())+'.pdf',bytes,'application/pdf','Capacité & stock');
    toast('PDF généré');
  }catch(e){toast('Échec de la génération PDF');}
}

/* ---------- PLAN ---------- */
function planRows(){
  return Object.keys(PLAN||{}).filter(prod=>RECF[prod]).map(prod=>{
    const p=PLAN[prod]||{};
    return {produit:prod,prio:p.prio,objectif:p.objectif,part:p.part};
  }).sort((a,b)=>{
    const ap=String(a.prio).trim()===''?9999:num(a.prio),bp=String(b.prio).trim()===''?9999:num(b.prio);
    return ap-bp||String(a.produit).localeCompare(String(b.produit),'fr');
  });
}
function buildReste(){const r={};Object.keys(RECF).forEach(prod=>(RECF[prod]||[]).forEach(m=>{if(m.code&&!(m.code in r))r[m.code]=stockDispo(m.code);}));return r;}
function maxGoulot(reste,prod){let maxs=null,goulot=null;(RECF[prod]||[]).forEach(m=>{const q=num(m.qte);const poss=q?((m.code?(reste[m.code]||0):0)/q):null;if(poss!=null&&(maxs==null||poss<maxs)){maxs=poss;goulot=matNom(m);}});return {maxs:maxs==null?0:maxs,goulot:goulot};}
function deduire(reste,prod,x){(RECF[prod]||[]).forEach(m=>{if(m.code)reste[m.code]=(reste[m.code]||0)-x*num(m.qte);});}


/* Option B — commandes fermes (objectif) + prorata du reste (part, base tonnage) */
function simulerB(){
  const reste=buildReste();
  const rows=planRows();
  const firm=rows.filter(r=>String(r.objectif).trim()!=='').map(r=>({produit:r.produit,prio:String(r.prio).trim()===''?999:num(r.prio),objectif:Math.floor(num(r.objectif))})).sort((a,b)=>a.prio-b.prio);
  const resFirm=[];
  firm.forEach(f=>{const mg=maxGoulot(reste,f.produit);const x=Math.floor(Math.min(mg.maxs,f.objectif));deduire(reste,f.produit,x);
    const manque=f.objectif-x;
    resFirm.push({produit:f.produit,prio:f.prio,objectif:f.objectif,n:x,limite:manque<=0?'objectif atteint':'STOCK INSUFFISANT (manque '+manque+') — goulot : '+mg.goulot,ok:manque<=0});});
  // prorata du reste
  const actifs=[],exclus=[];
  rows.filter(r=>String(r.part).trim()!==''&&String(r.objectif).trim()===''&&num(r.part)>0).forEach(r=>{
    let cap=null;(RECF[r.produit]||[]).forEach(m=>{const q=num(m.qte);const poss=q?((m.code?(reste[m.code]||0):0)/q):null;if(poss!=null&&(cap==null||poss<cap))cap=poss;});
    if((cap==null?0:cap)<1)exclus.push(r.produit);else actifs.push({produit:r.produit,part:num(r.part)});
  });
  const poids={};actifs.forEach(a=>poids[a.produit]=poidsUnite(a.produit)||1);
  const coef={};
  actifs.forEach(a=>{const w=a.part/poids[a.produit];(RECF[a.produit]||[]).forEach(m=>{if(m.code)coef[m.code]=(coef[m.code]||0)+w*num(m.qte);});});
  let k=null,goulotCode=null;
  Object.keys(coef).forEach(code=>{const a=coef[code];if(a>0){const r=(reste[code]||0)/a;if(k==null||r<k){k=r;goulotCode=code;}}});
  k=k==null?0:k;
  const resPro=[];
  actifs.forEach(a=>{const x=Math.floor(k*a.part/poids[a.produit]);deduire(reste,a.produit,x);
    resPro.push({produit:a.produit,part:a.part,poids:poids[a.produit],n:x,tonnage:Math.round(x*poids[a.produit]*10)/10});});
  // matières en négatif (objectifs fermes trop ambitieux)
  const negs=Object.keys(reste).filter(c=>reste[c]<-1e-6).map(c=>{const r=REFS.find(x=>x.code===c);return (r?r.des:c)+' ('+fmtq(Math.round(reste[c]*100)/100)+')';});
  let goulotNom=goulotCode;const rg=REFS.find(x=>x.code===goulotCode);if(rg)goulotNom=rg.des;
  return {resFirm:resFirm,resPro:resPro,reste:reste,exclus:exclus,goulot:goulotNom,negs:negs};
}

function savePlan(){lsSet('lep_plan',PLAN);}
function setPlan(prod,field,val){PLAN[prod]=PLAN[prod]||{prio:'',objectif:'',part:''};PLAN[prod][field]=val;savePlan();}
function nextPlanPrio(){
  let max=0;planRows().forEach(r=>{if(String(r.prio).trim()!=='')max=Math.max(max,Math.floor(num(r.prio)));});
  return max+1;
}
function addPlanProduct(prod){
  if(!prod||!RECF[prod])return false;
  PLAN[prod]=PLAN[prod]||{prio:nextPlanPrio(),objectif:'',part:''};
  if(String(PLAN[prod].prio).trim()==='')PLAN[prod].prio=nextPlanPrio();
  normalizePriorities(prod);savePlan();return true;
}
function removePlanProduct(prod){
  if(PLAN&&PLAN[prod])delete PLAN[prod];
  normalizePriorities(null);savePlan();
}
function resetPlan(){PLAN={};savePlan();}

function fmtPct(v){v=Math.round(v*100)/100;return (Math.abs(v-Math.round(v))<1e-9)?String(Math.round(v)):String(v).replace('.',',');}
function partSumExcl(prod){let s=0;planRows().forEach(r=>{if(r.produit!==prod){const v=num(r.part);if(v>0)s+=v;}});return s;}
function refreshPartHints(){
  let used=0;planRows().forEach(r=>{const v=num(r.part);if(v>0)used+=v;});
  document.querySelectorAll('.pf-pct').forEach(inp=>{
    const others=used-(num((PLAN[inp.dataset.prod]||{}).part)||0);
    const hh=inp.closest('label').querySelector('.part-hint');
    if(hh)hh.textContent=inp.disabled?'':'dispo '+fmtPct(Math.max(0,100-others))+'%';
  });
  const pt=document.getElementById('partTotal');
  if(pt)pt.innerHTML='Réparti <b>'+fmtPct(used)+'%</b> · reste <b>'+fmtPct(Math.max(0,100-used))+'%</b>'+(used>100?' <span class="pt-ko">⚠ dépasse 100%</span>':'');
}
/* priorités uniques 1..N : l'article modifié prend sa place, les autres se décalent (insertion) */
function normalizePriorities(modifiedProd){
  const rows=planRows().filter(r=>String(r.prio).trim()!=='');
  if(modifiedProd==null||!PLAN[modifiedProd]||String(PLAN[modifiedProd].prio).trim()===''){
    rows.sort((a,b)=>num(a.prio)-num(b.prio));
    rows.forEach((r,i)=>{PLAN[r.produit]=PLAN[r.produit]||{prio:'',objectif:'',part:''};PLAN[r.produit].prio=i+1;});
    savePlan();return;
  }
  const target=Math.max(1,Math.floor(num(PLAN[modifiedProd].prio)));
  const others=rows.filter(r=>r.produit!==modifiedProd).sort((a,b)=>num(a.prio)-num(b.prio)).map(r=>r.produit);
  const idx=Math.min(Math.max(target-1,0),others.length);
  others.splice(idx,0,modifiedProd);
  others.forEach((prod,i)=>{PLAN[prod]=PLAN[prod]||{prio:'',objectif:'',part:''};PLAN[prod].prio=i+1;});
  savePlan();
}
function renderPlan(){
  const app=$('#app');
  const rows=planRows();
  const addable=Object.keys(RECF).filter(prod=>!PLAN[prod]).sort((a,b)=>String(a).localeCompare(String(b),'fr'));
  let h='<div class="plan-wrap">';
  h+='<div class="bil-src">'+liveStockNote()+'</div>';
  h+='<p class="ref-hint">Pour chaque produit : une <b>priorité</b> (obligatoire pour l\u2019activer), puis <b>soit</b> une <b>quantité</b> ferme <b>soit</b> une <b>part %</b> du reste. Les quantités fermes sont produites d\u2019abord (par priorité), puis le stock restant est partagé au prorata du tonnage selon les % (somme ≤ 100 %).</p>';
  h+='<div class="plan-pick"><select id="planPick"><option value="">Choisir un produit fini</option>'+addable.map(p=>'<option value="'+esc(p)+'">'+esc(p)+'</option>').join('')+'</select><button id="planAdd" type="button">+ Ajouter</button></div>';
  h+='<button id="planReset" class="plan-reset" type="button">Repartir a zero</button>';
  h+='<div class="plan-rows">';
  if(!rows.length)h+='<p class="hist-empty">Aucun produit dans ce plan. Choisis un produit fini puis ajoute-le.</p>';
  rows.forEach(r=>{
    const hasPrio=String(r.prio).trim()!=='';
    const hasObj=String(r.objectif).trim()!=='';
    const hasPart=String(r.part).trim()!=='';
    const objDis=!hasPrio||hasPart;
    const partDis=!hasPrio||hasObj;
    h+='<div class="plan-row'+(hasPrio?'':' off')+'"><div class="pr-head"><div class="pr-prod">'+esc(r.produit)+'</div><button class="pr-remove" data-prod="'+esc(r.produit)+'" type="button">Retirer</button></div><div class="pr-fields">'
      +'<label>prio<input class="pf pf-prio" data-prod="'+esc(r.produit)+'" data-f="prio" inputmode="numeric" value="'+esc(r.prio)+'"></label>'
      +'<label>quantité<input class="pf pf-obj" data-prod="'+esc(r.produit)+'" data-f="objectif" inputmode="numeric" value="'+esc(r.objectif)+'"'+(objDis?' disabled':'')+'></label>'
      +'<label>part %<input class="pf pf-pct" data-prod="'+esc(r.produit)+'" data-f="part" inputmode="decimal" value="'+esc(r.part)+'"'+(partDis?' disabled':'')+'><span class="part-hint"></span></label>'
      +'</div></div>';
  });
  h+='</div>';
  h+='<div class="part-total" id="partTotal"></div>';
  h+='<button id="planRun" class="ref-add">Simuler la production</button><div id="planRes"></div></div>';
  app.innerHTML=h;
  // priorité : validée à la sortie du champ -> renumérotation propre + re-render
  const addBtn=$('#planAdd'),pick=$('#planPick');
  if(addBtn&&pick)addBtn.onclick=()=>{if(addPlanProduct(pick.value))renderPlan();else toast('Choisir un produit fini');};
  const resetBtn=$('#planReset');if(resetBtn)resetBtn.onclick=()=>{if(confirm('Effacer ce plan et repartir a zero ?')){resetPlan();renderPlan();}};
  app.querySelectorAll('.pr-remove').forEach(btn=>btn.onclick=()=>{removePlanProduct(btn.dataset.prod);renderPlan();});
  app.querySelectorAll('.pf-prio').forEach(inp=>inp.addEventListener('change',e=>{
    const prod=e.target.dataset.prod;const v=e.target.value.trim();
    PLAN[prod]=PLAN[prod]||{prio:'',objectif:'',part:''};
    if(v===''){PLAN[prod].prio='';normalizePriorities(null);}
    else{PLAN[prod].prio=Math.max(1,Math.floor(num(v)));normalizePriorities(prod);}
    savePlan();renderPlan();
  }));
  // quantité ferme : exclut la part %
  app.querySelectorAll('.pf-obj').forEach(inp=>inp.addEventListener('input',e=>{
    const prod=e.target.dataset.prod;const v=e.target.value;const part=e.target.closest('.pr-fields').querySelector('.pf-pct');
    setPlan(prod,'objectif',v);
    if(v.trim()!==''){if(part){part.value='';part.disabled=true;}setPlan(prod,'part','');}
    else if(part&&String((PLAN[prod]||{}).prio).trim()!==''){part.disabled=false;}
    refreshPartHints();
  }));
  // part % : exclut la quantité + plafond 100
  app.querySelectorAll('.pf-pct').forEach(inp=>inp.addEventListener('input',e=>{
    const prod=e.target.dataset.prod;const obj=e.target.closest('.pr-fields').querySelector('.pf-obj');
    if(e.target.value.trim()===''){setPlan(prod,'part','');if(obj&&String((PLAN[prod]||{}).prio).trim()!=='')obj.disabled=false;}
    else{let v=num(e.target.value);if(v<0)v=0;const maxA=Math.max(0,100-partSumExcl(prod));if(v>maxA){v=maxA;e.target.value=fmtPct(v);}setPlan(prod,'part',v);if(obj){obj.value='';obj.disabled=true;}setPlan(prod,'objectif','');}
    refreshPartHints();
  }));
  refreshPartHints();
  $('#planRun').onclick=()=>{
    const b=simulerB();
    const items=b.resFirm.map(x=>({produit:x.produit,n:x.n})).concat(b.resPro.map(x=>({produit:x.produit,n:x.n})));
    const res=$('#planRes');
    res.innerHTML=planResBHTML(b)+planChargeHTML(items)+planRemainingCapacityHTML(b);
    res.querySelectorAll('details.cap-det').forEach(d=>d.addEventListener('toggle',()=>{
      const card=d.closest('.cap-card')||d;setTimeout(()=>scrollCardIntoView(card),60);
    }));
    const pp=$('#planCapPDF');if(pp)pp.onclick=()=>planCapacityPDF(b);
  };
}
function planResBHTML(r){
  let h='<div class="plan-res">';
  if(r.resFirm.length){h+='<h4 class="plan-sub">Commandes fermes</h4>';
    r.resFirm.forEach(x=>{h+='<div class="plr '+(x.ok?'ok':'ko')+'"><div class="plr-h"><b>'+esc(x.produit)+'</b> <span class="plr-n">'+fmtq(x.n)+' u</span></div><div class="plr-l">prio '+x.prio+' · objectif '+x.objectif+' — '+esc(x.limite)+'</div></div>';});}
  if(r.resPro.length){h+='<h4 class="plan-sub">Prorata du reste (tonnage)</h4>';
    r.resPro.forEach(x=>{h+='<div class="plr ok"><div class="plr-h"><b>'+esc(x.produit)+'</b> <span class="plr-n">'+fmtq(x.n)+' u</span></div><div class="plr-l">part '+fmtq(x.part)+'% · '+fmtq(x.poids)+' kg/u · ≈ '+fmtq(x.tonnage)+' kg</div></div>';});
    h+='<div class="goulot-box"><span class="gb-tag">⚠ GOULOT</span><span class="gb-nom">'+esc(r.goulot||'—')+'</span><span class="gb-sub">matière qui limite le partage</span></div>';}
  if(r.exclus.length)h+='<div class="plr nf">Exclus du prorata (matière à 0) : '+r.exclus.map(esc).join(', ')+'</div>';
  if(r.negs.length)h+='<div class="plr ko">⚠ Matières en négatif (objectifs fermes trop ambitieux) : '+r.negs.map(esc).join(' · ')+'</div>';
  h+='</div>';return h;
}
function planPlannedItems(b){
  const items=[];
  (b.resFirm||[]).forEach(x=>items.push({produit:x.produit,n:x.n,objectif:x.objectif}));
  (b.resPro||[]).forEach(x=>items.push({produit:x.produit,n:x.n}));
  return items.filter(x=>num(x.n)>0||num(x.objectif)>0);
}
function planPDFChargeSummary(items){
  const est=planEstimateItems(items||[]);
  return {totalH:est.totalH,quarters:est.quarters,days:est.workDays,nonEst:est.nonEst};
}
function planPlannedLine(items){
  if(!items.length)return 'Aucune production prevue.';
  return items.map(x=>esc(x.produit)+' : <b>'+fmtq(x.n)+'</b> u'+(x.objectif&&x.objectif!==x.n?' <small>(objectif '+fmtq(x.objectif)+')</small>':'')).join(' · ');
}
function planRemainingCapacityHTML(b){
  const reste=(b&&b.reste)||{};
  const planned=planPlannedItems(b||{});
  const caps=computeCapaciteFromStock(reste||{});
  let h='<div class="plan-cap-section"><h4 class="plan-sub">Capacit&eacute; restante apr&egrave;s ce plan th&eacute;orique</h4>';
  h+='<div class="plan-cap-note"><b>Production pr&eacute;vue</b> : '+planPlannedLine(planned)+'<br>Lecture identique &agrave; Capacit&eacute;, mais avec les mati&egrave;res restantes apr&egrave;s les quantit&eacute;s simul&eacute;es ci-dessus. Calcul autonome par produit : non cumulable.</div>';
  h+='<button id="planCapPDF" class="bil-print" style="width:100%;margin:0 0 4px">📄 Exporter PDF (capacit&eacute; apr&egrave;s plan)</button>';
  caps.forEach(p=>{
    const capN=Math.max(0,Math.floor(p.cap==null?0:p.cap));
    h+='<div class="cap-card plan-cap-card"><div class="cap-h"><div class="cap-prod">'+esc(p.produit)+'</div>'
      +'<div class="cap-val'+(capN<=0?' zero':'')+'"><b>'+fmtq(capN)+'</b><small>unit&eacute;s</small></div></div>'
      +'<div class="cap-goulot"><span>goulot</span><b>'+(p.goulot?esc(p.goulot):'&mdash;')+'</b></div>'
      +'<details class="cap-det"><summary>D&eacute;tail des mati&egrave;res restantes</summary><div class="cap-lines">';
    p.lignes.forEach(l=>{
      const isG=l.nom===p.goulot;
      const poss=l.poss==null?null:Math.max(0,Math.floor(l.poss));
      h+='<div class="cap-line'+(isG?' g':'')+'"><div class="cl-l"><span class="cl-nom">'+esc(l.nom)+'</span>'
        +'<span class="cl-sub">'+fmtq(l.q)+'/u &middot; reste '+fmtq(Math.round(l.stock*100)/100)+'</span></div>'
        +'<div class="cl-r">&asymp; '+(poss==null?'&mdash;':fmtq(poss))+'<small>u</small></div></div>';
    });
    h+='</div></details></div>';
  });
  h+='</div>';return h;
}
async function planCapacityPDF(b){
  try{await ensurePDF();}catch(e){toast('PDF indisponible (hors-ligne, jamais chargé)');return;}
  if(!window.PDFLib){toast('PDF indisponible ici (teste sur l\u2019app déployée)');return;}
  try{
    const planned=planPlannedItems(b||{});
    const prods=computeCapaciteFromStock((b&&b.reste)||{});
    if(!prods.length){toast('Aucun produit/recette');return;}
    const matMap={};prods.forEach(p=>p.lignes.forEach(l=>{if(!matMap[l.code])matMap[l.code]={nom:l.nom,stock:l.stock};}));
    const matCodes=Object.keys(matMap).sort((a,b)=>String(matMap[a].nom).localeCompare(String(matMap[b].nom)));
    const hq=num(PRODCFG.heuresQuart)>0?num(PRODCFG.heuresQuart):8;const qj=num(PRODCFG.quartsJour)>0?num(PRODCFG.quartsJour):1;
    const doc=await PDFLib.PDFDocument.create();
    const F=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const FB=await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const INK=PDFLib.rgb(0.07,0.12,0.17),GREY=PDFLib.rgb(0.4,0.45,0.5),WHITE=PDFLib.rgb(1,1,1);
    const C_RED=PDFLib.rgb(0.85,0.2,0.3),C_ORA=PDFLib.rgb(1,0.86,0.6),C_GRN=PDFLib.rgb(0.82,0.93,0.84),C_ZERO=PDFLib.rgb(0.55,0.1,0.15),C_NA=PDFLib.rgb(0.93,0.94,0.92),C_MAT=PDFLib.rgb(0.96,0.97,0.95),BORD=PDFLib.rgb(0.8,0.82,0.8),C_HEAD=PDFLib.rgb(0.07,0.12,0.17);
    const W=842,H=595,M=26;const matColW=196;const pcount=prods.length;
    const prodColW=Math.max(70,Math.min(120,(W-2*M-matColW)/pcount));
    const rowH=15,headH=48;
    let page,y;
    const pdfText=s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/[–—−]/g,'-')
      .replace(/→/g,'->').replace(/≈/g,'~').replace(/≤/g,'<=').replace(/≥/g,'>=')
      .replace(/·/g,'-').replace(/…/g,'...').replace(/[^\x20-\x7E]/g,'');
    const T=(s,x,yy,sz,bold,col)=>page.drawText(pdfText(s),{x:x,y:yy,size:sz,font:bold?FB:F,color:col||INK});
    const rect=(x,yTop,w,hgt,col)=>page.drawRectangle({x:x,y:yTop-hgt,width:w,height:hgt,color:col,borderColor:BORD,borderWidth:0.5});
    const short=(s,n)=>{s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s;};
    const plannedLine=()=>{
      if(!planned.length)return;
      T('Production prevue :',M,y,9,true,GREY);
      let x=M+102,lineY=y;
      planned.forEach(it=>{
        const prod=short(it.produit,23)+' : ';
        const qty=fmtq(it.n)+' u';
        const suffix=(it.objectif&&it.objectif!==it.n)?' (objectif '+fmtq(it.objectif)+')':'';
        const w=Math.min(236,(prod.length+qty.length+suffix.length)*4.2+18);
        if(x+w>W-M){lineY-=14;x=M+92;}
        T(prod,x,lineY,7,false,INK);
        T(qty,x+(prod.length*3.8),lineY-1,11,true,INK);
        if(suffix)T(suffix,x+(prod.length*3.8)+(qty.length*6.2)+4,lineY,7,false,GREY);
        x+=w;
      });
      y=lineY-16;
      const ch=planPDFChargeSummary(planned);
      if(ch.totalH>0){
        T('Temps estime :',M,y,9,true,GREY);
        T(fmtH(ch.totalH),M+75,y-1,11,true,INK);
        T('soit ~'+(Math.round(ch.quarters*10)/10)+' quart(s) / ~'+(Math.round(ch.days*10)/10)+' jour(s)',M+150,y,8,false,GREY);
        y-=18;
      }
    };
    const drawHeader=()=>{
      rect(M,y,matColW,headH,C_HEAD);T('Matiere / emballage  [stock]',M+4,y-14,8,true,WHITE);T('Production possible ->',M+4,y-30,7,false,PDFLib.rgb(0.6,0.75,0.9));
      let x=M+matColW;
      prods.forEach(p=>{const capN=Math.max(0,Math.floor(p.cap==null?0:p.cap));
        const pd=prodDebit(p.produit);const rate=pd&&pd.eff>0?pd.eff*hq*qj:0;const days=rate>0&&p.cap!=null?p.cap/rate:null;
        rect(x,y,prodColW,headH,C_HEAD);
        T(short(p.produit,17),x+3,y-12,6.5,true,WHITE);
        T('cap '+fmtq(capN),x+3,y-26,7,true,PDFLib.rgb(1,0.8,0.55));
        T(days!=null?('~'+(Math.round(days*10)/10)+' j prod.'):'-',x+3,y-38,6.5,false,PDFLib.rgb(0.7,0.85,0.95));
        x+=prodColW;});
      y-=headH;
    };
    page=doc.addPage([W,H]);y=H-M;
    T('Capacite restante apres plan theorique',M,y,15,true);y-=18;
    T('Stock restant apres les quantites simulees dans l onglet Plan.',M,y,9,false,GREY);y-=16;
    plannedLine();
    drawHeader();
    matCodes.forEach(code=>{
      if(y<M+28){page=doc.addPage([W,H]);y=H-M;drawHeader();}
      const mm=matMap[code];
      rect(M,y,matColW,rowH,mm.stock<=0?PDFLib.rgb(0.99,0.9,0.9):C_MAT);
      T(short(mm.nom,30),M+4,y-10,6.8,false,INK);
      T('['+fmtq(mm.stock)+']',M+matColW-46,y-10,6.8,true,mm.stock<=0?C_RED:GREY);
      let x=M+matColW;
      prods.forEach(p=>{const l=p.lignes.find(z=>z.code===code);
        if(!l||l.poss==null){rect(x,y,prodColW,rowH,C_NA);}
        else{const cap=p.cap==null?0:p.cap;let fill=C_GRN,tc=INK,bold=false;
          if(mm.stock<=0){fill=C_ZERO;tc=WHITE;bold=true;}
          else if(l.poss<=cap*1.0001){fill=C_RED;tc=WHITE;bold=true;}
          else if(l.poss<=cap*1.15){fill=C_ORA;}
          rect(x,y,prodColW,rowH,fill);T(fmtq(Math.max(0,Math.floor(l.poss))),x+4,y-10,7,bold,tc);}
        x+=prodColW;});
      y-=rowH;
    });
    y-=10;if(y<M+10){page=doc.addPage([W,H]);y=H-M;}
    T('Legende : Rouge = goulot (limite la production) - Orange = a risque (proche du goulot) - Vert = suffisant - Rouge fonce = stock nul - Vide = absent de la recette.',M,y,7,false,GREY);
    const bytes=await doc.save();
    shareBlob('capacite_apres_plan_'+todayStr()+'.pdf',bytes,'application/pdf','Capacite apres plan');
    toast('PDF généré');
  }catch(e){toast('Échec de la génération PDF');}
}
