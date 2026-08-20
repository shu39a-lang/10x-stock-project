const CACHE="tenx-stock-v6";
self.addEventListener("install",e=>self.skipWaiting());
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin)return;
  if(r.mode==="navigate"||u.pathname.endsWith(".html")||u.pathname.endsWith(".json")){
    e.respondWith(fetch(r,{cache:"no-store"}).catch(()=>caches.match(r)));
    return;
  }
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{
    const copy=res.clone(); caches.open(CACHE).then(c=>c.put(r,copy)); return res;
  })));
});
