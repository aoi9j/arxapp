/* v71: bloquear/denunciar, borrar cuenta, recuperación por correo, consentimiento, privacidad/términos y avisos de mensajes */
(function(){
const CONTACT='arxapp@protonmail.com';
const CV=1,REASONS=[['acoso','Acoso o mensajes molestos'],['perfil_falso','Perfil falso'],['contenido_inapropiado','Contenido inapropiado'],['menor','Parece menor de edad'],['otro','Otro motivo']];
let hidden=new Set();
const sb=()=>(typeof arxSupabase!=='undefined'?arxSupabase:null),me=()=>(typeof currentUser!=='undefined'?currentUser:null);
const P=t=>'<p style="font-size:12px;line-height:1.5;color:#cfc8d6;margin:8px 0">'+t+'</p>';
const H=t=>'<h3 style="margin:16px 0 4px;font-size:14px">'+t+'</h3>';
async function loadHidden(){if(!sb()||!me())return;const {data,error}=await sb().rpc('arx_my_hidden_ids');if(error)return;hidden=new Set((data||[]).map(x=>typeof x==='object'?Object.values(x)[0]:x))}
function applyHidden(){if(Array.isArray(discoverPeople))discoverPeople=discoverPeople.filter(p=>!hidden.has(p.id));try{renderDiscover();renderConnections()}catch(e){}}
{const o=window.loadDiscoverPeople;if(typeof o==='function')window.loadDiscoverPeople=async function(){await loadHidden();const r=await o.apply(this,arguments);applyHidden();return r}}
{const o=window.renderConnections;if(typeof o==='function')window.renderConnections=function(){if(state&&Array.isArray(state.matches))state.matches=state.matches.filter(i=>!hidden.has(i));return o.apply(this,arguments)}}
/* --- seguridad --- */
window.arxSafety=function(id,name){window.__sid=id;window.__sname=name||'esta persona';openM('<div class="ey">SEGURIDAD</div><h2>'+esc(window.__sname)+'</h2><button class="btn ghost" data-click="arxBlockAsk()">🚫 Bloquear</button><button class="btn ghost" style="margin-top:8px" data-click="arxReportAsk()">⚑ Denunciar</button><button class="btn ghost" style="margin-top:8px" data-click="closeM()">Cancelar</button>')};
window.arxBlockAsk=function(){openM('<div class="ey">BLOQUEAR</div><h2>¿Bloquear a '+esc(window.__sname)+'?</h2>'+P('Dejaréis de veros en ARX y no podréis escribiros ni enviaros flores. No se le avisa.')+'<button class="btn" data-click="arxBlock()">Sí, bloquear</button><button class="btn ghost" style="margin-top:8px" data-click="closeM()">Cancelar</button>')};
window.arxBlock=async function(id){id=id||window.__sid;const {error}=await sb().from('arx_blocks').insert({blocked_id:id});if(error&&error.code!=='23505'){console.error(error);toast('No se pudo bloquear');return false}hidden.add(id);applyHidden();closeM();toast('Bloqueada. Ya no os veréis ✦');if(document.getElementById('privateChat').classList.contains('active'))show('matches');return true};
window.arxReportAsk=function(){openM('<div class="ey">DENUNCIAR</div><h2>¿Qué ha pasado?</h2>'+REASONS.map(r=>'<button class="btn ghost" style="margin-top:8px" data-click="arxReport(\''+r[0]+'\')">'+r[1]+'</button>').join('')+'<button class="btn ghost" style="margin-top:8px" data-click="closeM()">Cancelar</button>')};
window.arxReport=async function(reason){const id=window.__sid;const {error}=await sb().from('arx_reports').insert({reported_id:id,reason});if(error){console.error(error);toast('No se pudo enviar la denuncia');return}await window.arxBlock(id);toast('Denuncia enviada. La revisaremos ✦')};
{const o=window.openDiscoveryProfile;if(typeof o==='function')window.openDiscoveryProfile=function(id){const r=o.apply(this,arguments);try{const p=getPerson(id),c=$('modalContent');if(p&&c&&p.id!==me().id){const b=document.createElement('button');b.className='btn ghost';b.style.cssText='margin-top:8px;font-size:11px';b.textContent='⋯ Bloquear o denunciar';b.onclick=()=>arxSafety(p.id,p.name);c.appendChild(b)}}catch(e){}return r}}
/* --- cuenta --- */
window.arxDeleteAsk=function(){openM('<div class="ey">CUENTA</div><h2>Borrar mi cuenta</h2>'+P('Se borran tu perfil, fotos, mensajes, flores y conexiones. No se puede deshacer.')+'<input id="delConfirm" placeholder="Escribe BORRAR" style="width:100%;margin-top:10px"><button class="btn" style="margin-top:10px" data-click="arxDelete()">Borrar definitivamente</button><button class="btn ghost" style="margin-top:8px" data-click="closeM()">Cancelar</button>')};
window.arxDelete=async function(){if(($('delConfirm').value||'').trim().toUpperCase()!=='BORRAR'){toast('Escribe BORRAR para confirmar');return}const {error}=await sb().rpc('arx_delete_my_account');if(error){console.error(error);toast('No se pudo borrar. Escríbenos a '+CONTACT);return}try{localStorage.clear();sessionStorage.clear()}catch(e){}await sb().auth.signOut().catch(()=>{});location.reload()};
window.arxEmailAsk=function(){openM('<div class="ey">CUENTA</div><h2>Proteger mi cuenta</h2>'+P('Vincula un correo para poder recuperar tu cuenta si cambias de móvil o borras los datos. No se muestra en tu perfil.')+'<input id="emailLink" type="email" placeholder="tu@correo.com" style="width:100%;margin-top:10px"><button class="btn" style="margin-top:10px" data-click="arxEmailLink()">Enviar enlace de confirmación</button>')};
window.arxEmailLink=async function(){const e=($('emailLink').value||'').trim();if(!/^\S+@\S+\.\S+$/.test(e)){toast('Correo no válido');return}const {data:updateData,error}=await sb().auth.updateUser({email:e},{emailRedirectTo:location.origin+location.pathname});if(error){console.error(error);toast('No se pudo vincular el correo');return}if(updateData?.user)currentUser=updateData.user;openM('<div class="ey">CASI LISTO</div><h2>Revisa tu correo</h2>'+P('Te hemos enviado un enlace a '+esc(e)+'. Púlsalo para confirmar.'))};
window.arxRecoverAsk=function(){openM('<div class="ey">RECUPERAR</div><h2>Recuperar mi cuenta</h2>'+P('Si vinculaste un correo, escríbelo y te enviamos un enlace de acceso.')+'<input id="recEmail" type="email" placeholder="tu@correo.com" style="width:100%;margin-top:10px"><button class="btn" style="margin-top:10px" data-click="arxRecover()">Enviar enlace</button>')};
window.arxRecover=async function(){const e=($('recEmail').value||'').trim();if(!/^\S+@\S+\.\S+$/.test(e)){toast('Correo no válido');return}const {error}=await sb().auth.signInWithOtp({email:e,options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname}});if(error){console.error(error);toast('No se pudo enviar el enlace. Comprueba el correo e inténtalo de nuevo.');return}await sb().auth.signOut().catch(()=>{});openM('<div class="ey">ENVIADO</div><h2>Revisa tu correo</h2>'+P('Si ese correo está vinculado a una cuenta, te llegará un enlace. Cuando lo pulses, ARX abrirá esa cuenta.'))};
/* --- textos legales --- */
window.arxLegal=function(k){const t={
privacidad:'<h2>Política de privacidad</h2>'+P('Responsable: ARX. Contacto: '+esc(CONTACT))+H('Qué datos usamos')+P('Nombre de usuario, edad, foto, bio, intereses, zona aproximada (redondeada, nunca tu punto exacto), mensajes, flores y conexiones. Por el carácter de la comunidad, de tu uso de ARX puede deducirse tu orientación sexual: es un dato especial y solo lo tratamos con tu consentimiento explícito.')+H('Para qué')+P('Para que ARX funcione: mostrarte a otras personas, permitir conexiones y chats, y mantener la comunidad segura.')+H('Quién lo ve')+P('Otras usuarias ven lo que tú pones en tu perfil. Tus mensajes solo los ve quien los recibe. No vendemos tus datos.')+H('Proveedores')+P('Supabase (alojamiento de datos) y Giphy (GIFs).')+H('Cuánto tiempo')+P('Hasta que borres tu cuenta (Perfil → Cuenta y seguridad → Borrar mi cuenta). Podemos conservar denuncias para proteger a la comunidad.')+H('Tus derechos')+P('Acceso, rectificación, supresión, portabilidad y oposición escribiendo a '+esc(CONTACT)+'. También puedes reclamar ante la Agencia Española de Protección de Datos.')+H('Edad')+P('ARX es solo para mayores de 18 años.'),
terminos:'<h2>Términos de uso</h2>'+P('ARX es una comunidad privada de acceso por código. Al usarla aceptas estos términos y las normas.')+P('Eres responsable de lo que publicas y escribes. Podemos suspender o eliminar cuentas que incumplan las normas. ARX no verifica identidades ni garantiza encuentros; si quedas en persona, hazlo en sitios públicos y avisa a alguien de confianza. Los servicios pueden cambiar o interrumpirse.'),
normas:'<h2>Normas de la comunidad</h2>'+P('Respeto siempre. Nada de acoso, insultos, amenazas ni discriminación.')+P('Sin perfiles falsos ni suplantaciones. Sin contenido sexual explícito ni de menores. No compartas datos de otras personas sin su permiso. Sin spam ni publicidad.')+P('Si incumples: aviso, suspensión o expulsión. Puedes denunciar a cualquier persona desde su perfil o chat.')};
openM((t[k]||'')+(window.__consentOpen?'<button class="btn ghost" style="margin-top:14px" data-click="arxConsentShow()">← Volver</button>':''))};
/* --- tarjeta Cuenta y seguridad --- */
function addAccountCard(){const s=$('profile');if(!s||$('accountCard'))return;const d=document.createElement('div');d.id='accountCard';d.className='card';d.style.margin='14px 16px';d.innerHTML='<div class="ey">CUENTA Y SEGURIDAD</div><button class="btn ghost" style="margin-top:8px" data-click="arxLegal(\'privacidad\')">Privacidad</button><button class="btn ghost" style="margin-top:8px" data-click="arxLegal(\'terminos\')">Términos</button><button class="btn ghost" style="margin-top:8px" data-click="arxLegal(\'normas\')">Normas de la comunidad</button><button class="btn ghost" style="margin-top:8px;color:#ff91bc" data-click="arxDeleteAsk()">Borrar mi cuenta</button>';s.appendChild(d)}
addAccountCard();
const pv=document.querySelector('.privacy');if(pv){const l=document.createElement('div');l.style.cssText='margin-top:8px;font-size:11px';l.innerHTML='<a href="#" data-click="arxLegal(\'privacidad\');return false">Privacidad</a> · <a href="#" data-click="arxLegal(\'terminos\');return false">Términos</a>';pv.appendChild(l)}
/* --- consentimiento --- */
function arxConsentShow(){const nc=window.__needC,ne=window.__needE;const cl=document.querySelector('#modal .close');if(cl)cl.style.display='none';window.__consentOpen=true;let h='<div class="ey">ANTES DE EMPEZAR</div><h2>'+(nc?'Tu privacidad en ARX':'Protege tu cuenta')+'</h2>';if(nc){h+=P('Lee la <a href="#" data-click="arxLegal(\'privacidad\');return false">privacidad</a>, los <a href="#" data-click="arxLegal(\'terminos\');return false">términos</a> y las <a href="#" data-click="arxLegal(\'normas\');return false">normas</a>.')+'<label style="display:flex;gap:8px;font-size:12px;margin-top:10px"><input type="checkbox" id="c1"> Tengo 18 años o más y acepto los términos y las normas.</label><label style="display:flex;gap:8px;font-size:12px;margin-top:8px"><input type="checkbox" id="c2"> Consiento de forma explícita el tratamiento de mis datos, incluido lo que pueda revelar mi orientación sexual, según la política de privacidad.</label>'}if(ne){h+=(nc?H('Tu correo'):'')+P('Vincula tu correo para poder recuperar tu cuenta si cambias de móvil o borras los datos. No se muestra en tu perfil. Te enviaremos un enlace para confirmarlo.')+'<input id="firstEmail" type="email" placeholder="tu@correo.com" autocomplete="email" style="width:100%;margin-top:6px">'}h+='<button class="btn" style="margin-top:12px" data-click="arxAccept()">'+(nc?'Aceptar y continuar':'Continuar')+'</button>';openM(h)}
async function checkConsent(){if(!sb()||!me()||window.__consentOpen)return;const u=me();const {data,error}=await sb().from('arx_consents').select('version').eq('user_id',u.id).maybeSingle();if(error)console.error('ARX consent load:',error);const nc=error?true:!(data&&data.version>=CV),ne=false;if(!nc&&!ne){window.__consentDone=true;return}window.__needC=nc;window.__needE=ne;window.__consentDone=true;arxConsentShow()}
window.arxAccept=async function(){const nc=window.__needC,ne=window.__needE;if(nc&&(!$('c1').checked||!$('c2').checked)){toast('Marca las dos casillas para continuar');return}let e='';if(ne){e=($('firstEmail').value||'').trim();if(!/^\S+@\S+\.\S+$/.test(e)){toast('Escribe un correo válido');return}}if(nc){const {error}=await sb().from('arx_consents').upsert({user_id:me().id,version:CV});if(error){console.error(error);toast('No se pudo guardar. Inténtalo de nuevo');return}window.__needC=false}if(ne){const {data:updateData,error}=await sb().auth.updateUser({email:e},{emailRedirectTo:location.origin+location.pathname});if(error){console.error(error);toast('No se pudo vincular ese correo. Revisa que esté bien escrito o prueba con otro');return}if(updateData?.user)currentUser=updateData.user;window.__needE=false}window.__consentOpen=false;window.__consentDone=true;const cl=document.querySelector('#modal .close');if(cl)cl.style.display='';window.__setupOpen=false;closeM();if(!state.profileComplete)openProfileSetup();if(ne)toast('Te hemos enviado un enlace para confirmar tu correo ✦')};
/* --- aviso de mensajes nuevos en el punto de Conexiones --- */
let unread=0;
async function pollUnread(){if(!sb()||!me())return;const seen=localStorage.getItem('arx_dm_seen')||'1970-01-01T00:00:00Z';const {count}=await sb().from('arx_direct_messages').select('id',{count:'exact',head:true}).eq('receiver_id',me().id).gt('created_at',seen);unread=count||0;paintBadge()}
function paintBadge(){const b=$('navBadge');if(!b)return;const f=((state&&state.flowersIn)||[]).filter(x=>x.status==='pending').length,n=f+unread;b.textContent=n;b.classList.toggle('hidden',!n);const gd=$('segGardenDot');if(gd)gd.classList.toggle('hidden',!f)}
{const o=window.renderFlowerInbox;if(typeof o==='function')window.renderFlowerInbox=function(){const r=o.apply(this,arguments);paintBadge();return r}}
arxOnShow('privateChat',()=>{localStorage.setItem('arx_dm_seen',new Date().toISOString());unread=0;paintBadge()});
setInterval(()=>{if(!document.hidden)pollUnread()},30000);
const w=setInterval(()=>{if(me()&&sb()){clearInterval(w);loadHidden().then(applyHidden);checkConsent();pollUnread()}},800);
})();

/* v77: codigo de comunidad + codigo personal (sin correo) */
(function(){
const DOM='arxusers.invalid'; /* debe coincidir con la Edge Function arx-issue-code */
const X=()=>arxSupabase;
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}
window.arxSignup=async function(){
  showAuthError('');
  const code=($('loginCode').value||'').trim().toUpperCase();
  if(!code){showAuthError('Escribe el código de la comunidad.');return}
  if(!X()){showAuthError('ARX todavía no está conectado a Supabase.');return}
  const btn=$('signupBtn');if(btn)btn.disabled=true;
  let ok=false;window.__arxSigningUp=true;
  try{
    try{localStorage.setItem('arx_remember',$('rememberMe').checked?'1':'0')}catch(e){}

    // CREAR CUENTA SIEMPRE significa una identidad nueva. Nunca reutilizamos
    // una sesión anterior (esto era lo que hacía reaparecer el perfil de Aoi).
    try{await X().auth.signOut()}catch(e){console.warn('ARX previous signout:',e)}
    const anon=await X().auth.signInAnonymously();
    if(anon.error||!anon.data?.user){showAuthError('No se pudo iniciar una cuenta nueva. Inténtalo de nuevo.');return}

    const {data:role,error}=await X().rpc('arx_enter_with_code',{input_code:code});
    if(error){showAuthError(String(error.message||'').includes('too_many_attempts')?'Demasiados intentos. Espera unos minutos.':'No se pudo validar el código.');return}
    if(role!=='member'&&role!=='founder'){showAuthError('Código de la comunidad no válido.');return}

    const issued=await X().functions.invoke('arx-issue-code');
    if(issued.error||!issued.data?.ok){
      console.error(issued.error,issued.data);
      const st=issued.error?.context?.status;
      showAuthError(st===409?'No se pudo crear una cuenta nueva con este código.':'No se pudo crear tu código personal. Inténtalo de nuevo.');
      return;
    }
    ok=true;
    try{await X().auth.refreshSession()}catch(e){}
    showCode(issued.data.code);
  }catch(e){console.error('ARX NEW ACCOUNT:',e);showAuthError('No se pudo completar el registro. Inténtalo de nuevo.')}finally{
    if(btn)btn.disabled=false;
    if(!ok)window.__arxSigningUp=false;
  }
};

function showCode(c){
  openM('<div class="ey">CUENTA NUEVA · ARX</div><h2>Tu código personal</h2><div class="ticket-clean"><div class="ticket-note">Este código sirve para volver a entrar en <b>esta cuenta</b>. Guárdalo antes de continuar.</div><div class="personal-code" id="pc">'+esc(c)+'</div><button class="btn ghost" data-click="arxCopyPC()">Copiar código</button><label style="display:flex;gap:8px;align-items:center;font-size:11px;margin-top:12px"><input type="checkbox" id="pcOk"> Ya lo he guardado</label><button class="btn" data-click="arxPCDone()">Continuar</button></div>');
  const cl=document.querySelector('#modal .close');if(cl)cl.style.display='none';
}

window.arxCopyPC=function(){const t=$('pc').textContent;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('Código copiado ✦')).catch(()=>toast('Haz captura del código'))};
window.arxPCDone=async function(){if(!$('pcOk').checked){toast('Marca que ya lo has guardado');return}closeM();const cl=document.querySelector('#modal .close');if(cl)cl.style.display='';window.__arxSigningUp=false;const u=(await X().auth.getUser())?.data?.user;if(!u){showAuthError('No se pudo recuperar la cuenta nueva.');return}const ready=await finishAuth(u);if(ready===false){toast('Cuenta creada. Ahora completa tu perfil ✦')}};
window.arxLoginAsk=function(){
  openM('<div class="ey">YA TENGO CUENTA</div><h2>Entrar con mi código personal</h2><input id="lgCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXX-XXXXXX-XXXXXX" style="width:100%;margin-top:10px"><button class="btn" style="margin-top:12px" data-click="arxLogin()">Entrar</button>');
};
window.arxLogin=async function(){
  const c=String($('lgCode').value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(c.length!==18){toast('El código tiene 18 letras y números');return}
  window.__arxSigningUp=true;
  const {error}=await X().auth.signInWithPassword({email:c.slice(0,6).toLowerCase()+'@'+DOM,password:c.slice(6)});
  if(error){window.__arxSigningUp=false;console.error(error);toast('Código incorrecto');return}
  location.reload();
};
})();
