/* Glyph Loom — procedural animated dragon used as the demo source.
 * Draws into a 1000×1000 canvas; call every frame with a timestamp in ms. */
window.GL = window.GL || {};

GL.drawDragon = function (canvas, time) {
  const c = canvas.getContext('2d'), W = 1000, H = 1000, T = time*0.001;
  const g = c.createRadialGradient(560,420,50,500,500,760);
  g.addColorStop(0,'#2b2433'); g.addColorStop(1,'#07060a');
  c.fillStyle = g; c.fillRect(0,0,W,H);

  // drifting cloud curls
  c.lineCap = 'round';
  for (let k=0;k<5;k++){
    const cx = ((k*237 + T*28) % 1200) - 100, cy = 180 + (k*173)%640;
    c.strokeStyle = 'rgba(190,180,210,.16)'; c.lineWidth = 26;
    for (let j=0;j<3;j++){ c.beginPath(); c.arc(cx + j*70, cy + (j%2)*14, 46 - j*6, Math.PI, Math.PI*2.1); c.stroke(); }
  }

  // body spine
  const N = 170, pts = [];
  for (let i=0;i<N;i++){
    const u = i/(N-1);
    const x = 60 + u*560 + Math.sin(u*9 - T*1.3)*18*(1-u);
    const y = 780 - u*360 + Math.sin(u*Math.PI*3.2 - T*1.6)*150*(1-u*0.65);
    const r = 10 + 56*Math.pow(u,0.55) * (u>0.94 ? 1-(u-0.94)*3 : 1);
    pts.push({x,y,r,u});
  }
  for (let i=0;i<N;i++){
    const a = pts[Math.max(0,i-1)], b = pts[Math.min(N-1,i+1)];
    const dx = b.x-a.x, dy = b.y-a.y, l = Math.hypot(dx,dy)||1;
    pts[i].tx = dx/l; pts[i].ty = dy/l; pts[i].nx = dy/l; pts[i].ny = -dx/l; // normal points "up"
  }
  // dorsal spines
  for (let i=4;i<N-6;i+=5){
    const p = pts[i], h = p.r*0.9 + 8;
    const bx = p.x + p.nx*p.r*0.8, by = p.y + p.ny*p.r*0.8;
    c.fillStyle = '#ff6a4d';
    c.beginPath();
    c.moveTo(bx - p.tx*p.r*0.45, by - p.ty*p.r*0.45);
    c.lineTo(bx + p.nx*h - p.tx*h*0.5, by + p.ny*h - p.ty*h*0.5);
    c.lineTo(bx + p.tx*p.r*0.45, by + p.ty*p.r*0.45);
    c.fill();
  }
  // legs (behind body)
  for (const [ui, ph] of [[0.32,0],[0.68,1.7]]){
    const p = pts[Math.round(ui*(N-1))], sw = Math.sin(T*2.2+ph)*0.35;
    const kx = p.x - p.nx*(p.r+40) + p.tx*30*sw, ky = p.y - p.ny*(p.r+40) + p.ty*30*sw;
    const fx = kx + p.tx*46, fy = ky + p.ty*46 + 24;
    c.strokeStyle = '#5cc28f'; c.lineWidth = p.r*0.55;
    c.beginPath(); c.moveTo(p.x,p.y); c.lineTo(kx,ky); c.lineTo(fx,fy); c.stroke();
    c.strokeStyle = '#f1e2b0'; c.lineWidth = 6;
    for (let k=-1;k<=1;k++){ c.beginPath(); c.moveTo(fx,fy); c.lineTo(fx + 22 + k*4, fy + 14 + k*12); c.stroke(); }
  }
  // body tube, tail → head
  for (let i=0;i<N;i++){
    const p = pts[i];
    const lg = c.createRadialGradient(p.x + p.nx*p.r*0.45, p.y + p.ny*p.r*0.45, p.r*0.1, p.x, p.y, p.r*1.05);
    lg.addColorStop(0,'#f0ffd8'); lg.addColorStop(0.5,'#74d6a2'); lg.addColorStop(1,'#1d6a4e');
    c.fillStyle = lg; c.beginPath(); c.arc(p.x,p.y,p.r,0,Math.PI*2); c.fill();
    if (i%3===0){ // belly plates
      c.fillStyle = 'rgba(240,214,140,.85)';
      c.beginPath(); c.ellipse(p.x - p.nx*p.r*0.62, p.y - p.ny*p.r*0.62, p.r*0.42, p.r*0.2, Math.atan2(p.ty,p.tx), 0, Math.PI*2); c.fill();
    }
    if (i%4===2){ // scale arcs
      c.strokeStyle = 'rgba(8,30,24,.45)'; c.lineWidth = 2.5;
      c.beginPath(); c.arc(p.x + p.nx*p.r*0.15, p.y + p.ny*p.r*0.15, p.r*0.55, Math.atan2(p.ty,p.tx)-1.2, Math.atan2(p.ty,p.tx)+1.2); c.stroke();
    }
  }
  // tail tuft
  const t0 = pts[0];
  c.fillStyle = '#e04a3a';
  for (let k=0;k<4;k++){ const a = Math.PI + k*0.35 - 0.5 + Math.sin(T*3+k)*0.15;
    c.beginPath(); c.moveTo(t0.x,t0.y); c.lineTo(t0.x + Math.cos(a)*70, t0.y + Math.sin(a)*70); c.lineTo(t0.x + Math.cos(a+0.25)*40, t0.y + Math.sin(a+0.25)*40); c.fill(); }

  // head
  const hp = pts[N-1], ang = -0.12 + Math.sin(T*1.1)*0.06;
  c.save(); c.translate(hp.x, hp.y); c.rotate(ang);
  // mane
  c.fillStyle = '#ff6a4d';
  for (let k=0;k<7;k++){ const a = Math.PI*0.55 + k*0.22, len = 90 + (k%2)*30 + Math.sin(T*4+k)*8;
    c.beginPath(); c.moveTo(0,0); c.lineTo(Math.cos(a)*len - 20, Math.sin(a)*len*0.9 - 30); c.lineTo(Math.cos(a+0.18)*len*0.6, Math.sin(a+0.18)*len*0.6 - 20); c.fill(); }
  // horns
  c.strokeStyle = '#f3e6c0'; c.lineWidth = 13; c.lineCap = 'round';
  c.beginPath(); c.moveTo(20,-40); c.quadraticCurveTo(-30,-120,-110,-130); c.stroke();
  c.lineWidth = 10; c.beginPath(); c.moveTo(40,-36); c.quadraticCurveTo(10,-100,-50,-145); c.stroke();
  // skull + snout
  const hg = c.createRadialGradient(40,-30,8,50,0,130);
  hg.addColorStop(0,'#f4ffe2'); hg.addColorStop(0.55,'#7fdcaa'); hg.addColorStop(1,'#1f6a4f');
  c.fillStyle = hg;
  c.beginPath(); c.ellipse(40,0,78,58,0,0,Math.PI*2); c.fill();
  c.beginPath(); c.ellipse(125,-6,74,32,0.05,0,Math.PI*2); c.fill();
  // open jaw
  const open = 0.18 + Math.sin(T*1.8)*0.08;
  c.save(); c.translate(60,22); c.rotate(open);
  c.fillStyle = '#1f6e52'; c.beginPath(); c.ellipse(60,10,78,18,0,0,Math.PI*2); c.fill();
  c.fillStyle = '#f7f1dc'; for (let k=0;k<6;k++){ c.beginPath(); c.moveTo(20+k*20,-6); c.lineTo(28+k*20,-20); c.lineTo(36+k*20,-6); c.fill(); }
  c.restore();
  c.fillStyle = '#7a1424'; c.beginPath(); c.ellipse(140,22,50,10,0.15,0,Math.PI*2); c.fill();
  // brow + eye
  c.fillStyle = '#c23b3b'; c.beginPath(); c.moveTo(30,-44); c.lineTo(100,-34); c.lineTo(46,-22); c.fill();
  c.fillStyle = '#fff6c9'; c.beginPath(); c.ellipse(62,-22,15,10,0,0,Math.PI*2); c.fill();
  c.fillStyle = '#120a06'; c.beginPath(); c.ellipse(65,-22,4,9,0,0,Math.PI*2); c.fill();
  c.fillStyle = '#0b2a22'; c.beginPath(); c.arc(186,-14,6,0,Math.PI*2); c.fill();
  // whiskers
  c.strokeStyle = '#f3e6c0'; c.lineWidth = 6;
  for (const s of [-1,1]){
    c.beginPath(); c.moveTo(180,-10 + s*4);
    for (let k=1;k<=12;k++){ const x = 180 + k*22, y = -10 + s*4 + s*k*7 + Math.sin(T*2.5 + k*0.6 + s)*k*3.2; c.lineTo(x,y); }
    c.stroke();
  }
  c.restore();

  // flaming pearl
  const px = hp.x + 250 + Math.sin(T*0.9)*20, py = hp.y - 150 + Math.cos(T*1.2)*16;
  const pg = c.createRadialGradient(px-10,py-10,4,px,py,120);
  pg.addColorStop(0,'#ffffff'); pg.addColorStop(0.18,'#fff0b0'); pg.addColorStop(0.45,'rgba(255,150,60,.55)'); pg.addColorStop(1,'rgba(255,90,40,0)');
  c.fillStyle = pg; c.beginPath(); c.arc(px,py,120,0,Math.PI*2); c.fill();
};
