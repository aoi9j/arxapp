/* v70: chat privado real entre conexiones (tabla arx_direct_messages) | v101: nombre, hora y dias */
(function(){
let peer=null,timer=null,seen=new Set(),last={s:null,d:null};
const YOU='T'+String.fromCharCode(250);
function dayKey(t){const d=new Date(t);return d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate()}
function dayLabel(t){const n=new Date(),y=new Date();y.setDate(n.getDate()-1);const k=dayKey(t);
 if(k===dayKey(n))return 'Hoy';if(k===dayKey(y))return 'Ayer';
 return new Date(t).toLocaleDateString('es-ES',{day:'numeric',month:'long'})}
function hhmm(t){return new Date(t).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}
function bubble(m){
 const mine=m.sender_id===currentUser.id,f=document.createDocumentFragment();
 const dk=dayKey(m.created_at);
 if(dk!==last.d){const sep=document.createElement('div');sep.className='chat-day';sep.textContent=dayLabel(m.created_at);f.appendChild(sep);last.d=dk;last.s=null}
 const d=document.createElement('div');d.className='msg'+(mine?' me':'');
 if(last.s!==m.sender_id){
  d.className+=' first';
  const who=mine?YOU:(typeof chatPartnerName!=='undefined'&&chatPartnerName?chatPartnerName:'');
  if(who){const nm=document.createElement('span');nm.className='nm';nm.textContent=who;d.appendChild(nm)}}
 last.s=m.sender_id;
 d.appendChild(document.createTextNode(m.message));
 const tm=document.createElement('span');tm.className='tm';tm.textContent=hhmm(m.created_at);d.appendChild(tm);
 f.appendChild(d);return f}
function paint(rows){
 const box=$('messages');if(!box)return;
 const fresh=rows.filter(m=>!seen.has(m.id));
 if(!fresh.length&&seen.size)return;
 if(!seen.size)box.innerHTML='';
 fresh.forEach(m=>{seen.add(m.id);box.appendChild(bubble(m))});
 if(!seen.size)box.innerHTML='<div class="notice">Aún no hay mensajes. Rompe el hielo ✦</div>';
 box.scrollTop=box.scrollHeight}
async function load(){
 if(!peer||!arxSupabase||!currentUser)return;
 const {data,error}=await arxSupabase.from('arx_direct_messages')
  .select('id,sender_id,receiver_id,message,created_at')
  .or('and(sender_id.eq.'+currentUser.id+',receiver_id.eq.'+peer+'),and(sender_id.eq.'+peer+',receiver_id.eq.'+currentUser.id+')')
  .order('created_at',{ascending:true}).limit(300);
 if(error){console.error('ARX chat:',error);return}
 if(!(data||[]).length&&!seen.size){$('messages').innerHTML='<div class="notice">Aún no hay mensajes. Rompe el hielo ✦</div>';return}
 paint(data)}
window.openChatWith=function(name,id){
 chatPartnerName=name;peer=id||null;seen=new Set();last={s:null,d:null};clearInterval(timer);window.__peer=id;
 show('privateChat');renderChatNudge();
 const box=$('messages');if(box)box.innerHTML='<div class="notice">Cargando…</div>';
 if(peer){load();timer=setInterval(()=>{if(document.getElementById('privateChat').classList.contains('active')&&!document.hidden)load()},4000)}
 const pc=$('privateChat');if(pc&&id){let b=$('chatSafety');if(!b){b=document.createElement('div');b.id='chatSafety';b.style.cssText='display:flex;justify-content:flex-end;padding:6px 16px 0';pc.insertBefore(b,pc.firstChild)}b.innerHTML='<button class="toolbtn" type="button">⋯ Bloquear o denunciar</button>';b.firstChild.onclick=()=>window.arxSafety(id,name)}};
window.send=async function(){
 const i=$('input'),t=(i.value||'').trim();if(!t)return;
 if(!peer){toast('Abre el chat desde Conexiones');return}
 if([...t].length>1000){toast('Máximo 1000 caracteres');return}
 i.value='';
 const {error}=await arxSupabase.from('arx_direct_messages').insert({sender_id:currentUser.id,receiver_id:peer,message:t});
 if(error){console.error(error);i.value=t;toast('No se pudo enviar el mensaje');return}
 load()};
})();
