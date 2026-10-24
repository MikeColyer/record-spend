// v8: prefer fresh application files when online, use cached copies offline.
const CACHE='record-spend-v23';
const ASSETS=['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./icon.png','./icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    await Promise.all(ASSETS.map(async path=>{
      try {const response=await fetch(new Request(path,{cache:'reload'}));if(response.ok)await cache.put(path,response)}catch(e){}
    }));
  }));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith('record-spend-')&&name!==CACHE).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const response=await fetch(request);
      if(response.ok)await cache.put(request,response.clone());
      return response;
    }catch(e){
      const saved=await cache.match(request,{ignoreSearch:true});
      if(saved)return saved;
      if(request.mode==='navigate'){
        const home=await cache.match('./index.html');if(home)return home;
      }
      return Response.error();
    }
  })());
});
