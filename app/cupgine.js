// Cupgine — animação quadro a quadro dentro do Cuplock.
// Cada quadro desenhado é um keyframe (com quanto tempo ele fica na tela). Pincéis, borracha,
// balde, conta-gotas, cores, papel de cebola, desfazer, prévia e exportação (WebM) ou envio no chat.
// Toda animação leva a marca "Cupgine" no canto superior esquerdo e termina com a logo do Cupgine.
"use strict";
const CG_W = 640, CG_H = 480;
let CG = null;
const CG_COLORS = ["#111111", "#ffffff", "#ef4444", "#f97316", "#facc15", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#a16207", "#6b7280"];
const CG_BRUSHES = { lapis: ["Lápis", 1, 1], pincel: ["Pincel", 1, .7], marcador: ["Marcador", .55, 1], spray: ["Spray", 1, 1] };

function cupgineLogo(size = 26) {
  return `<svg class="cgl" width="${size}" height="${size}" viewBox="0 0 48 48"><defs><linearGradient id="cgg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f472b6"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><rect x="3" y="3" width="42" height="42" rx="12" fill="url(#cgg)"/><path d="M19 15v18l14-9z" fill="#fff"/><path d="M12 36l8-8" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/></svg>`;
}
function openCupgine() {
  closeLayer();
  const blank = () => { const c = document.createElement("canvas"); c.width = CG_W; c.height = CG_H; return c; };
  CG = { frames: [{ c: blank(), hold: 1 }], cur: 0, tool: "pincel", brush: "pincel", size: 8, color: "#111111", alpha: 1, onion: true, fps: 8, bg: "#ffffff", playing: false, undo: [], redo: [], blank };
  const el = Object.assign(document.createElement("div"), { id: "cupgine", className: "cupgine" });
  el.innerHTML = `<div class="cg-top">${cupgineLogo(28)}<b>Cupgine</b><span class="muted small">animação quadro a quadro</span><span class="grow"></span>
      <button class="btn ghost sm" onclick="cgPlay()" id="cgplay">${I("play", 15)} Prévia</button>
      <button class="btn ghost sm" onclick="cgExport('baixar')">${I("download", 15)} Exportar</button>
      <button class="btn sm" onclick="cgExport('enviar')">${I("upload", 15)} Mandar</button>
      <button class="icon-btn" title="Fechar" onclick="cgClose()">${I("x", 18)}</button></div>
    <div class="cg-main">
      <div class="cg-tools">
        ${[["pincel", "edit", "Pincel (B)"], ["borracha", "x", "Borracha (E)"], ["balde", "highlight", "Balde (G)"], ["conta", "sun", "Conta-gotas (I)"], ["linha", "list", "Linha (L)"]].map(([k, ic, t]) => `<button data-tool="${k}" title="${t}" class="${k === "pincel" ? "on" : ""}">${I(ic, 18)}</button>`).join("")}
        <span class="cg-sep"></span>
        <button title="Desfazer (Ctrl Z)" onclick="cgUndo()">${I("rotate", 18)}</button>
        <button title="Limpar quadro" onclick="cgClear()">${I("trash", 18)}</button>
      </div>
      <div class="cg-stage"><div class="cg-canvas-wrap" id="cgwrap"><canvas id="cgonion" width="${CG_W}" height="${CG_H}"></canvas><canvas id="cgcv" width="${CG_W}" height="${CG_H}"></canvas><div class="cg-wm">${cupgineLogo(16)} Cupgine</div></div></div>
      <div class="cg-side">
        <label class="te-f">Pincel</label><div class="seg te-seg" id="cgbr">${Object.entries(CG_BRUSHES).map(([k, [n]]) => `<button data-b="${k}" class="${k === "pincel" ? "on" : ""}">${n}</button>`).join("")}</div>
        <label class="te-f">Tamanho <span id="cgsz">8px</span></label><input type="range" min="1" max="80" value="8" id="cgsize">
        <label class="te-f">Opacidade <span id="cgop">100%</span></label><input type="range" min="5" max="100" value="100" id="cgalpha">
        <label class="te-f">Cor</label><div class="cg-colors">${CG_COLORS.map(c => `<button data-c="${c}" style="background:${c}" class="${c === "#111111" ? "on" : ""}"></button>`).join("")}<input type="color" id="cgcolor" value="#111111" title="Outra cor"></div>
        <label class="te-f">Fundo</label><div class="te-row2"><input type="color" id="cgbg" value="#ffffff"><label class="chk"><input type="checkbox" id="cgonionck" checked> Papel de cebola</label></div>
        <label class="te-f">Velocidade <span id="cgfpsv">8 fps</span></label><input type="range" min="2" max="24" value="8" id="cgfps">
        <label class="te-f">Este quadro fica por <span id="cgholdv">1 quadro</span></label><input type="range" min="1" max="24" value="1" id="cghold">
      </div></div>
    <div class="cg-timeline"><div class="cg-frames" id="cgframes"></div>
      <div class="cg-tl-btns"><button class="btn sm" onclick="cgAdd(false)" title="Novo quadro (N)">+ Quadro</button><button class="btn ghost sm" onclick="cgAdd(true)" title="Duplicar (D)">Duplicar</button><button class="btn ghost sm" onclick="cgDel()">Apagar</button></div></div>`;
  document.body.appendChild(el);
  const cv = $("#cgcv"), ctx = cv.getContext("2d");
  CG.cv = cv; CG.ctx = ctx;
  const pt = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * CG_W / r.width, y: (e.clientY - r.top) * CG_H / r.height }; };
  let drawing = false, last = null, lineStart = null;
  cv.addEventListener("pointerdown", e => {
    if (CG.playing) return; cv.setPointerCapture(e.pointerId);
    const p = pt(e), fctx = cgFrame().c.getContext("2d");
    if (CG.tool === "conta") { const d = cgComposite().getContext("2d").getImageData(p.x | 0, p.y | 0, 1, 1).data; cgSetColor("#" + [0, 1, 2].map(i => d[i].toString(16).padStart(2, "0")).join("")); return; }
    cgPushUndo();
    if (CG.tool === "balde") { cgFill(fctx, p.x | 0, p.y | 0); cgDraw(); return; }
    if (CG.tool === "linha") { lineStart = p; CG.lineSnap = fctx.getImageData(0, 0, CG_W, CG_H); drawing = true; return; }
    drawing = true; last = p; cgStroke(fctx, p, p, e.pressure);
    cgDraw();
  });
  cv.addEventListener("pointermove", e => {
    if (!drawing) return; const p = pt(e), fctx = cgFrame().c.getContext("2d");
    if (CG.tool === "linha") { fctx.putImageData(CG.lineSnap, 0, 0); cgStroke(fctx, lineStart, p, .5, true); }
    else { cgStroke(fctx, last, p, e.pressure); last = p; }
    cgDraw();
  });
  const end = () => { if (drawing) { drawing = false; cgThumbs(); cgSave(); } };
  cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
  el.querySelectorAll("[data-tool]").forEach(b => b.onclick = () => { CG.tool = b.dataset.tool; el.querySelectorAll("[data-tool]").forEach(x => x.classList.toggle("on", x === b)); cv.dataset.tool = CG.tool; });
  el.querySelectorAll("#cgbr [data-b]").forEach(b => b.onclick = () => { CG.brush = b.dataset.b; el.querySelectorAll("#cgbr button").forEach(x => x.classList.toggle("on", x === b)); });
  el.querySelectorAll(".cg-colors [data-c]").forEach(b => b.onclick = () => cgSetColor(b.dataset.c));
  $("#cgcolor").oninput = e => cgSetColor(e.target.value);
  $("#cgsize").oninput = e => { CG.size = +e.target.value; $("#cgsz").textContent = CG.size + "px"; };
  $("#cgalpha").oninput = e => { CG.alpha = +e.target.value / 100; $("#cgop").textContent = e.target.value + "%"; };
  $("#cgbg").oninput = e => { CG.bg = e.target.value; cgDraw(); cgThumbs(); };
  $("#cgonionck").onchange = e => { CG.onion = e.target.checked; cgDraw(); };
  $("#cgfps").oninput = e => { CG.fps = +e.target.value; $("#cgfpsv").textContent = CG.fps + " fps"; };
  $("#cghold").oninput = e => { cgFrame().hold = +e.target.value; cgHoldUI(); cgThumbs(); };
  CG.key = e => {
    if (!CG || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); cgUndo(); }
    else if (k === "b") el.querySelector('[data-tool="pincel"]').click(); else if (k === "e") el.querySelector('[data-tool="borracha"]').click();
    else if (k === "g") el.querySelector('[data-tool="balde"]').click(); else if (k === "i") el.querySelector('[data-tool="conta"]').click(); else if (k === "l") el.querySelector('[data-tool="linha"]').click();
    else if (k === "n") cgAdd(false); else if (k === "d") cgAdd(true);
    else if (k === "arrowright") cgGo(CG.cur + 1); else if (k === "arrowleft") cgGo(CG.cur - 1);
    else if (k === " ") { e.preventDefault(); cgPlay(); } else if (k === "escape") cgClose();
  };
  addEventListener("keydown", CG.key);
  cgLoad(); cgDraw(); cgThumbs();
}
const cgFrame = () => CG.frames[CG.cur];
function cgSetColor(c) { CG.color = c; $("#cgcolor").value = c; document.querySelectorAll(".cg-colors [data-c]").forEach(b => b.classList.toggle("on", b.dataset.c === c)); if (CG.tool === "borracha" || CG.tool === "conta") document.querySelector('#cupgine [data-tool="pincel"]').click(); }
function cgStroke(ctx, a, b, pressure, line) {
  const [, sizeK, alphaK] = CG_BRUSHES[CG.brush] || CG_BRUSHES.pincel;
  const pr = pressure && pressure !== .5 ? .4 + pressure * .9 : 1;
  ctx.save();
  ctx.globalCompositeOperation = CG.tool === "borracha" ? "destination-out" : "source-over";
  ctx.globalAlpha = CG.tool === "borracha" ? 1 : CG.alpha * alphaK;
  ctx.strokeStyle = ctx.fillStyle = CG.color; ctx.lineCap = CG.brush === "marcador" ? "square" : "round"; ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1, CG.size * sizeK * (line ? 1 : pr));
  if (CG.brush === "spray" && CG.tool !== "borracha" && !line) {
    const r = CG.size * 1.4;
    for (let i = 0; i < CG.size * 2; i++) { const t = Math.random(), x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, ang = Math.random() * 6.3, d = Math.random() * r; ctx.fillRect(x + Math.cos(ang) * d, y + Math.sin(ang) * d, 1.4, 1.4); }
  } else if (CG.brush === "lapis" && CG.tool !== "borracha") { ctx.lineWidth = Math.max(1, CG.size * .5); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + .01, b.y); ctx.stroke(); }
  ctx.restore();
}
function cgFill(ctx, x, y) {
  const img = ctx.getImageData(0, 0, CG_W, CG_H), d = img.data, i0 = (y * CG_W + x) * 4, t = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
  const n = parseInt(CG.color.slice(1), 16), fill = [n >> 16, (n >> 8) & 255, n & 255, Math.round(255 * CG.alpha)];
  if (t.every((v, k) => Math.abs(v - fill[k]) < 3)) return;
  const same = i => Math.abs(d[i] - t[0]) < 40 && Math.abs(d[i + 1] - t[1]) < 40 && Math.abs(d[i + 2] - t[2]) < 40 && Math.abs(d[i + 3] - t[3]) < 40;
  const st = [[x, y]], seen = new Uint8Array(CG_W * CG_H);
  while (st.length) {
    const [px, py] = st.pop(); if (px < 0 || py < 0 || px >= CG_W || py >= CG_H) continue;
    const k = py * CG_W + px; if (seen[k]) continue; seen[k] = 1;
    const i = k * 4; if (!same(i)) continue;
    d[i] = fill[0]; d[i + 1] = fill[1]; d[i + 2] = fill[2]; d[i + 3] = fill[3];
    st.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
  }
  ctx.putImageData(img, 0, 0);
}
function cgComposite(i = CG.cur, wm = false) {
  const c = CG.blank(), x = c.getContext("2d");
  x.fillStyle = CG.bg; x.fillRect(0, 0, CG_W, CG_H); x.drawImage(CG.frames[i].c, 0, 0);
  if (wm) cgWatermark(x);
  return c;
}
function cgWatermark(x) {
  x.save(); x.globalAlpha = .85;
  const g = x.createLinearGradient(12, 12, 40, 40); g.addColorStop(0, "#f472b6"); g.addColorStop(1, "#8b5cf6");
  x.fillStyle = "rgba(0,0,0,.35)"; x.beginPath(); x.roundRect(8, 8, 118, 32, 10); x.fill();
  x.fillStyle = g; x.beginPath(); x.roundRect(13, 13, 22, 22, 6); x.fill();
  x.fillStyle = "#fff"; x.beginPath(); x.moveTo(21, 18); x.lineTo(21, 30); x.lineTo(30, 24); x.fill();
  x.font = "800 15px system-ui, sans-serif"; x.fillText("Cupgine", 42, 30); x.restore();
}
// animação final com a logo do Cupgine (t de 0 a 1)
function cgOutro(x, t) {
  x.save();
  const g = x.createLinearGradient(0, 0, CG_W, CG_H); g.addColorStop(0, "#1a1030"); g.addColorStop(1, "#3b1450");
  x.fillStyle = g; x.fillRect(0, 0, CG_W, CG_H);
  const e = t < .5 ? 1 - Math.pow(1 - t / .5, 3) : 1, s = 70 + 50 * e, cx = CG_W / 2, cy = CG_H / 2 - 20, rot = (1 - e) * -.6;
  x.translate(cx, cy); x.rotate(rot); x.globalAlpha = Math.min(1, t * 3);
  const lg = x.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2); lg.addColorStop(0, "#f472b6"); lg.addColorStop(1, "#8b5cf6");
  x.shadowColor = "#f472b6"; x.shadowBlur = 30 * e; x.fillStyle = lg; x.beginPath(); x.roundRect(-s / 2, -s / 2, s, s, s * .28); x.fill();
  x.shadowBlur = 0; x.fillStyle = "#fff"; x.beginPath(); x.moveTo(-s * .12, -s * .2); x.lineTo(-s * .12, s * .2); x.lineTo(s * .2, 0); x.fill();
  x.setTransform(1, 0, 0, 1, 0, 0);
  const ta = Math.max(0, Math.min(1, (t - .35) / .3));
  x.globalAlpha = ta; x.fillStyle = "#fff"; x.textAlign = "center"; x.font = "800 34px system-ui, sans-serif"; x.fillText("Cupgine", cx, cy + 100 + (1 - ta) * 14);
  x.font = "600 15px system-ui, sans-serif"; x.fillStyle = "rgba(255,255,255,.75)"; x.fillText("feito no Cuplock", cx, cy + 128 + (1 - ta) * 14);
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28 + t * 2, r = 90 + 60 * e; x.globalAlpha = Math.max(0, .8 - t * .6); x.fillStyle = i % 2 ? "#f472b6" : "#a78bfa"; x.beginPath(); x.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3 + (i % 3), 0, 7); x.fill(); }
  x.restore();
}
function cgDraw() {
  if (!CG) return;
  const x = CG.ctx; x.fillStyle = CG.bg; x.fillRect(0, 0, CG_W, CG_H); x.drawImage(cgFrame().c, 0, 0);
  const on = $("#cgonion").getContext("2d"); on.clearRect(0, 0, CG_W, CG_H);
  if (CG.onion && !CG.playing && CG.cur > 0) { on.globalAlpha = .28; on.drawImage(CG.frames[CG.cur - 1].c, 0, 0); on.globalAlpha = 1; }
  cgHoldUI();
}
function cgHoldUI() { const h = cgFrame().hold; const e = $("#cghold"); if (e) { e.value = h; $("#cgholdv").textContent = `${h} quadro${h > 1 ? "s" : ""}`; } }
function cgThumbs() {
  const box = $("#cgframes"); if (!box) return;
  box.innerHTML = CG.frames.map((f, i) => `<button class="cg-th ${i === CG.cur ? "on" : ""}" data-i="${i}" draggable="true"><img src="${cgComposite(i).toDataURL("image/jpeg", .5)}" alt=""><span>${i + 1}${f.hold > 1 ? ` ×${f.hold}` : ""}</span></button>`).join("");
  box.querySelectorAll(".cg-th").forEach(b => {
    b.onclick = () => cgGo(+b.dataset.i);
    b.ondragstart = e => e.dataTransfer.setData("text/plain", b.dataset.i);
    b.ondragover = e => e.preventDefault();
    b.ondrop = e => { e.preventDefault(); const from = +e.dataTransfer.getData("text/plain"), to = +b.dataset.i; const [f] = CG.frames.splice(from, 1); CG.frames.splice(to, 0, f); CG.cur = to; cgDraw(); cgThumbs(); };
  });
  box.querySelector(".on")?.scrollIntoView({ inline: "nearest", block: "nearest" });
}
function cgGo(i) { if (!CG || i < 0 || i >= CG.frames.length) return; CG.cur = i; cgDraw(); cgThumbs(); }
function cgAdd(dup) {
  const c = CG.blank(); if (dup) c.getContext("2d").drawImage(cgFrame().c, 0, 0);
  CG.frames.splice(CG.cur + 1, 0, { c, hold: dup ? cgFrame().hold : 1 });
  if (CG.frames.length > 300) { CG.frames.pop(); return toast("Até 300 quadros."); }
  CG.cur++; cgDraw(); cgThumbs(); cgSave();
}
function cgDel() { if (CG.frames.length <= 1) return cgClear(); CG.frames.splice(CG.cur, 1); CG.cur = Math.max(0, CG.cur - 1); cgDraw(); cgThumbs(); cgSave(); }
function cgClear() { cgPushUndo(); cgFrame().c.getContext("2d").clearRect(0, 0, CG_W, CG_H); cgDraw(); cgThumbs(); }
function cgPushUndo() { CG.undo.push({ i: CG.cur, d: cgFrame().c.getContext("2d").getImageData(0, 0, CG_W, CG_H) }); if (CG.undo.length > 30) CG.undo.shift(); }
function cgUndo() { const u = CG.undo.pop(); if (!u || !CG.frames[u.i]) return; CG.frames[u.i].c.getContext("2d").putImageData(u.d, 0, 0); CG.cur = u.i; cgDraw(); cgThumbs(); }
// lista de quadros na ordem de exibição (cada um repetido pelo "hold")
function cgSequence() { const s = []; CG.frames.forEach((f, i) => { for (let k = 0; k < f.hold; k++) s.push(i); }); return s; }
async function cgPlay() {
  if (CG.playing) { CG.playing = false; return; }
  CG.playing = true; $("#cgplay").innerHTML = `${I("pause", 15)} Parar`;
  const seq = cgSequence(), x = CG.ctx, back = CG.cur;
  $("#cgonion").getContext("2d").clearRect(0, 0, CG_W, CG_H);
  while (CG?.playing) {
    for (const i of seq) { if (!CG?.playing) break; x.drawImage(cgComposite(i), 0, 0); await new Promise(r => setTimeout(r, 1000 / CG.fps)); }
    if (!CG?.playing) break;
    const t0 = performance.now(); while (CG?.playing && performance.now() - t0 < 1600) { cgOutro(x, (performance.now() - t0) / 1600); await new Promise(r => requestAnimationFrame(r)); }
  }
  if (!CG) return;
  $("#cgplay").innerHTML = `${I("play", 15)} Prévia`; CG.cur = back; cgDraw();
}
// gera o vídeo: quadros + marca no canto + animação da logo no fim
async function cgRender(onProgress) {
  const out = CG.blank(), x = out.getContext("2d"), stream = out.captureStream(30);
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find(m => MediaRecorder.isTypeSupported(m)) || "";
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 3_000_000 }), chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(r => (rec.onstop = r));
  const seq = cgSequence(), frameMs = 1000 / CG.fps, total = seq.length * frameMs + 1600;
  rec.start(250);
  const t0 = performance.now();
  await new Promise(res => {
    const tick = () => {
      const t = performance.now() - t0;
      if (t < seq.length * frameMs) { const i = seq[Math.min(seq.length - 1, Math.floor(t / frameMs))]; x.drawImage(cgComposite(i, true), 0, 0); }
      else if (t < total) cgOutro(x, (t - seq.length * frameMs) / 1600);
      else return res();
      onProgress?.(t / total); requestAnimationFrame(tick);
    };
    tick();
  });
  rec.stop(); await done;
  const type = (mime || "video/webm").split(";")[0];
  return new File([new Blob(chunks, { type })], `cupgine-${Date.now()}.${type.includes("mp4") ? "mp4" : "webm"}`, { type });
}
async function cgExport(mode) {
  if (CG.playing) CG.playing = false;
  const t = toast("Gerando a animação…");
  try {
    const f = await cgRender(p => { const b = document.querySelector("#cupgine .cg-top"); if (b) b.style.setProperty("--cgp", Math.round(p * 100) + "%"); });
    document.querySelector("#cupgine .cg-top")?.style.removeProperty("--cgp");
    if (!decoOf(S.me).cupgine) setDeco({ cupgine: true }).catch(() => {});
    if (mode === "baixar") {
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(f), download: f.name }); document.body.appendChild(a); a.click(); a.remove(); toast("Animação baixada!"); return;
    }
    cgSendPicker(f);
  } catch (e) { toast("Não deu para gerar: " + e.message); }
}
function cgSendPicker(file) {
  const dms = (S.recentDms || []).filter(id => S.users[id]).slice(0, 12), cur = currentChannel();
  modal(h`<h2>${cupgineLogo(22)} Mandar animação</h2><p class="sub">Escolha para onde vai.</p>
    <div class="cg-dest">${cur ? `<button class="item" onclick="cgSendTo('${cur}')"><span class="hash">#</span><span class="grow">Conversa aberta agora</span></button>` : ""}
      ${dms.map(id => `<button class="item" onclick="cgSendTo(dmId(uid(),'${id}'))">${avatar(S.users[id], "", false)}<span class="grow">${uname(S.users[id])}</span></button>`).join("")}
      ${S.servers.flatMap(s => s.channels.slice(0, 3).map(c => `<button class="item" onclick="cgSendTo('${c.id}')"><span class="hash">#</span><span class="grow">${esc(c.name)} <small class="muted">${esc(s.name)}</small></span></button>`)).join("")}</div>
    <div class="acts"><button class="btn ghost" onclick="closeLayer()">Cancelar</button></div>`);
  window.__cgFile = file;
}
async function cgSendTo(cid) {
  const f = window.__cgFile; if (!f) return; closeLayer();
  const prev = pendingFiles; pendingFiles = [{ file: f, kind: "video", url: URL.createObjectURL(f) }];
  try { await sendWithFiles(cid, "🎬 feito no Cupgine", null); toast("Animação enviada!"); } finally { pendingFiles = prev; renderPendingFiles(); }
}
// guarda o rascunho neste aparelho
function cgSave() {
  clearTimeout(CG?.saveT); if (!CG) return;
  CG.saveT = setTimeout(() => { try { localStorage.setItem("cupgine-draft", JSON.stringify({ fps: CG.fps, bg: CG.bg, frames: CG.frames.slice(0, 120).map(f => ({ h: f.hold, d: f.c.toDataURL("image/png") })) })); } catch {} }, 3000);
}
function cgLoad() {
  let d; try { d = JSON.parse(localStorage.getItem("cupgine-draft") || "null"); } catch {}
  if (!d?.frames?.length) return;
  CG.fps = d.fps || 8; CG.bg = d.bg || "#fff"; $("#cgfps").value = CG.fps; $("#cgfpsv").textContent = CG.fps + " fps"; $("#cgbg").value = CG.bg;
  CG.frames = d.frames.map(f => { const c = CG.blank(), img = new Image(); img.onload = () => { c.getContext("2d").drawImage(img, 0, 0); cgDraw(); cgThumbs(); }; img.src = f.d; return { c, hold: f.h || 1 }; });
  CG.cur = 0;
}
function cgClose() {
  if (!CG) return; CG.playing = false; cgSave();
  removeEventListener("keydown", CG.key); document.getElementById("cupgine")?.remove(); CG = null;
}
