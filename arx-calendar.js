let calOff=0,calSel=null;
function exploreTab(k){document.querySelectorAll('[data-pane]').forEach(e=>e.classList.toggle('hidden',e.dataset.pane!==k));document.querySelectorAll('.xtab').forEach(b=>b.classList.toggle('on',b.dataset.tab===k));if(k==='rooms')renderRooms();if(k==='cal')renderCal()}
function calGo(d){if(calOff+d<0)return;calOff+=d;calSel=null;renderCal()}
function bdaysOn(m,d){return (state.birthdays||[]).filter(b=>{const x=new Date(b.birthday_date+'T00:00:00');return !isNaN(x)&&x.getMonth()===m&&x.getDate()===d})}
function evsOn(y,m,d){return (state.events||[]).filter(e=>{const x=new Date(e.date+'T00:00:00');return !isNaN(x)&&x.getFullYear()===y&&x.getMonth()===m&&x.getDate()===d})}
function renderCalendarData(){renderCal();renderRooms()}
function renderCal(){
  const c=$('cal');if(!c)return;const now=new Date();now.setHours(0,0,0,0);const base=new Date(now.getFullYear(),now.getMonth()+calOff,1),y=base.getFullYear(),m=base.getMonth(),n=new Date(y,m+1,0).getDate(),first=(base.getDay()+6)%7;
  let h=['L','M','X','J','V','S','D'].map(x=>'<div class="day"><b>'+x+'</b></div>').join('');for(let i=0;i<first;i++)h+='<div class="day"></div>';
  for(let d=1;d<=n;d++){const dt=new Date(y,m,d),past=dt<now,bd=bdaysOn(m,d).length,ev=evsOn(y,m,d).length;
    h+='<div class="day'+(past?' past':'')+(+dt===+now?' today':'')+(calSel===d?' sel':'')+'" data-click="calPick('+d+')">'+(bd?'<span class="c">'+d+'</span>':d)+(ev?'<i class="dot"></i>':'')+'</div>'}
  c.innerHTML=h;$('calTitle').textContent=base.toLocaleDateString('es-ES',{month:'long',year:'numeric'});$('calPrev').style.visibility=calOff?'visible':'hidden';calDetail(y,m);
}
function calPick(d){calSel=calSel===d?null:d;renderCal()}
function calDetail(y,m){const el=$('calDetail');if(!el)return;if(!calSel){el.innerHTML='';return}
  const bs=bdaysOn(m,calSel),es=evsOn(y,m,calSel);
  if(!bs.length&&!es.length){el.innerHTML='<div class="calday mut">Nada este día.</div>';return}
  el.innerHTML=bs.map(b=>'<div class="calday">🎂 <b>Cumpleaños de '+esc(b.name)+'</b><div class="mut">Aviso: '+esc(b.reminder_days)+' días antes</div><button class="btn ghost" type="button" style="margin-top:8px" data-click="delBirthday('+jq(b.id)+')">Borrar</button></div>').join('')+es.map(e=>'<div class="calday" data-click="openEventDetails('+jq(e.id)+')">✦ <b>'+esc(e.name)+'</b><div class="mut">'+esc(e.time)+' · '+esc(e.place)+'</div></div>').join('')}
async function delBirthday(id){const r=await arxSupabase.from('arx_birthdays').delete().eq('id',id);if(r.error){toast('No se pudo borrar');return}state.birthdays=(state.birthdays||[]).filter(b=>b.id!==id);calSel=null;renderCal();toast('Cumpleaños borrado')}
async function renderRooms(){
  const el=$('roomsList');if(!el)return;
  const mine=(state.events||[]).filter(e=>e.attending||(currentUser&&e.creator_id===currentUser.id));
  if(!mine.length){el.innerHTML='<div class="notice">Aún no estás en ninguna sala. Apúntate a un plan y su chat aparecerá aquí.</div>';return}
  let last={};
  try{
    const r=await arxSupabase.from('arx_event_messages').select('event_id,message,message_type,created_at').in('event_id',mine.map(e=>e.id)).order('created_at',{ascending:false}).limit(300);
    if(r.error) console.warn('ARX rooms preview:',r.error);
    (r.data||[]).forEach(x=>{if(!last[x.event_id])last[x.event_id]=x});
  }catch(e){console.warn('ARX rooms preview:',e)}
  const pv=x=>!x?'Sé la primera en escribir':({photo:'📷 Foto',gif:'GIF',sticker:'✨ Sticker',audio:'🎙 Audio',poll:'📊 Encuesta'}[x.message_type]||x.message||'Nuevo mensaje');
  el.innerHTML=mine.map(e=>{
    const x=last[e.id];
    return '<button type="button" class="room-row" data-click="openEventRoom('+jq(e.id)+')" aria-label="Entrar al chat de '+esc(e.name)+'"><div class="room-ava">💬</div><div class="g"><b>'+esc(e.name)+'</b><small>'+esc(pv(x))+'</small></div><time>'+(x?new Date(x.created_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):'')+'</time><span class="room-arrow">→</span></button>'
  }).join('')
}
/* GIFs chat privado */
function pickGif(){openM('<div class="ey">GIF</div><input id="pgQ" class="er-search" placeholder="Buscar GIFs…" data-input="arxPgInput(this)"><div id="pgGrid" class="er-gifs" style="max-height:60vh"></div><div class="mut" style="font-size:11px;text-align:right;margin-top:5px">Powered by GIPHY</div>');$('modal').querySelector('#pgGrid').onclick=e=>{const b=e.target.closest('[data-g]');if(!b)return;const m=document.createElement('div');m.className='msg me media-msg';const i=document.createElement('img');i.src=b.dataset.g;i.alt='GIF';m.appendChild(i);$('messages').appendChild(m);closeM()};pgLoad('')}
async function pgLoad(q){const g=$('pgGrid');if(!g)return;if(!ARX_GIPHY_KEY_PRIV){g.innerHTML='<div class="notice">La búsqueda de GIF aún no está configurada.</div>';return}g.innerHTML='<div class="mut">Cargando…</div>';try{const r=await fetch('https://api.giphy.com/v1/gifs/'+(q?'search':'trending')+'?api_key='+ARX_GIPHY_KEY_PRIV+'&limit=30&rating=pg-13'+(q?'&lang=es&q='+encodeURIComponent(q):''));const j=await r.json();if(!r.ok)throw 0;g.innerHTML=(j.data||[]).map(x=>{const i=x.images||{};const p=(i.fixed_width_small||i.fixed_width||{}).url,u=(i.fixed_width||i.original||{}).url;return p&&u?'<button type="button" class="er-gif" data-g="'+esc(u)+'"><img loading="lazy" src="'+esc(p)+'" alt=""></button>':''}).join('')||'<div class="mut">Sin resultados</div>'}catch(e){g.innerHTML='<div class="notice">No se pudieron cargar los GIF</div>'}}
