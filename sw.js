const C='inv-lep-v119';
const LIBC='inv-lib-v1';
const APP=['./','./index.html','./css/styles.css','./domain/inventory.js','./js/core/inventory-core.js','./js/core/server-session-tabs.js','./js/core/auth-init.js','./js/features/production-movements-server.js','./js/features/analysis-bilan-feuillet.js','./js/features/capacity-plan.js','./js/features/fragments.js','./js/features/quality.js','./js/sw-register.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
const LIBS=['./xlsx.full.min.js','./pdf-lib.min.js','./pdf.min.js','./pdf.worker.min.js'];
self.addEventListener('install',e=>{e.waitUntil(Promise.all([
  caches.open(C).then(c=>c.addAll(APP)),
  caches.open(LIBC).then(c=>Promise.all(LIBS.map(u=>c.match(u).then(m=>m||c.add(u).catch(()=>{})))))
]).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C&&k!==LIBC).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin===self.location.origin&&u.pathname.startsWith('/api/')){
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
    const cp=resp.clone();caches.open(C).then(c=>c.put(e.request,cp));return resp;
  }).catch(()=>caches.match('./index.html'))));
});
