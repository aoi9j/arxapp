/* v52: Descubrir claro + flores acuarela + flor en 2 pasos */
(function(){
const LIM=6,DAYS=14,day=new Date().toISOString().slice(0,10);
const M=()=>window.ARX_MEM;
const count=()=>M().count,setCount=n=>{M().count=Math.max(0,n)};
const isSeen=id=>{const t=M().seen[id];return t&&Date.now()-t<DAYS*864e5};
const markSeen=id=>{M().seen[id]=Date.now();if(arxSupabase&&currentUser)arxDb(arxSupabase.from('arx_seen_cards').upsert({user_id:currentUser.id,seen_user_id:id,seen_at:new Date().toISOString()},{onConflict:'user_id,seen_user_id'}),'carta vista')},
unSeen=id=>{delete M().seen[id];if(arxSupabase&&currentUser)arxDb(arxSupabase.from('arx_seen_cards').delete().eq('user_id',currentUser.id).eq('seen_user_id',id),'deshacer carta')};
const skipZone=()=>{M().zoneSkip=day;arxSetPref({zone_skip_day:day},'zona: ahora no')};
const q=a=>jq(a);
const zone=()=>M().zone;
const km=(a,b,c,d)=>{const r=Math.PI/180,x=(c-a)*r,y=(d-b)*r,h=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;return 12742*Math.asin(Math.sqrt(h))};
let timer=null,seenTimer=null,last=null;

/* ---------- flores acuarela ---------- */
const R=(id,n,st,sc)=>{let s='';for(let i=0;i<n;i++)s+='<use href="#'+id+'" transform="rotate('+(st+i*360/n)+') scale('+sc+')"/>';return s};
const rose='M-28 -4 C-34 -32 -9 -48 0 -48 C9 -48 34 -32 28 -4 C24 11 10 17 0 17 C-10 17 -24 11 -28 -4Z',rim='M-25 -16 C-22 -34 -8 -45 0 -45 C8 -45 22 -34 25 -16';
const rp=(id,g,st,rc,ro,w)=>'<g id="'+id+'"><path d="'+rose+'" fill="url(#'+g+')" stroke="'+st+'" stroke-opacity=".6" stroke-width=".9"/><path d="'+rim+'" fill="none" stroke="'+rc+'" stroke-opacity="'+ro+'" stroke-width="'+w+'"/></g>';
const DEFS='<filter id="wc" x="-25%" y="-25%" width="150%" height="150%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="3" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" result="d"/><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="9" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.5 1.65" result="ga"/><feComposite in="d" in2="ga" operator="in"/></filter>'+
'<radialGradient id="gSun" cx=".5" cy=".9" r=".95"><stop offset="0" stop-color="#d98a1c"/><stop offset=".5" stop-color="#f0b83a"/><stop offset="1" stop-color="#fbe08a"/></radialGradient><radialGradient id="gSeed"><stop offset="0" stop-color="#5a3a1e"/><stop offset="1" stop-color="#2b1a0e"/></radialGradient>'+
'<linearGradient id="gTul" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e8708f"/><stop offset="1" stop-color="#fbc6d2"/></linearGradient><linearGradient id="gTul2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#f08aa5"/><stop offset=".7" stop-color="#f7b0c1"/><stop offset="1" stop-color="#ffe0e7"/></linearGradient>'+
'<radialGradient id="gCh" cx=".5" cy=".95" r="1"><stop offset="0" stop-color="#f0a6bd"/><stop offset=".5" stop-color="#f9d3de"/><stop offset="1" stop-color="#fff4f6"/></radialGradient>'+
'<radialGradient id="gRo" cx=".5" cy=".95" r="1"><stop offset="0" stop-color="#7d1628"/><stop offset=".55" stop-color="#c23a4f"/><stop offset="1" stop-color="#f08d99"/></radialGradient><radialGradient id="gRm" cx=".5" cy=".95" r="1"><stop offset="0" stop-color="#62101f"/><stop offset=".6" stop-color="#a92840"/><stop offset="1" stop-color="#e26f80"/></radialGradient><radialGradient id="gRi" cx=".5" cy=".95" r="1"><stop offset="0" stop-color="#450a15"/><stop offset=".6" stop-color="#8a1c31"/><stop offset="1" stop-color="#c94a5e"/></radialGradient>'+
'<linearGradient id="gLeaf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5f8f5b"/><stop offset="1" stop-color="#a9cf9a"/></linearGradient>'+
'<g id="lf"><path d="M0 0 C14 -11 34 -11 48 1 C34 13 14 13 0 0Z" fill="url(#gLeaf)" stroke="#3f6a40" stroke-opacity=".5" stroke-width=".7"/><path d="M2 0 L44 1" stroke="#d3e8c8" stroke-opacity=".5" stroke-width=".8" fill="none"/></g>'+
'<g id="sp"><path d="M0 -12 C-10 -24 -9 -46 0 -56 C9 -46 10 -24 0 -12Z" fill="url(#gSun)" stroke="#b9781a" stroke-opacity=".6" stroke-width=".8"/><path d="M0 -16 L0 -48" stroke="#b9781a" stroke-opacity=".3" stroke-width=".7"/></g>'+
'<g id="cp"><path d="M0 -4 C-22 -14 -24 -40 -9 -49 L0 -43 L9 -49 C24 -40 22 -14 0 -4Z" fill="url(#gCh)" stroke="#d58ea6" stroke-opacity=".7" stroke-width=".8"/><path d="M0 -8 L0 -36 M-4 -9 L-11 -32 M4 -9 L11 -32" stroke="#d98aa5" stroke-opacity=".45" stroke-width=".7" fill="none"/></g>'+
rp('rp1','gRo','#5b0c1a','#ffc1c8','.55',1.6)+rp('rp2','gRm','#4a0a17','#f5a3ad','.5',1.8)+rp('rp3','gRi','#3a0812','#e58a96','.5',2);
const stem=(d,w,c,l)=>'<g filter="url(#wc)"><path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="'+w+'" stroke-linecap="round"/>'+l+'</g>';
const L=t=>'<use href="#lf" transform="'+t+'"/>';
let seeds='';for(let k=1;k<=46;k++){const r=2*Math.sqrt(k),a=k*2.39996;seeds+='<circle cx="'+(r*Math.cos(a)).toFixed(1)+'" cy="'+(r*Math.sin(a)).toFixed(1)+'" r=".9" fill="#e9b45a" fill-opacity=".45"/>'}
let sta='';for(let i=0;i<10;i++){const a=i*36*Math.PI/180,x=(Math.sin(a)*13).toFixed(1),y=(-Math.cos(a)*13).toFixed(1);sta+='<path d="M0 0 L'+x+' '+y+'" stroke="#d98aa5" stroke-width=".6"/><circle cx="'+x+'" cy="'+y+'" r="1.5" fill="#e6a352"/>'}
const tp='fill="url(#gTul)" stroke="#c8657f" stroke-opacity=".6" stroke-width=".9"';
const SYM={
friendship:stem('M100 150 C96 200 106 240 100 285',3.2,'#5f8a5c',L('translate(102,240) rotate(-30)')+L('translate(99,200) scale(-1,1) rotate(-30) scale(.9)'))+'<g transform="translate(100,105)" filter="url(#wc)">'+R('sp',14,0,1)+R('sp',14,180/14,.76)+'<circle r="15" fill="url(#gSeed)"/>'+seeds+'</g>',
curiosity:stem('M100 130 C104 190 96 240 100 285',3.2,'#5f8a5c',L('translate(101,280) rotate(-64) scale(2.1,1.2)')+L('translate(99,280) scale(-1,1) rotate(-60) scale(1.7,1.1)'))+'<g transform="translate(100,100)" filter="url(#wc)"><path d="M0 34 C-38 22 -42 -18 -26 -40 C-10 -28 -2 -2 0 34Z" '+tp+'/><path d="M0 34 C38 22 42 -18 26 -40 C10 -28 2 -2 0 34Z" '+tp+'/><path d="M0 36 C-22 14 -20 -26 0 -46 C20 -26 22 14 0 36Z" fill="url(#gTul2)" stroke="#c8657f" stroke-opacity=".6" stroke-width=".9"/><path d="M0 30 L0 -32 M-7 22 C-10 4 -8 -14 -2 -30 M7 22 C10 4 8 -14 2 -30" fill="none" stroke="#b64a68" stroke-opacity=".3" stroke-width=".8"/></g>',
plan:stem('M100 150 C94 200 104 240 100 285',2.6,'#6b7d55',L('translate(99,225) scale(-1,1) rotate(-28) scale(.9)')+L('translate(101,258) rotate(-26) scale(.75)'))+'<g transform="translate(100,105)" filter="url(#wc)">'+R('cp',5,0,1)+'<circle r="4" fill="#c94f70" fill-opacity=".85"/>'+sta+'</g>',
attraction:stem('M100 165 C104 215 96 250 100 285',3.4,'#557f52','<path d="M102 205 l10 -4 l-6 11z M98 240 l-10 -4 l6 11z" fill="#557f52"/>'+L('translate(101,228) rotate(-32) scale(1.1)')+L('translate(99,258) scale(-1,1) rotate(-36) scale(.9)'))+'<g transform="translate(100,104)" filter="url(#wc)">'+R('rp1',6,0,1)+R('rp2',5,20,.72)+R('rp3',4,45,.48)+'<circle r="6" fill="url(#gRi)"/><path d="M0 -2 C4 -6 9 -2 6 3 C3 7 -5 6 -5 0 C-5 -4 0 -6 3 -4" fill="none" stroke="#2f060e" stroke-opacity=".85" stroke-width="1.2" stroke-linecap="round"/></g><path d="M100 146 C87 150 80 160 78 172 C89 166 96 160 100 152 C104 160 111 166 122 172 C120 160 113 150 100 146Z" fill="url(#gLeaf)" stroke="#3f6a40" stroke-opacity=".5" stroke-width=".7" filter="url(#wc)"/>'};
document.body.insertAdjacentHTML('beforeend','<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'+DEFS+'</defs>'+Object.keys(SYM).map(k=>'<symbol id="fw-'+k+'" viewBox="0 0 200 300">'+SYM[k]+'</symbol>').join('')+'</svg>');
window.flowerArt=function(key,cls){const k=SYM[key]?key:'curiosity';return '<div class="flower-art '+esc(cls||'')+'"><svg viewBox="0 0 200 300" aria-hidden="true"><use href="#fw-'+k+'"/></svg></div>'};

/* ---------- elegir flor: 2 pasos ---------- */
window.flowerStep1=function(){
 const p=getPerson(window._flowerTargetId);if(!p)return;
 window._flowerSelected='';window._flowerMode='flower';
 const ctx=window._flowerContextText;
 openM('<div class="fw-title">Una flor para '+esc(p.name)+'</div><div class="fw-sub">Elige la que mejor diga lo que sientes.</div>'+walletLine()+(ctx?'<div class="fw-ctx">Respondiendo a: “'+esc(ctx)+'”</div>':'')+'<div class="fw-grid">'+flowerIntentData().map(x=>'<button type="button" class="fw-opt" data-click="selectFlowerIntent(\''+x.key+'\')">'+flowerArt(x.key)+x.name+'<small class="fw-d">'+esc(x.desc)+'</small></button>').join('')+'</div>')};
window.openFlowerComposer=function(personId,contextText,contextLabel){
 const p=getPerson(personId);if(!p)return;
 if(pendingFlowerFor(personId)){toast('Ya has enviado una flor a esta persona');return}
 window._flowerTargetId=personId;window._flowerContextText=contextText||'';window._flowerContextLabel=contextLabel||'';window._flowerMode='flower';
 flowerStep1()};
window.selectFlowerIntent=function(key){
 window._flowerSelected=key;window._flowerMode='flower';const x=flowerByKey(key);
 openM('<div class="fw-one"><div style="text-align:left"><button type="button" class="fw-back" aria-label="Cambiar de flor" data-click="flowerStep1()">←</button></div>'+flowerArt(key,'large')+'<div class="fw-title">'+esc(x.name)+'</div><div class="fw-sub">'+esc(x.desc)+'</div><div class="fw-mode"><button type="button" id="flowerModeOnly" class="selected" data-click="setFlowerMode(\'flower\')">Solo flor</button><button type="button" id="flowerModeCard" data-click="setFlowerMode(\'card\')">Flor + tarjeta</button></div><div id="flowerCardEditor" class="hidden"><textarea id="flowerCardText" maxlength="100" placeholder="Escribe algo que de verdad quieras decir…" data-input="updateFlowerPreview()"></textarea><div class="fw-note"><span>Sin enlaces ni teléfonos</span><strong id="flowerCharCount">0 / 100</strong></div></div><button type="button" class="btn" data-click="sendFlowerCard()">Enviar</button></div>')};

/* ---------- descubrir ---------- */
function ordered(arr){const z=zone();return arr.filter(p=>!isSeen(p.id)).map(p=>{const d=(z&&p.lat!=null&&p.lng!=null)?km(z.lat,z.lng,+p.lat,+p.lng):9e5;return {p,b:Math.floor(d/25),r:arxH(p.id+day)}}).sort((a,b)=>a.b-b.b||a.r-b.r).map(x=>x.p)}
window.arxAskZone=function(){
 if(!navigator.geolocation){skipZone();renderDiscoverPeople();return}
 navigator.geolocation.getCurrentPosition(async pos=>{
  const lat=Math.round(pos.coords.latitude*10)/10,lng=Math.round(pos.coords.longitude*10)/10;
  if(!arxSupabase||!currentUser){toast('Necesitas iniciar sesión');return}
  const zr=await arxSupabase.from('arx_profiles').update({zone_lat:lat,zone_lng:lng}).eq('id',currentUser.id).select('id');
  if(zr.error||!zr.data||!zr.data.length){console.error('ARX zona:',zr.error||'0 filas: el perfil no existe');toast('No se pudo guardar tu zona');return}
  M().zone={lat,lng};
  $('discoverPeopleGrid').dataset.k='';renderDiscoverPeople()},
 ()=>{skipZone();$('discoverPeopleGrid').dataset.k='';renderDiscoverPeople()},{timeout:10000,maximumAge:864e5})};
window.arxSkipZone=function(){skipZone();$('discoverPeopleGrid').dataset.k='';renderDiscoverPeople()};
window.renderDiscoverPeople=function(){
 const el=$('discoverPeopleGrid');if(!el)return;clearTimeout(seenTimer);if(!M().loaded)return;
 const all=Array.isArray(discoverPeople)?discoverPeople:[],n=count(),cands=ordered(all),left=LIM-n;
 const msg=left>1&&n>0&&cands.length>1?'Hoy hay espacio para unas pocas más.':(left===1&&cands.length?'Esta es la última de hoy.':'');
 const top='<div class="st-top"><b>ARX</b><span>'+msg+'</span></div>';
 if(!all.length){el.dataset.k='';el.innerHTML=top+'<div class="letter on" style="margin-top:90px"><div class="let-q">Aún no hay cartas para hoy.</div><div class="let-tags">Cuando llegue alguien nuevo, aparecerá aquí.</div></div>';return}
 if(!zone()&&M().zoneSkip!==day){el.dataset.k='zone';el.innerHTML=top+'<div class="zone-ask"><div class="let-q">Para enseñarte gente cerca, ARX necesita tu zona aproximada.</div><div class="let-tags">Nunca guardamos tu punto exacto.</div><button class="zbtn" data-click="arxAskZone()">Activar mi zona</button><button class="leave" data-click="arxSkipZone()">Ahora no</button></div>';return}
 if(n>=LIM||!cands.length){el.dataset.k='end';el.innerHTML=top+'<div class="letter on" style="margin-top:70px">'+flowerArt('curiosity','large')+'<div class="let-q">'+(n>=LIM?'Ya has leído las cartas de hoy.':'Ya has visto a todas por ahora.')+'</div><div class="let-tags">'+(n>=LIM?'Mañana llegan otras nuevas.':'Vuelve pronto, llegarán más.')+'</div><div class="acts"><button data-click="show(\'garden\')">Abrir mi jardín</button></div></div>';return}
 const p=cands[0],conn=state.matches.includes(p.id),fl=pendingFlowerFor(p.id),k=p.id+'|'+n+'|'+(conn?1:0)+(fl?1:0);if(el.dataset.k===k)return;el.dataset.k=k;last=p.id;
 const cs=(p.cards||[]).filter(x=>x.text),cd=cs.length?cs[Math.floor(arxH(p.id+day)*cs.length)]:null,c=cd?cd.text:(p.prompt||''),lab=(cd&&cd.prompt)?cd.prompt:'Una cosa sobre ella';
 el.innerHTML=top+'<div class="st-card"><div class="pol" id="stPol"><div class="ph" style="background-image:url(\''+(p.photo?cssUrl(p.photo):'')+'\')"></div><div class="cap">'+esc(p.name)+(p.age?', '+esc(p.age):'')+'</div></div>'+
 '<div class="letter" id="stLet"><div class="let-k">'+esc(lab)+'</div><div class="let-q">“'+esc(c)+'”</div><div class="let-tags">'+(p.interests||[]).slice(0,3).map(x=>'<span>'+esc(x)+'</span>').join('')+'</div><div class="l-acts"><button class="l-main" data-click="arxWorld('+q(p.id)+')">Ver su mundo</button>'+((conn||fl)?'':'<button class="l-reply" data-click="openFlowerComposer('+q(p.id)+','+q(cd?cd.text:'')+','+q(cd&&cd.prompt?cd.prompt:'Su tarjeta')+')">Responder con una flor</button>')+'<button class="leave" data-click="arxNext()">Dejarla aquí</button></div></div></div>';
 requestAnimationFrame(()=>requestAnimationFrame(()=>{const a=$('stPol'),b=$('stLet');if(a)a.classList.add('dev');if(b)b.classList.add('on')}));
 seenTimer=setTimeout(()=>markSeen(p.id),5000)};
window.arxNext=function(){clearTimeout(seenTimer);clearTimeout(timer);const id=last;if(id)markSeen(id);setCount(count()+1);
 const el=$('discoverPeopleGrid');el.dataset.k='';el.innerHTML='<div class="st-top"><b>ARX</b><span></span></div><div class="st-undo">Dejada.<button data-click="arxUndo()">Deshacer</button></div>';
 timer=setTimeout(()=>{renderDiscoverPeople();window.scrollTo({top:0})},2500)};
window.arxUndo=function(){clearTimeout(timer);if(last)unSeen(last);setCount(count()-1);$('discoverPeopleGrid').dataset.k='';renderDiscoverPeople()};

/* ---------- su mundo: una pantalla, la flor al final ---------- */
window.arxWorld=function(id,preview){
 const p=(id&&typeof id==='object')?id:getPerson(id);if(!p)return;
 const conn=!preview&&state.matches.includes(p.id),fl=!preview&&pendingFlowerFor(p.id),canReply=!preview&&!conn&&!fl;
 const cards=(p.cards||[]).filter(c=>c.text);
 let h=(preview?'<div class="w-prev">Así te ven las demás</div>':'')+'<div class="w-ph" style="background-image:url(\''+(p.photo?cssUrl(p.photo):'')+'\')"></div><div class="w-name">'+esc(p.name)+(p.age?', '+esc(p.age):'')+'</div>';
 cards.forEach((c,i)=>{h+='<div class="w-card"><div class="w-k">'+esc(c.prompt||'Sobre ella')+'</div><div class="w-q">“'+esc(c.text)+'”</div>'+(canReply?'<button class="w-reply" data-i="'+i+'">Responder con una flor</button>':'')+'</div>'});
 if(!cards.length&&preview)h+='<div class="w-k">Aún no tienes tarjetas. Añádelas en tu perfil.</div>';
 if((p.bio||'').trim())h+='<div class="w-card"><div class="w-k">su bio</div><div class="w-q" style="font-size:19px">'+esc(p.bio)+'</div></div>';
 if(p.interests&&p.interests.length)h+='<div class="w-k">le gusta</div><div class="w-tags">'+p.interests.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>';
 if(!preview)h+='<div class="w-end" id="wEnd">'+(conn?'<button class="w-flbtn" id="wFl">Abrir chat</button>':fl?'<div class="w-k">Flor enviada. Esperando respuesta.</div>':flowerArt('curiosity','large')+'<button class="w-flbtn" id="wFl">Enviar una flor</button>')+'</div>';
 const w=document.createElement('div');w.id='arxWorld';w.innerHTML='<button class="w-back" aria-label="Volver">←</button><div class="w-body">'+h+'</div>';document.body.appendChild(w);
 const close1=()=>{w.classList.remove('on');setTimeout(()=>w.remove(),500)};
 w.querySelector('.w-back').onclick=close1;
 w.querySelectorAll('.w-reply').forEach(b=>b.onclick=()=>{const c=cards[+b.dataset.i];close1();openFlowerComposer(p.id,c.text,c.prompt||'Su tarjeta')});
 const b=w.querySelector('#wFl');if(b)b.onclick=()=>{close1();conn?openChatWith(p.name):openFlowerComposer(p.id)};
 const end=w.querySelector('#wEnd');
 if(end){if('IntersectionObserver' in window){new IntersectionObserver((e,o)=>{if(e[0].isIntersecting){end.classList.add('on');o.disconnect()}},{root:w,threshold:.35}).observe(end)}else end.classList.add('on')}
 requestAnimationFrame(()=>w.classList.add('on'))};
window.arxPreviewMe=function(){arxWorld({id:'me',name:state.displayName||'Tu nombre',age:state.age||'',photo:state.photo||'',bio:state.bio||'',interests:state.interests||[],cards:state.profileCards||[]},true)};

/* ---------- home limpio ---------- */
window.renderHomeNews=function(){
 const el=$('homeNews');if(!el)return;
 const left=Math.max(0,LIM-count()),avail=Array.isArray(discoverPeople)?ordered(discoverPeople).length:0,n=Math.min(left,avail);
 let h='';
 if(n>0)h+='<button class="hm-row" data-click="show(\'discover\')">'+(n===1?'Tienes 1 carta nueva hoy':'Tienes '+n+' cartas nuevas hoy')+'</button>';
 const m=(state.matches||[]).length;
 if(m>0)h+='<button class="hm-row" data-click="show(\'matches\')">'+(m===1?'Tienes 1 conexión':'Tienes '+m+' conexiones')+'</button>';
 const today=day,ev=(state.events||[]).filter(e=>e.date&&String(e.date)>=today&&(e.attending||(currentUser&&e.creator_id===currentUser.id))).sort((a,b)=>String(a.date).localeCompare(String(b.date)))[0];
 if(ev)h+='<button class="hm-row" data-click="show(\'map\')">Próximo plan: '+esc(ev.name)+'<small>'+esc(String(ev.date).slice(0,10))+(ev.time?' · '+esc(ev.time):'')+'</small></button>';
 if(!(state.profileCards||[]).length)h+='<button class="hm-row" data-click="openProfileCards()">Añade tarjetas a tu perfil<small>Con ellas es más fácil que te escriban.</small></button>';
 el.innerHTML=h};
['renderDiscover','renderProfileCards','renderProfile'].forEach(fn=>{const o=window[fn];if(typeof o==='function')window[fn]=function(){const r=o.apply(this,arguments);try{renderHomeNews()}catch(e){}return r}});
arxOnShow('home',()=>renderHomeNews());
try{renderHomeNews()}catch(e){}
if(typeof renderDiscover==='function')try{renderDiscover()}catch(e){}
})();
