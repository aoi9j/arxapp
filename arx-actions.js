/* ARX · acciones delegadas
   Sustituye a los atributos inline onclick/onchange/oninput/onscroll/onkeydown,
   que una CSP sin 'unsafe-inline' bloquea. El HTML lleva ahora data-click="fn(args)",
   data-change=..., data-input=..., data-scroll=..., data-keydown=...
   Sintaxis admitida: fn(arg,...) ; fn2(arg) ; return fn(arg) ; return false
   Argumentos: 'texto' | "texto" | número | true | false | null | this[.prop] | event[.prop]
   Solo se pueden invocar funciones definidas por la app (nunca funciones nativas). */
(function(){
  'use strict';
  var IDENT=/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/;
  var NUM=/^-?\d+(?:\.\d+)?/;
  var cache=Object.create(null);

  function parse(src){
    var i=0,n=src.length,steps=[];
    function ws(){while(i<n&&/\s/.test(src.charAt(i)))i++}
    function str(){
      var q=src.charAt(i++),raw='';
      while(i<n&&src.charAt(i)!==q){
        if(src.charAt(i)==='\\'&&i+1<n){raw+=src.charAt(i)+src.charAt(i+1);i+=2}else raw+=src.charAt(i++)
      }
      if(i>=n)throw new Error('cadena sin cerrar');
      i++;
      if(q==='"')return JSON.parse('"'+raw+'"');
      return raw.replace(/\\(.)/g,'$1');
    }
    function arg(){
      ws();var c=src.charAt(i),m;
      if(c==='"'||c==="'")return {lit:str()};
      if((m=NUM.exec(src.slice(i)))){i+=m[0].length;return {lit:parseFloat(m[0])}}
      if((m=IDENT.exec(src.slice(i)))){
        i+=m[0].length;var p=m[0].split('.');
        if(p.length===1){
          if(p[0]==='true')return {lit:true};
          if(p[0]==='false')return {lit:false};
          if(p[0]==='null')return {lit:null};
          if(p[0]==='undefined')return {lit:undefined};
        }
        if(p[0]==='this'||p[0]==='event')return {ref:p};
      }
      throw new Error('argumento no admitido en '+i);
    }
    function stmt(){
      ws();var step={ret:false};
      if(/^return(?![\w$])/.test(src.slice(i))){step.ret=true;i+=6;ws();
        if(i>=n||src.charAt(i)===';')return step}
      var m=IDENT.exec(src.slice(i));
      if(!m)throw new Error('instrucción no admitida en '+i);
      var name=m[0];
      if(step.ret&&(name==='true'||name==='false')){i+=name.length;step.lit=(name==='true');return step}
      i+=name.length;ws();
      if(src.charAt(i)!=='(')throw new Error('se esperaba ( en '+i);
      i++;ws();step.fn=name;step.args=[];
      if(src.charAt(i)===')'){i++}
      else{
        for(;;){step.args.push(arg());ws();
          var d=src.charAt(i++);
          if(d===')')break;
          if(d!==',')throw new Error('se esperaba , o ) en '+i)}
      }
      return step;
    }
    for(;;){
      ws();if(i>=n)break;
      steps.push(stmt());ws();
      if(src.charAt(i)===';'){i++;continue}
      if(i<n)throw new Error('texto inesperado en '+i);
    }
    return steps;
  }

  function isAppFn(f){
    return typeof f==='function'&&!/\{\s*\[native code\]\s*\}\s*$/.test(Function.prototype.toString.call(f));
  }
  function resolve(a,el,ev){
    if('lit' in a)return a.lit;
    var o=a.ref[0]==='this'?el:ev;
    for(var k=1;k<a.ref.length&&o!=null;k++)o=o[a.ref[k]];
    return o;
  }
  function fire(el,ev,code){
    var steps=cache[code];
    if(!steps){
      try{steps=cache[code]=parse(code)}
      catch(e){console.error('ARX acción no válida:',code,e);return}
    }
    var prevent=false;
    for(var s=0;s<steps.length;s++){
      var st=steps[s],r;
      try{
        if(st.fn==='event.stopPropagation')ev.stopPropagation();
        else if(st.fn==='event.preventDefault')ev.preventDefault();
        else if(st.fn){
          var f=window[st.fn];
          if(!isAppFn(f)){console.error('ARX acción desconocida:',st.fn);continue}
          r=f.apply(window,st.args.map(function(a){return resolve(a,el,ev)}));
        }else r=st.lit;
      }catch(err){setTimeout(function(){throw err});continue}
      if(st.ret){if(r===false)prevent=true;break}
    }
    if(prevent)ev.preventDefault();
  }
  function listen(type,capture){
    var attr='data-'+type;
    document.addEventListener(type,function(ev){
      var el=ev.target;
      if(capture){ /* scroll no burbujea */
        if(el&&el.nodeType===1&&el.hasAttribute(attr))fire(el,ev,el.getAttribute(attr));
        return;
      }
      while(el&&el!==document){
        if(el.nodeType===1&&el.hasAttribute(attr)){
          fire(el,ev,el.getAttribute(attr));
          if(ev.cancelBubble)break; /* respeta stopPropagation */
        }
        el=el.parentNode;
      }
    },!!capture);
  }
  listen('click');listen('change');listen('input');listen('keydown');listen('scroll',true);

  if(typeof module!=='undefined'&&module.exports)module.exports={parse:parse};
})();

/* ---- Ayudantes para los handlers que antes eran varias instrucciones ---- */
function arxStopOpenDrop01(ev){ev.stopPropagation();openDrop01()}
function arxToggleParentOpen(el){el.parentNode.classList.toggle('open')}
function arxClickById(id){var e=document.getElementById(id);if(e)e.click()}
function arxRoomPanelClose(){evRoom.mode=null;renderRoomPanel()}
function arxFiltersReset(){arxF.when='';arxF.type='';closeM();arxRefresh()}
function arxPgInput(el){clearTimeout(window.pgT);window.pgT=setTimeout(function(){pgLoad(el.value.trim())},450)}
function arxRoomKey(ev){if(ev.key==='Enter'){ev.preventDefault();sendEventRoomMessage()}}
