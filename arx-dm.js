/* v70: chat privado real entre conexiones (tabla arx_direct_messages) */
(function(){
let peer=null,timer=null,seen=new Set();
function bubble(m){
 const d=document.createElement('div');d.className='msg'+(m.sender_id===currentUser.id?' me':'');
 d.textContent=m.message;return d}
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
 chatPartnerName=name;peer=id||null;seen=new Set();clearInterval(timer);window.__peer=id;
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
