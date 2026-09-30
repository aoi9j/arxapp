(function(){
const sc=document.getElementById('gardenScene'),sec=document.getElementById('garden');if(!sc||!sec)return;
const tree=sc.querySelector('.gs-tree'),grade=sc.querySelector('.gs-grade'),btn=sc.querySelector('.gs-snd'),orb=sc.querySelector('.gs-orb');
const M=Math.random,buzz=ms=>{try{navigator.vibrate&&navigator.vibrate(ms)}catch(e){}};
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
let vis=sec.classList.contains('on');
/* ---------- ÁRBOL ---------- */
const CL=[[80,80,38,1],[50,100,26,1],[112,100,27,1],[80,46,32,2],[48,68,24,2],[114,70,25,3],[80,24,22,3],[32,90,18,4],[130,88,18,4],[58,30,18,5],[104,32,19,5]];
let sd=7;const R=()=>(sd=sd*16807%2147483647)/2147483647;
(function build(){
 let s='<svg viewBox="0 0 160 200"><defs><linearGradient id="gtk" x1="0" x2="1"><stop offset="0" stop-color="#6b4f37"/><stop offset=".55" stop-color="#4a3829"/><stop offset="1" stop-color="#2f241b"/></linearGradient></defs>'
 +'<path d="M48 199Q70 194 71 172L70 130Q68 104 60 82L100 82Q92 104 90 130L91 172Q92 194 114 199Z" fill="url(#gtk)"/>'
 +'<path d="M74 190Q76 150 72 118" stroke="#8a6a4d" stroke-width="2" stroke-linecap="round" fill="none" opacity=".45"/>'
 +'<path d="M78 128Q60 108 42 96M84 122Q104 102 122 92M80 100V70" stroke="#4a3829" stroke-width="7" stroke-linecap="round" fill="none"/>';
 CL.forEach(([x,y,r,l],i)=>{let sp='';for(let k=0;k<8;k++){const a=R()*6.28,d=R()*r*.8,ex=(x+Math.cos(a)*d).toFixed(1),ey=(y+Math.sin(a)*d-r*.1).toFixed(1);sp+='<ellipse cx="'+ex+'" cy="'+ey+'" rx="3.2" ry="1.8" transform="rotate('+((R()*180)|0)+' '+ex+' '+ey+')" fill="#a9c4a2" opacity=".5"/>'}
  s+='<g class="tg" data-l="'+l+'"><g class="tc" style="--d:'+(-i*.8).toFixed(1)+'s"><circle cx="'+x+'" cy="'+(y+r*.12)+'" r="'+r+'" fill="#35503f"/><circle cx="'+x+'" cy="'+y+'" r="'+(r*.9)+'" fill="#56745b"/><circle cx="'+(x-r*.22)+'" cy="'+(y-r*.3)+'" r="'+(r*.58)+'" fill="#7a9a78"/>'+sp+'</g></g>'});
 s+='<g class="bl">';for(let k=0;k<16;k++){const c=CL[(R()*7)|0],a=R()*6.28,d=R()*c[2]*.85;s+='<circle cx="'+(c[0]+Math.cos(a)*d).toFixed(1)+'" cy="'+(c[1]+Math.sin(a)*d).toFixed(1)+'" r="'+(2+R()*1.6).toFixed(1)+'" fill="'+(k%3?'#D8A7A0':'#F1E8D8')+'" opacity=".88"/>'}
 tree.innerHTML=s+'</g></svg>';
})();
function level(){const a=(state.flowers||[]).length,b=(state.flowersIn||[]).length,c=(state.flowersIn||[]).filter(f=>f.status==='accepted').length,n=a+b+c;return[n>=10?5:n>=6?4:n>=3?3:n>=1?2:1,n]}
function applyTree(){const[lv,n]=level();tree.dataset.lv=lv;sc.style.setProperty('--ts',(0.66+lv*0.1).toFixed(2));
 tree.querySelectorAll('.tg').forEach(g=>g.classList.toggle('off',+g.dataset.l>lv));
 if(!n)return;let prev=0;try{prev=+localStorage.getItem('arx_tree_lv')||0}catch(e){}
 if(lv>prev){try{localStorage.setItem('arx_tree_lv',lv)}catch(e){}if(prev&&vis)grow()}}
function grow(){tree.classList.add('up');setTimeout(()=>tree.classList.remove('up'),2300);leaves(14);chime([0,2,4,7]);buzz([15,40,25]);if(typeof toast==='function')toast('Tu árbol ha crecido ✦')}
function leaves(n){const a=sc.getBoundingClientRect(),t=tree.getBoundingClientRect();if(!t.width)return;
 for(let i=0;i<n;i++)setTimeout(()=>{const e=document.createElement('i');e.className='gs-leaf';e.style.left=(t.left-a.left+t.width*(.2+M()*.6))+'px';e.style.top=(t.top-a.top+t.height*(.12+M()*.35))+'px';e.style.background=['#7a9a78','#9bb596','#D8A7A0','#F1E8D8'][(M()*4)|0];e.style.setProperty('--dx',(M()*90-55)+'px');e.style.setProperty('--dy',(70+M()*80)+'px');e.style.setProperty('--t',(3.5+M()*2.5)+'s');sc.appendChild(e);setTimeout(()=>e.remove(),6500)},i*120)}
(function auto(){setTimeout(()=>{if(vis&&!document.hidden&&!reduce)leaves(1+(M()*2|0));auto()},5000+M()*6000)})();
/* ---------- LUZ ---------- */
const ST=[[0,[40,60,140,.5]],[5,[60,80,150,.45]],[7,[255,170,130,.4]],[9.5,[255,255,255,0]],[17,[255,255,255,0]],[19,[255,150,100,.42]],[21,[50,65,140,.5]],[24,[40,60,140,.5]]];
function light(){const d=new Date(),h=d.getHours()+d.getMinutes()/60;let i=0;while(ST[i+1][0]<h)i++;
 const[h0,c0]=ST[i],[h1,c1]=ST[i+1],k=(h-h0)/(h1-h0),c=c0.map((v,j)=>v+(c1[j]-v)*k);
 grade.style.backgroundColor='rgba('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+','+c[3].toFixed(2)+')';
 const day=h>=6&&h<20,t=day?(h-6)/14:(h>=20?h-20:h+4)/10,left=10+80*t,top=(day?46:44)-(day?32:28)*Math.sin(Math.PI*t);
 orb.style.right='auto';orb.style.left=left.toFixed(1)+'%';orb.style.top=top.toFixed(1)+'%';
 sc.style.setProperty('--rx',left.toFixed(1)+'%');sc.style.setProperty('--ray',day?((h<8||h>18.3)?.38:.55):.1);sc.style.setProperty('--sx',(day?(.5-t)*2:0).toFixed(2))}
setInterval(light,30000);
/* ---------- PARALLAX ---------- */
let tx=0,ty=0,cx=0,cy=0,held=false,gyro=false;const t0=performance.now(),cl=(v)=>Math.max(-1,Math.min(1,v));
function aim(e){const r=sc.getBoundingClientRect();tx=cl(((e.clientX-r.left)/r.width-.5)*2);ty=cl(((e.clientY-r.top)/r.height-.5)*2)}
if(!reduce){
 sc.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||held)aim(e)});
 sc.addEventListener('pointerdown',e=>{held=true;aim(e);askGyro()});
 ['pointerup','pointercancel'].forEach(n=>addEventListener(n,()=>{held=false;if(!gyro){tx=0;ty=0}}));
 sc.addEventListener('pointerleave',()=>{if(!gyro&&!held){tx=0;ty=0}});
 let asked=false;function askGyro(){if(asked)return;asked=true;const D=window.DeviceOrientationEvent;if(!D)return;const go=()=>addEventListener('deviceorientation',e=>{if(e.gamma==null)return;gyro=true;if(!held){tx=cl(e.gamma/25);ty=cl((e.beta-50)/30)}});
  if(typeof D.requestPermission==='function')D.requestPermission().then(r=>{if(r==='granted')go()}).catch(()=>{});else go()}
 (function loop(now){if(vis){const idle=(held||gyro)?0:Math.sin((now-t0)/5200)*.25;cx+=(tx+idle-cx)*.06;cy+=(ty-cy)*.06;sc.style.setProperty('--px',cx.toFixed(3));sc.style.setProperty('--py',cy.toFixed(3))}requestAnimationFrame(loop)})(t0)}
/* ---------- SONIDO (sintetizado, sin archivos) ---------- */
const A={c:null,m:null,fx:null,on:false,want:false};try{A.want=localStorage.getItem('arx_garden_snd')==='1'}catch(e){}
const N=[523.25,587.33,659.25,783.99,880,1046.5,1174.66,1318.5];
function unlockIOS(){try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}try{if(!A.el){const e=document.createElement('audio');e.setAttribute('playsinline','');e.loop=true;e.src='data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';A.el=e}A.el.play().catch(()=>{})}catch(e){}}
function ensure(){if(A.c)return A.c;unlockIOS();const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;const c=A.c=new C();
 A.m=c.createGain();A.m.gain.value=0;A.m.connect(c.destination);
 const dl=c.createDelay(1);dl.delayTime.value=.32;const fb=c.createGain();fb.gain.value=.32;const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1800;dl.connect(lp);lp.connect(fb);fb.connect(dl);lp.connect(A.m);A.fx=dl;
 const mk=w=>{const b=c.createBuffer(1,c.sampleRate*3,c.sampleRate),d=b.getChannelData(0);let p=0;for(let i=0;i<d.length;i++){const x=Math.random()*2-1;if(w)d[i]=x;else{p=(p+.02*x)/1.02;d[i]=p*3.5}}return b};
 A.br=mk(0);A.wh=mk(1);
 const bed=(buf,type,f,q,g,lf,lg)=>{const s=c.createBufferSource();s.buffer=buf;s.loop=true;const fl=c.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;const ga=c.createGain();ga.gain.value=g;s.connect(fl);fl.connect(ga);ga.connect(A.m);const o=c.createOscillator();o.frequency.value=lf;const og=c.createGain();og.gain.value=lg;o.connect(og);og.connect(ga.gain);o.start();s.start()};
 bed(A.br,'lowpass',420,.5,.32,.09,.12);bed(A.wh,'bandpass',1500,.7,.05,.23,.02);return c}
function tone(f,t0,dur,vol){const c=A.c,o=c.createOscillator(),g=c.createGain();o.frequency.value=f;g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(vol,t0+.02);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);o.connect(g);g.connect(A.m);g.connect(A.fx);o.start(t0);o.stop(t0+dur+.05)}
function chime(ix){if(!A.on)return;const t=A.c.currentTime;ix.forEach((k,i)=>tone(N[k],t+i*.12,1.8,.22))}
function chirp(){const c=A.c,t=c.currentTime,n=2+(M()*3|0),b=2400+M()*1600;for(let i=0;i<n;i++){const o=c.createOscillator(),g=c.createGain(),s=t+i*.11;o.frequency.setValueAtTime(b,s);o.frequency.exponentialRampToValueAtTime(b*(1.25+M()*.4),s+.07);g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(.07,s+.01);g.gain.exponentialRampToValueAtTime(.0001,s+.09);o.connect(g);g.connect(A.m);o.start(s);o.stop(s+.1)}}
function cricket(){const c=A.c,t=c.currentTime;for(let i=0;i<5;i++){const o=c.createOscillator(),g=c.createGain(),s=t+i*.07;o.frequency.value=4300;g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(.03,s+.015);g.gain.linearRampToValueAtTime(0,s+.05);o.connect(g);g.connect(A.m);o.start(s);o.stop(s+.06)}}
function rustle(){if(!A.on)return;const c=A.c,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),t=c.currentTime;s.buffer=A.wh;f.type='bandpass';f.frequency.value=3200;f.Q.value=.8;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.16,t+.08);g.gain.exponentialRampToValueAtTime(.0001,t+.7);s.connect(f);f.connect(g);g.connect(A.m);s.start(t,M()*2);s.stop(t+.8)}
let tm;function sched(){clearTimeout(tm);if(!A.on)return;const d=sc.dataset.tod;if((d==='night'||d==='dusk')&&M()<.8)cricket();if(d!=='night'&&M()<.7)chirp();tm=setTimeout(sched,(d==='night'?1200:2500)+M()*4500)}
function sync(){const on=A.want&&vis&&!document.hidden;if(on&&!A.c&&!ensure())return;btn.classList.toggle('on',A.want);btn.setAttribute('aria-pressed',A.want);if(!A.c)return;A.on=on;const t=A.c.currentTime;A.m.gain.cancelScheduledValues(t);A.m.gain.setTargetAtTime(on?.9:0,t,.6);if(on){unlockIOS();A.c.resume&&A.c.resume();sched()}else{clearTimeout(tm);try{A.el&&A.el.pause()}catch(e){}}}
btn.addEventListener('click',e=>{e.stopPropagation();A.want=!A.want;try{localStorage.setItem('arx_garden_snd',A.want?'1':'0')}catch(x){}sync();if(A.want)setTimeout(()=>chime([0,2,4]),250);buzz(10)});
sc.addEventListener('pointerdown',()=>{if(A.want)sync()});
document.addEventListener('visibilitychange',sync);
/* ---------- INTERACCIÓN ---------- */
sc.addEventListener('click',e=>{if(e.target.closest('.gs-snd'))return;
 const p=e.target.closest('.gs-plant');if(p){const k=(+p.dataset.i*2)%5;buzz(12);chime([k,k+2]);return}
 if(e.target.closest('.gs-tree')){tree.classList.remove('shake');void tree.offsetWidth;tree.classList.add('shake');setTimeout(()=>tree.classList.remove('shake'),1000);leaves(8);rustle();buzz(15)}});
/* ---------- ENGANCHE CON EL JARDÍN ---------- */
function post(){applyTree();light();if(vis&&sc.querySelector('.gs-new'))chime([0,2,4])}
const o=window.arxGardenScene;if(typeof o==='function')window.arxGardenScene=function(){const r=o.apply(this,arguments);try{post()}catch(e){console.warn('ARX v92',e)}return r};
new MutationObserver(()=>{const v=sec.classList.contains('on');if(v===vis)return;vis=v;if(v){light();applyTree()}sync()}).observe(sec,{attributes:true,attributeFilter:['class']});
applyTree();light();sync();
})();
