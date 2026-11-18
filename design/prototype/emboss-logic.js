class Component extends DCLogic {
constructor(props) {
super(props);
var guided = false;
try { guided = window.localStorage.getItem('lhk.stampGuided') === '1'; } catch (e) {}
this.state = { phase: 'idle', guided: guided };
this.r = 0;
this.el = {};
this.mode = 'idle'; // idle | press | retreat | set
this.p = 0;        // press progress 0..1
this.s = 0;        // after the click: the dent under the finger releases
this.raf = 0;
var self = this;
this.refFns = {};
['stage', 'stamp', 'emb', 'shadow', 'hi', 'ink', 'dent', 'bar', 'touch'].forEach(function (k) {
self.refFns[k] = function (node) { if (node) self.el[k] = node; };
});
this.reduce = false;
try { this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
}
componentDidMount() {
// create the audio engine up front (≈80 ms on first creation) so the first press never stutters;
// a user gesture later only has to resume() it, which is cheap
try { var C = window.AudioContext || window.webkitAudioContext; if (C && !this.ctx) this.ctx = new C(); } catch (e) {}
}
componentWillUnmount() { cancelAnimationFrame(this.raf); try { if (this.ctx) this.ctx.close(); } catch (e) {} }

// ---------- sound & haptics ----------
noise(dur, freq, gain, type, delay) {
try {
var C = window.AudioContext || window.webkitAudioContext;
if (!this.ctx) this.ctx = new C();
var ctx = this.ctx;
if (ctx.state === 'suspended') ctx.resume();
var n = Math.floor(ctx.sampleRate * dur);
var buf = ctx.createBuffer(1, n, ctx.sampleRate);
var d = buf.getChannelData(0);
for (var i = 0; i < n; i++) { d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); }
var src = ctx.createBufferSource();
src.buffer = buf;
var f = ctx.createBiquadFilter();
f.type = type || 'lowpass';
f.frequency.value = freq;
var g = ctx.createGain();
g.gain.value = gain;
src.connect(f); f.connect(g); g.connect(ctx.destination);
src.start(ctx.currentTime + (delay || 0));
} catch (e) {}
}
buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
holdMs() { return this.reduce ? 300 : (Number(this.props.holdMs) || 700); }

// ---------- placement: the seal grows from where the finger is ----------
place(clientX, clientY, isMouse) {
var st = this.el.stage, W = 358, H = 360;
var fx = 179, fy = 150;
if (clientX != null && st) {
var r = st.getBoundingClientRect();
var sx = r.width / (st.offsetWidth || W) || 1, sy = r.height / (st.offsetHeight || H) || 1;
fx = (clientX - r.left) / sx;
fy = (clientY - r.top) / sy;
}
var cx = Math.min(245, Math.max(113, fx)), cy = Math.min(222, Math.max(93, fy));
var rot = -6 + Math.random() * 9;
var a = rot * Math.PI / 180, dx = fx - cx, dy = fy - cy;
this.lx = 115 + dx * Math.cos(a) + dy * Math.sin(a);
this.ly = 95 - dx * Math.sin(a) + dy * Math.cos(a);
var lx = this.lx, ly = this.ly;
this.maxR = Math.max(Math.hypot(lx, ly), Math.hypot(230 - lx, ly), Math.hypot(lx, 190 - ly), Math.hypot(230 - lx, 190 - ly)) + 4;
if (this.el.stamp) this.el.stamp.style.transform = 'translate(' + (cx - 115) + 'px,' + (cy - 95) + 'px) rotate(' + rot.toFixed(2) + 'deg)';
if (this.el.dent) this.el.dent.style.transform = 'translate(' + (fx - 130) + 'px,' + (fy - 130) + 'px)';
if (this.el.touch) {
this.el.touch.style.transform = 'translate(' + (fx - 22) + 'px,' + (fy - 22) + 'px)';
this.el.touch.style.opacity = isMouse ? '1' : '0';
}
}

// ---------- easing ----------
eOut(t) { return 1 - Math.pow(1 - t, 3); }
eQuart(t) { return 1 - Math.pow(1 - t, 4); }
eSine(t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); }
setMask(node, v) { node.style.webkitMaskImage = v; node.style.maskImage = v; }

// ---------- one frame ----------
apply() {
var E = this.el;
if (!E.emb) return;
var p = this.p;
// pressure builds faster and faster, then LANDS: the last 15 % (~0.1 s) decelerates to a stop,
// like the paper pushing back at the bottom. No long ease-out (that read as waiting),
// no full-speed stop (that read as a jump).
var depth = this.pressCurve(p);
// once the finger lifts, the paper slowly relaxes: the relief settles to half depth over ~2.5 s
if (this.mode === 'set') depth = depth * (1 - 0.5 * this.eSine(this.r));
// the reveal radius ends one full feather BEYOND the farthest corner, so at p = 1 the relief is
// already 100% visible and nothing pops when the ink lands
var feather = 26 + 30 * (1 - p);
var r = (this.maxR + feather) * this.eQuart(p);
var a = Math.max(0, r - feather).toFixed(1), b = Math.max(0.1, r).toFixed(1);
this.setMask(E.emb, 'radial-gradient(circle at ' + this.lx.toFixed(1) + 'px ' + this.ly.toFixed(1) + 'px, #000 ' + a + 'px, rgba(0,0,0,0) ' + b + 'px)');
E.emb.style.opacity = Math.max(0.001, Math.min(1, p * 4)).toFixed(3);
E.shadow.style.transform = 'translate(' + (1.7 * depth).toFixed(2) + 'px,' + (1.9 * depth).toFixed(2) + 'px)';
E.shadow.style.opacity = Math.max(0.001, 0.34 * depth).toFixed(3);
E.hi.style.transform = 'translate(' + (-1.1 * depth).toFixed(2) + 'px,' + (-1.2 * depth).toFixed(2) + 'px)';
E.hi.style.opacity = Math.max(0.001, depth).toFixed(3);
E.stamp.style.scale = (1.012 - 0.012 * this.pressCurve(p)).toFixed(4);
var dent = 0.9 * this.pressCurve(p);
if (this.mode === 'set') dent = dent * (1 - this.eOut(this.s));
E.dent.style.opacity = dent.toFixed(3);
// ink is pressed into the relief as the pressure builds (second half of the press),
// so at the click only the last bit of colour lands: no flash from paper-white to red
if (this.mode !== 'set' && this.inkBuild()) {
var k = Math.max(0, Math.min(1, (p - 0.45) / 0.55));
E.ink.style.transition = 'none';
E.ink.style.opacity = Math.max(0.001, 0.82 * this.eSine(k) * this.eSine(k)).toFixed(3);
}
}
pressCurve(p) {
var L = 0.85, top = 0.93;
if (p <= L) return top * Math.pow(p / L, 1.6);
return top + (1 - top) * this.eOut((p - L) / (1 - L));
}
inkBuild() { return this.props.inkBuild !== false; }
loop() {
var self = this;
if (this.raf) return;
var last = performance.now();
var step = function (now) {
var dt = Math.min(64, now - last); last = now;
if (self.mode === 'press') {
self.p = Math.min(1, self.p + dt / self.holdMs());
if (self.p >= 1) self.commit();
} else if (self.mode === 'retreat') {
self.p = Math.max(0, self.p - dt / 320);
} else if (self.mode === 'set' && self.lifted) {
// the paper only springs back once the finger is lifted
self.s = Math.min(1, self.s + dt / 420);
self.r = Math.min(1, self.r + dt / (self.reduce ? 300 : 2500));
}
self.apply();
var more = self.mode === 'press' || (self.mode === 'retreat' && self.p > 0) || (self.mode === 'set' && self.lifted && (self.s < 1 || self.r < 1));
if (self.mode === 'retreat' && self.p <= 0) { self.mode = 'idle'; self.go('idle'); }
if (more) self.raf = requestAnimationFrame(step); else self.raf = 0;
};
this.raf = requestAnimationFrame(step);
}
go(ph) { if (this.state.phase !== ph) this.setState({ phase: ph }); }

// ---------- the click: the moment the press bottoms out ----------
// Nothing moves. The wet ink appears in place on the relief lines; the click is told by sound + haptics.
// Then the ink dries slowly and unevenly (fibre-noise order, thin lines first): vivid when the hand lifts,
// fully dry after about 20 s on the page.
commit() {
this.mode = 'set'; this.s = 0; this.r = 0; this.lifted = false;
var ink = this.el.ink;
if (ink) {
ink.style.transition = this.inkBuild() ? 'opacity 80ms cubic-bezier(.2,.6,.3,1)' : 'opacity 30ms linear';
ink.style.opacity = '1';
var dry = ink.querySelectorAll('.dry');
var start = this.reduce ? 300 : 1600, gap = this.reduce ? 200 : 2500, dur = this.reduce ? 600 : 4200;
for (var i = 0; i < dry.length; i++) {
dry[i].style.transition = 'opacity ' + dur + 'ms cubic-bezier(.45,0,.55,1) ' + (start + i * gap) + 'ms';
dry[i].style.opacity = '1';
}
}
if (this.el.touch) this.el.touch.style.opacity = '0';
this.noise(0.014, 2400, 0.55, 'highpass');
this.noise(0.2, 300, 0.85, 'lowpass', 0.008);
this.buzz(18);
// first successful stamp: never show the first-time guide again
try { window.localStorage.setItem('lhk.stampGuided', '1'); } catch (e) {}
this.setState({ phase: 'done', guided: true });
}

// ---------- input ----------
start(e) {
if (this.mode === 'set') return;
if (this.mode === 'idle') {
this.place(e && e.clientX, e && e.clientY, e && e.pointerType === 'mouse');
this.noise(0.03, 600, 0.1);
}
this.mode = 'press';
this.go('press');
this.loop();
}
finish() {
if (this.mode === 'set') {
if (!this.lifted) { this.lifted = true; this.loop(); }
return;
}
if (this.mode !== 'press') return;
this.mode = 'retreat';
this.go('idle');
this.loop();
}
reset() {
cancelAnimationFrame(this.raf); this.raf = 0;
this.mode = 'idle'; this.p = 0; this.s = 0; this.r = 0; this.lifted = false;
var E = this.el;
if (E.emb) { E.emb.style.opacity = '0.001'; this.setMask(E.emb, 'none'); }
if (E.shadow) E.shadow.style.opacity = '0.001';
if (E.hi) E.hi.style.opacity = '0.001';
if (E.ink) {
E.ink.style.transition = 'none'; E.ink.style.opacity = '0.001';
var dry = E.ink.querySelectorAll('.dry');
for (var i = 0; i < dry.length; i++) { dry[i].style.transition = 'none'; dry[i].style.opacity = '0.001'; }
}
if (E.dent) E.dent.style.opacity = '0';
if (E.bar) E.bar.style.transform = 'scaleX(0)';
if (E.touch) E.touch.style.opacity = '0';
if (E.stamp) E.stamp.style.scale = '1';
this.go('idle');
}

renderVals() {
var p = this.state.phase;
var self = this;
var guide = !!this.props.alwaysGuide || !this.state.guided;
return {
phase: p,
done: p === 'done',
notDone: p !== 'done',
showGuide: p !== 'done' && guide,
showLater: p !== 'done' && !guide,
rStage: this.refFns.stage, rStamp: this.refFns.stamp, rEmb: this.refFns.emb, rShadow: this.refFns.shadow,
rHi: this.refFns.hi, rInk: this.refFns.ink, rDent: this.refFns.dent, rBar: this.refFns.bar, rTouch: this.refFns.touch,
down: function (e) { try { if (e && e.currentTarget && e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {} self.start(e); },
up: function () { self.finish(); },
keyDown: function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) self.start(null); } },
keyUp: function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); self.finish(); } },
noMenu: function (e) { e.preventDefault(); },
reset: function () { self.reset(); }
};
}
}
