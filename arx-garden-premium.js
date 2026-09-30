(function(){
const SLOTS=[[50,27],[30,32],[70,30],[42,16],[62,15],[16,30],[80,20],[90,30],[38,26]];
const tod=()=>{const h=new Date().getHours();return h>=5&&h<8?'dawn':h<18?'day':h<21?'dusk':'night'};
const seen=()=>{try{return new Set(JSON.parse(localStorage.getItem('arx_garden_seen')||'[]'))}catch(e){return new Set()}};
let ALL=[],SEEN=null,LOADING=false;
async function loadSeen(){if(LOADING)return;LOADING=true;let r;try{r=await arxSupabase.from('arx_garden_seen').select('flower_id').eq('user_id',currentUser.id)}catch(e){r={error:e}}LOADING=false;if(r.error){console.warn('ARX jardín (vistas):',r.error);SEEN='local'}else SEEN=new Set((r.data||[]).map(x=>String(x.flower_id)));window.arxGardenScene()}
window.arxGardenScene=function(){
 const sc=document.getElementById('gardenScene'),box=document.getElementById('gsPlants');if(!sc||!box)return;
 sc.dataset.tod=tod();
 if(arxSupabase&&currentUser&&SEEN===null){loadSeen();return}
 ALL=[...(state.flowersIn||[]).map(f=>({f,d:'in'})),...(state.flowers||[]).map(f=>({f,d:'out'}))].slice(0,SLOTS.length);
 const old=seen(),keys=[];
 box.innerHTML=ALL.map((o,i)=>{const f=o.f,x=flowerByKey(f.intent||'curiosity'),k=o.d+'|'+(f.id||(f.intent+'|'+(f.date||'')+'|'+(f.from||f.targetName||''))),[l,b]=SLOTS[i],s=(1.15-(b-16)/90).toFixed(2);keys.push(k);
  const dec=o.d==='in'&&f.status==='declined',acc=o.d==='in'&&f.status==='accepted';
  return '<button class="gs-plant'+(old.has(k)||(SEEN instanceof Set&&f.synced&&SEEN.has(String(f.id)))?'':' gs-new')+(dec?' gs-faded':'')+'" style="left:'+l+'%;bottom:'+b+'%;--s:'+s+';--d:'+(-i*.7)+'s;z-index:'+(100-b)+'" data-i="'+i+'" aria-label="Flor '+esc(f.intentName||x.name)+'"><span class="gs-sway">'+flowerArt(x.key)+'</span>'+(acc?'<i class="gs-lantern"></i>':'')+(dec?'<i class="gs-fallen"></i>':'')+'</button>'}).join('');
 if(!ALL.length)box.innerHTML='<div class="gs-empty">'+flowerArt('curiosity','small')+'</div>';
 try{localStorage.setItem('arx_garden_seen',JSON.stringify(keys))}catch(e){}
 if(SEEN instanceof Set&&arxSupabase&&currentUser){const fresh=ALL.filter(o=>o.f.synced&&!SEEN.has(String(o.f.id))).map(o=>String(o.f.id));if(fresh.length)arxSupabase.from('arx_garden_seen').upsert(fresh.map(id=>({user_id:currentUser.id,flower_id:id})),{onConflict:'user_id,flower_id',ignoreDuplicates:true}).then(r=>{if(!r.error)fresh.forEach(id=>SEEN.add(id))})}
 const t=document.getElementById('gsTitle'),news=(state.flowersIn||[]).some(f=>f.status!=='accepted'&&f.status!=='declined');
 if(t)t.textContent=!ALL.length?'Tu jardín espera su primera flor':news?'Algo florece aquí':'Un pequeño lugar para respirar.';
};
document.addEventListener('click',e=>{
 const sc=e.target.closest&&e.target.closest('#gardenScene');if(!sc)return;
 const p=e.target.closest('.gs-plant');
 if(p){const o=ALL[+p.dataset.i];if(!o)return;const f=o.f,x=flowerByKey(f.intent||'curiosity'),rv=o.d==='in';
  openM('<div class="ey">RECUERDO</div><h2>'+esc(f.intentName||x.name)+'</h2>'+flowerArt(x.key,'large')+'<div class="flower-card-paper"><div class="paper-to">'+(rv?'De '+esc(f.from||f.fromName||'ARX'):'Para '+esc(f.targetName||f.person||'ARX'))+'</div><div class="paper-text">'+esc(f.card||'Solo flor')+'</div><div class="paper-from">'+esc(f.date||'')+'</div></div>');return}
 const r=sc.getBoundingClientRect();
 for(let i=0;i<6;i++){const s=document.createElement('i');s.className='gs-petal';s.style.left=(e.clientX-r.left+(Math.random()*30-15))+'px';s.style.top=(e.clientY-r.top-20)+'px';s.style.setProperty('--dx',(Math.random()*80-40)+'px');s.style.animationDelay=(i*.08)+'s';sc.appendChild(s);setTimeout(()=>s.remove(),2000)}
});
})();
