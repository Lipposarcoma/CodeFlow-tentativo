/* ══════════════════════════════════════════════════════════
   1. CANVAS
   Fondo animado: partículas conectadas por líneas (efecto "red neuronal").
   ══════════════════════════════════════════════════════════ */

(function(){
  const c=document.getElementById('bg-canvas'),ctx=c.getContext('2d');
  let W,H,pts=[];
  const COLS=['rgba(79,142,247,.55)','rgba(168,85,247,.4)','rgba(99,102,241,.45)','rgba(16,185,129,.3)','rgba(236,72,153,.3)'];
  function resize(){W=c.width=innerWidth;H=c.height=innerHeight;}
  resize();addEventListener('resize',resize);
  class P{constructor(){this.r(true);}r(i=false){this.x=Math.random()*W;this.y=i?Math.random()*H:H+5;this.vy=-(Math.random()*.32+.08);this.vx=(Math.random()-.5)*.12;this.rad=Math.random()*1.4+.4;this.a=Math.random()*.45+.15;this.col=COLS[Math.floor(Math.random()*COLS.length)];this.l=0;this.ml=Math.random()*380+160;}tick(){this.x+=this.vx;this.y+=this.vy;this.l++;if(this.l>this.ml||this.y<-5)this.r();}draw(){ctx.save();ctx.globalAlpha=this.a*Math.sin(Math.PI*this.l/this.ml);ctx.fillStyle=this.col;ctx.beginPath();ctx.arc(this.x,this.y,this.rad,0,Math.PI*2);ctx.fill();ctx.restore();}}
  for(let i=0;i<90;i++)pts.push(new P());
  function conn(){for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<105){ctx.save();ctx.globalAlpha=.1*(1-d/105);ctx.strokeStyle='rgba(79,142,247,1)';ctx.lineWidth=.4;ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.stroke();ctx.restore();}}}
  function loop(){ctx.clearRect(0,0,W,H);conn();pts.forEach(p=>{p.tick();p.draw();});requestAnimationFrame(loop);}
  loop();
})();

/* ══════════════════════════════════════════════════════════
   2. ESTADO GLOBAL COMPARTIDO
   S es el objeto de estado que usan TODAS las secciones. Aquí solo
   se declara con lo mínimo del sidebar (xp). Cada archivo de sección
   (ej: lacaceria.js) le AGREGA sus propias propiedades sin volver a
   declararlo con const — por eso index.js debe cargarse primero en
   el HTML, antes que cualquier script de sección.
   ══════════════════════════════════════════════════════════ */
const S={
  xp:0,
  streak:0,
};

const XP_LEVELS=[
  {min:0,  max:99,  name:'Aprendiz',   icon:'<span class="material-icons">eco</span>',unlock:'Modo Galaxia + cursor especial'},
  {min:100,max:249, name:'Iniciado',   icon:'<span class="material-icons">bolt</span>',unlock:'Partículas azules extra'},
  {min:250,max:499, name:'Explorador', icon:'<span class="material-icons">explore</span>',unlock:'Tema Púrpura'},
  {min:500,max:799, name:'Pensador',   icon:'<span class="material-icons">psychology</span>',unlock:'Tema Naranja Fuego'},
  {min:800,max:1199,name:'Lógico',     icon:'<span class="material-icons">settings</span>',unlock:'Tema Verde Matrix'},
  {min:1200,max:99999,name:'Arquitecto',icon:'<span class="material-icons">rocket_launch</span>',unlock:'Modo Maestro + confetti permanente'},
];

/* ══════════════════════════════════════════════════════════
   3. TEMA — claro / oscuro
   Alternar el tema visual de la interfaz (botón del topbar).
   ══════════════════════════════════════════════════════════ */
function toggleTheme() {
  const html = document.documentElement, isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  
  // Reemplazamos innerText por innerHTML para inyectar el span
  document.getElementById('theme-toggle').innerHTML = isDark 
    ? '<span class="material-icons">dark_mode</span>' 
    : '<span class="material-icons">light_mode</span>';
  
  // Actualizamos el mensaje del toast con los íconos
  showToast(isDark 
    ? '<span class="material-icons" style="font-size: calc(16px * var(--a11y-fs, 1)); vertical-align: text-bottom;">light_mode</span> Modo claro' 
    : '<span class="material-icons" style="font-size: calc(16px * var(--a11y-fs, 1)); vertical-align: text-bottom;">dark_mode</span> Modo oscuro', 
    1600
  );
}

/* ══════════════════════════════════════════════════════════
   4. XP Y NIVELES — lógica del sidebar
   Cálculo de nivel actual y actualización de la barra de progreso.
   ══════════════════════════════════════════════════════════ */
function getLevelData(xp){return XP_LEVELS.find(l=>xp>=l.min&&xp<=l.max)||XP_LEVELS[XP_LEVELS.length-1];}
function getLevelIndex(xp){return XP_LEVELS.indexOf(getLevelData(xp));}
function updateXpBar(){
  const ld=getLevelData(S.xp),idx=XP_LEVELS.indexOf(ld),next=XP_LEVELS[idx+1];
  const progress=next?Math.min(100,Math.round((S.xp-ld.min)/(next.min-ld.min)*100)):100;
  document.getElementById('xp-bar-fill').style.width=progress+'%';
  document.getElementById('xp-label-val').innerHTML=S.xp+(next?' / '+next.min+' XP':' XP MAX');
  document.getElementById('level-icon').innerHTML=ld.icon;
  document.getElementById('level-name').innerHTML=ld.name;
  document.getElementById('level-sub').innerHTML='Nivel '+(idx+1)+' · '+S.xp+' XP';
  if(next){
    document.getElementById('next-unlock-label').innerHTML='<span class="material-icons" style="font-size: calc(15px * var(--a11y-fs, 1)); vertical-align: text-bottom;">lock_open</span> Próximo: Nivel '+(idx+2)+' — '+next.name;
    document.getElementById('next-unlock-desc').innerHTML='A '+(next.min-S.xp)+' XP · Desbloquea: '+next.unlock;
  }
  else{
    document.getElementById('next-unlock-label').innerHTML='<span class="material-icons" style="font-size: calc(15px * var(--a11y-fs, 1)); vertical-align: text-bottom;">emoji_events</span> Nivel máximo alcanzado';
    document.getElementById('next-unlock-desc').innerHTML='¡Has dominado la Red!';
  }
}
// Compara el nivel de XP antes/después de una ganancia y, si subió
// de nivel (ej: Aprendiz → Iniciado), muestra el aviso correspondiente.
function checkLevelUp(oldXp,newXp){
  if(getLevelIndex(newXp)>getLevelIndex(oldXp)){
    const ld=getLevelData(newXp);
    showLevelUpNotif(ld);
  }
}

// Muestra la notificación animada de "subiste de nivel" + confetti.
function showLevelUpNotif(ld){
  const el=document.createElement('div');
  el.className='levelup-notif';
  el.innerHTML=`<div style="font-size:calc(50px * var(--a11y-fs, 1));margin-bottom:10px">${ld.icon}</div><h2>¡Subiste de nivel!</h2><p style="font-size:calc(15px * var(--a11y-fs, 1));font-weight:700;color:var(--yellow);margin-bottom:6px">${ld.name}</p><p>Desbloqueaste: ${ld.unlock}</p>`;
  document.body.appendChild(el);
  launchConfetti();
  setTimeout(()=>el.remove(),3100);
}

// Muestra un pequeño aviso flotante de "+XP" arriba a la derecha.
function showXp(t){
  const el=document.createElement('div');
  el.className='xp-flash';
  el.innerHTML='<span class="material-icons" style="font-size: calc(14px * var(--a11y-fs, 1)); vertical-align: text-top; margin-right: 4px;">star</span>' + t;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),1900);
}
// Actualiza el texto de una estadística y hace un pequeño "rebote"
// visual en su badge (ej: al ganar XP o cambiar la racha).
function animateStat(id,val){
  const el=document.getElementById(id);
  if(!el)return;
  el.innerHTML=val;
  const badge=el.closest('.stat-badge');
  if(badge){
    badge.classList.remove('pop');
    void badge.offsetWidth; // fuerza el reinicio de la animación
    badge.classList.add('pop');
  }
}

// Lanza una lluvia de confetti (usada al completar un nivel o subir de nivel).
function launchConfetti(){
  const cols=['#4F8EF7','#A855F7','#F97316','#10B981','#FBBF24','#6366F1','#EC4899'];
  for(let i=0;i<55;i++){
    const p=document.createElement('div');
    p.className='confetti-piece';
    const sz=Math.random()*8+4;
    p.style.cssText=`width:${sz}px;height:${sz}px;left:${Math.random()*100}vw;top:-10px;background:${cols[Math.floor(Math.random()*cols.length)]};border-radius:${Math.random()>.5?'50%':'2px'};animation-duration:${Math.random()*2+1.4}s;animation-delay:${Math.random()*.7}s;`;
    document.body.appendChild(p);
    setTimeout(()=>p.remove(),3400);
  }
}

/* ══════════════════════════════════════════════════════════
   5. NAVEGACIÓN DEL SIDEBAR
   Marca el ítem activo (visual y para lectores de pantalla) y
   muestra la vista correspondiente. La usan TODAS las secciones
   (Hub, Explorar Juegos, La Cacería, etc.), por eso vive aquí.
   - Si el botón tiene data-view y esa vista existe en el HTML,
     se muestra esa vista real (ej: "La Cacería" → #view-map).
   - Si no tiene data-view (vistas que aún no construimos),
     se cae de vuelta al placeholder, igual que antes.
   ══════════════════════════════════════════════════════════ */
function navTo(el){
  document.querySelectorAll('.nav-item').forEach(x=>{
    x.classList.remove('active');
    x.removeAttribute('aria-current');
  });
  el.classList.add('active');
  el.setAttribute('aria-current','page');

  const targetId=el.dataset.view;
  const shown=targetId&&enterView(targetId);

  if(!shown){
    showView('view-placeholder');
    const label=document.getElementById('view-label');
    if(label)label.innerHTML=el.dataset.label||el.textContent.trim();
  }
}

// Cambia de vista SIN pasar por un clic del sidebar y SIN disparar su
// data-onshow (útil dentro de funciones que ya están manejando esa
// misma vista, para evitar que se vuelvan a llamar a sí mismas).
// Devuelve true si la vista existe.
function showView(id){
  document.querySelectorAll('.view-container').forEach(v=>v.classList.remove('active'));
  const el=document.getElementById(id);
  if(!el)return false;
  el.classList.add('active');
  return true;
}

// Como showView(), pero además dispara el data-onshow de la vista
// destino (si tiene uno declarado). Es el punto de entrada correcto
// para navegar HACIA una vista desde afuera (ej: navTo, launchGame).
function enterView(id){
  const shown=showView(id);
  if(shown){
    const el=document.getElementById(id);
    const onShow=el.dataset.onshow;
    if(onShow&&typeof window[onShow]==='function')window[onShow]();
  }
  return shown;
}

// Marca como activo el ítem del sidebar que apunta a una vista dada
// (ej: al salir de un ejercicio, volver a resaltar "La Cacería").
function setActiveNavByView(viewId){
  document.querySelectorAll('.nav-item').forEach(n=>{
    n.classList.remove('active');
    n.removeAttribute('aria-current');
  });
  const nav=document.querySelector(`.nav-item[data-view="${viewId}"]`);
  if(nav){
    nav.classList.add('active');
    nav.setAttribute('aria-current','page');
  }
}

/* ══════════════════════════════════════════════════════════
   6. TOAST — aviso flotante
   Utilidad compartida: cualquier sección puede llamar a showToast().
   ══════════════════════════════════════════════════════════ */
function showToast(msg,dur=2800){
  const t=document.getElementById('toast');
  t.innerHTML=msg;t.style.opacity='1';t.style.transform='translateY(0)';t.style.pointerEvents='auto';
  clearTimeout(t._t);
  t._t=setTimeout(()=>{t.style.opacity='0';t.style.transform='translateY(10px)';t.style.pointerEvents='none';},dur);
}

/* ══════════════════════════════════════════════════════════
   7. INICIALIZACIÓN BASE
   Cada archivo de sección agrega su propia inicialización
   (ej: lacaceria.js llama a buildPath(1) y updateRing(1)).
   ══════════════════════════════════════════════════════════ */
(function init(){
  updateXpBar();
})();