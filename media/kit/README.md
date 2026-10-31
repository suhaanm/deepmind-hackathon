# Alongside kit (look copied from src/renderer/design + overlay, read-only)
Files: kit.css (tokens: light + dark, radii 8/14/22/pill, glass blur 26, shadows, type scale, fonts), kit.js (API), overlay-kit.html (showcase), svg/ (standalone SVGs), kit-preview.png.
Use: load `overlay-kit.html?clean` (transparent 1920x1080 #stage, add `&theme=dark` for dark). Or link kit.css + kit.js in your own page that has a 1920x1080 `#stage`.
Every call returns the element. Drive it with GSAP (cdnjs gsap@3.12.5) by tweening CSS vars: `gsap.to(el,{'--x':'640px','--y':'320px','--s':1.2,'--o':0,duration:.8})`. Transforms use translate3d + scale; no layout reads after creation.
API: kit.ring({x,y,w,h},label,{tone:'teal|guide|success|warn|danger',step:n}) | kit.badge(n,x,y) | kit.labelChip(text,x,y) | kit.arrow(x1,y1,x2,y2) | kit.spotlight(box)
  kit.ghostCursor(x,y,'Marcus') assistant: teal rounded pointer + name tag | kit.userCursor(x,y) macOS arrow | kit.rippleUser(x,y) white ripple | kit.pulseBot(x,y) teal ring pulse
  kit.caption(text,{who}) bottom frosted pill | kit.levelChip(level,step,total,{variant:'dock'}) 'Help level N of 4 - Watch me / Walk with me / Nudge me / On my own' + 'Step N of M'
  kit.progressPanel({task,step,total,level,doneForYou,byYou}) | kit.toast({title,body,primary,secondary}) | kit.menuBarState('Listening|Live|Working…|Muted') | kit.pill('live|working|muted') | kit.orb(state,size)
Placement: pass {x,y,scale} in opts; kit.remove(el) deletes; kit.clear() wipes stage. Pulse/ripple/orb are CSS animations: for frame-exact capture call kit.setTime(seconds) every frame (pauses and seeks them).
Honest differences vs the product: the real ghost cursor is blue (guide tone, tag 'Showing you. I will not click.'); here it is teal with the persona tag per SPEC. Product font Atkinson Hyperlegible is not on macOS by default, falls back to SF.
Real values: ring pad 5, radius 8, strokes halo 6.9 / ink casing 4.9 / core 2.5; label chip 13.2px 700 white with ink 1px border; caption rgba(11,18,32,.78), 16px 600, radius 14, blur 14; level chip echo rgba(11,18,32,.8).
Toast and menu-bar item are new UI (per NOTIFY.md/SHELL2.md): real title 'Alongside needs your OK', buttons = the question's own option labels (NOTIFY.md example: 'Yes, open it' / 'No, I will').
