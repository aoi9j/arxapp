const $=id=>document.getElementById(id);
const ARX_EXT={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
const ARX_CONFIG_OK = !!(window.ARX_SUPABASE_URL && window.ARX_SUPABASE_KEY && !window.ARX_SUPABASE_URL.includes('PEGA_AQUI'));
const arxSupabase = (ARX_CONFIG_OK && window.supabase) ? window.supabase.createClient(window.ARX_SUPABASE_URL, window.ARX_SUPABASE_KEY, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } }) : null;
let currentUser=null;
// Declaradas antes de cualquier render para evitar TDZ si Supabase recupera sesión muy pronto.
var ARX_DROP01_ICONS={1:'✦',2:'◇',3:'◈',4:'✧',5:'◆'};
var ARX_DROP01=[
{id:1,name:'LUX',rarity:'COMMON',icon:'✦',clue:'La primera luz se esconde a la vista. Lee con calma a la fundadora.'},
{id:2,name:'NITOR',rarity:'UNCOMMON',icon:'◇',clue:'Los planes cuentan menos de lo que guardan.'},
{id:3,name:'FULGOR',rarity:'RARE',icon:'◈',clue:'Una señal se enciende fuera de ARX. Búscala en nuestras redes.'},
{id:4,name:'LUMEN',rarity:'EPIC',icon:'✧',clue:'Otra señal, más brillante, te espera en las redes. Trae números.'},
{id:5,name:'IUBAR',rarity:'LEGENDARY',icon:'◆',clue:'Une los números de Fulgor y Lumen. Donde se cruzan, brilla Iubar.'}
];
// ARX usa Supabase como fuente de verdad para los datos persistentes.
let state={code:"",logged:false,role:"member",community:"ARX",displayName:"",age:null,bio:"",photo:"",profileComplete:false,sent:[],matches:[],arrows:0,dailyClaim:"",improvements:[],missionClaimed:false,interests:[],tokens:120,flowers:[],pendingFlowers:[],events:[],dailyQuestionKey:"",dailyQuestionIndex:0,dailyAnswers:{},pendingConnections:[],collectedFigures:[],dropProgress:0,accountCreated:false,birthdays:[],dailyQuestion:null,profileCards:[]};

/* ===== PREFERENCIAS DE AVISOS ARX ===== */
let arxNotifPrefs={
  flower_enabled:true,
  connection_enabled:true,
  message_enabled:true,
  quiet_enabled:true,
  quiet_start:'23:00:00',
  quiet_end:'08:00:00'
};

async function loadArxNotificationPrefs(){
  if(!arxSupabase||!currentUser)return;

  try{
    const {data,error}=await arxSupabase
      .from('arx_notification_prefs')
      .select('user_id,flower_enabled,connection_enabled,message_enabled,quiet_enabled,quiet_start,quiet_end')
      .eq('user_id',currentUser.id)
      .maybeSingle();

    if(error){
      console.error('ARX notification prefs load:',error);
      renderArxNotificationPrefs();
      return;
    }

    if(data){
      arxNotifPrefs={
        flower_enabled:data.flower_enabled!==false,
        connection_enabled:data.connection_enabled!==false,
        message_enabled:data.message_enabled!==false,
        quiet_enabled:data.quiet_enabled!==false,
        quiet_start:data.quiet_start||'23:00:00',
        quiet_end:data.quiet_end||'08:00:00'
      };
    }else{
      const defaults={
        user_id:currentUser.id,
        flower_enabled:true,
        connection_enabled:true,
        message_enabled:true,
        quiet_enabled:true,
        quiet_start:'23:00:00',
        quiet_end:'08:00:00'
      };

      const {error:insertError}=await arxSupabase
        .from('arx_notification_prefs')
        .insert(defaults);

      if(insertError){
        console.error('ARX notification prefs create:',insertError);
      }else{
        arxNotifPrefs={
          flower_enabled:true,
          connection_enabled:true,
          message_enabled:true,
          quiet_enabled:true,
          quiet_start:'23:00:00',
          quiet_end:'08:00:00'
        };
      }
    }
  }catch(err){
    console.error('ARX notification prefs:',err);
  }

  renderArxNotificationPrefs();
}

async function arxToggleNotification(field,value){
  if(value){
    const ok=await enablePush(false);
    if(!ok){
      renderArxNotificationPrefs();
      return;
    }
  }
  await saveArxNotificationPref(field,value);
}

async function saveArxNotificationPref(field,value){
  if(!arxSupabase||!currentUser)return;

  const previous=arxNotifPrefs[field];
  arxNotifPrefs[field]=!!value;
  renderArxNotificationPrefs();

  try{
    const payload={
      user_id:currentUser.id,
      [field]:!!value
    };

    const {error}=await arxSupabase
      .from('arx_notification_prefs')
      .upsert(payload,{onConflict:'user_id'});

    if(error)throw error;

    toast('✓ Preferencia guardada');
  }catch(err){
    console.error('ARX notification pref save:',err);
    arxNotifPrefs[field]=previous;
    renderArxNotificationPrefs();
    toast('No se pudo guardar la preferencia');
  }
}

function renderArxNotificationPrefs(){
  const f=$('notifFlower');
  const c=$('notifConnection');
  const m=$('notifMessage');

  if(f)f.checked=arxNotifPrefs.flower_enabled!==false;
  if(c)c.checked=arxNotifPrefs.connection_enabled!==false;
  if(m)m.checked=arxNotifPrefs.message_enabled!==false;

  const q=$('notifQuietText');
  if(q){
    const start=String(arxNotifPrefs.quiet_start||'23:00:00').slice(0,5);
    const end=String(arxNotifPrefs.quiet_end||'08:00:00').slice(0,5);
    q.textContent=arxNotifPrefs.quiet_enabled===false
      ? 'Silencio nocturno desactivado'
      : 'Silencio nocturno · '+start+'–'+end;
  }
}

function save(){
  if($('sentCount'))$('sentCount').textContent=state.sent.length;
  if($('matchCount'))$('matchCount').textContent=state.matches.length;
  if($('arrowBalance'))$('arrowBalance').textContent=state.arrows||0;
  if($('improvementCount'))$('improvementCount').textContent=state.improvements.length;
  if($('tokenBalance'))$('tokenBalance').textContent=state.tokens||0;
  renderInterests();
  renderGarden();
  renderEvents();
  renderProfile();
  renderDiscover();
  renderDrop01();
  if(typeof renderEventRadar==='function')renderEventRadar();
  if($('cal')&&typeof renderCal==='function')renderCal();
}

/* ===== Memoria de la usuaria en Supabase (antes vivía en localStorage) ===== */
window.ARX_MEM={seen:{},count:0,reads:{},recent:[],zoneSkip:null,zone:null,loaded:false};
function arxMemReset(){const M=window.ARX_MEM;M.seen={};M.count=0;M.reads={};M.recent=[];M.zoneSkip=null;M.zone=null;M.loaded=false}
function arxDb(p,label){try{Promise.resolve(p).then(r=>{if(r&&r.error)console.error('ARX '+label+':',r.error)}).catch(e=>console.error('ARX '+label+':',e))}catch(e){console.error('ARX '+label+':',e)}}
async function loadUserMemory(){
  arxMemReset();
  const M=window.ARX_MEM;
  try{['arx_v52','arx_zone','arx_zoneskip','arx_seenids','arx_recent_emoji'].forEach(k=>localStorage.removeItem(k));Object.keys(localStorage).filter(k=>k.indexOf('arx_seen')===0).forEach(k=>localStorage.removeItem(k))}catch(e){}
  if(arxSupabase&&currentUser){
    const uid=currentUser.id,since=new Date(Date.now()-14*864e5).toISOString(),today=new Date().toISOString().slice(0,10);
    try{
      const [s,r,p,z]=await Promise.all([
        arxSupabase.from('arx_seen_cards').select('seen_user_id,seen_at').eq('user_id',uid).gte('seen_at',since),
        arxSupabase.from('arx_room_reads').select('event_id,last_read_at').eq('user_id',uid),
        arxSupabase.from('arx_user_prefs').select('recent_emoji,zone_skip_day').eq('user_id',uid).maybeSingle(),
        arxSupabase.from('arx_profiles').select('zone_lat,zone_lng').eq('id',uid).maybeSingle()
      ]);
      if(s.error)console.error('ARX cartas vistas:',s.error);
      (s.data||[]).forEach(x=>{const t=new Date(x.seen_at).getTime();M.seen[x.seen_user_id]=t;if(String(x.seen_at).slice(0,10)===today)M.count++});
      if(r.error)console.error('ARX lecturas de chat:',r.error);
      (r.data||[]).forEach(x=>{M.reads[String(x.event_id)]=new Date(x.last_read_at).getTime()});
      if(p.error)console.error('ARX preferencias:',p.error);
      if(p.data){M.recent=Array.isArray(p.data.recent_emoji)?p.data.recent_emoji:[];M.zoneSkip=p.data.zone_skip_day||null}
      if(z.error)console.error('ARX zona:',z.error);
      if(z.data&&z.data.zone_lat!=null&&z.data.zone_lng!=null)M.zone={lat:+z.data.zone_lat,lng:+z.data.zone_lng};
    }catch(e){console.error('ARX memoria:',e)}
  }
  M.loaded=true;
  try{if(typeof window.renderDiscoverPeople==='function')window.renderDiscoverPeople();if(typeof window.renderHomeNews==='function')window.renderHomeNews()}catch(e){}
}
function arxSetPref(fields,label){if(!arxSupabase||!currentUser)return;arxDb(arxSupabase.from('arx_user_prefs').upsert({user_id:currentUser.id,...fields},{onConflict:'user_id'}),label)}
function showAuthError(message){ const el=$('loginError'); if(el) el.textContent=message||''; }
function arxSafeError(err,fallback){ try{ console.error('ARX:',err); }catch(_){} return fallback||'No se pudo completar la operación. Inténtalo de nuevo.'; }
async function finishAuth(user){
  // El rol solo viene del servidor. Nunca confiamos en datos locales para permisos.
  const roleRes=await arxSupabase.rpc('arx_my_role');
  const serverRole=roleRes&&!roleRes.error?roleRes.data:null;
  if(serverRole!=='member'&&serverRole!=='founder') return 'denied';
  currentUser=user;
  state.role=serverRole;
  state.logged=true;
  state.accountCreated=true;

  const {data:profile,error}=await arxSupabase.from('arx_profiles')
    .select('id,username,age,bio,avatar_url,interests,profile_completed')
    .eq('id',user.id).maybeSingle();
  if(error) console.error('ARX profile load:',error);

  const complete=!!(profile && profile.profile_completed===true && profile.username && Number(profile.age)>=18 && profile.avatar_url);
  if(profile){
    state.displayName=profile.username||'';
    state.bio=profile.bio||'';
    state.photo=profile.avatar_url||'';
    state.interests=Array.isArray(profile.interests)?profile.interests:[];
    state.age=profile.age??null;
    state.profileComplete=complete;
  }else{
    state.displayName='';state.bio='';state.photo='';state.age=null;state.interests=[];state.profileComplete=false;
  }
  await loadArxNotificationPrefs();
  save();
  $('gate').style.display='none'; $('app').style.display='block'; applyRoleUI();
  if(!complete){openProfileSetup();return false}
  return true;
}

function openProfileSetup(){
  window.__setupOpen=true;
  openM('<div class="ey">PRIMER PASO · ARX</div><h2>Crea tu perfil</h2><div class="mut">Para proteger la comunidad necesitamos una foto, tu nombre y tu edad. El resto puedes completarlo cuando quieras.</div><div class="form" style="margin-top:14px"><label>FOTO DE PERFIL · OBLIGATORIA<input id="setupPhoto" type="file" accept="image/*"></label><label>NOMBRE O ALIAS · OBLIGATORIO<input id="setupName" maxlength="30" placeholder="Cómo quieres que te conozcan"></label><label>EDAD · OBLIGATORIA<input id="setupAge" type="number" min="18" max="120" inputmode="numeric" placeholder="18"></label><label>BIOGRAFÍA · OPCIONAL<textarea id="setupBio" maxlength="220" placeholder="Cuéntanos algo sobre ti…"></textarea></label><button class="btn" data-click="createProfile()">Activar mi perfil ARX</button></div>');
  {const cl=document.querySelector('#modal .close');if(cl)cl.style.display='none'}
}

async function createProfile(){
  if(!currentUser||!arxSupabase){toast('Necesitas iniciar sesión');return}
  const name=($('setupName').value||'').trim();
  const age=parseInt($('setupAge').value,10);
  const bio=($('setupBio').value||'').trim();
  const file=$('setupPhoto').files&&$('setupPhoto').files[0];
  if(!file){toast('La foto es obligatoria');return}
  if(!name){toast('El nombre es obligatorio');return}
  if(!Number.isInteger(age)||age<18||age>120){toast('Introduce una edad válida (18+)');return}
  if(!ARX_EXT[file.type]){toast('Usa una imagen JPG, PNG, WebP o GIF');return}
  if(file.size>5*1024*1024){toast('La foto debe pesar menos de 5 MB');return}
  const ext=ARX_EXT[file.type];
  const path=currentUser.id+'/avatar.'+ext;
  const {error:uploadError}=await arxSupabase.storage.from('arx-avatars').upload(path,file,{upsert:true,contentType:file.type});
  if(uploadError){toast(arxSafeError(uploadError,'No se pudo subir la foto. Inténtalo de nuevo.'));return}
  const {data}=arxSupabase.storage.from('arx-avatars').getPublicUrl(path);
  const avatarUrl=data.publicUrl+'?v='+Date.now();
  const {error}=await arxSupabase.from('arx_profiles').upsert({
    id:currentUser.id,username:name,age:age,bio:bio,avatar_url:avatarUrl,interests:[],profile_completed:true
  },{onConflict:'id'});
  if(error){toast(arxSafeError(error,'No se pudo guardar el perfil. Inténtalo de nuevo.'));return}
  state.displayName=name;state.age=age;state.bio=bio;state.photo=avatarUrl;state.interests=[];state.profileComplete=true;state.accountCreated=true;
  window.__setupOpen=false;{const cl=document.querySelector('#modal .close');if(cl)cl.style.display=''}save();closeM();try{loadUserMemory();loadEvents();loadDiscoverPeople();loadConnections();loadFlowers();loadDropFigures();loadDailyData();loadBirthdays()}catch(e){console.warn(e)}toast('Perfil creado correctamente ✦');
}



$('loginCode')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();arxSignup();}});

async function logout(){
  if(arxSupabase) await arxSupabase.auth.signOut().catch(()=>{});
  currentUser=null;arxMemReset();
  state.logged=false;
  state.role='member';
  // El perfil NO se borra al cerrar sesión.
  save();
  $('app').style.display='none';
  $('gate').style.display='grid';
  showAuthError('');
  if($('loginCode'))$('loginCode').value='';
  toast('Sesión cerrada. Tu perfil sigue guardado ✦');
}

if(arxSupabase){
  arxSupabase.auth.onAuthStateChange(async(event,session)=>{
    if((event==='SIGNED_IN'||event==='TOKEN_REFRESHED') && session?.user && !window.__arxSigningUp){
      const ready=await finishAuth(session.user);
      if(ready==='denied') return; // sesión sin código válido: se queda en la puerta
      state.logged=true;
      state.accountCreated=true;
      save();
      $('gate').style.display='none';
      $('app').style.display='block';
      applyRoleUI();
      if(ready) await Promise.all([loadUserMemory(),loadEvents(),loadDiscoverPeople(),loadConnections(),loadFlowers(),loadDropFigures(),loadDailyData(),loadBirthdays()]);
    }
    if(event==='SIGNED_OUT'){
      currentUser=null;arxMemReset();
      state.logged=false;
      save();
      $('app').style.display='none';
      $('gate').style.display='grid';
    }
  });
}

async function bootAuth(){
  $('gate').style.display='grid';
  $('app').style.display='none';
  if(!ARX_CONFIG_OK){showAuthError('ARX todavía no está conectado a Supabase.');return}

  // NO cerramos sesión al recargar. Recuperamos la sesión persistida de Supabase.
  try{if(localStorage.getItem('arx_remember')==='0'&&!sessionStorage.getItem('arx_alive'))await arxSupabase.auth.signOut().catch(()=>{});sessionStorage.setItem('arx_alive','1')}catch(e){}
  const {data:{session},error}=await arxSupabase.auth.getSession();
  if(error){
    console.error('Error recuperando sesión:',error);
    showAuthError('No se pudo recuperar tu sesión.');
    return;
  }

  if(session?.user){
    // Una cuenta recién creada pero todavía sin perfil NO debe saltarse la
    // pantalla inicial al recargar. La puerta siempre va antes del perfil.
    const roleRes=await arxSupabase.rpc('arx_my_role').catch(()=>({data:null,error:true}));
    if(roleRes?.error || (roleRes?.data!=='member' && roleRes?.data!=='founder')){
      await arxSupabase.auth.signOut().catch(()=>{});
      currentUser=null;state.logged=false;
      $('gate').style.display='grid';$('app').style.display='none';
      return;
    }
    const {data:profile}=await arxSupabase.from('arx_profiles')
      .select('id,username,age,avatar_url,profile_completed').eq('id',session.user.id).maybeSingle();
    const complete=!!profile && !!profile.username && Number.isInteger(profile.age) && !!profile.avatar_url && profile.profile_completed===true;
    if(!complete){
      // Dejamos la cuenta incompleta fuera de la sesión automática.
      // Así, al recargar, vuelve primero a “Crear mi cuenta”.
      await arxSupabase.auth.signOut().catch(()=>{});
      currentUser=null;state.logged=false;
      state.displayName='';state.bio='';state.photo='';state.age=null;state.interests=[];state.profileComplete=false;
      save();
      $('gate').style.display='grid';$('app').style.display='none';
      showAuthError('');
      return;
    }
    const ready=await finishAuth(session.user);
    if(ready==='denied'){
      await arxSupabase.auth.signOut().catch(()=>{});
      currentUser=null;state.logged=false;
      $('gate').style.display='grid';$('app').style.display='none';
      return;
    }
    state.logged=true;
    state.accountCreated=true;
    save();
    $('gate').style.display='none';
    $('app').style.display='block';
    applyRoleUI();
    if(ready) await Promise.all([loadUserMemory(),loadEvents(),loadDiscoverPeople(),loadConnections(),loadFlowers(),loadDropFigures(),loadDailyData(),loadBirthdays()]);
    return;
  }

  currentUser=null;
  state.logged=false;
  save();
}

function openSecurity(){
  if(state.role!=='founder'){toast('Solo la fundadora puede acceder a Seguridad');return}
  openM(`<div class="ey">ARX CONTROL</div><h2>Seguridad 🔐</h2><div class="mut">Los códigos actuales nunca se muestran. Puedes sustituirlos desde aquí y el anterior dejará de funcionar.</div><div class="event" style="margin-top:14px"><b>Código de miembros</b><div class="mut" style="margin-top:4px">Código protegido · se cambia sin mostrar el actual.</div><button class="btn" data-click="openChangeCode('member')">Cambiar código de miembros</button></div><div class="event"><b>Código de fundadora</b><div class="mut" style="margin-top:4px">Código protegido · se cambia sin mostrar el actual.</div><button class="btn" data-click="openChangeCode('founder')">Cambiar código de fundadora</button></div>`);
}
function openChangeCode(type){
  if(state.role!=='founder'){toast('No autorizado');return}
  const label=type==='founder'?'fundadora':'miembros';
  openM(`<div class="ey">SEGURIDAD ARX</div><h2>Cambiar código de ${label}</h2><div class="mut">El código anterior dejará de funcionar en cuanto guardes el nuevo.</div><div class="form" style="margin-top:14px"><label>NUEVO CÓDIGO<input id="newAccessCode" type="text" maxlength="80" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Escribe el nuevo código"></label><label>REPETIR CÓDIGO<input id="newAccessCode2" type="text" maxlength="80" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Repite el nuevo código"></label><button class="btn" data-click="changeAccessCode('${type}')">Guardar nuevo código</button></div>`);
}
async function changeAccessCode(type){
  if(state.role!=='founder'||!arxSupabase||!currentUser){toast('No autorizado');return}
  const a=($('newAccessCode')?.value||'').trim().toUpperCase();
  const b=($('newAccessCode2')?.value||'').trim().toUpperCase();
  if(a.length<12){toast('El código debe tener al menos 12 caracteres');return}
  if(a!==b){toast('Los códigos no coinciden');return}
  if(!/^ARX-[A-Z0-9-]+$/.test(a)){toast('El código debe empezar por ARX- y usar solo letras, números y guiones');return}
  const {data,error}=await arxSupabase.rpc('arx_change_access_code',{target_code_type:type,new_code:a});
  if(error||data!==true){console.error(error);toast(error?.message||'No se pudo cambiar el código');return}
  closeM();
  toast('Código de '+(type==='founder'?'fundadora':'miembros')+' actualizado ✦');
}


function applyRoleUI(){
  const fp=$('founderPanel'); if(fp) fp.classList.toggle('hidden',state.role!=='founder');
  const badge=document.querySelector('.private');
  if(!badge)return;
  if(state.role==='founder'){
    badge.textContent='✦ FUNDADORA · ACCESO TOTAL';
    badge.style.borderColor='#ff4fa366';
  }else{
    badge.textContent='⌁ COMUNIDAD PRIVADA';
  }
}
const arxShowHooks={};
function arxOnShow(id,fn){(arxShowHooks[id]=arxShowHooks[id]||[]).push(fn)}
function show(id){
  const target=$(id); if(!target){console.warn('ARX: pantalla no encontrada',id);return}
  document.querySelectorAll('.screen').forEach(x=>x.classList.remove('on'));
  target.classList.add('on');
  if(id==='calendar'&&typeof renderCalendarData==='function')renderCalendarData();
  if(id==='garden'&&typeof renderGarden==='function'){renderGarden();if(typeof loadFlowers==='function')loadFlowers()}
  document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active'));
  const navId=(id==='garden'||id==='privateChat')?'matches':id;const nav=[...document.querySelectorAll('.bottom .nav')].find(n=>n.getAttribute('onclick')===`show('${navId}')`);
  if(nav)nav.classList.add('active'); window.scrollTo({top:0,behavior:'smooth'});
  (arxShowHooks[id]||[]).forEach(f=>{try{f()}catch(e){console.warn('ARX show hook:',id,e)}});
}
function closeM(){const m=$('modal');if(m)m.classList.remove('on');clearInterval(window.eventRoomTimer);if(typeof window.evRoomCleanup==='function'){try{window.evRoomCleanup()}catch(e){console.warn('ARX room cleanup:',e)}}}
function openM(html){const c=$('modalContent'),m=$('modal');if(!c||!m)return;c.innerHTML=html;m.classList.add('on');}
function openImprovementForm(){openM('<div class="ey">BUZÓN ARX</div><h2>Ayúdanos a mejorar ✦</h2><div class="mut">Cuéntanos qué cambiarías, qué función te gustaría añadir o qué parte no te convence.</div><div class="form" style="margin-top:14px"><label>TIPO DE MEJORA<select id="impType"><option>✨ Nueva función</option><option>🎨 Diseño / experiencia</option><option>🐛 Algo no funciona</option><option>💡 Otra idea</option></select></label><label>TU IDEA<textarea id="impText" placeholder="Escribe tu propuesta…"></textarea></label><button class="btn" data-click="submitImprovement()">Enviar mejora</button></div>')}
async function submitImprovement(){
  const text=($('impText').value||'').trim();
  if(!text){toast('Cuéntanos primero tu mejora');return}
  if(!arxSupabase||!currentUser){toast('Necesitas iniciar sesión');return}
  const kind=String($('impType').value||'Otra').slice(0,40);
  const {error}=await arxSupabase.from('arx_improvements').insert({kind:kind,text:text.slice(0,2000)});
  if(error){console.error('ARX mejora:',error);toast('No se pudo enviar tu mejora. Inténtalo de nuevo');return}
  closeM();toast('¡Gracias! Tu mejora ha sido enviada ✦');
}
async function openImprovements(){
  if(state.role!=='founder'){toast('Solo la fundadora puede ver este buzón');return}
  if(!arxSupabase||!currentUser){toast('Necesitas iniciar sesión');return}
  const {data,error}=await arxSupabase.from('arx_improvements').select('id,kind,text,created_at').order('created_at',{ascending:false}).limit(200);
  if(error){console.error('ARX buzón:',error);toast('No se pudo cargar el buzón');return}
  state.improvements=data||[];
  if($('improvementCount'))$('improvementCount').textContent=state.improvements.length;
  const items=state.improvements.length
    ? state.improvements.map(x=>'<div class="event"><b>'+esc(x.kind)+'</b><div class="mut" style="margin-top:5px">'+esc(x.text)+'</div><div class="mut" style="margin-top:6px;font-size:11px">'+esc(new Date(x.created_at).toLocaleString('es-ES'))+'</div></div>').join('')
    : '<div class="notice">Todavía no hay mejoras enviadas.</div>';
  openM('<div class="ey">ARX CONTROL</div><h2>Mejoras de la comunidad</h2><div class="mut">Aquí puedes leer todas las propuestas enviadas por las usuarias.</div><div style="margin-top:12px">'+items+'</div>');
}
function openNotifications(){show('notifications');arxUnread=0;$('notifBadge').style.display='none'}

const arxQuestions=['¿Cuál sería tu domingo perfecto?','¿Qué pequeño detalle consigue alegrarte un día malo?','¿Dónde te irías mañana si pudieras viajar gratis?','¿Qué canción describe tu semana?','¿Qué cosa absurda defenderías hasta la muerte?','¿Qué lugar te hace sentir en casa?','¿Qué plan te parece perfecto para conocer a alguien?','¿Qué sueño todavía tienes pendiente?','¿Qué película puedes ver mil veces?','¿Qué valoras más cuando conoces a alguien?','¿Mar, montaña o ciudad?','¿Qué te gustaría aprender algún día?','¿Cuál es tu pequeño placer culpable?','¿Qué harías con un día completamente libre?','¿Qué viaje nunca olvidarás?','¿Qué gesto te hace confiar en alguien?'];
let discoverPeople=[];
let dailyQuestionRow=null;
async function loadDailyData(){
  if(!arxSupabase||!currentUser)return;
  const today=new Date().toISOString().slice(0,10);
  let {data:q,error}=await arxSupabase.from('arx_daily_questions').select('id,question,active_date').eq('active_date',today).eq('active',true).maybeSingle();
  if(error)console.error('ARX daily question:',error);
  if(!q){
    const fallback=arxQuestions[Math.floor(Date.now()/86400000)%arxQuestions.length];
    dailyQuestionRow={id:null,question:fallback,active_date:today};
  }else dailyQuestionRow=q;
  if(q){
    const {data:mine}=await arxSupabase.from('arx_daily_answers').select('answer').eq('question_id',q.id).eq('user_id',currentUser.id).maybeSingle();
    state.dailyAnswers[today]=mine?.answer||null;
    const {data:answers}=await arxSupabase.from('arx_daily_answers').select('user_id,answer,created_at').eq('question_id',q.id).order('created_at',{ascending:false}).limit(30);
    const ids=(answers||[]).map(a=>a.user_id).filter(id=>id!==currentUser.id);
    let profiles=[];if(ids.length){const r=await arxSupabase.from('arx_public_profiles').select('id,username,avatar_url').in('id',ids);profiles=r.data||[]}
    state.dailyCommunity=(answers||[]).filter(a=>a.user_id!==currentUser.id).map(a=>{const p=profiles.find(x=>x.id===a.user_id)||{};return {name:p.username||'Alguien de ARX',photo:p.avatar_url||'',answer:a.answer}});
  }
  renderDiscover();
}
function dailyQuestionKey(){return new Date().toISOString().slice(0,10)}
function renderDiscover(){
  const key=dailyQuestionKey(),q=dailyQuestionRow?.question||arxQuestions[Math.floor(Date.now()/86400000)%arxQuestions.length];
  if($('dailyQuestion'))$('dailyQuestion').textContent=q;
  if($('questionDate'))$('questionDate').textContent='PREGUNTA · '+new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long'});
  const answer=state.dailyAnswers[key];
  if($('dailyAnswer')){$('dailyAnswer').value=answer||'';$('dailyAnswer').disabled=!!answer;$('dailyAnswer').style.opacity=answer?'.65':'1'}
  if($('answerStatus'))$('answerStatus').textContent=answer?'✓ Tu respuesta está publicada para la comunidad.':'';
  renderDiscoverPeople();
  const el=$('dailyAnswers');if(el){const arr=state.dailyCommunity||[];el.innerHTML=arr.length?arr.map(a=>'<div class="card" style="margin-bottom:9px"><div class="row"><div class="mini"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C12.7 8 14 10.3 19 12 14 13.7 12.7 16 12 21 11.3 16 10 13.7 5 12 10 10.3 11.3 8 12 3Z"/></svg></div><div><b>'+esc(a.name)+'</b><div class="mut" style="margin-top:4px">“'+esc(a.answer)+'”</div></div></div></div>').join(''):'<div class="notice">Todavía no hay respuestas de la comunidad para mostrar.</div>'}
  const sig=$('signalText');if(sig){const p=discoverPeople[0];sig.textContent=p?('“'+p.prompt+'”'):'“Me iría mañana mismo a cualquier ciudad nueva.”';}
}


function currentSignal(){return discoverPeople[0]||null}

function signalPass(){if(discoverPeople.length>1)discoverPeople.push(discoverPeople.shift());renderDiscover();toast('Señal pasada. Te mostramos otra.')} 


function getPerson(id){return discoverPeople.find(p=>p.id===id)||discoverPeople[0]}
function flowerIntentData(){return [
 {key:'friendship',flower:'🌻',name:'Amistad',desc:'Creo que podríamos llevarnos genial.'},
 {key:'curiosity',flower:'🌷',name:'Curiosidad',desc:'Quiero conocerte un poco más.'},
 {key:'plan',flower:'🌸',name:'Plan',desc:'Me apetece compartir un plan contigo.'},
 {key:'attraction',flower:'🌹',name:'Atracción',desc:'Me llamaste la atención.'}
]}
function flowerByKey(key){return flowerIntentData().find(x=>x.key===key)||flowerIntentData()[0]}
let ARX_FLOWER_UID=0;
function flowerArt(key,cls=''){
 const k=key||'curiosity',uid=(++ARX_FLOWER_UID),common='<defs><linearGradient id="petal-'+k+'-'+uid+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".72"/><stop offset=".28" stop-color="#ff7bbd"/><stop offset="1" stop-color="#9b2d83"/></linearGradient><radialGradient id="center-'+k+'-'+uid+'"><stop stop-color="#ffeaa6"/><stop offset=".45" stop-color="#e9a64d"/><stop offset="1" stop-color="#8b4c35"/></radialGradient></defs>';
 let petals='';
 if(k==='friendship'){
   for(let i=0;i<10;i++){const a=i*36;petals+='<ellipse cx="50" cy="38" rx="12" ry="25" transform="rotate('+a+' 50 50)" fill="url(#petal-'+k+'-'+uid+')" opacity=".94"/>'}
 }else if(k==='plan'){
   for(let i=0;i<7;i++){const a=i*51.43;petals+='<path d="M50 49 C28 42 26 20 48 16 C62 24 62 39 50 49Z" transform="rotate('+a+' 50 50)" fill="url(#petal-'+k+'-'+uid+')"/>'}
 }else if(k==='attraction'){
   for(let i=0;i<12;i++){const a=i*30;petals+='<path d="M50 52 C25 45 22 18 50 11 C78 18 75 45 50 52Z" transform="rotate('+a+' 50 50)" fill="url(#petal-'+k+'-'+uid+')"/>'}
 }else{
   for(let i=0;i<6;i++){const a=i*60;petals+='<path d="M50 50 C22 48 18 22 39 13 C58 18 62 37 50 50Z" transform="rotate('+a+' 50 50)" fill="url(#petal-'+k+'-'+uid+')"/>'}
 }
 const svg='<svg viewBox="0 0 100 100" aria-hidden="true">'+common+petals+'<circle cx="50" cy="50" r="10" fill="url(#center-'+k+'-'+uid+')"/><circle cx="46" cy="46" r="2" fill="#fff" opacity=".65"/><path d="M50 60 C49 72 47 83 44 94" stroke="#5ebf7b" stroke-width="4" stroke-linecap="round"/><path d="M45 76 C35 69 28 72 25 78 C35 80 41 79 45 76Z" fill="#5ebf7b" opacity=".85"/></svg>';
 return '<div class="flower-art '+esc(cls)+'">'+svg+'</div>';
}
function pendingFlowerFor(id){const m=x=>String(x.targetId)===String(id);return (state.flowers||[]).find(m)||(state.pendingFlowers||[]).find(m)||null}
function profileContextItems(p){
 const out=[];
 (p.cards||[]).slice(0,5).forEach(c=>out.push({type:'profile-card',label:c.featured?'Tarjeta destacada':'Sobre ella',text:c.text,reply:true}));
 if((p.bio||'').trim())out.push({type:'bio',label:'Su bio',text:p.bio});
 (p.interests||[]).slice(0,6).forEach((x,i)=>out.push({type:'interest',label:'Interés',text:x,index:i}));
 return out;
}
function openDiscoveryProfile(id){
 const p=getPerson(id);if(!p)return;
 const connected=state.matches.includes(p.id),pending=state.pendingConnections.includes(p.id),flower=pendingFlowerFor(p.id);
 closeM();
 const photo=p.photo?'<img src="'+esc(p.photo)+'" alt="Foto de perfil" style="width:92px;height:92px;border-radius:22px;object-fit:cover;display:block;margin:0 auto 12px">':'<div class="profile-avatar fallback" style="width:92px;height:92px;margin:0 auto 12px">✦</div>';
 let contextHtml=profileContextItems(p).map((c,i)=>'<div class="card" style="margin-top:10px"><div class="ey">'+esc(c.label)+'</div><div style="margin-top:6px">“'+esc(c.text)+'”</div>'+((!connected&&!flower&&!pending)?'<div class="profile-reply"><button type="button" data-click="openFlowerComposer('+jq(p.id)+','+jq(c.text)+','+jq(c.label)+')">🌷 Responder a esto</button></div>':'')+'</div>').join('');
 let action='';
 if(connected){action='<button class="btn" data-click="closeM();openChatWith('+jq(p.name)+')">💬 Abrir chat · Conexión mutua</button>'}
 else if(flower){action='<div class="pending-flower"><b>'+flowerArt(flower.intent,'small')+' Flor enviada</b>Estás esperando una respuesta. No puedes enviar otra hasta que responda.</div>'}
 else if(pending){action='<div class="pending-flower"><b>⌁ Interés enviado</b>La conexión sigue pendiente.</div>'}
 else{action='<button class="btn discover-flower-btn" data-click="openFlowerComposer('+jq(p.id)+')">🌷 Enviar una flor</button>'}
 openM('<div class="ey">SEÑAL ARX · PERFIL REVELADO</div>'+photo+'<h2>'+esc(p.name)+' · '+esc(p.age)+'</h2><div class="mut">📍 Ubicación privada</div><div class="tags">'+(p.interests||[]).map(x=>'<span class="tag">'+esc(x)+'</span>').join('')+'</div>'+contextHtml+action+(connected?'':'<button class="btn ghost" data-click="closeM();signalPass()">Pasar</button>'));
}
function openFlowerComposer(personId,contextText='',contextLabel=''){
 const p=getPerson(personId);if(!p)return;
 const pending=pendingFlowerFor(personId);if(pending){toast('Ya has enviado una flor a esta persona');return}
 window._flowerTargetId=personId;window._flowerSelected='';window._flowerMode='flower';window._flowerContextText=contextText||'';window._flowerContextLabel=contextLabel||'';
 const intents=flowerIntentData();
 openM('<div class="ey">ARX · PRIMERA SEÑAL</div><h2>Enviar una flor a '+esc(p.name)+'</h2><div class="mut">Puedes enviar solo la flor o acompañarla con una tarjeta de máximo 100 caracteres.</div>'+(contextText?'<div class="flower-context"><div class="ctx-label">RESPONDIENDO A · '+esc(contextLabel||'SU PERFIL')+'</div><div class="ctx-text">“'+esc(contextText)+'”</div></div>':'')+'<div class="flower-intent-grid" id="flowerIntentGrid">'+intents.map(x=>'<button type="button" class="flower-intent" data-key="'+x.key+'" data-click="selectFlowerIntent(\''+x.key+'\')">'+flowerArt(x.key)+'<b>'+x.name+'</b><span>'+x.desc+'</span></button>').join('')+'</div><div id="flowerComposerBody" class="flower-compose hidden"></div><div class="flower-rule">✦ No es un “like”. Tu nombre siempre será visible.<br>🔒 La tarjeta no admite enlaces, teléfonos ni Instagram.</div>');
}
function selectFlowerIntent(key){
 window._flowerSelected=key;const x=flowerByKey(key);document.querySelectorAll('.flower-intent').forEach(b=>b.classList.toggle('selected',b.dataset.key===key));
 const body=$('flowerComposerBody');if(!body)return;body.classList.remove('hidden');
 body.innerHTML='<div class="flower-card-preview">'+flowerArt(key,'large')+'<div class="flower-send-summary"><div class="summary-art">'+flowerArt(key,'small')+'</div><div><b>'+esc(x.name)+'</b><div class="mut">'+esc(x.desc)+'</div></div></div>'+(window._flowerContextText?'<div class="flower-context"><div class="ctx-label">RESPONDIENDO A</div><div class="ctx-text">“'+esc(window._flowerContextText)+'”</div></div>':'')+'</div><div class="flower-mode"><button type="button" class="selected" id="flowerModeOnly" data-click="setFlowerMode(\'flower\')">'+flowerArt(key,'small')+'Solo flor</button><button type="button" id="flowerModeCard" data-click="setFlowerMode(\'card\')">✉️ Flor + tarjeta</button></div><div id="flowerCardEditor" class="hidden"><div class="flower-card-paper"><div class="paper-to">Para '+esc(getPerson(window._flowerTargetId)?.name||'esta persona')+'</div><div class="paper-text" id="flowerLiveText">Tu tarjeta aparecerá aquí…</div><div class="paper-from">De '+esc(state.displayName||'tu perfil ARX')+'</div></div><textarea id="flowerCardText" maxlength="100" placeholder="Escribe algo que de verdad quieras decir…" data-input="updateFlowerPreview()"></textarea><div class="flower-count"><span>Máximo 100 caracteres</span><strong id="flowerCharCount">0 / 100</strong></div><div style="display:flex;gap:7px;margin-top:10px;flex-wrap:wrap"><button type="button" class="toolbtn" data-click="flowerStarter(&quot;Me llamó la atención que…&quot;)">Me llamó la atención que…</button><button type="button" class="toolbtn" data-click="flowerStarter(&quot;Tenemos en común…&quot;)">Tenemos en común…</button><button type="button" class="toolbtn" data-click="flowerStarter(&quot;Ese plan que mencionaste…&quot;)">Ese plan que mencionaste…</button><button type="button" class="toolbtn" data-click="flowerStarter(&quot;Tengo curiosidad por…&quot;)">Tengo curiosidad por…</button></div></div><button type="button" class="btn" data-click="sendFlowerCard()">Enviar señal ✦</button><button type="button" class="btn ghost" data-click="closeM()">Ahora no</button>';
}
function setFlowerMode(mode){
 window._flowerMode=mode;const only=$('flowerModeOnly'),card=$('flowerModeCard'),ed=$('flowerCardEditor');if(only)only.classList.toggle('selected',mode==='flower');if(card)card.classList.toggle('selected',mode==='card');if(ed)ed.classList.toggle('hidden',mode!=='card');
}
function flowerStarter(text){const t=$('flowerCardText');if(!t)return;t.value=text.slice(0,100);updateFlowerPreview();t.focus();try{t.setSelectionRange(t.value.length,t.value.length)}catch(e){}}
function updateFlowerPreview(){const t=$('flowerCardText'),v=(t?.value||'');if($('flowerLiveText'))$('flowerLiveText').textContent=v||'Tu tarjeta aparecerá aquí…';if($('flowerCharCount')){$('flowerCharCount').textContent=v.length+' / 100';$('flowerCharCount').style.color=v.length>=95?'#ff83b9':''}}
async function sendFlowerCard(){
 const id=window._flowerTargetId,key=window._flowerSelected,mode=window._flowerMode||'flower';if(!id||!key){toast('Elige primero una flor');return}
 const t=($('flowerCardText')?.value||'').trim();if(mode==='card'&&(!t||[...t].length>100)){toast(!t?'Escribe algo en la tarjeta':'La tarjeta tiene que tener 100 caracteres o menos');return}
 if(pendingFlowerFor(id)){toast('Ya has enviado una flor a esta persona');return}
 const p=getPerson(id),x=flowerByKey(key),item={id:'flower-'+Date.now(),targetId:id,targetName:p.name,intent:key,flower:x.flower,intentName:x.name,mode,card:mode==='card'?t:'',contextText:window._flowerContextText||'',contextLabel:window._flowerContextLabel||'',from:state.displayName||'Tu perfil',date:new Date().toLocaleDateString('es-ES')};
 if(!arxSupabase||!currentUser){toast('Necesitas iniciar sesión');return}
 if(window._flowerSending)return;window._flowerSending=true;
 let ins;try{ins=await arxSupabase.rpc('arx_send_flower',{p_receiver:id,p_intent:key,p_mode:mode,p_card:item.card||null,p_context_text:item.contextText||null,p_context_label:item.contextLabel||null})}catch(e){ins={error:e}}
 window._flowerSending=false;
 if(ins.error){console.warn('ARX flor no enviada:',ins.error);toast(/sin_flores/.test(ins.error.message||'')?'Te has quedado sin flores. Consigue más completando un Drop ✦':ins.error.code==='23505'?'Ya has enviado una flor a esta persona':'No se pudo enviar la flor. Inténtalo de nuevo');if(ins.error.code==='23505')loadFlowers();return}
 item.id=ins.data.id;item.synced=true;state.flowerWallet={balance:Number(ins.data.balance)||0,founder:state.role==='founder'||!!ins.data.founder};renderFlowerChip();item.fromId=currentUser.id;item.status='pending';
 state.pendingFlowers=[item,...(state.pendingFlowers||[])];state.flowers=[item,...(state.flowers||[])];save();
 openM('<div class="flower-success">'+flowerArt(key,'large')+'<div class="ey">SEÑAL ENVIADA</div><h2>Tu '+(mode==='card'?'flor y tarjeta':'flor')+' ha llegado a '+esc(p.name)+'</h2>'+(item.contextText?'<div class="flower-context"><div class="ctx-label">RESPONDIÓ A · '+esc(item.contextLabel||'SU PERFIL')+'</div><div class="ctx-text">“'+esc(item.contextText)+'”</div></div>':'')+(mode==='card'?'<div class="flower-card-paper"><div class="paper-to">Para '+esc(p.name)+'</div><div class="paper-text">'+esc(t)+'</div><div class="paper-from">De '+esc(state.displayName||'tu perfil ARX')+'</div></div>':'<div class="mut" style="margin-top:12px">Has enviado la flor sin tarjeta. A veces una señal sencilla dice suficiente.</div>')+'<div class="mut" style="margin-top:12px">Ahora le toca a ella decidir. No podrás enviar otra flor hasta que responda.</div><button class="btn" data-click="closeM()">Cerrar</button></div>');
 window._flowerTargetId=null;window._flowerSelected='';window._flowerContextText='';window._flowerContextLabel='';
}

function walletLine(){const w=state.flowerWallet;if(!w)return '';return '<div class="fw-sub" style="margin-top:-6px">'+(w.founder?'Flores ilimitadas ✦':'Te quedan <b>'+(w.balance||0)+'</b> '+((w.balance||0)===1?'flor':'flores'))+'</div>'}
function renderFlowerChip(){const c=$('flowerChip'),n=$('flowerChipN'),w=state.flowerWallet;if(!c||!n)return;if(!w){c.style.display='none';return}n.textContent=w.founder?'∞':String(w.balance||0);c.style.display='inline-flex'}
function showFlowerWallet(){const w=state.flowerWallet;if(!w)return;toast(w.founder?'🌹 Flores ilimitadas ✦':'🌹 Te quedan '+(w.balance||0)+(w.balance===1?' flor':' flores')+' · Recuperas 1 por semana hasta tener 3')}
async function loadWallet(){let founder=state.role==='founder',balance=0;try{const r=await arxSupabase.rpc('arx_my_flowers');if(!r.error&&r.data){balance=Number(r.data.balance)||0;founder=founder||!!r.data.founder}}catch(e){console.warn('ARX wallet:',e)}state.flowerWallet={balance,founder};renderFlowerChip()}
async function loadFlowers(){
 if(!arxSupabase||!currentUser)return;loadWallet();
 const q0=cols=>arxSupabase.from('arx_flowers').select(cols).or('sender_id.eq.'+currentUser.id+',receiver_id.eq.'+currentUser.id).order('created_at',{ascending:false}).limit(200);
 let r=await q0('id,sender_id,receiver_id,intent,card,context_text,created_at,status');
 if(r.error)r=await q0('id,sender_id,receiver_id,intent,card,context_text,created_at');
 if(r.error){console.warn('ARX flores:',r.error);return}
 const rows=r.data||[],ids=[...new Set(rows.map(x=>x.sender_id===currentUser.id?x.receiver_id:x.sender_id))];
 let ps=[];if(ids.length){const q=await arxSupabase.from('arx_public_profiles').select('id,username').in('id',ids);ps=q.data||[]}
 const nm=id=>(ps.find(p=>p.id===id)||{}).username||'Alguien de ARX';
 const mk=x=>({id:x.id,intent:x.intent,intentName:flowerByKey(x.intent).name,card:x.card||'',contextText:x.context_text||'',date:new Date(x.created_at).toLocaleDateString('es-ES'),from:nm(x.sender_id),fromId:x.sender_id,status:x.status||'pending',targetId:x.receiver_id,targetName:nm(x.receiver_id),synced:true});
 const local=(state.flowers||[]).filter(f=>!f.synced);
 state.flowersIn=rows.filter(x=>x.receiver_id===currentUser.id).map(mk);
 state.flowers=[...rows.filter(x=>x.sender_id===currentUser.id).map(mk),...local];
 renderGarden();renderFlowerInbox();
}
function renderFlowerInbox(){
 const el=$('flowerInbox'),n=(state.flowersIn||[]).filter(f=>f.status==='pending');
 const b=$('navBadge');if(b){b.textContent=n.length;b.classList.toggle('hidden',!n.length)}
 if(!el)return;
 if(!n.length){el.innerHTML='';return}
 el.innerHTML='<div class="sec">FLORES NUEVAS · '+n.length+'</div>'+n.map(f=>{const x=flowerByKey(f.intent),ia=jq(f.id);return '<div class="card fi-card">'+flowerArt(x.key)+'<b>'+esc(x.name)+'</b><div class="mut" style="font-size:12px">'+esc(x.desc)+'</div><div class="fi-from">De '+esc(f.from)+' · '+esc(f.date)+'</div>'+(f.contextText?'<div class="flower-note">↳ “'+esc(f.contextText)+'”</div>':'')+(f.card?'<div class="flower-note">“'+esc(f.card)+'”</div>':'<div class="flower-note">Solo flor</div>')+'<div class="fi-acts"><button class="btn" data-click="arxFlowerAccept('+ia+')">Abrir conexión ✦</button><button class="btn ghost" data-click="arxFlowerDecline('+ia+')">Ahora no</button></div></div>'}).join('');
}
window.arxFlowerAccept=async function(id){
 const f=(state.flowersIn||[]).find(x=>x.id===id);if(!f||!arxSupabase||!currentUser)return;
 const sid=f.fromId;
 const acc=await arxSupabase.rpc('arx_accept_flower',{p_flower_id:String(id)});
 if(acc.error||acc.data!==true){if(acc.error)console.error(acc.error);toast('No se pudo abrir la conexión. Inténtalo de nuevo');return}
 f.status='accepted';await loadConnections();renderFlowerInbox();renderGarden();toast('¡Conexión abierta! Ya podéis hablar ✦');if(sid)openChatWith(f.from,sid);
};
window.arxFlowerDecline=async function(id){
 const f=(state.flowersIn||[]).find(x=>x.id===id);if(!f||!arxSupabase||!currentUser)return;
 const u=await arxSupabase.from('arx_flowers').update({status:'declined'}).eq('id',id);
 if(u.error){console.error(u.error);toast('No se pudo guardar tu respuesta');return}
 f.status='declined';renderFlowerInbox();renderGarden();toast('La flor se queda en tu jardín ✦');
};
async function loadConnections(){
  if(!arxSupabase||!currentUser)return;
  const {data,error}=await arxSupabase.from('arx_connections')
    .select('id,status,requester_id,target_id,created_at,updated_at')
    .or('requester_id.eq.'+currentUser.id+',target_id.eq.'+currentUser.id)
    .order('created_at',{ascending:false});
  if(error){console.error('ARX load connections:',error);return}
  const rows=data||[];
  state.matches=[];
  state.pendingConnections=[];
  rows.forEach(c=>{
    const other=c.requester_id===currentUser.id?c.target_id:c.requester_id;
    if(c.status==='matched')state.matches.push(other);
    else if(c.status==='pending'&&c.requester_id===currentUser.id)state.pendingConnections.push(c.target_id);
  });
  renderConnections();
}

function renderConnections(){
  const el=$('connectionList');
  if(!el)return;
  const ids=[...new Set(state.matches||[])];
  if(!ids.length){
    el.innerHTML='<div class="notice">Todavía no tienes conexiones mutuas. Cuando dos personas se interesen mutuamente, aparecerán aquí. ✦</div>';
    return;
  }
  el.innerHTML=ids.map(id=>{
    const p=(discoverPeople||[]).find(x=>x.id===id);
    const name=p?.name||'Conexión ARX';
    const photo=p?.photo?'<img src="'+esc(p.photo)+'" alt="" style="width:54px;height:54px;border-radius:50%;object-fit:cover">':'<div class="mini"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C12.7 8 14 10.3 19 12 14 13.7 12.7 16 12 21 11.3 16 10 13.7 5 12 10 10.3 11.3 8 12 3Z"/></svg></div>';
    return '<div class="card" style="margin-bottom:10px"><div class="row">'+photo+'<div><b>'+esc(name)+'</b><div class="mut">Conexión mutua ✦</div></div></div><button class="btn" type="button" data-click="openChatWith('+jq(name)+','+jq(id)+')">💬 Abrir chat</button></div>';
  }).join('');
}

async function loadDiscoverPeople(){
  if(!arxSupabase||!currentUser)return;
  const runQ=cols=>arxSupabase.from('arx_public_profiles').select(cols).neq('id',currentUser.id).limit(50);
  const base='id,username,age,bio,avatar_url,interests';
  let {data,error}=await runQ(base);
  if(error){console.error('ARX load discover:',error);return}
  const rows=data||[];
  const matched=new Set(state.matches||[]);
  const pending=new Set(state.pendingConnections||[]);
  let cardRows=[];
  if(rows.length){
    const ids=rows.map(p=>p.id);
    const cr=await arxSupabase.from('arx_profile_cards').select('id,user_id,prompt,text,featured,position').in('user_id',ids).order('position',{ascending:true});
    if(cr.error){console.warn('ARX profile cards:',cr.error)}else cardRows=cr.data||[];
  }
  discoverPeople=rows.map(p=>{
    const interests=Array.isArray(p.interests)?p.interests:[];
    let prompt='Me iría mañana mismo a cualquier ciudad nueva.';
    if(interests.length)prompt='También elegiría un plan relacionado con '+String(interests[0]).replace(/^\S+\s*/,'')+'.';
    else if(p.bio)prompt='También valora conocer gente con calma y sin prisas.';
    const cards=cardRows.filter(c=>c.user_id===p.id).sort((a,b)=>(Number(b.featured)-Number(a.featured))||(Number(a.position)-Number(b.position)));
    return {id:p.id,name:p.username||'Alguien de ARX',age:p.age||'',bio:p.bio||'',photo:p.avatar_url||'',lat:null,lng:null,interests,prompt,cards,connected:matched.has(p.id),pending:pending.has(p.id)};
  });
  renderDiscover();
  renderConnections();
  loadMyProfileCards();
}



function send(){let i=$('input'),t=i.value.trim();if(!t)return;appendTextMessage(t,true);i.value=''}
let chatPartnerName='tu conexión';
function renderChatNudge(){const el=$('chatNudge');if(!el)return;el.style.display='flex';el.innerHTML='✦ Ya podéis hablar con <b>'+esc(chatPartnerName)+'</b>. La conversación ya está abierta.';}
function appendTextMessage(t,me=false){let m=document.createElement('div');m.className='msg'+(me?' me':'');m.textContent=t;$('messages').appendChild(m);$('messages').scrollTop=$('messages').scrollHeight}
function attachGif(e){const f=e.target.files[0];if(!f)return;const url=URL.createObjectURL(f);let m=document.createElement('div');m.className='msg me media-msg';let img=document.createElement('img');img.src=url;img.alt='GIF';m.appendChild(img);$('messages').appendChild(m);e.target.value='';toast('GIF añadido al chat')}
function pickPhoto(){$('photoInput').click()}
function attachPhoto(e){const f=e.target.files[0];if(!f)return;const url=URL.createObjectURL(f);let m=document.createElement('div');m.className='msg me media-msg';let img=document.createElement('img');img.src=url;img.alt='Foto';m.appendChild(img);$('messages').appendChild(m);e.target.value='';toast('Foto añadida al chat')}
function pickFile(){$('fileInput').click()}
function attachFile(e){const f=e.target.files[0];if(!f)return;appendTextMessage('📎 '+f.name,true);e.target.value='';toast('Archivo adjuntado')}
let mediaRecorder=null,audioChunks=[];
async function toggleAudio(){if(mediaRecorder&&mediaRecorder.state==='recording'){mediaRecorder.stop();return}if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){toast('Tu navegador no permite grabar audio aquí');return}try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});audioChunks=[];mediaRecorder=new MediaRecorder(stream);$('audioStatus').textContent='🔴 Grabando… pulsa Audio otra vez para terminar';mediaRecorder.ondataavailable=e=>audioChunks.push(e.data);mediaRecorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(audioChunks,{type:'audio/webm'});const url=URL.createObjectURL(blob);let m=document.createElement('div');m.className='msg me audio-msg';m.innerHTML='🎙 <audio controls src="'+url+'"></audio>';$('messages').appendChild(m);$('audioStatus').textContent='';toast('Audio enviado al chat')};mediaRecorder.start()}catch(e){$('audioStatus').textContent='';toast('Necesitas permitir el micrófono')}
}
function openReactionPicker(){openM('<div class="ey">CHAT ARX</div><h2>Enviar reacción</h2><div class="tags" style="margin-top:14px">'+['❤️','😂','😍','✨','🔥','🫶','🥹','🌹'].map(x=>'<button class="toolbtn" data-click="appendTextMessage(\''+x+'\',true);closeM()">'+x+'</button>').join('')+'</div>')}
function openPoll(){openM('<div class="ey">CHAT ARX</div><h2>Crear encuesta</h2><div class="form"><label>PREGUNTA<input id="pollQ" placeholder="¿Qué hacemos este finde?"></label><label>OPCIÓN 1<input id="poll1" placeholder="Café"></label><label>OPCIÓN 2<input id="poll2" placeholder="Paseo"></label><button class="btn" data-click="sendPoll()">Enviar encuesta</button></div>')}
function sendPoll(){const q=$('pollQ').value||'¿Qué hacemos?';const a=$('poll1').value||'Opción 1';const b=$('poll2').value||'Opción 2';openM('');closeM();const m=document.createElement('div');m.className='msg me';const t=document.createElement('b');t.textContent='▣ '+q;const tags=document.createElement('div');tags.className='tags';[a,b].forEach(o=>{const btn=document.createElement('button');btn.type='button';btn.className='toolbtn';btn.textContent=o;btn.addEventListener('click',()=>toast('Votaste por '+o));tags.appendChild(btn)});m.appendChild(t);m.appendChild(tags);$('messages').appendChild(m)}

function sendPlan(plan){appendTextMessage('✦ Propongo un plan: '+plan,true);toast('Propuesta enviada')}
function openEvent(){
  if(!currentUser){toast('Necesitas iniciar sesión');return false}
  try{
    eventStep=1;
    const html=eventWizardHTML();
    if(!html){toast('No se pudo abrir el creador de experiencias');return false}
    openM(html);
    bindEventWizard();
    return false;
  }catch(err){
    console.error('ARX openEvent:',err);
    toast('No se pudo abrir el creador de experiencias');
    return false;
  }
}
async function createEvent(){
  const name=($('evName')?.value||'').trim(),date=$('evDate')?.value||'',time=$('evTime')?.value||'',place=($('evPlace')?.value||'').trim(),exactPlace=($('evExactPlace')?.value||'').trim(),max=parseInt($('evMax')?.value||'10',10),desc=($('evDesc')?.value||'').trim(),type=$('evType')?.value||'Quedada',cover=($('evCover')?.value||'').trim();if(cover&&!/^https:\/\/[^\s()"'\\<>]{1,500}$/.test(cover)){toast('La portada debe ser un enlace https válido (Supabase o Giphy)');return false}
  if(!name||!date||!time||!place){toast('Completa nombre, fecha, hora y zona');return false}
  if(!Number.isInteger(max)||max<2){toast('El aforo mínimo es de 2 personas');return false}
  if(!arxSupabase||!currentUser){toast('Tu sesión no está disponible.');return false}
  const payload={creator_id:currentUser.id,name,event_date:date,event_time:time,place,exact_place:exactPlace||null,max_attendees:max,description:desc||null,event_type:type,cover_url:cover||null};
  const button=document.querySelector('#modalContent .arx-publish');if(button){button.disabled=true;button.textContent='Publicando…'}
  const result=await arxSupabase.from('arx_events').insert(payload).select('id,creator_id,name,event_date,event_time,place,max_attendees,description,event_type,cover_url,created_at').single();
  if(result.error){console.error(result.error);toast(arxSafeError(result.error,'No se pudo publicar el evento. Inténtalo de nuevo.'));if(button){button.disabled=false;button.textContent='Publicar experiencia ✦'}return false}
  closeM();show('map');await loadEvents();toast('Experiencia publicada ✦');return true;
}
async function loadEvents(){
  if(!arxSupabase||!currentUser)return;
  const result=await arxSupabase.from('arx_public_events').select('id,creator_id,name,event_date,event_time,place,max_attendees,description,event_type,cover_url').order('event_date',{ascending:true}).order('event_time',{ascending:true});
  if(result.error){console.error('ARX load events:',result.error);return renderEvents()}
  const a=await arxSupabase.from('arx_event_attendees').select('event_id').eq('user_id',currentUser.id);const ids=new Set((a.data||[]).map(x=>String(x.event_id)));
  state.events=(result.data||[]).map(ev=>({id:ev.id,creator_id:ev.creator_id,name:ev.name,date:ev.event_date,time:String(ev.event_time||'').slice(0,5),place:ev.place,max:ev.max_attendees,desc:ev.description||'',type:ev.event_type||'Experiencia',cover:ev.cover_url||'',attending:ids.has(String(ev.id)),exactPlace:null}));
  renderEvents();renderEventRadar();renderCalendarData();
}
async function attendEvent(id){
  if(!arxSupabase||!currentUser){toast('Tu sesión no está disponible');return}
  const ev=state.events.find(x=>String(x.id)===String(id));if(!ev)return;
  if(ev.attending){const {error}=await arxSupabase.from('arx_event_attendees').delete().eq('event_id',id).eq('user_id',currentUser.id);if(error){toast('No se pudo cancelar la asistencia');return}ev.attending=false;renderEvents();try{renderHomeNews();renderEventRadar();renderCalendarData()}catch(e){}toastUndo('Has salido del plan.',()=>attendEvent(id));return}
  const {error}=await arxSupabase.from('arx_event_attendees').insert({event_id:id,user_id:currentUser.id});
  if(error){toast(error.code==='23505'?'Ya estás apuntada a este evento':'No se pudo registrar tu asistencia');return}
  ev.attending=true;toast('Te has apuntado al evento ✦');renderEvents();try{renderHomeNews();renderEventRadar();renderCalendarData()}catch(e){}
}
function renderEvents(){
  const el=$('events');if(!el)return;const all=Array.isArray(state.events)?state.events:[];const arr=arxFiltered();if(!arr.length&&all.length){el.innerHTML='<div class="card arx-empty"><div class="ey">✦ SIN RESULTADOS</div><h3>Ningún plan con esos filtros.</h3><button class="btn" type="button" data-click="arxClear()">Ver todos los planes</button></div>';return}
  if(!arr.length){el.innerHTML='<div class="card arx-empty"><div class="ey">✦ PRIMERA EXPERIENCIA</div><h3>Aún no hay planes publicados.</h3><div class="mut">Crea la primera experiencia ARX.</div><button class="btn" type="button" data-click="return openEvent()">＋ Crear experiencia</button></div>';return}
  el.innerHTML=arr.map(ev=>{const cover=ev.cover?'<div class="event-cover" style="background-image:url('+cssUrl(ev.cover)+')"></div>':'<div class="event-cover event-cover-empty"><span>✦</span></div>';return '<article class="event-card">'+cover+'<div class="event-card-body"><div class="ey">'+esc(ev.type)+'</div><h3>'+esc(ev.name)+'</h3><div class="event-meta"><span>◷ '+esc(ev.date)+'</span><span>'+esc(ev.time)+'</span></div><div class="event-place">⌖ '+esc(ev.place)+'</div>'+(ev.desc?'<p class="mut event-desc">'+esc(ev.desc)+'</p>':'')+'<div class="event-footer"><span>👥 hasta '+esc(ev.max)+'</span><button class="btn ghost" type="button" data-click="openEventDetails('+jq(ev.id)+')">Ver experiencia →</button></div></div></article>'}).join('');
}
function esc(v){return String(v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
/* ARX v69 seguridad: valor JS seguro para usar dentro de atributos onclick="..." (escapa & < > " ' tras JSON.stringify) */
function jq(v){return esc(JSON.stringify(v===undefined?null:v))}
/* ARX v69: URL segura para usar dentro de url(...) en style="" */
function cssUrl(u){u=String(u==null?'':u);if(!/^(https:\/\/|blob:|data:image\/)/i.test(u))return '';return esc(u.replace(/[()'"\\\s<>]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase().padStart(2,'0')))}
/* ARX v66 seguridad: solo deja pasar ids "limpios" (letras, numeros, guion) y emojis de una lista fija */
function safeId(v){v=String(v==null?'':v);return /^[A-Za-z0-9_-]{1,64}$/.test(v)?v:''}
var ARX_REACT_OK=['❤️','😂','😍','✨','🔥','🫶','🥹','🌹'];
function safeEmoji(v){return ARX_REACT_OK.indexOf(v)>=0?v:''}

const ARX_INTEREST_GROUPS={
'MÚSICA':['🎵 Pop','🎸 Rock','🎧 Indie','🎛 Electrónica','🎤 Hip-hop/Rap','💃 Reggaetón','🎻 Clásica','🎷 Jazz','💜 K-pop','🌴 Música latina','🎪 Festivales','🎙 Podcasts'],
'VIAJES':['✈️ Viajar','🚗 Road trips','🎒 Mochilera','🏙 Ciudades','🏝 Playa','⛰ Montaña','🌲 Naturaleza','🗺 Escapadas','🏄 Surf','🚆 Viajar en tren','🏕 Camping','🧭 Viajes improvisados'],
'CREATIVIDAD':['📸 Fotografía','🎬 Cine','📺 Series','📚 Lectura','✍️ Escritura','🎨 Arte','🧵 Manualidades','💻 Diseño','👗 Moda','🎭 Teatro','🪴 Decoración','🎞 Documentales'],
'PLANES':['☕ Cafés','🍜 Restaurantes','🥐 Brunch','🍳 Cocinar','🍰 Repostería','🎲 Juegos de mesa','🎤 Karaoke','🌃 Vida nocturna','🏛 Museos','🎟 Espectáculos','🧩 Escape rooms','🧺 Picnic'],
'ACTIVIDAD':['🏋️ Gimnasio','🏃 Running','🧘 Yoga','🥾 Senderismo','🚴 Ciclismo','💃 Baile','🏊 Natación','🧗 Escalada','🛼 Patines','🥊 Boxeo','⛳ Golf','🧗‍♀️ Aventura'],
'ESTILO DE VIDA':['🐶 Animales','🌱 Sostenibilidad','🤝 Voluntariado','🚀 Emprendimiento','🧠 Aprender','🧘 Bienestar','💻 Tecnología','☀️ Madrugadora','🌙 Nocturna','🏠 Casera','🌿 Vida tranquila','📖 Formación'],
'VIBE':['✨ Espontánea','🌍 Aventurera','💬 Sociable','🌿 Tranquila','🎨 Creativa','🔎 Curiosa','😂 Humor','❤️ Romántica','⚡ Energética','🧭 Exploradora','🫶 Cariñosa','🎯 Organizada'],
'COMUNIDAD':['🏳️‍🌈 Activismo','💜 Comunidad LGBTQ+','👩‍🎤 Cultura queer','🗣 Conversaciones profundas','🫂 Nuevas amistades','🌎 Intercambio cultural','🧑‍🤝‍🧑 Planes en grupo','💌 Citas','🌈 Orgullo','🧠 Salud emocional']};
function openInterests(){let html='<div class="ey">MI PERFIL</div><h2>¿Qué te representa?</h2><div class="mut">Elige hasta 8 intereses. Puedes cambiarlo cuando quieras.</div><div class="interest-picker" id="interestPicker">';for(const [group,opts] of Object.entries(ARX_INTEREST_GROUPS)){html+='<div class="interest-group" style="width:100%"><h3>'+group+'</h3><div class="interest-picker">'+opts.map(o=>'<button class="tag interest-option '+(state.interests.includes(o)?'selected':'')+'" data-interest="'+esc(o)+'" data-click="toggleInterest(this)">'+o+'</button>').join('')+'</div></div>'}html+='</div><div class="interest-limit" id="interestLimit">'+(state.interests.length)+'/8 seleccionados</div><button class="btn" data-click="saveInterests()">Guardar intereses</button>';openM(html)}
function toggleInterest(el){const selected=document.querySelectorAll('#interestPicker .interest-option.selected').length;if(!el.classList.contains('selected')&&selected>=8){toast('Puedes elegir hasta 8');return}el.classList.toggle('selected');const n=document.querySelectorAll('#interestPicker .interest-option.selected').length;if($('interestLimit'))$('interestLimit').textContent=n+'/8 seleccionados'}
async function saveInterests(){const interests=[...document.querySelectorAll('#interestPicker .interest-option.selected')].map(x=>x.dataset.interest);if(!currentUser||!arxSupabase){toast('Necesitas iniciar sesión');return}const {data:upd,error}=await arxSupabase.from('arx_profiles').update({interests}).eq('id',currentUser.id).select('id');if(error||!upd||!upd.length){toast('No se pudieron guardar los intereses');return}state.interests=interests;save();closeM();toast('Intereses guardados ✦')}
function chooseProfilePhoto(){$('profilePhotoInput').click()}
async function photoSelected(e){
  const input=e&&e.target;
  const f=input&&input.files&&input.files[0];
  if(!f)return;
  if(!ARX_EXT[f.type]){toast('Usa una imagen JPG, PNG, WebP o GIF');if(input)input.value='';return}
  if(!currentUser||!arxSupabase){toast('Necesitas iniciar sesión');return}
  if(f.size>5*1024*1024){toast('La foto debe pesar menos de 5 MB');if(input)input.value='';return}
  const ext=ARX_EXT[f.type];
  const path=currentUser.id+'/avatar.'+ext;
  const bucket=arxSupabase.storage.from('arx-avatars');
  const {error:uploadError}=await bucket.upload(path,f,{upsert:true,contentType:f.type,cacheControl:'3600'});
  if(uploadError){console.error('ARX upload:',uploadError);toast(arxSafeError(uploadError,'No se pudo subir la foto. Revisa que el bucket arx-avatars permita subir archivos.'));if(input)input.value='';return}
  const {data}=bucket.getPublicUrl(path);
  const url=data.publicUrl+'?v='+Date.now();
  const {data:upd,error:dbError}=await arxSupabase.from('arx_profiles').upsert({id:currentUser.id,avatar_url:url,profile_completed:!!state.displayName&&Number(state.age)>=18},{onConflict:'id'}).select('id');
  if(dbError||!upd||!upd.length){console.error('ARX foto:',dbError||'0 filas');toast('La foto se subió, pero no se pudo guardar el perfil. Comprueba los permisos de arx_profiles.');if(input)input.value='';return}
  state.photo=url;save();if(typeof renderHome==='function')renderHome();if(input)input.value='';toast('Foto de perfil actualizada ✦');
}

function editProfile(){openM('<div class="ey">MI ESPACIO ARX</div><h2>Editar perfil</h2><div class="profile-edit"><label>Tu nombre<input id="editName" maxlength="30" value="'+esc(state.displayName||'Aoi')+'" placeholder="El nombre que quieras mostrar"></label><label>Tu edad<input id="editAge" type="number" min="18" max="120" value="'+esc(state.age||18)+'"></label><label>Tu biografía<textarea id="editBio" maxlength="220" placeholder="Cuéntale a ARX un poco sobre ti…">'+esc(state.bio||'')+'</textarea></label><button class="btn" data-click="saveProfile()">Guardar cambios</button></div>')}
async function saveProfile(){
  const n=$('editName').value.trim();
  const age=parseInt($('editAge').value,10);
  const b=$('editBio').value.trim();
  if(!n){toast('El nombre no puede estar vacío');return}
  if(!Number.isInteger(age)||age<18||age>120){toast('Introduce una edad válida (18+)');return}
  if(!currentUser||!arxSupabase){toast('Necesitas iniciar sesión');return}

  // arx_profiles usa "username" para el nombre. No usar "display_name" aquí.
  const {data:upd,error}=await arxSupabase.from('arx_profiles')
    .update({username:n,age:age,bio:b})
    .eq('id',currentUser.id).select('id');

  if(error||!upd||!upd.length){
    console.error('Error guardando perfil:',error);
    toast('No se pudo guardar el perfil');
    return;
  }

  // También mantenemos el nombre/bio en los metadatos de Auth.
  const {error:authError}=await arxSupabase.auth.updateUser({
    data:{display_name:n,bio:b}
  });

  if(authError){
    console.warn('Perfil guardado, pero no se actualizaron los metadatos:',authError);
  }

  state.displayName=n;
  state.age=age;
  state.bio=b;
  save();
  closeM();
  toast('Perfil actualizado ✦');
}
function renderProfile(){const name=state.displayName||'Aoi';if($('profileName'))$('profileName').textContent=name;if($('profileAge'))$('profileAge').textContent=state.age?'🎂 '+state.age+' años':'';if($('homeName'))$('homeName').textContent=name||'Tu nombre';if($('homeAge'))$('homeAge').textContent=state.age?'🎂 '+state.age+' años':'';if($('profileBio'))$('profileBio').textContent=state.bio||'';const av=$('profileAvatar');if(av){if(state.photo){av.classList.remove('fallback');av.innerHTML='<img src="'+esc(state.photo)+'" style="width:100%;height:100%;object-fit:cover;border-radius:22px">'}else{av.classList.add('fallback');av.innerHTML='✦'}}const hav=$('homeAvatar');if(hav){if(state.photo){hav.innerHTML='<img src="'+esc(state.photo)+'" style="width:100%;height:100%;object-fit:cover;border-radius:22px">'}else{hav.innerHTML='<div class="fallback">✦</div>'}}}

const ARX_PROFILE_CARD_PROMPTS=[
 'Una cosa que siempre consigue hacerme sonreír…','Mi escapada perfecta sería…','Ahora mismo no paro de escuchar…','Una buena primera cita para mí sería…','Mi plan improvisado favorito…','Un sitio al que volvería mil veces…','Mi viaje pendiente es…','Mi pequeño vicio es…','Una cosa que poca gente sabe de mí…','Mi domingo perfecto…','Tengo debilidad por…','Mi talento más inútil…','Una opinión por la que podría empezar un debate…','Me conquistas si…','Una green flag que valoro mucho…','Una cosa que me hace especialmente feliz…','Mi comida favorita es…','Si me dices “haz una maleta”, me voy a…','Mi lugar favorito para desconectar…','Una conversación que nunca me cansa…','Mi idea de química es…','Lo más random que me gusta…','Una cosa que quiero hacer este año…','Café antes de cualquier conversación ☕','No digo que no a una escapada al mar 🌊','Si empezamos hablando de esto, tenemos conversación para rato…','Soy de las que…','Un plan que nunca rechazo…','Mi película o serie refugio es…','Este año quiero aprender…'
];
function renderProfileCards(){
 const arr=Array.isArray(state.profileCards)?state.profileCards:[],list=$('profileCardsList'),count=$('profileCardsCount');
 if(count)count.textContent=arr.length+' / 5';
 if(!list)return;
 list.innerHTML=arr.length?arr.map((c,i)=>'<div class="profile-card-item '+(c.featured?'featured':'')+'"><span class="pc-kicker">'+(c.featured?'✦ DESTACADA':'TARJETA '+(i+1))+'</span>'+(c.featured?'<span class="pc-star">✦</span>':'')+'<div class="pc-text">'+esc(c.text)+'</div></div>').join(''):'<div class="notice" style="margin-top:10px">Todavía no has añadido ninguna tarjeta. Añade una pequeña cosa que dé ganas de conocerte.</div>';
}
function openProfileCards(){
 const arr=Array.isArray(window._profileCardsDraft)?window._profileCardsDraft.map(x=>({...x})):Array.isArray(state.profileCards)?state.profileCards.map(x=>({...x})):[];
 const rows=arr.map((c,i)=>'<div class="profile-card-editor-row" data-pc-row="'+i+'"><label style="font-size:11px;color:#c8c1ce;font-weight:800">IDEA</label><select id="pcPrompt'+i+'">'+ARX_PROFILE_CARD_PROMPTS.map(q=>'<option value="'+esc(q)+'" '+(q===c.prompt?'selected':'')+'>'+esc(q)+'</option>').join('')+'</select><label style="font-size:11px;color:#c8c1ce;font-weight:800;display:block;margin-top:7px">TU RESPUESTA</label><input id="pcText'+i+'" maxlength="100" value="'+esc(c.text||'')+'" placeholder="Escribe algo que sea tuyo…"><div class="pc-row-actions"><button type="button" data-click="profileCardMove('+i+',-1)">↑</button><button type="button" data-click="profileCardMove('+i+',1)">↓</button><button type="button" data-click="profileCardFeature('+i+')">'+(c.featured?'★ Destacada':'☆ Destacar')+'</button><button type="button" class="danger" data-click="profileCardRemove('+i+')">Eliminar</button></div></div>').join('');
 openM('<div class="ey">MI PERFIL · TARJETAS</div><h2>Tu lado más personal.</h2><div class="mut">No son una biografía. Son pequeños detalles que hacen que alguien piense: <b>quiero saber más.</b></div><div class="premium-card-intro"><div class="pc-icon">✦</div><div><b>Hazlas tuyas</b><div class="mut">Hasta 5 tarjetas · 100 caracteres cada una · 1 destacada</div></div></div><div class="profile-card-editor" style="margin-top:14px">'+rows+'</div><button type="button" class="btn ghost" style="margin-top:10px" data-click="profileCardAdd()" '+(arr.length>=5?'disabled':'')+'>＋ Añadir tarjeta</button><button type="button" class="btn" data-click="saveProfileCards()">Guardar tarjetas ✦</button><div class="flower-rule">✦ Dale algo a lo que responder. Añadir una tarjeta puede facilitar que alguien encuentre una razón para enviarte una flor.</div>');
 window._profileCardsDraft=arr;
}
function syncProfileCardsDraft(){
 const a=window._profileCardsDraft||[];
 a.forEach((c,i)=>{const p=$('pcPrompt'+i),t=$('pcText'+i);if(p)c.prompt=p.value;if(t)c.text=t.value.slice(0,100)});
 return a;
}
function profileCardAdd(){const a=syncProfileCardsDraft();if(a.length>=5){toast('Puedes añadir hasta 5 tarjetas');return}a.push({prompt:ARX_PROFILE_CARD_PROMPTS[0],text:'',featured:a.length===0,position:a.length});window._profileCardsDraft=a;openProfileCards()}
function profileCardRemove(i){const a=syncProfileCardsDraft();a.splice(i,1);if(a.length&&!a.some(x=>x.featured))a[0].featured=true;window._profileCardsDraft=a;openProfileCards()}
function profileCardMove(i,d){const a=syncProfileCardsDraft(),j=i+d;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];window._profileCardsDraft=a;openProfileCards()}
function profileCardFeature(i){const a=syncProfileCardsDraft();a.forEach((x,n)=>x.featured=n===i);window._profileCardsDraft=a;openProfileCards()}
async function saveProfileCards(){
 const a=syncProfileCardsDraft().map((c,i)=>({prompt:c.prompt,text:c.text,featured:!!c.featured,position:i})).filter(c=>c.text&&c.text.trim());
 if(a.length>5){toast('Puedes guardar hasta 5 tarjetas');return}
 if(a.length&&!a.some(c=>c.featured))a[0].featured=true;
 if(!currentUser||!arxSupabase){toast('Necesitas iniciar sesión');return}
 const del=await arxSupabase.from('arx_profile_cards').delete().eq('user_id',currentUser.id);
 if(del.error){console.error('ARX profile cards delete:',del.error);toast('No se pudieron guardar las tarjetas. Comprueba la tabla de tarjetas en Supabase.');return}
 if(a.length){const ins=await arxSupabase.from('arx_profile_cards').insert(a.map(c=>({...c,user_id:currentUser.id})));if(ins.error){console.error('ARX profile cards insert:',ins.error);toast('No se pudieron guardar las tarjetas. Comprueba la tabla de tarjetas en Supabase.');return}}
 state.profileCards=a.map((c,i)=>({...c,id:'local-'+i}));save();window._profileCardsDraft=null;closeM();toast('Tarjetas guardadas ✦');
}
async function loadMyProfileCards(){
 if(!currentUser||!arxSupabase)return;
 const r=await arxSupabase.from('arx_profile_cards').select('id,prompt,text,featured,position').eq('user_id',currentUser.id).order('position',{ascending:true});
 if(r.error){console.warn('ARX profile cards:',r.error);state.profileCards=[];renderProfileCards();return}
 state.profileCards=r.data||[];renderProfileCards();
}
function renderInterests(){renderProfileCards();const html=(state.interests||[]).map(x=>'<span class="tag">'+esc(x)+'</span>').join('')||'<span class="mut">Todavía no has elegido intereses.</span>';if($('profileInterests'))$('profileInterests').innerHTML=html;if($('homeInterests'))$('homeInterests').innerHTML=html}


function renderGarden(){
 const el=$('gardenList');if(!el)return;
 const mk=(f,dir)=>{const x=flowerByKey(f.intent||'curiosity'),recv=dir==='in';return '<div class="flower-card">'+flowerArt(x.key)+'<b>'+esc(f.intentName||x.name)+'</b><div class="mut" style="font-size:12px">'+esc(x.desc)+'</div><div class="flower-intent-label">'+(recv?(f.status==='accepted'?'Recibida · conexión abierta':'Recibida'):'Enviada')+'</div>'+(f.contextText?'<div class="flower-note">↳ “'+esc(f.contextText)+'”</div>':'')+(f.card?'<div class="flower-note">“'+esc(f.card)+'”</div>':'<div class="flower-note">Solo flor</div>')+'<div class="mut" style="margin-top:6px">'+(recv?'De: '+esc(f.from||f.fromName||'ARX'):'Para: '+esc(f.targetName||f.person||'ARX'))+'</div><div class="mut">'+esc(f.date||'')+'</div></div>'};
 const items=[...(state.flowersIn||[]).map(f=>mk(f,'in')),...(state.flowers||[]).map(f=>mk(f,'out'))];
 el.innerHTML=items.join('')||'<div class="notice" style="grid-column:1/-1">Tu jardín está vacío. Las flores que envíes o recibas quedarán aquí como recuerdo. ✦</div>';
 if(typeof arxGardenScene==='function')arxGardenScene();
}


function openBirthday(){openM('<div class="ey">CALENDARIO</div><h2>Añadir cumpleaños</h2><div class="form"><label>NOMBRE<input id="bName" maxlength="80" placeholder="Nombre"></label><label>FECHA<input id="bDate" type="date"></label><label>AVISO<select id="bNotice"><option value="0">El mismo día</option><option value="1">1 día antes</option><option value="7" selected>7 días antes</option><option value="30">30 días antes</option></select></label><button class="btn" data-click="createBirthday()">Guardar cumpleaños</button></div>')}
async function createBirthday(){
  const name=($('bName')?.value||'').trim(),date=$('bDate')?.value||'',notice=parseInt($('bNotice')?.value||'7',10);
  const showErr=t=>{let n=$('bErr');if(!n){n=document.createElement('div');n.id='bErr';n.className='notice';n.style.marginTop='10px';const f=document.querySelector('#modalContent .form');if(f)f.appendChild(n)}n.textContent=t};
  if(!name||!date){showErr('Completa nombre y fecha');return}
  if(!arxSupabase||!currentUser){showErr('Necesitas iniciar sesión');return}
  const btn=document.querySelector('#modalContent .form .btn');if(btn){btn.disabled=true;btn.textContent='Guardando…'}
  const ins=await arxSupabase.from('arx_birthdays').insert({user_id:currentUser.id,name,birthday_date:date,reminder_days:notice}).select('id,name,birthday_date,reminder_days').single();
  if(btn){btn.disabled=false;btn.textContent='Guardar cumpleaños'}
  if(ins.error){console.error('ARX birthday save:',ins.error);showErr('No se pudo guardar: '+(ins.error.message||ins.error.details||'error de Supabase')+(ins.error.code?' ['+ins.error.code+']':''));return}
  state.birthdays=[...(state.birthdays||[]),ins.data];
  renderCalendarData();checkBirthdayReminders();closeM();toast('🎂 Cumpleaños guardado');
}
async function loadBirthdays(){
  if(!arxSupabase||!currentUser)return;
  const {data,error}=await arxSupabase.from('arx_birthdays').select('id,name,birthday_date,reminder_days').eq('user_id',currentUser.id).order('birthday_date',{ascending:true});
  if(error){console.error('ARX birthdays:',error);return}
  state.birthdays=data||[];renderCalendarData();checkBirthdayReminders();
}

function checkBirthdayReminders(){
  const now=new Date(); now.setHours(0,0,0,0); const arr=state.birthdays||[]; const due=[];
  arr.forEach(b=>{const raw=new Date(b.birthday_date+'T00:00:00'); if(Number.isNaN(raw.getTime()))return; let next=new Date(now.getFullYear(),raw.getMonth(),raw.getDate()); if(next<now)next.setFullYear(now.getFullYear()+1); const days=Math.round((next-now)/86400000); if(days===Number(b.reminder_days||0))due.push(b)});
  state.birthdayReminders=due;
  const box=$('birthdayReminderBox'); if(box)box.innerHTML=due.length?due.map(b=>'<div class=\"birthday-reminder\">🎂 <b>'+esc(b.name)+'</b> cumple en '+Number(b.reminder_days||0)+' días.</div>').join(''):'';
  if(due.length) setTimeout(()=>toast('🎂 Tienes '+due.length+' aviso'+(due.length>1?'s':'')+' de cumpleaños'),350);
}
function toastUndo(t,fn){const x=$('toast');x.textContent=t+' ';const b=document.createElement('button');b.type='button';b.className='toast-undo';b.textContent='Deshacer';b.onclick=()=>{x.classList.remove('show','undo');fn()};x.appendChild(b);x.classList.add('show','undo');clearTimeout(window._tu);window._tu=setTimeout(()=>x.classList.remove('show','undo'),5000)}
function toast(t){let x=$('toast');x.classList.remove('undo');x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),1800)}
$('modal').addEventListener('click',e=>{if(e.target.id==='modal')closeM()});
/* v43: el primer render espera a que carguen TODOS los scripts (arxFiltered/renderEventRadar viven en el script final). Antes lanzaba un error que cortaba este script a medias. */
window.addEventListener('DOMContentLoaded',()=>{try{save()}catch(e){console.warn('ARX initial render:',e)}});
window.addEventListener('DOMContentLoaded',async()=>{
  $('gate').style.display='grid';
  $('app').style.display='none';
  // Durante esta reparación no registramos el SW: evita que Safari/GitHub Pages
  // siga sirviendo una versión antigua del login.
  if('serviceWorker' in navigator){
    try{
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.filter(r=>!String((r.active||r.waiting||r.installing||{}).scriptURL||'').endsWith('arx-sw.js')).map(r=>r.unregister()));
    }catch(e){console.warn('ARX SW cleanup:',e)}
  }
  await bootAuth();
});
let eventStep=1;
function eventWizardHTML(){return `<div class="arx-event-wizard"><div class="ey">ARX // CREATE</div><h2>Crear experiencia</h2><div class="mut">Construye un plan que quieras compartir.</div><div class="arx-stepbar"><span class="active" data-es="1">01</span><span data-es="2">02</span><span data-es="3">03</span><span data-es="4">04</span></div><div class="arx-event-step" data-step="1"><div class="ey">01 / IDEA</div><h3>¿Qué quieres crear?</h3><label>NOMBRE<input id="evName" maxlength="80" placeholder="Noche ARX"></label><label>TIPO<select id="evType"><option>Quedada</option><option>Cita</option><option>Plan</option><option>Fiesta</option><option>Viaje</option><option>Actividad</option><option>Otro</option></select></label></div><div class="arx-event-step hidden" data-step="2"><div class="ey">02 / VIBE</div><h3>Cuéntanos el plan.</h3><label>DESCRIPCIÓN<textarea id="evDesc" maxlength="500" rows="5" placeholder="¿Qué vais a hacer?"></textarea></label><label>PORTADA OPCIONAL<input id="evCover" type="url" placeholder="https://..."></label></div><div class="arx-event-step hidden" data-step="3"><div class="ey">03 / MOMENTO</div><h3>¿Cuándo y dónde?</h3><label>FECHA<input id="evDate" type="date"></label><label>HORA<input id="evTime" type="time"></label><label>ZONA VISIBLE<input id="evPlace" maxlength="120" placeholder="Málaga Centro"></label><label>LUGAR EXACTO PRIVADO<input id="evExactPlace" maxlength="180" placeholder="Dirección o punto de encuentro"></label><div class="arx-private-note">🔐 La zona general aparece en Explore. El lugar exacto se reserva para las asistentes.</div></div><div class="arx-event-step hidden" data-step="4"><div class="ey">04 / PLAZAS</div><h3>¿Cuántas personas?</h3><div class="arx-capacity"><button class="btn ghost" id="evMinus" type="button">−</button><strong id="evMaxPreview">10</strong><button class="btn ghost" id="evPlus" type="button">＋</button></div><input id="evMax" type="hidden" value="10"><div id="eventPreview" class="arx-preview"></div></div><div class="arx-wizard-actions"><button class="btn ghost" id="eventBack" type="button">← Atrás</button><button class="btn arx-publish" id="eventNext" type="button">Continuar →</button></div></div>`}
function bindEventWizard(){const next=$('eventNext'),back=$('eventBack');const showStep=n=>{eventStep=Math.max(1,Math.min(4,n));document.querySelectorAll('.arx-event-step').forEach(x=>x.classList.toggle('hidden',Number(x.dataset.step)!==eventStep));document.querySelectorAll('.arx-stepbar span').forEach(x=>x.classList.toggle('active',Number(x.dataset.es)<=eventStep));back.style.visibility=eventStep>1?'visible':'hidden';next.textContent=eventStep===4?'Publicar experiencia ✦':'Continuar →';if(eventStep===4)updateEventPreview()};next.onclick=async()=>{
  if(eventStep<4){
    if(eventStep===1 && !(($('evName')?.value||'').trim())){toast('Pon un nombre para la experiencia');return}
    if(eventStep===3 && (!(($('evDate')?.value||'')) || !(($('evTime')?.value||'')) || !(($('evPlace')?.value||'').trim()))){toast('Completa fecha, hora y zona');return}
    showStep(eventStep+1);return
  }
  await createEvent()
};back.onclick=()=>showStep(eventStep-1);$('evMinus').onclick=()=>{const n=Math.max(2,Number($('evMax').value)-1);$('evMax').value=n;$('evMaxPreview').textContent=n;updateEventPreview()};$('evPlus').onclick=()=>{const n=Math.min(500,Number($('evMax').value)+1);$('evMax').value=n;$('evMaxPreview').textContent=n;updateEventPreview()};showStep(1)}
function updateEventPreview(){const p=$('eventPreview');if(!p)return;p.innerHTML='<div class="arx-preview-card"><div class="ey">PREVISUALIZACIÓN</div><h3>'+esc(($('evName')?.value||'').trim()||'Tu experiencia')+'</h3><div class="mut">◷ '+esc($('evDate')?.value||'Fecha pendiente')+' · '+esc($('evTime')?.value||'Hora pendiente')+'</div><div class="mut">⌖ '+esc(($('evPlace')?.value||'Zona pendiente').trim())+'</div><div class="mut">👥 0 / '+esc($('evMax')?.value||10)+'</div><div class="arx-private-note">🔐 La ubicación exacta se compartirá únicamente con las asistentes.</div></div>'}
async function openEventDetails(id){
  const ev=state.events.find(x=>String(x.id)===String(id));if(!ev)return;
  let exact=null;
  if(ev.attending||ev.creator_id===currentUser?.id){const r=await arxSupabase.rpc('arx_get_event_private_location',{p_event_id:id});if(!r.error)exact=r.data}
  const exactHtml=exact?'<div class="arx-private-note">🔐 <b>Punto de encuentro desbloqueado</b><br>'+esc(exact)+'<br><button class="btn ghost" style="margin-top:8px" type="button" data-click="openExactLocation('+jq(exact)+')">Abrir en mapas →</button></div>':'<div class="arx-private-note">🔒 La ubicación exacta se comparte únicamente con la creadora y las asistentes.</div>';
  const roomBtn=(ev.attending||ev.creator_id===currentUser?.id)?'<button class="btn ghost" style="width:100%;margin-top:8px" type="button" data-click="openEventRoom('+jq(ev.id)+')">💬 Entrar en la sala del plan</button>':'';
  openM('<div class="arx-event-detail"><div class="ey">'+esc(ev.type)+'</div><h2>'+esc(ev.name)+'</h2><div class="mut">◷ '+esc(ev.date)+' · '+esc(ev.time)+'</div><div class="mut">⌖ '+esc(ev.place)+'</div>'+(ev.desc?'<p>'+esc(ev.desc)+'</p>':'')+exactHtml+'<button class="btn arx-join" style="width:100%;margin-top:14px" type="button" data-click="attendEventAndRefresh('+jq(ev.id)+')">'+(ev.attending?'✓ ESTÁS DENTRO':'ESTOY DENTRO ✦')+'</button>'+roomBtn+(ev.creator_id===currentUser?.id?'<button class="btn ghost" style="width:100%;margin-top:8px" type="button" data-click="arxCancelPlan('+jq(String(ev.id))+')">🗑 Cancelar este plan</button>':'')+'</div>');
}
window.arxCancelPlan=function(id){
 const ev=(state.events||[]).find(x=>String(x.id)===String(id));if(!ev||ev.creator_id!==currentUser?.id)return;
 if(window.evRoomCleanup)window.evRoomCleanup();
 const q=jq(String(id));
 openM('<div class="ey">CANCELAR PLAN</div><h2>¿Cancelar «'+esc(ev.name)+'»?</h2><div class="mut">Se eliminará para todas las asistentes, junto con la conversación. No se puede deshacer.</div><button class="btn" style="width:100%;margin-top:16px" type="button" data-click="arxCancelPlanDo('+q+')">Sí, cancelar plan</button><div id="cancelErr" class="notice" style="display:none;margin-top:12px"></div><button class="btn ghost" style="width:100%;margin-top:8px" type="button" data-click="closeM()">No, volver</button>')};
window.arxCancelPlanDo=async function(id){
 if(!arxSupabase||!currentUser)return;
 const r=await arxSupabase.rpc('arx_cancel_event',{p_event_id:id});
 if(r.error){console.error('ARX cancelar plan:',r.error);const ce=$('cancelErr');if(ce){ce.style.display='block';ce.textContent=arxSafeError(r.error,'No se pudo cancelar el plan. Inténtalo de nuevo.')}else toast('No se pudo cancelar el plan');return}
 closeM();state.events=(state.events||[]).filter(e=>String(e.id)!==String(id));
 renderEvents();try{renderHomeNews();renderEventRadar();renderCalendarData()}catch(e){}
 toast('Plan cancelado');loadEvents()};
async function attendEventAndRefresh(id){await attendEvent(id);closeM();await loadEvents()}
function openExactLocation(place){window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(place),'_blank','noopener')}
/* ===== SALA DE EXPERIENCIA (chat estilo WhatsApp) ===== */
const ARX_GIPHY_KEY=window.ARX_GIPHY_KEY||'';const ARX_GIPHY_KEY_PRIV=window.ARX_GIPHY_KEY_PRIV||window.ARX_GIPHY_KEY||'';
const evRoom={id:null,sig:'',mode:null,cat:0,rec:null,sign:new Map(),audio:null,audioSrc:null,audioRoot:null,timer:null,gifTimer:null};
window.evRoomCleanup=function(){clearInterval(evRoom.timer);clearTimeout(evRoom.gifTimer);if(evRoom.rec){evRoom.rec.discard=true;try{if(evRoom.rec.mr&&evRoom.rec.mr.state!=='inactive')evRoom.rec.mr.stop();else if(evRoom.rec.stream)evRoom.rec.stream.getTracks().forEach(t=>t.stop())}catch(e){}evRoom.rec=null}if(evRoom.audio){try{evRoom.audio.pause()}catch(e){}evRoom.audio=null;evRoom.audioRoot=null}evRoom.id=null;evRoom.mode=null;window.currentEventRoomId=null};
function roomErr(e){return (e&&(e.message||e.details||e.hint))||'error desconocido'}
function roomNotice(t){const el=$('eventRoomError');if(!el)return;el.textContent=t||'';el.style.display=t?'block':'none'}
function fmtSecs(s){s=Math.max(0,Math.round(Number(s)||0));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}

async function openEventRoom(eventId){
  if(!arxSupabase||!currentUser){toast('Necesitas iniciar sesión');return}
  const ev=state.events.find(x=>String(x.id)===String(eventId)); if(!ev)return;
  if(ev.creator_id!==currentUser.id){
    const access=await arxSupabase.from('arx_event_attendees').select('event_id').eq('event_id',eventId).eq('user_id',currentUser.id).maybeSingle();
    if(access.error||!access.data){toast('Primero tienes que apuntarte al plan');return}
  }
  window.evRoomCleanup();
  evRoom.id=eventId;evRoom.sig='';evRoom.mode=null;evRoom.cat=0;window.currentEventRoomId=eventId;
  openM(`<div class="er-top"><button class="er-ico er-back" type="button" data-click="closeM()" aria-label="Volver">‹</button><div class="grow"><b class="er-title">${esc(ev.name)}</b><small id="erSub">👥 Solo asistentes · Hablad antes del plan</small></div>${ev.creator_id===currentUser.id?`<button class="er-ico" type="button" data-click="arxCancelPlan(${jq(String(eventId))})" aria-label="Cancelar plan">🗑</button>`:''}<button id="erBell" class="er-ico" type="button" data-click="enablePush()" aria-label="Avisos de mensajes">🔔</button></div><div id="erPin" class="er-pin"></div><div id="eventRoomMessages" class="event-room-messages" data-scroll="roomScrolled()"><div class="mut">Cargando conversación…</div></div><div id="eventRoomError" class="notice" style="display:none;margin-top:8px"></div><div id="eventRoomPanel" class="er-panel" style="display:none"></div><div id="erReply" class="er-replybar" style="display:none"></div><div class="er-wrap"><button id="erDown" class="er-down" type="button" data-click="roomToBottom()" style="display:none">⌄<i id="erDownN"></i></button><div id="eventRoomBar" class="er-bar"><button class="er-ico" type="button" data-click="toggleRoomPanel()">😊</button><input id="eventRoomInput" maxlength="500" placeholder="Escribe un mensaje" autocomplete="off" data-input="roomInputChanged()" data-keydown="arxRoomKey(event)"><button class="er-ico" type="button" data-click="pickEventPhoto()">📷</button><button id="eventRoomMic" class="send er-mic" type="button" aria-label="Mantén pulsado para grabar">🎙</button><button id="eventRoomSend" class="send" type="button" style="display:none" data-click="sendEventRoomMessage()">➤</button></div><div id="eventRoomRec" class="er-rec"><span class="rec-dot"></span><b id="recTime">0:00</b><span class="hint" id="recHint">◀ Desliza para cancelar · ↑ bloquear</span><span class="ctl"><button class="er-ico" type="button" data-click="recStop(true)">🗑</button><button class="send" type="button" style="height:44px" data-click="recStop(false)">➤</button></span></div></div><input id="eventPhotoInput" class="sr-only-file" type="file" accept="image/*" data-change="sendEventMedia(event)"><input id="eventGifInput" class="sr-only-file" type="file" accept="image/gif" data-change="sendEventGif(event)">`);
  enterRoomFull();roomGestures();roomAccent(ev.type);roomPin(ev);roomTypingInit(eventId);refreshBell();const mic=$('eventRoomMic');
  if(mic){mic.addEventListener('pointerdown',recStart);mic.addEventListener('pointermove',recMove);mic.addEventListener('pointerup',recEnd);mic.addEventListener('pointercancel',recEnd);mic.addEventListener('contextmenu',e=>e.preventDefault())}
  clearInterval(evRoom.timer);
  evRoom.timer=setInterval(()=>{if(!$('eventRoomMessages')){window.evRoomCleanup();return}if(!document.hidden)loadEventRoomMessages(evRoom.id,true)},5000);
  await loadEventRoomMessages(eventId);
}
function roomInputChanged(){const has=(($('eventRoomInput')?.value)||'').trim().length>0;const s=$('eventRoomSend'),m=$('eventRoomMic');if(s)s.style.display=has?'':'none';if(m)m.style.display=has?'none':'';roomTyping(has)}

/* ---- mensajes ---- */
async function roomSigned(path){
  const c=evRoom.sign.get(path);if(c&&c.exp>Date.now())return c.url;
  const sr=await arxSupabase.storage.from('arx-event-chat').createSignedUrl(path,3600);
  const url=sr.data?.signedUrl||null;if(url)evRoom.sign.set(path,{url,exp:Date.now()+3300000});return url;
}
function audioBubble(url,secs,seed){
  let h=0;for(const ch of String(seed))h=(h*31+ch.charCodeAt(0))>>>0;
  let bars='';for(let i=0;i<30;i++){h=(h*1103515245+12345)>>>0;bars+='<i style="height:'+(22+((h>>>8)%70))+'%"></i>'}
  return '<div class="wa-audio" data-src="'+esc(url)+'" data-dur="'+(Number(secs)||0)+'"><button type="button" class="wa-play" data-click="roomPlayAudio(this)">▶</button><div class="wa-wave" data-click="roomSeekAudio(event,this)">'+bars+'</div><span class="wa-time">'+fmtSecs(secs)+'</span><button type="button" class="wa-spd" data-click="roomSpeed(this)">'+(evRoom.rate||1)+'×</button></div>';
}
function roomAudioUI(root,frac,cur){
  if(!root)return;const bars=root.querySelectorAll('.wa-wave i'),n=Math.floor(frac*bars.length);
  bars.forEach((b,i)=>b.classList.toggle('on',i<n));
  const t=root.querySelector('.wa-time');if(t)t.textContent=fmtSecs(cur!=null?cur:Number(root.dataset.dur));
}
function roomAudioReset(root){if(!root)return;const b=root.querySelector('.wa-play');if(b)b.textContent='▶';roomAudioUI(root,0,null)}
function roomPlayAudio(btn){
  const root=btn.closest('.wa-audio');if(!root)return;
  if(evRoom.audio&&evRoom.audioRoot===root){if(evRoom.audio.paused){evRoom.audio.play();btn.textContent='❚❚'}else{evRoom.audio.pause();btn.textContent='▶'}return}
  if(evRoom.audio){evRoom.audio.pause();roomAudioReset(evRoom.audioRoot)}
  const a=new Audio(root.dataset.src);a.playbackRate=evRoom.rate||1;evRoom.audio=a;evRoom.audioRoot=root;evRoom.audioSrc=root.dataset.src;
  a.ontimeupdate=()=>{const d=(isFinite(a.duration)&&a.duration>0)?a.duration:Number(evRoom.audioRoot?.dataset.dur)||1;roomAudioUI(evRoom.audioRoot,Math.min(1,a.currentTime/d),a.currentTime)};
  a.onended=()=>{roomAudioReset(evRoom.audioRoot);evRoom.audio=null;evRoom.audioRoot=null};
  a.onerror=()=>{roomNotice('No se pudo reproducir el audio.');roomAudioReset(evRoom.audioRoot);evRoom.audio=null;evRoom.audioRoot=null};
  a.play().then(()=>{btn.textContent='❚❚'}).catch(()=>roomNotice('No se pudo reproducir el audio.'));
}
function roomSeekAudio(e,wave){
  const root=wave.closest('.wa-audio');if(!evRoom.audio||evRoom.audioRoot!==root)return;
  const r=wave.getBoundingClientRect(),f=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));
  const d=(isFinite(evRoom.audio.duration)&&evRoom.audio.duration>0)?evRoom.audio.duration:Number(root.dataset.dur)||0;
  if(d)evRoom.audio.currentTime=f*d;
}
async function loadEventRoomMessages(eventId,silent,force){
  const el=$('eventRoomMessages'); if(!el||String(eventId)!==String(evRoom.id))return;
  const r=await arxSupabase.from('arx_event_messages')
    .select('id,user_id,message,message_type,media_path,sticker,created_at,reply_to')
    .eq('event_id',eventId).order('created_at',{ascending:false}).limit(100);
  if(r.error){console.error('ARX chat:',r.error);if(!silent){el.innerHTML='<div class="notice">No se pudo cargar la conversación.<br><small>'+esc(roomErr(r.error))+'</small></div>'}return}
  const rows=(r.data||[]).slice().reverse();
  const mids=rows.map(x=>String(x.id));let rx=[],pv=[];
  if(mids.length){const [a,b]=await Promise.all([arxSupabase.from('arx_message_reactions').select('message_id,user_id,emoji').in('message_id',mids),arxSupabase.from('arx_poll_votes').select('message_id,user_id,option').in('message_id',mids)]);rx=a.data||[];pv=b.data||[]}
  evRoom.rx=rx;evRoom.pv=pv;evRoom.rows=rows;
  const sig=rows.length+':'+(rows.length?rows[rows.length-1].id:'')+':'+rx.map(r=>r.message_id+r.user_id+r.emoji).join('|')+':'+pv.map(v=>v.message_id+v.user_id+v.option).join('|');
  if(!force&&sig===evRoom.sig&&el.dataset.ready)return;
  evRoom.sig=sig;
  const ids=[...new Set(rows.map(x=>x.user_id))];
  let ps=[];
  if(ids.length){const q=await arxSupabase.from('arx_public_profiles').select('id,username,avatar_url').in('id',ids);ps=q.data||[]}evRoom.ps=ps;
  if(!rows.length){el.innerHTML='<div class="event-room-empty"><div class="emoji">👋</div><b>¡Bienvenida a la sala!</b><div class="mut">Sé la primera en escribir al grupo.</div></div>';el.dataset.ready='1';return}
  const nearBottom=!el.dataset.ready||(el.scrollHeight-el.scrollTop-el.clientHeight<90);
  const parts=await Promise.all(rows.map(async (m,i)=>{
    const p=ps.find(x=>x.id===m.user_id)||{};const mine=m.user_id===currentUser.id;
    const time=new Date(m.created_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
    let body='',cls='';
    if(m.message_type==='poll'){body=roomPollHTML(m)}else if(m.message_type==='system'){body='<span>'+esc(m.message)+'</span>';cls=' system'}else if(m.message_type==='sticker'){body='<div class="sticker-bubble">'+esc(m.sticker||'✨')+'</div>';cls=' sticker'}
    else if(m.message_type==='gif'&&/^https:\/\/[a-z0-9.-]*giphy\.com\//i.test(m.media_path||'')){body='<img class="event-room-attachment" loading="lazy" src="'+esc(m.media_path)+'" alt="GIF">';cls=' sticker'}
    else if(m.media_path){
      const url=await roomSigned(m.media_path);
      if(m.message_type==='audio'&&url){const secs=(String(m.message||'').match(/^audio:(\d+)/)||[])[1]||0;body=audioBubble(url,secs,m.media_path)}
      else if(url){body='<img class="event-room-attachment" src="'+esc(url)+'" alt="'+esc(m.message_type||'archivo')+'" data-click="roomViewer(this.src)">'}
      else body='<span>📎 Archivo</span>';
    }else{body='<span>'+esc(m.message||'')+'</span>'}
    const quote=roomQuote(m),reacts=roomReacts(m);const prev=rows[i-1],day=(!prev||new Date(prev.created_at).toDateString()!==new Date(m.created_at).toDateString())?'<div class="er-day">'+roomDayLabel(m.created_at)+'</div>':'',same=prev&&prev.user_id===m.user_id&&!day;
    return day+'<div class="event-room-msg'+(mine?' mine':'')+cls+(same?'':' gap')+'" data-id="'+m.id+'">'+((mine||same)?'':'<b style="color:'+roomColor(m.user_id)+'">'+(p.avatar_url?'<img class="er-ava" src="'+esc(p.avatar_url)+'" alt="">':'')+esc(p.display_name||p.username||'ARX')+'</b>')+quote+body+reacts+'<small class="er-time">'+time+'</small></div>';
  }));
  el.innerHTML=parts.join('');el.dataset.ready='1';
  if(evRoom.audio&&!evRoom.audio.paused){const n=[...el.querySelectorAll('.wa-audio')].find(x=>x.dataset.src===evRoom.audioSrc);evRoom.audioRoot=n||null;if(n)n.querySelector('.wa-play').textContent='❚❚'}
  if(nearBottom){el.scrollTop=el.scrollHeight;roomUnread=0}else{const l=rows[rows.length-1];if(l&&l.id!==roomLastId&&l.user_id!==currentUser.id)roomUnread++}roomLastId=rows[rows.length-1].id;roomMarkSeen(eventId);roomScrolled();
}
async function roomInsert(row){
  if(!evRoom.id||!currentUser)return false;
  roomNotice('');
  const rp=(evRoom.reply&&row.message_type!=='poll')?{reply_to:String(evRoom.reply.id)}:{};const r=await arxSupabase.from('arx_event_messages').insert(Object.assign({event_id:evRoom.id,user_id:currentUser.id},rp,row));if(!r.error)roomReply(null);
  if(r.error){console.error('ARX chat send:',r.error);roomNotice('No se pudo enviar: '+roomErr(r.error)+(r.error.code?' ['+r.error.code+']':''));return false}
  await loadEventRoomMessages(evRoom.id,false,true);
  const el=$('eventRoomMessages');if(el)el.scrollTop=el.scrollHeight;
  return true;
}
async function sendEventRoomMessage(){
  const input=$('eventRoomInput'),message=(input?.value||'').trim();if(!message)return;
  input.value='';roomInputChanged();
  const ok=await roomInsert({message,message_type:'text'});
  if(!ok&&input){input.value=message;roomInputChanged()}
}

/* ---- fotos ---- */
function pickEventPhoto(){$('eventPhotoInput')?.click()}
async function roomUploadAndSend(file,ext,ct,type,text){
  if(!evRoom.id)return;roomNotice('');
  const path=evRoom.id+'/'+currentUser.id+'/'+Date.now()+'.'+ext;
  const up=await arxSupabase.storage.from('arx-event-chat').upload(path,file,{contentType:ct,upsert:false});
  if(up.error){console.error('ARX chat upload:',up.error);roomNotice('No se pudo subir el archivo: '+roomErr(up.error));return}
  await roomInsert({message:text,message_type:type,media_path:path});
}
async function sendEventMedia(e){
  const f=e.target.files?.[0];e.target.value='';if(!f)return;
  if(f.size>8*1024*1024){toast('Máximo 8 MB');return}
  if(!ARX_EXT[f.type]){toast('Usa una imagen JPG, PNG, WebP o GIF');return}
  const ext=ARX_EXT[f.type];
  await roomUploadAndSend(f,ext,f.type,'photo','Foto');
}

/* ---- audio: mantén pulsado (tipo WhatsApp) ---- */
function recPickMime(){for(const m of ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus']){try{if(MediaRecorder.isTypeSupported(m))return m}catch(e){}}return ''}
function recUI(state){
  const rec=$('eventRoomRec'),bar=$('eventRoomBar');if(!rec||!bar)return;
  rec.classList.toggle('on',!!state);rec.classList.toggle('locked',state==='locked');rec.classList.remove('cancel');bar.classList.toggle('rec',!!state);
  const h=$('recHint');if(h)h.textContent='◀ Desliza para cancelar · ↑ bloquear';
}
function recTick(){const r=evRoom.rec;if(!r||!r.t0)return;const s=(Date.now()-r.t0)/1000;const t=$('recTime');if(t)t.textContent=fmtSecs(s);if(s>=180)recStop(false)}
async function recStart(e){
  e.preventDefault();
  if(evRoom.rec||!evRoom.id)return;
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){roomNotice('Tu navegador no permite grabar audio.');return}
  const btn=e.currentTarget,pid=e.pointerId;
  const r={down:true,canceled:false,locked:false,discard:false,x0:e.clientX,y0:e.clientY,t0:0,chunks:[],stream:null,mr:null,timer:null,mime:recPickMime()};
  evRoom.rec=r;
  try{btn.setPointerCapture(pid)}catch(_){}
  const t0=Date.now();
  try{r.stream=await navigator.mediaDevices.getUserMedia({audio:true})}
  catch(err){evRoom.rec=null;roomNotice('Permite el micrófono en el navegador para enviar audios.');return}
  if(!evRoom.rec||evRoom.rec!==r){r.stream.getTracks().forEach(t=>t.stop());return}
  if(!r.down){r.stream.getTracks().forEach(t=>t.stop());evRoom.rec=null;toast('Mantén pulsado para grabar');return}
  if(Date.now()-t0>700)r.locked=true; // el aviso de permisos interrumpe el gesto: se deja grabando
  try{r.mr=r.mime?new MediaRecorder(r.stream,{mimeType:r.mime}):new MediaRecorder(r.stream)}
  catch(err){r.stream.getTracks().forEach(t=>t.stop());evRoom.rec=null;roomNotice('No se pudo iniciar la grabación.');return}
  r.mr.ondataavailable=ev=>{if(ev.data&&ev.data.size)r.chunks.push(ev.data)};
  r.mr.onstop=()=>recFinish(r);
  r.mr.start();r.t0=Date.now();
  recUI(r.locked?'locked':true);r.timer=setInterval(recTick,250);recTick();
  if(navigator.vibrate)navigator.vibrate(15);
}
function recMove(e){
  const r=evRoom.rec;if(!r||!r.down||r.locked||!r.mr)return;
  const dx=e.clientX-r.x0,dy=e.clientY-r.y0;
  if(dy<-70){r.locked=true;r.canceled=false;recUI('locked');return}
  r.canceled=dx<-90;
  const rec=$('eventRoomRec');if(rec)rec.classList.toggle('cancel',r.canceled);
  const h=$('recHint');if(h)h.textContent=r.canceled?'Suelta para cancelar':'◀ Desliza para cancelar · ↑ bloquear';
}
function recEnd(e){
  const r=evRoom.rec;if(!r)return;
  r.down=false;
  if(!r.mr||r.locked)return;
  recStop(r.canceled);
}
function recStop(discard){
  const r=evRoom.rec;if(!r)return;
  r.discard=!!discard;clearInterval(r.timer);
  if(r.mr&&r.mr.state!=='inactive')r.mr.stop();
}
async function recFinish(r){
  clearInterval(r.timer);
  try{r.stream.getTracks().forEach(t=>t.stop())}catch(e){}
  evRoom.rec=null;recUI(false);
  if(r.discard)return;
  const secs=Math.round((Date.now()-r.t0)/1000);
  if(secs<1){toast('Audio muy corto: mantén pulsado');return}
  const type=((r.mr&&r.mr.mimeType)||r.mime||'audio/webm').split(';')[0];
  const ext=type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':'webm';
  await roomUploadAndSend(new Blob(r.chunks,{type}),ext,type,'audio','audio:'+secs);
}

/* ---- emojis, stickers y GIF ---- */
const ARX_EMOJI_CATS=(()=>{
  const ok=c=>{try{return /\p{Emoji_Presentation}/u.test(c)}catch(e){return true}};
  const rng=(list,extra)=>{const set=new Set();list.forEach(([a,b])=>{for(let c=a;c<=b;c++){const ch=String.fromCodePoint(c);if(ok(ch))set.add(ch)}});(extra?((typeof Intl!=='undefined'&&Intl.Segmenter)?[...new Intl.Segmenter().segment(extra)].map(x=>x.segment):Array.from(extra)):[]).forEach(x=>set.add(x));return [...set]};
  return [
   ['😀','Caras',rng([[0x1F600,0x1F64F],[0x1F910,0x1F92F],[0x1F970,0x1F97B],[0x1F47B,0x1F47F],[0x1F480,0x1F480],[0x1F4A9,0x1F4A9],[0x1F921,0x1F921]],'☺️☹️🥲🫠🫡🫢🫣🫤🫥')],
   ['👋','Gestos y personas',rng([[0x1F440,0x1F465],[0x1F466,0x1F478],[0x1F90C,0x1F90F],[0x1F930,0x1F93F],[0x1F9D0,0x1F9DF]],'✌️☝️✍️🖐️🖕🤙🫶🫰🫱🫲🫳🫴🫵')],
   ['❤️','Amor y símbolos',rng([[0x1F493,0x1F49F],[0x1F4A0,0x1F4AF],[0x1F500,0x1F53D],[0x1F5A4,0x1F5A4],[0x1F90D,0x1F90E]],'❤️🧡💛💚💙💜🖤🤍🤎💔❣️❤️‍🔥❤️‍🩹✨⭐☀️⚡❄️☔☁️✔️✅❌❓❗‼️⚠️♻️➕➖♾️')],
   ['🐶','Animales y naturaleza',rng([[0x1F400,0x1F43F],[0x1F980,0x1F9AE],[0x1F331,0x1F344],[0x1F308,0x1F30C],[0x1F31A,0x1F320]],'🕊️🦋🐿️🌸🌹🌺🌻🌼🌷')],
   ['🍕','Comida y bebida',rng([[0x1F345,0x1F37F],[0x1F32D,0x1F32F],[0x1F950,0x1F96F],[0x1F9C0,0x1F9CB]],'🌶️')],
   ['⚽','Actividades',rng([[0x1F380,0x1F393],[0x1F3A0,0x1F3CA],[0x1F3CF,0x1F3D3],[0x1F93A,0x1F94F],[0x1F9E9,0x1F9FF]],'🎗️🎟️🎖️🏆🏅')],
   ['🚗','Viajes y lugares',rng([[0x1F680,0x1F6C5],[0x1F3E0,0x1F3F0],[0x1F30D,0x1F310],[0x1F5FB,0x1F5FF]],'✈️🏔️🏖️🏝️')],
   ['💡','Objetos',rng([[0x1F4B0,0x1F4FF],[0x1F507,0x1F52E],[0x1F9F0,0x1F9F8]],'⌚☎️⌛✏️✂️🖊️')]
  ];
})();
function roomRecents(){return window.ARX_MEM.recent||[]}
function roomAddRecent(e){const a=[e,...roomRecents().filter(x=>x!==e)].slice(0,24);window.ARX_MEM.recent=a;arxSetPref({recent_emoji:a},'emojis recientes')}
function toggleRoomPanel(){evRoom.mode=evRoom.mode?null:'emoji';if(evRoom.mode&&document.activeElement)document.activeElement.blur();renderRoomPanel();setTimeout(()=>{const el=$('eventRoomMessages');if(el)el.scrollTop=el.scrollHeight},30)}
function setRoomPanel(m){evRoom.mode=m;evRoom.cat=0;renderRoomPanel()}
function setRoomCat(i){evRoom.cat=i;renderRoomPanel()}
function renderRoomPanel(){
  const p=$('eventRoomPanel'),box=$('eventRoomMessages');if(!p)return;
  if(!evRoom.mode){p.style.display='none';p.innerHTML='';box&&box.classList.remove('small');return}
  p.style.display='block';box&&box.classList.add('small');
  const m=evRoom.mode;
  const tab=(k,l)=>'<button type="button" class="er-tab'+(m===k?' on':'')+'" data-click="setRoomPanel(\''+k+'\')">'+l+'</button>';
  let html='<div class="er-tabs">'+tab('emoji','😊 Emojis')+tab('sticker','✨ Stickers')+tab('gif','GIF')+tab('poll','📊')+'<button type="button" class="er-tab" style="margin-left:auto" data-click="arxRoomPanelClose()">✕</button></div>';
  if(m==='poll'){p.innerHTML=html+roomPollForm();p.onclick=null;return}
  if(m==='gif'){
    html+='<button type="button" class="er-tab" style="margin-top:6px" data-click="arxClickById(\'eventGifInput\')">⬆ Subir GIF</button><input id="erGifQ" class="er-search" placeholder="Buscar GIFs…" autocomplete="off" data-input="roomGifSearch(this.value)"><div id="erGifGrid" class="er-gifs"></div><div class="mut" style="font-size:11px;margin-top:5px;text-align:right">Powered by GIPHY</div>';
    p.innerHTML=html;
    p.onclick=e=>{const b=e.target.closest('[data-g]');if(b)roomInsert({message:'GIF',message_type:'gif',media_path:b.dataset.g}).then(()=>{evRoom.mode=null;renderRoomPanel()})};
    roomGifLoad('');return;
  }
  const rec=roomRecents();
  const cats=(rec.length?[['🕘','Recientes',rec]]:[]).concat(ARX_EMOJI_CATS);
  if(evRoom.cat>=cats.length)evRoom.cat=0;
  html+='<div class="er-cats">'+cats.map((c,i)=>'<button type="button" class="er-cat'+(i===evRoom.cat?' on':'')+'" title="'+esc(c[1])+'" data-click="setRoomCat('+i+')">'+c[0]+'</button>').join('')+'</div>';
  html+='<div class="er-grid'+(m==='sticker'?' st':'')+'">'+cats[evRoom.cat][2].map(e=>'<button type="button" data-e="'+esc(e)+'">'+esc(e)+'</button>').join('')+'</div>';
  p.innerHTML=html;
  p.onclick=e=>{const b=e.target.closest('[data-e]');if(!b)return;const em=b.dataset.e;roomAddRecent(em);
    if(m==='sticker'){roomInsert({message:'Sticker',message_type:'sticker',sticker:em}).then(()=>{evRoom.mode=null;renderRoomPanel()})}
    else{const inp=$('eventRoomInput');if(inp){const s=inp.selectionStart??inp.value.length,t=inp.selectionEnd??s;inp.value=inp.value.slice(0,s)+em+inp.value.slice(t);const pos=s+em.length;try{inp.setSelectionRange(pos,pos)}catch(x){}roomInputChanged()}}};
}
function roomGifSearch(q){clearTimeout(evRoom.gifTimer);evRoom.gifTimer=setTimeout(()=>roomGifLoad(q.trim()),450)}
async function roomGifLoad(q){
  const g=$('erGifGrid');if(!g)return;
  g.innerHTML='<div class="mut" style="grid-column:1/-1;padding:10px">Cargando…</div>';
  if(!ARX_GIPHY_KEY){g.innerHTML='<div class="notice" style="grid-column:1/-1">La búsqueda de GIF aún no está configurada. Mientras tanto, sube un GIF desde tu móvil.</div>';return}
  try{
    const base='https://api.giphy.com/v1/gifs/'+(q?'search':'trending')+'?api_key='+encodeURIComponent(ARX_GIPHY_KEY)+'&limit=30&rating=pg-13'+(q?'&lang=es&q='+encodeURIComponent(q):'');
    const res=await fetch(base);const j=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(res.status===401||res.status===403?'la clave de GIPHY no es válida':((j&&j.message)||('HTTP '+res.status)));
    const arr=j.data||[];
    if(!$('erGifGrid'))return;
    g.innerHTML=arr.length?arr.map(x=>{const im=x.images||{};const prev=(im.fixed_width_small||im.fixed_width||im.original||{}).url;const send=(im.fixed_width||im.original||{}).url;return prev&&send?'<button type="button" class="er-gif" data-g="'+esc(send)+'"><img loading="lazy" src="'+esc(prev)+'" alt=""></button>':''}).join(''):'<div class="mut" style="grid-column:1/-1;padding:10px">Sin resultados</div>';
  }catch(err){g.innerHTML='<div class="notice" style="grid-column:1/-1">No se pudieron cargar los GIF ('+esc(roomErr(err))+')</div>'}
}


document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('[data-event-filter]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-event-filter]').forEach(x=>x.classList.remove('active'));btn.classList.add('active')}))});


async function arxDropSeal(){if(drop01Progress()<4||!arxSupabase)return;const r=await arxSupabase.rpc('arx_my_seal');const el=$('dropSeal');if(r.data&&el)el.innerHTML='<div class="notice" style="margin-top:12px">Tu sello personal: <b>'+esc(String(r.data))+'</b><br>Para Iubar escribe: RESPUESTA-'+esc(String(r.data))+'</div>'}
function openDropCode(){setTimeout(arxDropSeal,80);openM('<div class="ey">DROP #01 · IUBAR</div><h2>Introduce el código</h2><div class="mut">Junta las piezas que hayas encontrado.</div><div id="dropSeal"></div><div class="form" style="margin-top:14px"><label>CÓDIGO FINAL<input id="dropCodeInput" maxlength=120 autocomplete="off" autocapitalize="characters" placeholder="INTRODUCE EL CÓDIGO"></label><button class="btn" data-click="redeemDropCode()">Desbloquear figura ✦</button></div><div class="mut" style="margin-top:10px">La respuesta se comprueba de forma segura en Supabase.</div>')}
async function redeemDropCode(){const input=$('dropCodeInput'),code=(input?.value||'').trim().toUpperCase();if(!code){toast('Introduce un código');return}if(!arxSupabase||!currentUser){toast('Necesitas iniciar sesión');return}const r=await arxSupabase.rpc('arx_redeem_drop_code',{input_code:code});if(r.error){console.error(r.error);toast(arxSafeError(r.error,'Código no válido.'));return}const result=r.data; if(result?.ok===false){toast(result.message||'Código no válido');return}await loadDropFigures();await loadWallet();closeM();toast(result?.message||'✦ Figura desbloqueada')}
async function loadDropFigures(){
 if(!arxSupabase||!currentUser)return;
 const {data,error}=await arxSupabase.from('arx_drop_figures').select('*').eq('drop_id','drop-01').order('figure_number');
 if(!error&&data&&data.length){
   ARX_DROP01=data.map(f=>({id:f.figure_number,name:f.name,rarity:f.rarity,icon:ARX_DROP01_ICONS[f.figure_number]||'✦',clue:f.clue}));
 }
 const {data:progress,error:perr}=await arxSupabase.from('arx_user_drop_progress').select('figure_number').eq('user_id',currentUser.id).eq('drop_id','drop-01');
 if(!perr){const max=(progress||[]).reduce((m,r)=>Math.max(m,r.figure_number),0);state.dropProgress=max;save();}
 renderDrop01();
}
function drop01Progress(){
 const r=state.dropProgress;
 if(typeof r==='number')return Math.max(0,Math.min(5,r));
 if(r&&typeof r==='object')return Math.max(0,Math.min(5,Number(r.firstSignal||r.drop01||r.progress||0)));
 return 0;
}
function setDrop01Progress(n){state.dropProgress=Number(n);save()}
function renderDrop01(){
 const p=drop01Progress(),bar=$('dropProgressBar'),label=$('dropProgressLabel'),count=$('dropVitrineCount'),feature=$('dropFeatureCount'),grid=$('dropVitrineGrid');
 if(bar)bar.style.width=((p/5)*100)+'%';
 if(label)label.textContent=p+' de 5 vitrinas';
 if(count)count.textContent=String(p).padStart(2,'0')+' / 05';
 if(feature)feature.textContent=String(p).padStart(2,'0')+' / 05';
 if(!grid)return;
 grid.innerHTML=ARX_DROP01.map(f=>{
  const u=p>=f.id,a=p>=f.id-1;
  return `<div class="vitrine-premium ${u?'owned':a?'available':'locked'}" data-click="openDropFigure(${f.id})"><div class="glass"><span>${u?f.icon:(a?'✦':'?')}</span></div><b>${String(f.id).padStart(2,'0')}</b><small>${u?'DESBLOQUEADA':a?'CÓDIGO REQUERIDO':'BLOQUEADA'}</small></div>`;
 }).join('');
 const m=$('dropMasterCard');if(m)m.classList.toggle('complete',p===5);
}
function openDrop01(){const e=$('dropVitrineGrid');if(e)e.scrollIntoView({behavior:'smooth',block:'center'})}
function openDropFigure(id){
 const f=ARX_DROP01.find(x=>x.id===id),p=drop01Progress();if(!f)return;
 if(p<id-1){toast('Primero desbloquea la figura anterior.');return}
 const u=p>=id;
 openM(`<div class="vitrine-viewer"><div class="ey">DROP #01 · ${String(id).padStart(2,'0')}</div><h2>${esc(f.name)}</h2><div class="rarity ${f.rarity.toLowerCase()}">${esc(f.rarity)}</div><div class="vitrine-3d">${u?f.icon:'?'}</div><div class="mut">${u?'FIGURA DESBLOQUEADA · VISOR 360° PREPARADO':'Pista de la figura'}</div><p style="margin:12px 0 16px">${esc(f.clue)}</p>${u?'<div class="notice">✓ Esta figura ya pertenece a tu colección.</div>':'<button class="btn" style="width:100%" data-click="closeM();openDropCode()">INTRODUCIR CÓDIGO →</button>'}</div>`);
}



/* ===== v36: avisos, tiempo real y GIF propio ===== */
const ARX_VAPID=window.ARX_VAPID_PUBLIC_KEY||'BL8iA8Z8oORBI_wtx55-Rln991Uf8Tx9RYgfkTZ8PLd3LWlu8rnGu0so2fJlOg5VfUeRh1i5leyS959e6BIHImw';let arxUnread=0,arxNotifInit=false;
function roomDayLabel(d){const x=new Date(d),t=new Date(),y=new Date(Date.now()-864e5);return x.toDateString()===t.toDateString()?'Hoy':x.toDateString()===y.toDateString()?'Ayer':x.toLocaleDateString('es-ES',{day:'numeric',month:'long'})}
function roomColor(id){let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))>>>0;return 'hsl('+(h%360)+',75%,74%)'}
function roomPreview(m){return m.message_type==='text'?String(m.message||'').slice(0,60):({audio:'🎙 Audio',photo:'📷 Foto',gif:'GIF',sticker:m.sticker||'✨',poll:'📊 Encuesta'}[m.message_type]||'Mensaje')}
async function sendEventGif(e){const f=e.target.files?.[0];e.target.value='';if(!f)return;if(f.type!=='image/gif'){toast('Elige un archivo .gif');return}if(f.size>8*1024*1024){toast('Máximo 8 MB');return}await roomUploadAndSend(f,'gif','image/gif','gif','GIF');evRoom.mode=null;renderRoomPanel()}
function b64u(s){const b=(s+'='.repeat((4-s.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(b),c=>c.charCodeAt(0))}
function refreshBell(){const b=$('erBell');if(b)b.textContent=('Notification' in window&&Notification.permission==='granted')?'🔔':'🔕'}
async function enablePush(quiet){
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent),app=navigator.standalone||matchMedia('(display-mode: standalone)').matches;
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){if(!quiet)toast(ios&&!app?'En iPhone: Compartir → Añadir a pantalla de inicio y ábrela desde ahí':'Tu navegador no admite avisos');return false}
  if(!ARX_VAPID){if(!quiet)toast('Falta ARX_VAPID_PUBLIC_KEY');return false}
  if(Notification.permission!=='granted'){if(quiet)return false;if(await Notification.requestPermission()!=='granted'){toast('Avisos bloqueados en el navegador');refreshBell();return false}}
  try{
    await navigator.serviceWorker.register('arx-sw.js');const reg=await navigator.serviceWorker.ready;
    const sub=(await reg.pushManager.getSubscription())||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(ARX_VAPID)});
    const j=sub.toJSON(),r=await arxSupabase.rpc('arx_save_push_subscription',{p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth,p_ua:navigator.userAgent.slice(0,200)});
    if(r.error)throw r.error;if(!quiet)toast('🔔 Avisos activados');
    refreshBell();
    return true;
  }catch(err){console.error('ARX push:',err);if(!quiet)toast('No se pudieron activar los avisos');refreshBell();return false}
}
async function arxInitNotifs(){
  enablePush(true);
  if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',e=>{if(e.data&&e.data.type==='open-room')openEventRoom(e.data.eventId)});
  arxSupabase.channel('arx-msgs').on('postgres_changes',{event:'INSERT',schema:'public',table:'arx_event_messages'},async pay=>{
    const m=pay.new;if(!m||m.user_id===currentUser.id)return;
    if(String(evRoom.id)===String(m.event_id)&&$('eventRoomMessages')){loadEventRoomMessages(m.event_id,true);return}
    const ev=(state.events||[]).find(x=>String(x.id)===String(m.event_id)),q=await arxSupabase.from('arx_public_profiles').select('username').eq('id',m.user_id).maybeSingle();
    refreshInbox();const b=$('notifBadge');arxUnread++;if(b){b.textContent=arxUnread;b.style.display='inline-block'}
    toast('💬 '+(q.data?.display_name||q.data?.username||'ARX')+' · '+(ev?.name||'Sala')+': '+roomPreview(m));
  }).subscribe();
}
const arxNotifT=setInterval(()=>{if(arxNotifInit){clearInterval(arxNotifT);return}if(typeof currentUser!=='undefined'&&currentUser&&arxSupabase){arxNotifInit=true;arxInitNotifs();clearInterval(arxNotifT)}},2000);
(function(){const id=new URLSearchParams(location.search).get('room');if(!id)return;let n=0;const t=setInterval(()=>{if(++n>40)clearInterval(t);if(currentUser&&(state.events||[]).some(x=>String(x.id)===id)){clearInterval(t);history.replaceState(null,'',location.pathname);openEventRoom(id)}},500)})();

/* ===== v37: sala en pantalla completa ===== */
function enterRoomFull(){
  const m=$('modal');m.classList.add('er-full');roomUnread=0;roomLastId=null;
  if(!(history.state&&history.state.arxRoom))history.pushState({arxRoom:1},'');
  const vv=window.visualViewport;
  if(vv){const f=()=>{m.style.setProperty('--vvh',vv.height+'px');m.style.setProperty('--vvt',vv.offsetTop+'px');const el=$('eventRoomMessages');if(el)el.scrollTop=el.scrollHeight};f();vv.addEventListener('resize',f);vv.addEventListener('scroll',f);evRoom.vvf=f}
}
const _closeM=closeM;
closeM=function(){
  if(window.__consentOpen||window.__setupOpen)return;
  const m=$('modal');
  if(m.classList.contains('er-full')){
    m.classList.remove('er-full');['--vvh','--vvt','--ac1','--ac2'].forEach(k=>m.style.removeProperty(k));if(evRoom.ch){arxSupabase.removeChannel(evRoom.ch);evRoom.ch=null}setTimeout(refreshInbox,300);m.style.removeProperty('--vvt');
    const vv=window.visualViewport;if(vv&&evRoom.vvf){vv.removeEventListener('resize',evRoom.vvf);vv.removeEventListener('scroll',evRoom.vvf);evRoom.vvf=null}
    if(history.state&&history.state.arxRoom){history.back();return}
  }
  _closeM();
};
window.addEventListener('popstate',()=>{if($('modal').classList.contains('on')&&$('eventRoomMessages'))closeM()});

/* ===== v38: tarjeta del plan, escribiendo…, bandeja, visor ===== */
let roomUnread=0,roomLastId=null;
function roomAccent(t){const c={Cita:['#ff4fa3','#c23f93'],Fiesta:['#ff9a3d','#e0457b'],Viaje:['#2fc7c0','#3f7fe0'],Actividad:['#43c97a','#2f9fc7'],Plan:['#7b4fe0','#4f7fe0']}[t],m=$('modal');if(c){m.style.setProperty('--ac1',c[0]);m.style.setProperty('--ac2',c[1])}}
async function roomPin(ev){
  let exact='';try{const r=await arxSupabase.rpc('arx_get_event_private_location',{p_event_id:ev.id});if(!r.error&&r.data)exact=r.data}catch(e){}
  const el=$('erPin');if(!el)return;
  el.innerHTML='<button type="button" class="er-pin-h" data-click="arxToggleParentOpen(this)"><span>📌 '+esc(ev.date)+' · '+esc(ev.time)+'</span><span class="er-pin-c">⌄</span></button><div class="er-pin-b">'+(exact?'<div>⌖ <b>'+esc(exact)+'</b></div><button type="button" class="er-tab" data-click="openExactLocation('+jq(exact)+')">Abrir en mapas</button>':'<div>⌖ '+esc(ev.place)+'</div>')+(ev.desc?'<div class="mut">'+esc(ev.desc)+'</div>':'')+'</div>';
}
function roomTypingInit(id){
  evRoom.me='';arxSupabase.from('arx_public_profiles').select('username').eq('id',currentUser.id).maybeSingle().then(q=>{evRoom.me=q.data?.display_name||q.data?.username||'Alguien'});
  evRoom.ch=arxSupabase.channel('room-'+id).on('broadcast',{event:'typing'},({payload})=>roomShowTyping((payload&&payload.name)||'Alguien')).subscribe();
}
function roomTyping(has){if(!has||!evRoom.ch||Date.now()-(evRoom.tsent||0)<2500)return;evRoom.tsent=Date.now();evRoom.ch.send({type:'broadcast',event:'typing',payload:{name:evRoom.me||'Alguien'}})}
function roomShowTyping(n){const s=$('erSub');if(!s)return;s.textContent=n+' está escribiendo…';s.style.color='#7ee0b0';clearTimeout(evRoom.tt);evRoom.tt=setTimeout(()=>{s.textContent='👥 Solo asistentes · Hablad antes del plan';s.style.color=''},3000)}
function roomScrolled(){const el=$('eventRoomMessages'),b=$('erDown');if(!el||!b)return;const far=el.scrollHeight-el.scrollTop-el.clientHeight>140;if(!far)roomUnread=0;b.style.display=far?'flex':'none';const n=$('erDownN');if(n)n.textContent=roomUnread||''}
function roomToBottom(){const el=$('eventRoomMessages');if(el)el.scrollTo({top:el.scrollHeight,behavior:'smooth'})}
function roomSpeed(b){evRoom.rate=({1:1.5,1.5:2,2:1})[evRoom.rate||1];document.querySelectorAll('.wa-spd').forEach(x=>x.textContent=evRoom.rate+'×');if(evRoom.audio)evRoom.audio.playbackRate=evRoom.rate}
function roomViewer(src){const v=document.createElement('div');v.className='er-viewer';v.innerHTML='<img src="'+esc(src)+'" alt="">';v.onclick=()=>v.remove();document.body.appendChild(v)}
function roomSeen(id){return window.ARX_MEM.reads[String(id)]||0}
function roomMarkSeen(id){const now=Date.now();window.ARX_MEM.reads[String(id)]=now;if(arxSupabase&&currentUser)arxDb(arxSupabase.from('arx_room_reads').upsert({user_id:currentUser.id,event_id:String(id),last_read_at:new Date(now).toISOString()},{onConflict:'user_id,event_id'}),'lectura de chat')}
function roomDayShort(d){const x=new Date(d);return x.toDateString()===new Date().toDateString()?x.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):roomDayLabel(d)}
async function inboxData(){
  const evs=(state.events||[]).filter(e=>e.attending||e.creator_id===currentUser?.id);if(!evs.length)return [];
  const r=await arxSupabase.from('arx_event_messages').select('event_id,user_id,message,message_type,sticker,created_at').in('event_id',evs.map(e=>e.id)).order('created_at',{ascending:false}).limit(300),rows=r.data||[];
  return evs.map(ev=>{const ms=rows.filter(m=>String(m.event_id)===String(ev.id)),seen=roomSeen(ev.id);return{ev,last:ms[0],unread:ms.filter(m=>m.user_id!==currentUser.id&&new Date(m.created_at).getTime()>seen).length}}).sort((a,b)=>new Date(b.last?.created_at||0)-new Date(a.last?.created_at||0));
}
async function refreshInbox(){try{if(!currentUser||!arxSupabase)return [];const d=await inboxData(),n=d.reduce((a,x)=>a+x.unread,0),b=$('inboxBadge');if(b){b.textContent=n;b.style.display='none'}return d}catch(e){return []}}

setInterval(()=>{if(!document.hidden)refreshInbox()},30000);setTimeout(refreshInbox,6000);

/* ===== v39: reacciones, respuestas, encuestas ===== */
function roomName(uid){const p=(evRoom.ps||[]).find(x=>x.id===uid)||{};return p.display_name||p.username||'ARX'}
function roomQuote(m){if(!m.reply_to)return '';const o=(evRoom.rows||[]).find(x=>String(x.id)===String(m.reply_to));return '<div class="er-quote" data-click="roomJump(\''+safeId(m.reply_to)+'\')"><b>'+(o?esc(roomName(o.user_id)):'Mensaje')+'</b><span>'+(o?esc(roomPreview(o)):'Mensaje no disponible')+'</span></div>'}
function roomJump(id){id=safeId(id);if(!id)return;const n=document.querySelector('#eventRoomMessages [data-id="'+id+'"]');if(!n)return;n.scrollIntoView({block:'center',behavior:'smooth'});n.classList.add('flash');setTimeout(()=>n.classList.remove('flash'),1200)}
function roomReply(id){const b=$('erReply');if(!b)return;if(id==null){evRoom.reply=null;b.style.display='none';b.innerHTML='';return}const m=(evRoom.rows||[]).find(x=>String(x.id)===String(id));if(!m)return;evRoom.reply={id:m.id};b.style.display='flex';b.innerHTML='<div class="grow"><b>'+esc(roomName(m.user_id))+'</b><span>'+esc(roomPreview(m))+'</span></div><button type="button" class="er-ico" data-click="roomReply(null)">✕</button>';const i=$('eventRoomInput');if(i)i.focus()}
function roomReacts(m){const l=(evRoom.rx||[]).filter(r=>r.message_id===String(m.id));if(!l.length)return '';const g={};l.forEach(r=>{const em=safeEmoji(r.emoji);if(!em)return;(g[em]=g[em]||[]).push(r.user_id)});return '<div class="er-rx">'+Object.entries(g).map(([e,u])=>'<button type="button" class="'+(u.includes(currentUser.id)?'on':'')+'" data-click="roomReact(\''+safeId(m.id)+'\',\''+e+'\')">'+e+(u.length>1?' '+u.length:'')+'</button>').join('')+'</div>'}
async function roomReact(mid,e){if(!safeEmoji(e)||!safeId(mid))return;const mine=(evRoom.rx||[]).find(r=>r.message_id===String(mid)&&r.user_id===currentUser.id),q=arxSupabase.from('arx_message_reactions');const r=(mine&&mine.emoji===e)?await q.delete().eq('message_id',String(mid)).eq('user_id',currentUser.id):await q.upsert({message_id:String(mid),event_id:String(evRoom.id),user_id:currentUser.id,emoji:e},{onConflict:'message_id,user_id'});if(r.error){toast('No se pudo reaccionar');return}loadEventRoomMessages(evRoom.id,false,true)}
function roomMenuClose(){const m=$('erMenu');if(m)m.remove()}
function roomMenu(n){roomMenuClose();const id=n.dataset.id,r=n.getBoundingClientRect(),d=document.createElement('div');d.id='erMenu';d.className='er-menu';d.style.top=Math.max(70,r.top-54)+'px';d.style.left=Math.min(Math.max(8,r.left),innerWidth-270)+'px';d.innerHTML=['❤️','😂','😮','😢','👍','🔥'].map(e=>'<button type="button" data-r="'+e+'">'+e+'</button>').join('')+'<button type="button" class="txt">↩ Responder</button>';d.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.r)roomReact(id,b.dataset.r);else roomReply(id);roomMenuClose()};document.body.appendChild(d);setTimeout(()=>document.addEventListener('pointerdown',e=>{if(!e.target.closest('#erMenu'))roomMenuClose()},{once:true,capture:true}),0);if(navigator.vibrate)navigator.vibrate(10)}
function roomGestures(){
  const el=$('eventRoomMessages');if(!el)return;let t,sx,sy,tg,mv;
  el.addEventListener('contextmenu',e=>e.preventDefault());
  el.addEventListener('pointerdown',e=>{tg=e.target.closest('.event-room-msg[data-id]');if(!tg||tg.classList.contains('system')||e.target.closest('button,audio,.wa-wave,img'))return void(tg=null);sx=e.clientX;sy=e.clientY;mv=false;const n=tg;t=setTimeout(()=>{t=null;tg=null;roomMenu(n)},450)});
  el.addEventListener('pointermove',e=>{if(!tg)return;const dx=e.clientX-sx,dy=e.clientY-sy;if(Math.abs(dx)>10||Math.abs(dy)>10){clearTimeout(t);t=null}if(dx>10&&Math.abs(dy)<28){mv=true;tg.style.transform='translateX('+Math.min(dx,70)+'px)'}});
  const end=e=>{if(!tg)return;clearTimeout(t);tg.style.transform='';if(mv&&e.clientX-sx>55)roomReply(tg.dataset.id);tg=null};
  el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
}
function roomPollForm(){return '<div class="er-pollform"><input id="pollQ" maxlength="120" placeholder="Pregunta (¿A qué hora quedamos?)">'+[1,2,3,4].map(i=>'<input class="pollO" maxlength="60" placeholder="Opción '+i+(i>2?' (opcional)':'')+'">').join('')+'<button type="button" class="btn" data-click="roomSendPoll()">Enviar encuesta</button></div>'}
async function roomSendPoll(){const q=($('pollQ').value||'').trim(),o=[...document.querySelectorAll('.pollO')].map(x=>x.value.trim()).filter(Boolean);if(!q||o.length<2){toast('Escribe la pregunta y al menos 2 opciones');return}evRoom.mode=null;renderRoomPanel();await roomInsert({message:JSON.stringify({q,o}),message_type:'poll'})}
function roomPollHTML(m){let d;try{d=JSON.parse(m.message)}catch(e){return '<span>📊 Encuesta</span>'}const v=(evRoom.pv||[]).filter(x=>x.message_id===String(m.id)),tot=v.length,my=v.find(x=>x.user_id===currentUser.id);return '<div class="er-poll"><strong>📊 '+esc(d.q)+'</strong>'+(d.o||[]).map((t,i)=>{const c=v.filter(x=>x.option===i).length;return '<button type="button" class="er-opt'+(my&&my.option===i?' on':'')+'" data-click="roomVote(\''+safeId(m.id)+'\','+(i|0)+')"><i style="width:'+(tot?Math.round(c*100/tot):0)+'%"></i><span>'+esc(t)+'</span><b>'+c+'</b></button>'}).join('')+'<small class="mut">'+tot+' voto'+(tot===1?'':'s')+'</small></div>'}
async function roomVote(mid,i){if(!safeId(mid)||!Number.isInteger(i))return;const r=await arxSupabase.from('arx_poll_votes').upsert({message_id:String(mid),event_id:String(evRoom.id),user_id:currentUser.id,option:i},{onConflict:'message_id,user_id'});if(r.error){toast('No se pudo votar');return}loadEventRoomMessages(evRoom.id,false,true)}
