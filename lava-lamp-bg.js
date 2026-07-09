/**
 * lava-lamp-bg.js — Animated lava-lamp canvas background, usable two ways:
 *  1. Dedicated page: drop a <canvas id="bg"> + <div class="coming-soon"> in
 *     the page and this file auto-inits itself and wires the click-to-unblur.
 *  2. Reusable engine: call window.LavaLampBG.create(canvasEl) from any other
 *     script to get a controller { toggleBlur, unblur, reblur, destroy }.
 */
(function () {

  const SPEED      = 2.0;   // animation speed — lower = slower blobs
  const DRIFT      = 12;    // how far shapes travel
  const BLUR       = 55;
  const BLUR_SPEED = 1.1;   // blur transition speed (1/seconds)
  const NOISE      = 88;
  const MAX_DPR    = 1.0;   // cap at 1× — retina adds cost without visible gain under blur
  const TARGET_FPS = 30;    // lava lamps don't need 60fps
  const FRAME_MS   = 1000 / TARGET_FPS;
  const GRAIN_TILE = 128;   // fixed small tile of native-res noise, repeated as a pattern
  const FADE_MS    = 700;   // opacity cross-fade duration for show/hide

  const MOBILE  = { n:3,  blur:40, rR:[38,65], sR:[42,70], minScale:0.65 };
  const DESKTOP = { n:10, blur:BLUR, rR:[18,46], sR:[20,52], minScale:0.2 };

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

  // ── seeded rng ─────────────────────────────────────────────────────────────
  function mkRng(s) {
    let st = s >>> 0;
    return () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 0x100000000; };
  }

  const _GRAIN_ALPHA = (NOISE/100)*0.18;
  const _GRAIN_IV    = (NOISE/100)*80;

  function mkCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}

  // ── engine factory — each call owns its own independent state ──────────────
  function createEngine(canvas) {
    const { bg: BG_STOPS, shapes: SHAPE_DEFS } = makeRandomPalette();
    const SEED = Math.floor(Math.random() * 99999);

    let mob = window.innerWidth < 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    let shapes = [], anims = [], t = 0, lastTs = null;
    let blurT = 1.0, blurDir = 0; // 1 = full blur, 0 = sharp; dir: -1 unblur, +1 reblur
    let _off, _octx, _blur, _bctx, _pad = 0;
    let _grainData = null, _grainTs = 0, _grainPattern = null;
    let _grain, _gctx, _bgFill = null, _ctx = null;
    let _lastFrameTs = 0;
    let running = true, rafId = null;

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

    function ensureOff(W,H) {
      const pad=Math.ceil((mob?MOBILE.blur:BLUR)/4)*4, PW=W+pad*2, PH=H+pad*2;
      if (!_off||_off.width!==PW||_off.height!==PH) {
        _off=mkCanvas(PW,PH); _octx=_off.getContext('2d');
        _blur=mkCanvas(PW,PH); _bctx=_blur.getContext('2d');
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

    function grain(ctx,W,H) {
      if (mob) return;
      // Generate noise on a small fixed tile at native 1:1 density (fine grain,
      // not scaled/blocky), then repeat it as a pattern across the canvas.
      // Random noise has no structure, so tiling shows no visible seams —
      // cost stays proportional to tile area regardless of screen size.
      if (!_grain) {
        _grain=mkCanvas(GRAIN_TILE,GRAIN_TILE); _gctx=_grain.getContext('2d');
        _grainData=_gctx.createImageData(GRAIN_TILE,GRAIN_TILE); _grainTs=0;
      }
      const now=performance.now();
      if (now-_grainTs > 33) { // cheap enough to refresh at ~30fps
        const d=_grainData.data;
        for(let i=0;i<d.length;i+=4){
          const b=(128+(Math.random()-0.5)*_GRAIN_IV)|0;
          d[i]=d[i+1]=d[i+2]=b;d[i+3]=255;
        }
        _gctx.putImageData(_grainData,0,0);
        _grainPattern=ctx.createPattern(_grain,'repeat');
        _grainTs=now;
      }
      if (!_grainPattern) return;
      ctx.save();ctx.globalAlpha=_GRAIN_ALPHA;ctx.globalCompositeOperation='overlay';
      ctx.fillStyle=_grainPattern;ctx.fillRect(0,0,W,H);ctx.restore();
    }

    function draw() {
      const W=canvas.width,H=canvas.height;
      if (!_ctx) _ctx=canvas.getContext('2d');
      const ctx=_ctx;

      ctx.fillStyle=_bgFill||makeBgFill(ctx,W,H);
      ctx.fillRect(0,0,W,H);

      const ease = blurT * blurT * (3 - 2 * blurT); // smoothstep
      const blurPx = ease * (mob ? MOBILE.blur : BLUR);

      if (mob) {
        // Mobile: draw shapes straight to the visible canvas and blur via the
        // canvas element's CSS filter. Canvas2D's own `ctx.filter` (used
        // below for desktop) isn't reliably supported across mobile
        // browsers/WebViews — when it's a no-op, shapes render fully sharp
        // and the intended blur never appears. Element-level CSS filter is
        // universally supported and cheap at mobile's lower shape count.
        ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
        shapes.forEach(s=>{ctx.fillStyle=fill(ctx,s,W,H,0);path(ctx,s,W,H,0);ctx.fill();});
        canvas.style.filter = blurPx > 0.5 ? `blur(${blurPx}px)` : 'none';
      } else {
        ensureOff(W,H);
        const pad=_pad,PW=W+pad*2,PH=H+pad*2;

        _octx.clearRect(0,0,PW,PH);
        _octx.globalAlpha=1; _octx.globalCompositeOperation='source-over';
        shapes.forEach(s=>{_octx.fillStyle=fill(_octx,s,W,H,pad);path(_octx,s,W,H,pad);_octx.fill();});

        _bctx.clearRect(0,0,PW,PH);
        _bctx.filter=`blur(${blurPx}px)`;
        _bctx.drawImage(_off,0,0);
        _bctx.filter='none';
        ctx.drawImage(_blur,pad,pad,W,H,0,0,W,H);
      }

      grain(ctx,W,H);
    }

    function resize() {
      const dpr=Math.min(window.devicePixelRatio||1,MAX_DPR);
      const W=Math.round(window.innerWidth*dpr),H=Math.round(window.innerHeight*dpr);
      if (canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;_bgFill=null;_off=null;_ctx=null;}
      canvas.style.width=window.innerWidth+'px'; canvas.style.height=window.innerHeight+'px';
    }

    function loop(ts) {
      if (!running) return;
      rafId = requestAnimationFrame(loop);
      if (ts - _lastFrameTs < FRAME_MS) return; // skip frame to hit TARGET_FPS
      _lastFrameTs = ts;
      const dt = lastTs !== null ? (ts - lastTs) / 1000 : 0;
      t += dt * SPEED;
      lastTs = ts;
      if (blurDir !== 0) {
        blurT = Math.min(1, Math.max(0, blurT + blurDir * dt * BLUR_SPEED));
        if (blurT <= 0 || blurT >= 1) blurDir = 0;
      }
      stepShapes(t);
      draw();
    }

    // ── go ─────────────────────────────────────────────────────────────────
    // Cancel any pending fade-out hide (from a destroy() on this same canvas)
    // so a rapid re-create can't have its display:block clobbered late.
    if (canvas._lavaHideTimeout) { clearTimeout(canvas._lavaHideTimeout); canvas._lavaHideTimeout = null; }

    Object.assign(canvas.style, {
      position:'fixed',inset:'0',width:'100vw',height:'100vh',display:'block',pointerEvents:'none',
      transition:`opacity ${FADE_MS}ms ease`, opacity:'0', filter:'none',
    });

    const p = mob ? MOBILE : DESKTOP;
    shapes = SHAPE_DEFS.slice(0,p.n).map((d,i)=>({id:i,x:50,y:50,r:30,w:30,h:30,scaleX:1,scaleY:1,rotate:0,sides:6,...d}));
    layout(); resize();
    _bgFill = makeBgFill(canvas.getContext('2d'), canvas.width, canvas.height);
    buildAnims();

    rafId = requestAnimationFrame(loop);

    // Double rAF ensures the initial opacity:0 is painted before flipping to
    // 1, so the browser actually animates the transition instead of skipping it.
    requestAnimationFrame(() => requestAnimationFrame(() => { canvas.style.opacity = '1'; }));

    let rt;
    const onResize = () => { clearTimeout(rt); rt=setTimeout(()=>{
      mob = window.innerWidth < 768;
      resize();
      _bgFill = makeBgFill(canvas.getContext('2d'), canvas.width, canvas.height);
    },150); };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    return {
      toggleBlur() { blurDir = blurT > 0.5 ? -1 : 1; },
      unblur() { blurDir = -1; },
      reblur() { blurDir = 1; },
      destroy() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
        canvas.style.opacity = '0'; // fade out, then hide once the transition finishes
        canvas._lavaHideTimeout = setTimeout(() => {
          canvas.style.display = 'none';
          canvas._lavaHideTimeout = null;
        }, FADE_MS);
      },
    };
  }

  window.LavaLampBG = { create: createEngine };

  // ── auto-init for the dedicated lava-lamp.html page ─────────────────────
  function autoInit() {
    const canvas = document.getElementById('bg');
    if (!canvas) return; // being used purely as a library elsewhere — no-op
    const engine = createEngine(canvas);
    const label = document.querySelector('.coming-soon');
    if (label) label.addEventListener('click', () => engine.toggleBlur());
  }

  document.readyState==='loading' ? document.addEventListener('DOMContentLoaded', autoInit) : autoInit();

})();
