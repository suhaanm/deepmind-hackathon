/* Alongside overlay kit: tiny no-dependency JS API. Every call returns the element; drive it with GSAP by tweening the CSS vars
   --x --y (px strings), --s (scale), --o (opacity), e.g. gsap.to(el, {'--x':'640px','--y':'320px',duration:.8}). */
(function(){
  const NS='http://www.w3.org/2000/svg';
  const LEVELS={1:'Watch me',2:'Walk with me',3:'Nudge me',4:'On my own'};
  const SUPPORT={1:4,2:3,3:2,4:1};
  const TONES={teal:'#5fd0c5',guide:'#4fb3ff',success:'#2fd39a',warn:'#ffb000',danger:'#ff6a4d'};
  const DASH={teal:null,guide:null,success:null,warn:'12 8',danger:'2 9'};
  const GLYPH={teal:'pointer',guide:'pointer',success:'check',warn:'alert',danger:'stop'};
  const GLYPH_D={pointer:'M6 3.5 L6 19.5 L10.2 15.6 L13 21 L15.6 19.7 L12.9 14.4 L18.5 14.4 Z',check:'M5.5 12.8 L10 17.3 L18.8 7.2',alert:'M12 5.5 L12 13.6',stop:'M8.6 3.4 H15.4 L20.6 8.6 V15.4 L15.4 20.6 H8.6 L3.4 15.4 V8.6 Z M7.6 12 H16.4'};
  const POINTER='M0 0 L0 16 L4.2 12.1 L7 17.5 L9.6 16.2 L6.9 10.9 L12.5 10.9 Z'; /* real ghost pointer path (OverlayScene GhostCursor) */
  const MAC_ARROW='M1.2 1 L1.2 17.4 L5.3 13.6 L8.1 19.8 L10.9 18.6 L8.1 12.5 L13.6 12.5 Z'; /* classic macOS arrow */
  let stage=null, timeMode=false, T=0;
  const el=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;};
  const px=n=>n+'px';
  function place(e,x,y,opts){opts=opts||{};e.classList.add('k');e.style.setProperty('--x',px(x||0));e.style.setProperty('--y',px(y||0));
    if(opts.scale)e.style.setProperty('--s',opts.scale);if(opts.center)e.classList.add('center');e.dataset.t0=T;
    (opts.parent||kit.stage()).appendChild(e);return e;}
  function layers(fn,core,casing,halo,color){ /* halo -> casing -> core, same recipe as annotation-style stroke */
    return [['#fff',halo,.92],['#0b1220',casing,1],[color,core,1]].map(([c,w,o],i)=>fn(c,w,o,i)).join('');}
  const glyphSVG=(tone,size)=>`<svg viewBox="0 0 24 24" width="${size}" height="${size}"><circle cx="12" cy="12" r="11.5" fill="${TONES[tone]}" stroke="#0b1220" stroke-width="1.5"/><path d="${GLYPH_D[GLYPH[tone]]}" transform="translate(4.5 4.5) scale(.625)" fill="${GLYPH[tone]==='pointer'?'#0b1220':'none'}" stroke="#0b1220" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>${GLYPH[tone]==='alert'?'<circle cx="12" cy="17" r="1.4" fill="#0b1220"/>':''}</svg>`;

  const kit={
    LEVELS, stage(){ if(!stage){stage=document.getElementById('stage');if(!stage){stage=el('div');stage.id='stage';document.body.appendChild(stage);}} return stage; },
    clear(){ kit.stage().innerHTML=''; },
    remove(e){ if(e&&e.parentNode)e.parentNode.removeChild(e); },
    /* deterministic mode: pause CSS animations and render them at absolute time t (seconds). Call each frame after seeking GSAP. */
    setTime(t){ timeMode=true;T=t;document.getAnimations().forEach(a=>{const n=a.effect&&a.effect.target;const host=n&&n.closest?n.closest('.k'):null;const t0=host?parseFloat(host.dataset.t0||0):0;a.pause();a.currentTime=Math.max(0,(t-t0)*1000);});},

    /* tight ring around box {x,y,w,h}; opts {tone:'teal'|'guide'|'success'|'warn'|'danger', step:n, pulse:true, label:true}. pad 5, radius 8, core 2.5 / casing 4.9 / halo 6.9 */
    ring(box,label,opts){ opts=opts||{}; const tone=opts.tone||'teal', color=TONES[tone];
      const pad=5, w=Math.min(180,Math.max(24,box.w+pad*2)), h=Math.min(180,Math.max(24,box.h+pad*2));
      const cx=box.x+box.w/2, cy=box.y+box.h/2, rx=Math.min(8,Math.min(w,h)/2), m=26, dash=DASH[tone];
      const rect=(a)=>`<rect x="${m}" y="${m}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${a}/>`;
      let g=[[1,.09],[.62,.15],[.3,.22]].map(([k,o])=>rect(`stroke="${color}" stroke-width="${6.9+10*k}" stroke-opacity="${o}"`)).join('');
      g+=layers((c,wd,o,i)=>rect(`stroke="${c}" stroke-width="${wd}" stroke-opacity="${o}"${i===2&&dash?` stroke-dasharray="${dash}"`:''}`),2.5,4.9,6.9,color);
      if(opts.pulse!==false)g+=`<g class="pulse">${rect(`stroke="${color}" stroke-width="2.5"`)}</g>`;
      const wrap=el('div','mark-ring');
      wrap.innerHTML=`<svg width="${w+m*2}" height="${h+m*2}" viewBox="0 0 ${w+m*2} ${h+m*2}">${g}</svg>`;
      if(opts.step!=null){const b=el('div','badge-num',String(opts.step));b.style.cssText=`position:absolute;left:${m-9-2}px;top:${m-9-2}px;background:${color}`;wrap.appendChild(b);}
      if(label){const l=el('div','label-chip',glyphSVG(tone,15)+`<span>${label}</span>`);l.style.cssText=`position:absolute;left:${m}px;top:${m+h+9}px`;wrap.appendChild(l);}
      return place(wrap,cx-(w+m*2)/2,cy-(h+m*2)/2,opts); },
    badge(n,x,y,opts){ const b=el('div','badge-num',String(n)); if(opts&&opts.tone)b.style.background=TONES[opts.tone]; return place(b,x-9,y-9,opts); },
    labelChip(text,x,y,opts){ const tone=(opts&&opts.tone)||'teal'; return place(el('div','label-chip',glyphSVG(tone,15)+`<span>${text}</span>`),x,y,opts); },
    arrow(x1,y1,x2,y2,opts){ opts=opts||{}; const tone=opts.tone||'teal',c=TONES[tone];const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;const gap=6,hl=14,hw=14;
      const ex=x2-ux*gap,ey=y2-uy*gap,bx=ex-ux*hl,by=ey-uy*hl;const mx=(x1+bx)/2-uy*L*.12*.5,my=(y1+by)/2+ux*L*.12*.5;
      const shaft=`M${x1} ${y1} Q${mx} ${my} ${bx} ${by}`,head=`${ex},${ey} ${bx-uy*hw/2},${by+ux*hw/2} ${bx+uy*hw/2},${by-ux*hw/2}`;
      const s=layers((col,w,o)=>`<path d="${shaft}" fill="none" stroke="${col}" stroke-width="${w}" stroke-opacity="${o}" stroke-linecap="round"/><polygon points="${head}" fill="none" stroke="${col}" stroke-width="${w}" stroke-opacity="${o}" stroke-linejoin="round"/>`,2.5,4.9,6.9,c)+`<polygon points="${head}" fill="${c}"/>`;
      const w=el('div','mark-arrow',`<svg width="1920" height="1080" style="overflow:visible">${s}</svg>`);return place(w,0,0,opts); },
    spotlight(box,opts){ const p=6,r=9,d=(opts&&opts.dim)||.45; const w=el('div','mark-spot',`<svg width="1920" height="1080"><defs><filter id="feather${Math.random().toString(36).slice(2,6)}"></filter></defs><path fill="#05070d" fill-opacity="${d}" fill-rule="evenodd" d="M0 0H1920V1080H0Z M${box.x-p+r} ${box.y-p} h${box.w+2*p-2*r} a${r} ${r} 0 0 1 ${r} ${r} v${box.h+2*p-2*r} a${r} ${r} 0 0 1 -${r} ${r} h-${box.w+2*p-2*r} a${r} ${r} 0 0 1 -${r} -${r} v-${box.h+2*p-2*r} a${r} ${r} 0 0 1 ${r} -${r}Z"/></svg>`); return place(w,0,0,opts); },

    /* assistant cursor: rounded teal ghost pointer + persona name tag. Tip of pointer sits at (x,y). */
    ghostCursor(x,y,name,opts){ opts=opts||{}; const sc=17/17.5;
      const p=layers((c,w,o,i)=>`<path d="${POINTER}" fill="none" stroke="${c}" stroke-width="${w/sc*.55}" stroke-opacity="${o}" stroke-linejoin="round" stroke-linecap="round"/>`,2.5,4.9,6.9,TONES.teal);
      const e=el('div','cursor-ghost',`<svg width="22" height="26" viewBox="-6 -6 30 34" style="margin:-6px 0 0 -6px"><g transform="scale(${sc})">${p}<path d="${POINTER}" fill="${TONES.teal}" fill-opacity=".92" stroke-linejoin="round"/></g></svg>`);
      if(name!==''){e.insertAdjacentHTML('beforeend',`<div class="tag">${name==null?'Marcus':name}</div>`);}
      if(opts.scale==null)opts.scale=1.5; if(opts.loop)e.classList.add('loop');
      return place(e,x,y,opts); },
    /* user cursor: classic macOS arrow, white fill, black outline */
    userCursor(x,y,opts){ opts=opts||{}; if(opts.scale==null)opts.scale=1.5; return place(el('div','cursor-user',`<svg width="18" height="26" viewBox="-2 -2 18 26"><path d="${MAC_ARROW}" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>`),x,y,opts); },
    /* white soft ripple at a click point (auto-removes unless opts.keep) */
    rippleUser(x,y,opts){ const e=place(el('div','ripple-user'+(opts&&opts.keep?' loop':'')),x,y,opts); if(!(opts&&opts.keep)&&!timeMode)setTimeout(()=>kit.remove(e),900); return e; },
    /* teal ring pulse for assistant "press" (two rings, ink casing + teal core like the real press ring) */
    pulseBot(x,y,opts){ const r=(w,c)=>`<circle cx="48" cy="48" r="30" fill="none" stroke="${c}" stroke-width="${w}"/>`;
      const e=place(el('div','pulse-bot'+(opts&&opts.keep?' loop':''),`<svg width="96" height="96" viewBox="0 0 96 96">${r(4.5,'#0b1220')}${r(2.5,TONES.teal)}${r(4.5,'#0b1220')}${r(2.5,TONES.teal)}</svg>`),x,y,opts);
      if(!(opts&&opts.keep)&&!timeMode)setTimeout(()=>kit.remove(e),1100); return e; },

    /* bottom frosted caption pill (16px/600). speaker optional: kit.caption(text,{who:'Marcus'}) ; placed bottom-centre by default */
    caption(text,opts){ opts=opts||{}; const e=el('div','caption',(opts.who?`<span class="who">${opts.who}</span>`:'')+`<span>${text}</span>`);
      place(e,0,0,opts); e.style.visibility='hidden'; const w=e.offsetWidth,h=e.offsetHeight; e.style.visibility='';
      e.style.setProperty('--x',px(opts.x!=null?opts.x:(1920-w)/2)); e.style.setProperty('--y',px(opts.y!=null?opts.y:1080-28-h)); return e; },
    /* 'Help level N of 4 - Watch me / Walk with me / Nudge me / On my own' + 'Step N of M'. opts {variant:'dock'|'overlay', x, y} */
    levelChip(level,step,total,opts){ opts=opts||{}; const on=SUPPORT[level],bars=[1,2,3,4].map(i=>`<i class="${i<=on?'on':''}" style="height:${(.35+i*.16)*16}px"></i>`).join('');
      const e=el('div','level-chip'+(opts.variant==='dock'?' dock':''),`<span class="bars">${bars}</span><span class="lv">Help level ${level} of 4 - ${LEVELS[level]}</span>${step!=null?`<span class="sep">|</span><span class="st">Step ${step} of ${total}</span>`:''}`);
      place(e,0,0,opts); const w=e.offsetWidth; e.style.setProperty('--x',px(opts.x!=null?opts.x:(1920-w)/2)); e.style.setProperty('--y',px(opts.y!=null?opts.y:56)); return e; },
    orb(state,size,opts){ const e=el('span','orb','<i class="halo"></i><i class="ring"></i><i class="core"></i>'); e.dataset.state=state||'live'; e.style.setProperty('--orb-size',px(size||36)); return opts&&opts.place?place(e,opts.x,opts.y,opts):e; },
    /* 320x64 glass pill. state: 'live'|'working'|'muted' (+ optional {word, level, stop}) */
    pill(state,opts){ opts=opts||{}; state=state||'live'; const word=opts.word||{live:'Listening',working:'Working…',muted:'Muted'}[state]||state; const lv=opts.level||2;
      const e=el('div','pill glass'); e.appendChild(kit.orb(state,36)); e.insertAdjacentHTML('beforeend',`<span class="word">${word}</span><span class="dots">${[1,2,3,4].map(i=>`<b class="${i<=SUPPORT[lv]?'':'off'}"></b>`).join('')}</span>${opts.stop===false||state==='muted'?'':'<span class="stop">Stop</span>'}`);
      return place(e,opts.x!=null?opts.x:800,opts.y!=null?opts.y:980,opts); },
    /* macOS menu-bar item look: small orb + 'Listening' / 'Live' / 'Working…' / 'Muted'. Not the real menu bar. */
    menuBarState(text,opts){ opts=opts||{}; const st=/work/i.test(text)?'working':/mut/i.test(text)?'muted':'live';
      const e=el('div','menubar-item'); e.appendChild(kit.orb(st,16)); e.insertAdjacentHTML('beforeend',`<span>${text}</span>`); return place(e,opts.x!=null?opts.x:1560,opts.y!=null?opts.y:4,opts); },
    /* progress panel {task,step,total,level,doneForYou,byYou} */
    progressPanel(d,opts){ opts=opts||{}; const lv=d.level||1,e=el('div','progress-panel glass');
      e.innerHTML=`<div class="who"></div><h3>${d.task}</h3><div class="stepline">Step ${d.step} of ${d.total}</div><div class="meter" style="--p:${Math.round(100*d.step/d.total)}%"><i></i></div><div class="lvslot"></div><div class="tally"><div class="done"><b>${d.doneForYou}</b><span>Done for you</span></div><div><b>${d.byYou}</b><span>By you</span></div></div>`;
      const who=e.querySelector('.who');who.appendChild(kit.orb('live',44));who.insertAdjacentHTML('beforeend','<div><b>Marcus</b><span>Listening</span></div>');
      const lc=kit.levelChip(lv,null,null,{variant:'dock'});kit.remove(lc);lc.classList.remove('k');lc.removeAttribute('style');e.querySelector('.lvslot').appendChild(lc);
      return place(e,opts.x!=null?opts.x:1500,opts.y!=null?opts.y:120,opts); },
    /* top-right glass toast: Alongside needs your OK, two big buttons */
    toast(d,opts){ opts=opts||{}; d=d||{}; const e=el('div','toast glass');
      e.innerHTML=`<div class="head"></div><p>${d.body||''}</p><div class="btns"><span class="btn primary">${d.primary||'Yes, open it'}</span><span class="btn secondary">${d.secondary||'No, I will'}</span></div>`;
      const h=e.querySelector('.head');h.appendChild(kit.orb('live',40));h.insertAdjacentHTML('beforeend',`<h4>${d.title||'Alongside needs your OK'}</h4>`);
      return place(e,opts.x!=null?opts.x:1920-440-24,opts.y!=null?opts.y:44,opts); },
    setTheme(t){ document.documentElement.dataset.theme=t; },
    svgs:{POINTER,MAC_ARROW,TONES}
  };
  window.kit=kit;
})();
