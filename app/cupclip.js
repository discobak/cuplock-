// CupClip — editor de vídeo antes de enviar: cortar, zoom, textos, filtros, velocidade e som.
// Exporta no próprio app (canvas + MediaRecorder), sem servidor.
"use strict";
let CC = null;
const CC_FILTERS = { nenhum: "none", vivo: "saturate(1.5) contrast(1.1)", pb: "grayscale(1) contrast(1.1)", retro: "sepia(.6) saturate(1.2) contrast(.95)", frio: "hue-rotate(-15deg) saturate(1.2) brightness(1.03)", quente: "sepia(.25) saturate(1.3) hue-rotate(-8deg)", escuro: "brightness(.8) contrast(1.25)" };
const CC_FONTS = ["Impact, Haettenschweiler, sans-serif", "var(--font)", "Georgia, serif", "'Comic Sans MS', cursive", "monospace"];

(() => {
  const _add = addFiles;
  addFiles = files => {
    const list = [...files], vids = list.filter(f => (f.type || "").startsWith("video/") && !f.__cupclip);
    const rest = list.filter(f => !vids.includes(f));
    if (rest.length) _add(rest);
    if (vids.length && typeof MediaRecorder !== "undefined" && HTMLCanvasElement.prototype.captureStream) {
      const queue = [...vids];
      const next = () => { const f = queue.shift(); if (f) openCupClip(f, out => { if (out) _add([out]); next(); }); };
      next();
    } else if (vids.length) _add(vids);
  };
})();

function openCupClip(file, done) {
  const url = URL.createObjectURL(file);
  CC = { file, url, done, start: 0, end: 0, dur: 0, zoom: 1, zx: .5, zy: .5, texts: [], filter: "nenhum", speed: 1, muted: false, sel: -1, exporting: false };
  layer.innerHTML = `<div class="modal-bg cc-bg"><div class="cupclip" role="dialog" aria-modal="true">
    <div class="cc-head"><b>${I("film", 18)} CupClip</b><span class="muted small" id="ccinfo">${esc(file.name)}</span><span class="grow"></span>
      <button class="btn ghost sm" onclick="ccSkip()">Enviar sem editar</button><button class="icon-btn" title="Cancelar" onclick="ccClose(null)">${I("x", 18)}</button></div>
    <div class="cc-main">
      <div class="cc-stage" id="ccstage"><video id="ccv" src="${url}" playsinline preload="auto"></video><canvas id="ccc"></canvas><div id="cctexts"></div>
        <button class="cc-play" id="ccplay" onclick="ccToggle()">${I("play", 22)}</button></div>
      <div class="cc-side">
        <div class="cc-sec"><label>${I("scissors", 15)} Cortar</label>
          <div class="cc-trim"><input type="range" id="ccs" min="0" max="1000" value="0"><input type="range" id="cce" min="0" max="1000" value="1000"></div>
          <div class="cc-row small"><span id="ccst">0:00</span><span class="grow" style="text-align:center" id="cclen"></span><span id="ccet">0:00</span></div></div>
        <div class="cc-sec"><label>${I("zoomIn", 15)} Zoom <span class="muted" id="cczv">100%</span></label><input type="range" id="ccz" min="100" max="300" value="100">
          <div class="muted small">Com zoom, arraste o vídeo para escolher o ponto.</div></div>
        <div class="cc-sec"><label>${I("type", 15)} Textos</label>
          <div class="cc-row"><input class="input" id="cctxt" maxlength="80" placeholder="Escreva algo…"><button class="btn sm" onclick="ccAddText()">Adicionar</button></div>
          <div id="cctlist"></div></div>
        <div class="cc-sec"><label>${I("sun", 15)} Filtro</label><div class="cc-chips">${Object.keys(CC_FILTERS).map(k => `<button class="chip2 ${k === "nenhum" ? "on" : ""}" data-f="${k}">${k}</button>`).join("")}</div></div>
        <div class="cc-sec cc-row"><label style="margin:0">Velocidade</label><select class="input" id="ccsp" style="width:auto">${[0.5, 1, 1.5, 2].map(v => `<option value="${v}" ${v === 1 ? "selected" : ""}>${v}x</option>`).join("")}</select>
          <span class="grow"></span><label class="chk"><input type="checkbox" id="ccmute"> ${I("volumeX", 15)} Sem som</label></div>
      </div></div>
    <div class="cc-foot"><div class="cc-prog" id="ccprog"><i></i></div><span class="muted small" id="ccmsg">O vídeo é gerado aqui no seu ${window.__TAURI__ ? "PC" : "aparelho"} (leva o tempo do trecho).</span><span class="grow"></span>
      <button class="btn ghost" onclick="ccClose(null)">Cancelar</button><button class="btn" id="ccgo" onclick="ccExport()">${I("check", 16)} Pronto</button></div>
  </div></div>`;
  const v = $("#ccv"), cv = $("#ccc");
  v.addEventListener("loadedmetadata", () => {
    CC.dur = v.duration || 0; CC.end = Math.min(CC.dur, 120);
    $("#cce").value = Math.round(CC.end / CC.dur * 1000);
    cv.width = v.videoWidth || 1280; cv.height = v.videoHeight || 720;
    $("#ccinfo").textContent = `${esc(file.name)} · ${v.videoWidth}×${v.videoHeight} · ${fmtSec(CC.dur)}`;
    ccTrimUI(); ccDraw();
  });
  v.addEventListener("seeked", () => ccDraw());
  v.addEventListener("timeupdate", () => { if (!CC?.exporting && v.currentTime >= CC.end) { v.pause(); v.currentTime = CC.start; } });
  v.addEventListener("play", () => { $("#ccplay").innerHTML = I("pause", 22); $("#ccplay").classList.add("playing"); ccLoop(); });
  v.addEventListener("pause", () => { $("#ccplay").innerHTML = I("play", 22); $("#ccplay").classList.remove("playing"); });
  const trim = () => {
    let a = +$("#ccs").value / 1000 * CC.dur, b = +$("#cce").value / 1000 * CC.dur;
    if (b - a < .5) { if (document.activeElement.id === "ccs") a = Math.max(0, b - .5); else b = Math.min(CC.dur, a + .5); }
    CC.start = a; CC.end = b; ccTrimUI(); v.currentTime = document.activeElement.id === "cce" ? b : a;
  };
  $("#ccs").oninput = trim; $("#cce").oninput = trim;
  $("#ccz").oninput = e => { CC.zoom = +e.target.value / 100; $("#cczv").textContent = e.target.value + "%"; ccDraw(); };
  $("#ccsp").onchange = e => { CC.speed = +e.target.value; v.playbackRate = CC.speed; ccTrimUI(); };
  $("#ccmute").onchange = e => { CC.muted = e.target.checked; v.muted = CC.muted; };
  layer.querySelector(".cc-chips").onclick = e => { const b = e.target.closest("[data-f]"); if (!b) return; CC.filter = b.dataset.f; layer.querySelectorAll(".cc-chips .chip2").forEach(x => x.classList.toggle("on", x === b)); ccDraw(); };
  // arrastar: move o ponto do zoom
  const st = $("#ccstage");
  st.addEventListener("pointerdown", e => {
    if (e.target.closest(".cc-text,.cc-play") || CC.zoom <= 1) return;
    const r = cv.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, zx = CC.zx, zy = CC.zy;
    const mv = ev => { CC.zx = Math.min(1, Math.max(0, zx - (ev.clientX - x0) / r.width / CC.zoom)); CC.zy = Math.min(1, Math.max(0, zy - (ev.clientY - y0) / r.height / CC.zoom)); ccDraw(); };
    const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); };
    addEventListener("pointermove", mv); addEventListener("pointerup", up);
  });
  $("#cctxt").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); ccAddText(); } });
}
const fmtSec = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function ccTrimUI() {
  if (!CC) return;
  $("#ccst").textContent = fmtSec(CC.start); $("#ccet").textContent = fmtSec(CC.end);
  const len = (CC.end - CC.start) / CC.speed;
  $("#cclen").textContent = `${fmtSec(len)} de vídeo${len > 120 ? " — máx. 2 min" : ""}`;
  $("#ccgo").disabled = len > 120;
}
function ccToggle() { const v = $("#ccv"); if (!v) return; if (v.paused) { if (v.currentTime < CC.start || v.currentTime >= CC.end - .05) v.currentTime = CC.start; v.play(); } else v.pause(); }
function ccLoop() { const v = $("#ccv"); if (!v || v.paused || !CC) return; ccDraw(); requestAnimationFrame(ccLoop); }
// desenha o quadro atual com zoom, filtro e textos
function ccDraw(ctxOverride, OW, OH) {
  const v = $("#ccv"), cv = $("#ccc"); if (!v || !cv || !CC) return;
  const ctx = ctxOverride || cv.getContext("2d"), W = OW || cv.width, H = OH || cv.height, z = CC.zoom;
  ctx.save(); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  ctx.filter = CC_FILTERS[CC.filter] || "none";
  const sw = W / z, sh = H / z, sx = Math.min(W - sw, Math.max(0, CC.zx * W - sw / 2)), sy = Math.min(H - sh, Math.max(0, CC.zy * H - sh / 2));
  try { ctx.drawImage(v, sx * (v.videoWidth / W), sy * (v.videoHeight / H), sw * (v.videoWidth / W), sh * (v.videoHeight / H), 0, 0, W, H); } catch {}
  ctx.filter = "none";
  for (const t of CC.texts) {
    const size = Math.round(H * t.size / 100);
    ctx.font = `900 ${size}px ${t.font.replace("var(--font)", getComputedStyle(document.documentElement).getPropertyValue("--font") || "sans-serif")}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    const lines = t.text.split("\n");
    lines.forEach((ln, i) => {
      const y = t.y * H + (i - (lines.length - 1) / 2) * size * 1.1;
      if (t.box) { const w = ctx.measureText(ln).width; ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(t.x * W - w / 2 - size * .3, y - size * .62, w + size * .6, size * 1.24); }
      if (t.stroke) { ctx.lineWidth = Math.max(2, size * .12); ctx.strokeStyle = "#000"; ctx.strokeText(ln, t.x * W, y); }
      ctx.fillStyle = t.color; ctx.fillText(ln, t.x * W, y);
    });
  }
  ctx.restore();
  if (!ctxOverride) ccTextHandles();
}
function ccAddText() {
  const inp = $("#cctxt"), text = inp.value.trim(); if (!text) return;
  CC.texts.push({ text, x: .5, y: CC.texts.length ? .2 : .85, size: 8, color: "#ffffff", font: CC_FONTS[0], stroke: true, box: false });
  inp.value = ""; CC.sel = CC.texts.length - 1; ccTextList(); ccDraw();
}
function ccTextList() {
  $("#cctlist").innerHTML = CC.texts.map((t, i) => `<div class="cc-t ${i === CC.sel ? "on" : ""}" onclick="CC.sel=${i};ccTextList();ccDraw()">
    <input class="input" value="${esc(t.text)}" oninput="CC.texts[${i}].text=this.value;ccDraw()">
    <div class="cc-row"><input type="color" value="${t.color}" oninput="CC.texts[${i}].color=this.value;ccDraw()" title="Cor">
      <input type="range" min="3" max="20" value="${t.size}" oninput="CC.texts[${i}].size=+this.value;ccDraw()" title="Tamanho" style="flex:1">
      <select class="input" style="width:auto;padding:4px" onchange="CC.texts[${i}].font=this.value;ccDraw()">${CC_FONTS.map((f, k) => `<option value="${esc(f)}" ${f === t.font ? "selected" : ""}>${["Meme", "App", "Serifa", "Divertida", "Mono"][k]}</option>`).join("")}</select>
      <button class="icon-btn ${t.stroke ? "on" : ""}" title="Contorno" onclick="event.stopPropagation();CC.texts[${i}].stroke=!CC.texts[${i}].stroke;ccTextList();ccDraw()">${I("bold", 14)}</button>
      <button class="icon-btn ${t.box ? "on" : ""}" title="Fundo" onclick="event.stopPropagation();CC.texts[${i}].box=!CC.texts[${i}].box;ccTextList();ccDraw()">${I("highlight", 14)}</button>
      <button class="icon-btn" title="Apagar" onclick="event.stopPropagation();CC.texts.splice(${i},1);CC.sel=-1;ccTextList();ccDraw()">${I("trash", 14)}</button></div></div>`).join("");
}
// alças para arrastar os textos em cima do vídeo
function ccTextHandles() {
  const box = $("#cctexts"), cv = $("#ccc"); if (!box || !cv) return;
  const r = cv.getBoundingClientRect(), pr = box.parentNode.getBoundingClientRect();
  box.innerHTML = CC.texts.map((t, i) => `<div class="cc-text ${i === CC.sel ? "on" : ""}" data-i="${i}" style="left:${r.left - pr.left + t.x * r.width}px;top:${r.top - pr.top + t.y * r.height}px;height:${Math.max(24, t.size / 100 * r.height * 1.2)}px;width:${Math.max(60, t.size / 100 * r.height * t.text.length * .6)}px"></div>`).join("");
  box.querySelectorAll(".cc-text").forEach(el => el.onpointerdown = e => {
    e.preventDefault(); const i = +el.dataset.i; CC.sel = i; ccTextList();
    const mv = ev => { CC.texts[i].x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)); CC.texts[i].y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)); ccDraw(); };
    const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); };
    addEventListener("pointermove", mv); addEventListener("pointerup", up);
  });
}
function ccSkip() { const f = CC.file; f.__cupclip = true; ccClose(f); }
function ccClose(out) {
  if (!CC) return;
  const d = CC.done; CC.cancel = true;
  try { $("#ccv")?.pause(); } catch {}
  URL.revokeObjectURL(CC.url); CC = null; closeLayer(); d?.(out);
}
async function ccExport() {
  const v = $("#ccv"), cv = $("#ccc"); if (!v || CC.exporting) return;
  const edited = CC.start > .05 || CC.end < CC.dur - .05 || CC.zoom > 1 || CC.texts.length || CC.filter !== "nenhum" || CC.speed !== 1 || CC.muted;
  if (!edited) return ccSkip();
  CC.exporting = true; $("#ccgo").disabled = true; layer.querySelector(".cupclip").classList.add("busy");
  // limita a resolução para o arquivo não ficar enorme
  const maxSide = 1280, sc = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight));
  const out = document.createElement("canvas"); out.width = Math.round(v.videoWidth * sc / 2) * 2; out.height = Math.round(v.videoHeight * sc / 2) * 2;
  const octx = out.getContext("2d");
  const stream = out.captureStream(30);
  let actx = null;
  if (!CC.muted) {
    try {
      actx = new AudioContext(); const src = actx.createMediaElementSource(v), dst = actx.createMediaStreamDestination();
      src.connect(dst); dst.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    } catch {}
  }
  const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(m => MediaRecorder.isTypeSupported(m)) || "";
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 });
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const stopped = new Promise(r => (rec.onstop = r));
  v.pause(); v.muted = false; v.playbackRate = CC.speed; v.currentTime = CC.start;
  await new Promise(r => v.addEventListener("seeked", r, { once: true }));
  const prog = $("#ccprog i"), msg = $("#ccmsg");
  const drawOut = () => {
    if (!CC || CC.cancel) return;
    ccDraw(octx, out.width, out.height);
  };
  rec.start(500); await v.play();
  await new Promise(resolve => {
    const tick = () => {
      if (!CC || CC.cancel) return resolve();
      drawOut();
      const p = (v.currentTime - CC.start) / (CC.end - CC.start);
      if (prog) prog.style.width = Math.min(100, p * 100) + "%";
      if (msg) msg.textContent = `Gerando vídeo… ${Math.min(100, Math.round(p * 100))}%`;
      if (v.currentTime >= CC.end || v.ended) return resolve();
      requestAnimationFrame(tick);
    };
    tick();
  });
  v.pause(); rec.stop(); await stopped; try { actx?.close(); } catch {}
  if (!CC) return;
  const type = (mime || "video/webm").split(";")[0], ext = type.includes("mp4") ? "mp4" : "webm";
  const blob = new Blob(chunks, { type });
  if (blob.size > 50 * 1048576) { CC.exporting = false; $("#ccgo").disabled = false; layer.querySelector(".cupclip").classList.remove("busy"); return toast("O vídeo editado passou de 50 MB — corte um trecho menor."); }
  const f = new File([blob], (CC.file.name.replace(/\.[^.]+$/, "") || "video") + "-cupclip." + ext, { type }); f.__cupclip = true;
  toast("Vídeo pronto!"); ccClose(f);
}
