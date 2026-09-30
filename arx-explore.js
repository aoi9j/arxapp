/* ARX Explorar v42: filtros (TODO / CIUDAD / FILTROS) + radar con posiciones por zona */
var arxF={city:'',when:'',type:''};
function arxZone(ev){return String(ev.place||'').trim()}
function arxToday(){const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
function arxWhen(ev,w){const d=new Date(ev.date+'T00:00:00');if(isNaN(d))return false;const t=arxToday(),diff=Math.round((d-t)/864e5);
 if(w==='today')return diff===0;
 if(w==='week')return diff>=0&&diff<=7;
 if(w==='weekend'){const dow=d.getDay();return diff>=0&&diff<=7&&(dow===0||dow===6)}
 return true}
function arxFiltered(){const arr=Array.isArray(state.events)?state.events:[];
 return arr.filter(ev=>(!arxF.city||arxZone(ev).toLowerCase()===arxF.city.toLowerCase())&&(!arxF.type||ev.type===arxF.type)&&(!arxF.when||arxWhen(ev,arxF.when)))}
function arxRefresh(){
 const n=(arxF.when?1:0)+(arxF.type?1:0);
 const all=$('fAll'),c=$('fCity'),m=$('fMore');
 if(all)all.classList.toggle('active',!arxF.city&&!n);
 if(c){c.textContent=(arxF.city||'CIUDAD')+' ▾';c.classList.toggle('set',!!arxF.city)}
 if(m){m.textContent=n?'FILTROS · '+n:'FILTROS';m.classList.toggle('set',n>0)}
 renderEvents();renderEventRadar()}
function arxClear(){arxF={city:'',when:'',type:''};arxRefresh()}
function arxCityPick(){
 const arr=Array.isArray(state.events)?state.events:[],cnt={};
 arr.forEach(ev=>{const z=arxZone(ev);if(z)cnt[z]=(cnt[z]||0)+1});
 const zs=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]);
 const html='<div class="ey">ARX // EXPLORE</div><h2>Elige una ciudad</h2><div class="mut">Tú decides dónde mirar. No usamos tu ubicación.</div><div class="interest-picker" style="margin-top:14px">'+
  (zs.length?zs.map(z=>'<button type="button" class="tag interest-option'+(arxF.city===z?' selected':'')+'" data-click="arxSetCity(this.dataset.z)" data-z="'+esc(z)+'">'+esc(z)+' · '+cnt[z]+'</button>').join(''):'<div class="notice">Todavía no hay planes publicados.</div>')+'</div>'+
  (arxF.city?'<button type="button" class="btn ghost" style="margin-top:14px" data-click="arxSetCity(\'\')">Quitar ciudad</button>':'');
 openM(html)}
function arxSetCity(z){arxF.city=z||'';closeM();arxRefresh()}
function arxFilterPanel(){
 const types=['Quedada','Cita','Plan','Fiesta','Viaje','Actividad','Otro'],whens=[['today','Hoy'],['weekend','Este fin de semana'],['week','Esta semana']];
 const chip=(k,v,l,on)=>'<button type="button" class="tag interest-option'+(on?' selected':'')+'" data-click="arxPick(\''+k+'\',\''+v+'\')">'+l+'</button>';
 openM('<div class="ey">ARX // EXPLORE</div><h2>Filtros</h2><h3 style="margin:16px 0 8px">Cuándo</h3><div class="interest-picker">'+whens.map(w=>chip('when',w[0],w[1],arxF.when===w[0])).join('')+'</div><h3 style="margin:16px 0 8px">Tipo de plan</h3><div class="interest-picker">'+types.map(t=>chip('type',t,t,arxF.type===t)).join('')+'</div><div class="explore-actions" style="margin-top:18px"><button type="button" class="btn ghost" data-click="arxFiltersReset()">Limpiar</button><button type="button" class="btn" data-click="closeM()">Ver planes</button></div>')}
function arxPick(k,v){arxF[k]=arxF[k]===v?'':v;arxRefresh();arxFilterPanel()}
function arxH(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0)/4294967295}
function arxPopClose(){const p=document.querySelector('.arx-pop');if(p)p.remove()}
function arxPop(id){arxPopClose();const ev=(state.events||[]).find(e=>String(e.id)===String(id));if(!ev)return;const box=$('mapBox');if(!box)return;
 const d=document.createElement('div');d.className='arx-pop';
 d.innerHTML='<button type="button" class="arx-pop-x" aria-label="Cerrar" data-click="arxPopClose()">×</button><div class="ey">'+esc(ev.type)+'</div><b>'+esc(ev.name)+'</b><div class="mut">'+esc(ev.date)+' · '+esc(ev.time)+' · '+esc(ev.place)+'</div><div class="mut" style="margin-top:3px">Hasta '+esc(ev.max)+' personas</div><button type="button" class="btn" data-click="openEventDetails('+jq(ev.id)+')">Ver experiencia</button>';
 box.appendChild(d)}
function renderEventRadar(){const radar=$('eventRadar');if(!radar)return;
 const arr=arxFiltered(),zones={};
 arr.forEach(ev=>{const z=arxZone(ev).toLowerCase();(zones[z]=zones[z]||[]).push(ev)});
 let html='';
 Object.keys(zones).forEach(z=>{const n=zones[z].length,x=16+arxH(z+'x')*68,y=24+arxH(z+'y')*54;
  html+='<div class="arx-map-halo" style="left:'+x+'%;top:'+y+'%;width:'+(80+n*26)+'px;height:'+(80+n*26)+'px"></div>';
  zones[z].forEach(ev=>{const px=Math.min(90,Math.max(8,x+(arxH(ev.id+'a')-.5)*14)),py=Math.min(88,Math.max(12,y+(arxH(ev.id+'b')-.5)*16));
   html+='<button class="arx-radar-point" type="button" title="'+esc(ev.name)+'" data-click="arxPop('+jq(ev.id)+')" style="left:'+px+'%;top:'+py+'%">✦</button>'})});
 radar.innerHTML=html;
 const live=document.querySelector('.radar-live');if(live)live.textContent=arr.length?'● '+arr.length+(arr.length===1?' PLAN':' PLANES'):'● SIN PLANES';
 const c=document.querySelector('.arx-map-center');if(c)c.style.display=arr.length?'none':''}
