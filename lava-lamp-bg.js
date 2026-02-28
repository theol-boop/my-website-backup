/**
 * bg.js — Animated lava-lamp background + GIF logo
 * Requires: <canvas id="bg"></canvas> and logo.gif in the same folder.
 */
(function () {

  const SPEED      = 2.0;   // animation speed — lower = slower blobs
  const DRIFT      = 12;    // how far shapes travel
  const BLUR       = 77;
  const BLUR_SPEED = 1.1;   // blur transition speed (1/seconds)
  const NOISE   = 88;
  const MAX_DPR = 1.5;

  const PALETTE_DEFAULT = {
    bg: [
      { color: '#FF0000', pos: 0 },
      { color: '#4A90D9', pos: 100 },
    ],
    shapes: [
      { type:'circle', color:'#FF6055', gradType:'radial',  color2:'#FF8C00' },
      { type:'circle', color:'#00CFFF', gradType:'radial',  color2:'#7C3AED' },
      { type:'poly',   color:'#FFD700', gradType:'linear',  color2:'#FF4500' },
      { type:'circle', color:'#A855F7', gradType:'radial',  color2:'#FF9473' },
      { type:'poly',   color:'#FF6B35', gradType:'linear',  color2:'#FFD700' },
      { type:'circle', color:'#00E5B0', gradType:'radial',  color2:'#00CFFF' },
      { type:'rect',   color:'#FF7043', gradType:'linear',  color2:'#A855F7' },
      { type:'circle', color:'#1E90FF', gradType:'radial',  color2:'#00BFA5' },
      { type:'poly',   color:'#FF4500', gradType:'linear',  color2:'#FF8C69' },
      { type:'circle', color:'#C084FC', gradType:'radial',  color2:'#FFB07C' },
    ],
  };

  const PALETTE_AURORA = {
    bg: [
      { color: '#0A0A2E', pos: 0 },
      { color: '#2D1B69', pos: 100 },
    ],
    shapes: [
      { type:'circle', color:'#00FF7F', gradType:'radial',  color2:'#00CED1' },
      { type:'circle', color:'#9400D3', gradType:'radial',  color2:'#4B0082' },
      { type:'poly',   color:'#7FFF00', gradType:'linear',  color2:'#3CB371' },
      { type:'circle', color:'#8A2BE2', gradType:'radial',  color2:'#DA70D6' },
      { type:'poly',   color:'#00CED1', gradType:'linear',  color2:'#7B2D8B' },
      { type:'circle', color:'#00FF00', gradType:'radial',  color2:'#00FA9A' },
      { type:'rect',   color:'#4B0082', gradType:'linear',  color2:'#8A2BE2' },
      { type:'circle', color:'#20B2AA', gradType:'radial',  color2:'#00FF7F' },
      { type:'poly',   color:'#DA70D6', gradType:'linear',  color2:'#9400D3' },
      { type:'circle', color:'#7B2D8B', gradType:'radial',  color2:'#00CED1' },
    ],
  };

  function rndHex() {
    return '#' + (Math.random() * 0xFFFFFF | 0).toString(16).padStart(6, '0');
  }

  function makeRandomPalette() {
    const types = ['circle','circle','poly','circle','poly','circle','rect','circle','poly','circle'];
    return {
      bg: [
        { color: rndHex(), pos: 0 },
        { color: rndHex(), pos: 100 },
      ],
      shapes: types.map(type => ({
        type,
        gradType: Math.random() > 0.5 ? 'radial' : 'linear',
        color:  rndHex(),
        color2: rndHex(),
      })),
    };
  }

  // ── active palette (swap here to change) ───────────────────────────────────
  const { bg: BG_STOPS, shapes: SHAPE_DEFS } = makeRandomPalette();

  const MOBILE  = { n:3,  blur:40, rR:[38,65], sR:[42,70], minScale:0.65 };
  const DESKTOP = { n:10, blur:BLUR, rR:[18,46], sR:[20,52], minScale:0.2 };

  // ── state ──────────────────────────────────────────────────────────────────
  const SEED = Math.floor(Math.random() * 99999);
  let shapes = [], anims = [], t = 0, lastTs = null, mob = false;
  let blurT = 1.0, blurDir = 0; // 1 = full blur, 0 = sharp; dir: -1 unblur, +1 reblur
  let _off, _octx, _blur, _bctx, _un, _uctx, _pad = 0;
  let _grainData = null, _grainTs = 0;
  let _grain, _gctx, _bgFill = null, _ctx = null;

  // ── seeded rng ─────────────────────────────────────────────────────────────
  function mkRng(s) {
    let st = s >>> 0;
    return () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 0x100000000; };
  }

  // ── layout ─────────────────────────────────────────────────────────────────
  function layout() {
    const r = mkRng(SEED), p = mob ? MOBILE : DESKTOP;
    shapes.forEach(s => {
      s.x = 5 + r()*90; s.y = 5 + r()*90;
      s.r = p.rR[0] + r()*(p.rR[1]-p.rR[0]);
      s.w = p.sR[0] + r()*(p.sR[1]-p.sR[0]);
      s.h = p.sR[0] + r()*(p.sR[1]-p.sR[0]);
      s.scaleX = 0.6+r()*1.8; s.scaleY = 0.6+r()*1.8;
      s.rotate = r()*360; s.sides = 3+Math.floor(r()*7);
    });
  }

  // ── oscillators ────────────────────────────────────────────────────────────
  // Frequencies are tiny so motion is genuinely slow at SPEED=0.4
  function buildAnims() {
    const r = mkRng(SEED+9999), d = DRIFT/12;
    anims = shapes.map(s => ({
      x: {base:s.x, w:[ [r()*0.03+0.005,r()*Math.PI*2,(20+r()*35)*d], [r()*0.015+0.003,r()*Math.PI*2,(12+r()*20)*d] ]},
      y: {base:s.y, w:[ [r()*0.025+0.005,r()*Math.PI*2,(18+r()*38)*d],[r()*0.012+0.003,r()*Math.PI*2,(10+r()*22)*d] ]},
      r: {base:s.r, w:[ [r()*0.015+0.003,r()*Math.PI*2,(3+r()*6)*d],  [r()*0.008+0.002,r()*Math.PI*2,(2+r()*4)*d]  ]},
      sx:{base:s.scaleX,w:[[r()*0.015+0.003,r()*Math.PI*2,(0.12+r()*0.18)*d],[r()*0.008+0.002,r()*Math.PI*2,(0.06+r()*0.10)*d]]},
      sy:{base:s.scaleY,w:[[r()*0.015+0.003,r()*Math.PI*2,(0.10+r()*0.16)*d],[r()*0.008+0.002,r()*Math.PI*2,(0.05+r()*0.10)*d]]},
      ro:{base:s.rotate,w:[[r()*0.012+0.003,r()*Math.PI*2,(15+r()*25)*d],[r()*0.006+0.002,r()*Math.PI*2,(8+r()*15)*d]]},
      w: {base:s.w,w:[[r()*0.015+0.003,r()*Math.PI*2,(4+r()*6)*d],[r()*0.008+0.002,r()*Math.PI*2,(2+r()*4)*d]]},
      h: {base:s.h,w:[[r()*0.015+0.003,r()*Math.PI*2,(4+r()*6)*d],[r()*0.008+0.002,r()*Math.PI*2,(2+r()*4)*d]]},
    }));
  }

  function osc(a, t) { return a.base + a.w.reduce((s,[f,p,amp])=>s+Math.sin(t*f+p)*amp, 0); }

  function stepShapes(t) {
    shapes.forEach((s,i) => {
      const a = anims[i]; if (!a) return;
      s.x=osc(a.x,t); s.y=osc(a.y,t); s.r=Math.max(10,osc(a.r,t));
      const ms=(mob?MOBILE:DESKTOP).minScale;
      s.scaleX=Math.max(ms,osc(a.sx,t)); s.scaleY=Math.max(ms,osc(a.sy,t));
      s.rotate=osc(a.ro,t); s.w=Math.max(10,osc(a.w,t)); s.h=Math.max(10,osc(a.h,t));
    });
    // nudge back if everything drifts off
    const vis = s => { const m=(s.r||30)*Math.max(s.scaleX||1,s.scaleY||1); return s.x>-m&&s.x<100+m&&s.y>-m&&s.y<100+m; };
    if (!shapes.some(vis) && shapes.length) {
      let best=shapes[0], bd=1e9;
      shapes.forEach(s=>{const d=(s.x-50)**2+(s.y-50)**2; if(d<bd){bd=d;best=s;}});
      const a=anims[shapes.indexOf(best)];
      if(a){a.x.base+=(50-best.x)*0.02; a.y.base+=(50-best.y)*0.02;}
    }
  }

  // ── rendering ──────────────────────────────────────────────────────────────
  function mkCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}

  function ensureOff(W,H) {
    const pad=Math.ceil((mob?MOBILE.blur:BLUR)/4)*4, PW=W+pad*2, PH=H+pad*2;
    if (!_off||_off.width!==PW||_off.height!==PH) {
      _off=mkCanvas(PW,PH); _octx=_off.getContext('2d');
      _blur=mkCanvas(PW,PH); _bctx=_blur.getContext('2d');
      _un=mkCanvas(PW,PH);   _uctx=_un.getContext('2d');
      _pad=pad;
    }
  }

  function makeBgFill(ctx,W,H) {
    const g=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)/2);
    BG_STOPS.forEach(s=>g.addColorStop(s.pos/100,s.color));
    return g;
  }

  function path(ctx,s,W,H,pad=0) {
    ctx.save();
    ctx.translate((s.x/100)*W+pad,(s.y/100)*H+pad);
    ctx.rotate(s.rotate*Math.PI/180);
    ctx.scale(s.scaleX||1,s.scaleY||1);
    if (s.type==='circle') {
      ctx.beginPath(); ctx.arc(0,0,(s.r/100)*W*0.5,0,Math.PI*2);
    } else if (s.type==='rect') {
      const rw=(s.w/100)*W,rh=(s.h/100)*H;
      ctx.beginPath(); ctx.roundRect(-rw/2,-rh/2,rw,rh,Math.min(rw,rh)*0.15);
    } else {
      const n=Math.max(3,Math.round(s.sides)),pr=(s.r/100)*W*0.4;
      ctx.beginPath();
      for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2-Math.PI/2; i?ctx.lineTo(Math.cos(a)*pr,Math.sin(a)*pr):ctx.moveTo(Math.cos(a)*pr,Math.sin(a)*pr);}
      ctx.closePath();
    }
    ctx.restore();
  }

  function fill(ctx,s,W,H,pad=0) {
    const cx=(s.x/100)*W+pad,cy=(s.y/100)*H+pad,r=(s.r/100)*W*0.5;
    if (s.gradType==='linear'){const g=ctx.createLinearGradient(cx-r,cy-r,cx+r,cy+r);g.addColorStop(0,s.color);g.addColorStop(1,s.color2||'#fff');return g;}
    if (s.gradType==='radial'){const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,s.color);g.addColorStop(1,s.color2||'#fff');return g;}
    return s.color;
  }

  const _GRAIN_ALPHA = (NOISE/100)*0.18;
  const _GRAIN_IV    = (NOISE/100)*80;

  function grain(ctx,W,H) {
    if (mob) return;
    if (!_grain||_grain.width!==W||_grain.height!==H) {
      _grain=mkCanvas(W,H); _gctx=_grain.getContext('2d');
      _grainData=_gctx.createImageData(W,H); _grainTs=0;
    }
    const now=performance.now();
    if (now-_grainTs > 33) { // ~30fps
      const d=_grainData.data;
      for(let i=0;i<d.length;i+=4){
        const b=(128+(Math.random()-0.5)*_GRAIN_IV)|0;
        d[i]=d[i+1]=d[i+2]=b;d[i+3]=255;
      }
      _gctx.putImageData(_grainData,0,0);
      _grainTs=now;
    }
    ctx.save();ctx.globalAlpha=_GRAIN_ALPHA;ctx.globalCompositeOperation='overlay';
    ctx.imageSmoothingEnabled=false;ctx.drawImage(_grain,0,0,W,H);ctx.restore();
  }

  function draw(canvas) {
    const W=canvas.width,H=canvas.height;
    if (!_ctx||_ctx.canvas!==canvas) _ctx=canvas.getContext('2d');
    const ctx=_ctx;
    ensureOff(W,H);
    const pad=_pad,PW=W+pad*2,PH=H+pad*2;

    ctx.fillStyle=_bgFill||makeBgFill(ctx,W,H);
    ctx.fillRect(0,0,W,H);

    _octx.clearRect(0,0,PW,PH); _uctx.clearRect(0,0,PW,PH);
    _octx.globalAlpha=1; _octx.globalCompositeOperation='source-over';
    shapes.forEach(s=>{_octx.fillStyle=fill(_octx,s,W,H,pad);path(_octx,s,W,H,pad);_octx.fill();});

    const ease = blurT * blurT * (3 - 2 * blurT); // smoothstep
    const blurPx = ease * (mob ? MOBILE.blur : BLUR);
    _bctx.clearRect(0,0,PW,PH);
    _bctx.filter=`blur(${blurPx}px)`;
    _bctx.drawImage(_off,0,0);
    _bctx.filter='none';
    ctx.drawImage(_blur,pad,pad,W,H,0,0,W,H);

    grain(ctx,W,H);

  }

  // ── sizing ─────────────────────────────────────────────────────────────────
  function resize(canvas) {
    const dpr=Math.min(window.devicePixelRatio||1,MAX_DPR);
    const W=Math.round(window.innerWidth*dpr),H=Math.round(window.innerHeight*dpr);
    if (canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;_bgFill=null;_off=null;_ctx=null;}
    canvas.style.width=window.innerWidth+'px'; canvas.style.height=window.innerHeight+'px';
  }

  // ── loop ───────────────────────────────────────────────────────────────────
  function loop(canvas, ts) {
    const dt = lastTs !== null ? (ts - lastTs) / 1000 : 0;
    t += dt * SPEED;
    lastTs = ts;
    if (blurDir !== 0) {
      blurT = Math.min(1, Math.max(0, blurT + blurDir * dt * BLUR_SPEED));
      if (blurT <= 0 || blurT >= 1) blurDir = 0;
    }
    stepShapes(t);
    draw(canvas);
    requestAnimationFrame(n=>loop(canvas,n));
  }

  // ── init ───────────────────────────────────────────────────────────────────
  function init() {
    const canvas=document.getElementById('bg');
    if (!canvas){console.warn('bg.js: missing <canvas id="bg">');return;}
    Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',display:'block'});

    mob = window.innerWidth<768||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const p=mob?MOBILE:DESKTOP;
    shapes=SHAPE_DEFS.slice(0,p.n).map((d,i)=>({id:i,x:50,y:50,r:30,w:30,h:30,scaleX:1,scaleY:1,rotate:0,sides:6,...d}));
    layout(); resize(canvas);
    _bgFill=makeBgFill(canvas.getContext('2d'),canvas.width,canvas.height);
    buildAnims();

    requestAnimationFrame(n=>loop(canvas,n));

    const label = document.querySelector('.coming-soon');
    if (label) label.addEventListener('click', () => { blurDir = blurT > 0.5 ? -1 : 1; });

    let rt;
    const onResize=()=>{clearTimeout(rt);rt=setTimeout(()=>{
      mob=window.innerWidth<768;
      resize(canvas);
      _bgFill=makeBgFill(canvas.getContext('2d'),canvas.width,canvas.height);
    },150);};
    window.addEventListener('resize',onResize);
    window.addEventListener('orientationchange',onResize);
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();

})();
