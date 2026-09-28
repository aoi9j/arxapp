// Service worker solo para avisos push (sin caché, para no servir versiones antiguas).
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{
  let d={};try{d=e.data.json()}catch(_){d={title:'ARX',body:e.data?e.data.text():'Nuevo mensaje'}}
  e.waitUntil(self.registration.showNotification(d.title||'ARX',{body:d.body,tag:d.tag,renotify:true,data:{eventId:d.eventId}}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();const id=e.notification.data&&e.notification.data.eventId;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    if(cs[0]){cs[0].postMessage({type:'open-room',eventId:id});return cs[0].focus()}
    return self.clients.openWindow('./?room='+encodeURIComponent(id));
  }));
});
