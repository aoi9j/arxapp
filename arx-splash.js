(function(){
try{if(!sessionStorage.getItem('arx_splash')&&!matchMedia('(prefers-reduced-motion:reduce)').matches){sessionStorage.setItem('arx_splash','1');var s=document.createElement('div');s.id='arxSplash';s.innerHTML='<span>ARX</span>';document.body.appendChild(s);setTimeout(function(){s.remove()},1800)}}catch(e){}
var MAX=8,SEL=new Set(),$i=function(i){return document.getElementById(i)};
var E=function(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
function paint(){
 var n=SEL.size,pk=$i('interestPicker');if(!pk)return;
 pk.classList.toggle('maxed',n>=MAX);
 pk.querySelectorAll('.interest-option').forEach(function(b){b.classList.toggle('selected',SEL.has(b.dataset.interest))});
 pk.querySelectorAll('.int-group').forEach(function(g){var c=g.querySelectorAll('.interest-option.selected').length;g.querySelector('em').textContent=c?c+' ✓':''});
 $i('intSel').innerHTML=[].concat(Array.from(SEL)).map(function(x){return'<button type="button" class="int-pill" data-rm="'+E(x)+'">'+E(x)+' ×</button>'}).join('');
 $i('intN').textContent=n;$i('intDots').innerHTML=Array.from({length:MAX},function(_,i){return'<i class="'+(i<n?'on':'')+'"></i>'}).join('');
}
function err(m){var e=$i('intErr');if(!e)return;e.textContent=m||'';var c=document.querySelector('.int-count');if(m&&c){c.classList.remove('int-shake');void c.offsetWidth;c.classList.add('int-shake')}}
function tog(name){err('');if(SEL.has(name)){SEL.delete(name)}else{if(SEL.size>=MAX){err('Ya tienes 8. Quita uno para añadir otro.');return}SEL.add(name)}paint();if(navigator.vibrate)try{navigator.vibrate(8)}catch(e){}}
window.arxIntFilter=function(q){q=(q||'').trim().toLowerCase();document.querySelectorAll('#interestPicker .int-group').forEach(function(g,i){var any=false;g.querySelectorAll('.interest-option').forEach(function(b){var m=!q||b.dataset.interest.toLowerCase().indexOf(q)>-1;b.style.display=m?'':'none';if(m)any=true});g.style.display=any?'':'none';g.open=q?any:i===0})};
async function doSave(){
 var btn=$i('intSave');err('');
 if(typeof currentUser==='undefined'||!currentUser||!arxSupabase){err('Necesitas iniciar sesión para guardar.');return}
 btn.disabled=true;btn.textContent='Guardando…';
 try{var interests=Array.from(SEL);var r=await arxSupabase.from('arx_profiles').update({interests:interests}).eq('id',currentUser.id).select('id');
  if(r.error||!r.data||!r.data.length){err('No se pudo guardar. Tu selección sigue aquí, inténtalo otra vez.');btn.disabled=false;btn.textContent='Guardar';return}
  state.interests=interests;save();closeM();toast('Intereses guardados ✦')
 }catch(e){err('Sin conexión. Tu selección sigue aquí.');btn.disabled=false;btn.textContent='Guardar'}
}
window.openInterests=function(){
 SEL=new Set(state.interests||[]);
 var h='<div class="ey">MI PERFIL</div><h2>¿Qué te representa?</h2><div class="mut">Elige hasta 8. Puedes cambiarlo cuando quieras.</div><input id="intSearch" class="int-search" type="search" placeholder="Buscar un interés…" autocomplete="off" data-input="arxIntFilter(this.value)"><div id="intSel" class="int-sel"></div><div id="interestPicker">',i=0;
 for(var g in ARX_INTEREST_GROUPS){h+='<details class="int-group"'+(i++===0?' open':'')+'><summary>'+g+'<em></em></summary><div class="int-chips">'+ARX_INTEREST_GROUPS[g].map(function(o){return'<button type="button" class="tag interest-option" data-interest="'+E(o)+'">'+o+'</button>'}).join('')+'</div></details>'}
 h+='</div><div class="int-bar"><div id="intErr" class="int-err"></div><div class="int-count"><b id="intN">0</b> / 8<div class="int-dots" id="intDots"></div></div><button type="button" class="btn" id="intSave">Guardar</button></div>';
 openM(h);paint();
 $i('interestPicker').addEventListener('click',function(e){var b=e.target.closest('.interest-option');if(b)tog(b.dataset.interest)});
 $i('intSel').addEventListener('click',function(e){var b=e.target.closest('.int-pill');if(b)tog(b.dataset.rm)});
 $i('intSave').addEventListener('click',doSave);
};
})();
