// Cuplock 3.7 — barra de título própria (app de PC) e visualizador de fotos
// ---------------------------------------------------------------- barra de título
const TWIN = (() => { try { return window.__TAURI__?.window?.getCurrentWindow?.() || null; } catch { return null; } })();
function initTitlebar() {
  if (!TWIN && !/[?&]tb=1/.test(location.search)) return;
  document.body.classList.add("has-tb");
  const bar = document.createElement("div");
  bar.id = "titlebar";
  bar.innerHTML = `<div class="tb-nav"><button title="Voltar" onclick="history.back()">${I("chevL", 16)}</button><button title="Avançar" onclick="history.forward()">${I("chevR", 16)}</button></div>
    <div class="tb-title" data-tauri-drag-region><span class="tb-ic"></span><span class="tb-t" data-tauri-drag-region></span></div>
    <div class="tb-acts"><button title="Anúncios" onclick="typeof openAnnouncements==='function'&&openAnnouncements()">${I("inbox", 16)}</button><button title="Atalhos e ajuda" onclick="helpModal()">${I("help", 16)}</button>
    ${TWIN ? `<span class="tb-sep"></span><button class="win" title="Minimizar" onclick="TWIN.minimize()">${I("winMin", 15)}</button><button class="win" id="tbmax" title="Maximizar" onclick="TWIN.toggleMaximize()">${I("winMax", 13)}</button><button class="win close" title="Fechar" onclick="TWIN.close()">${I("x", 16)}</button>` : ""}</div>`;
  bar.setAttribute("data-tauri-drag-region", "");
  document.body.prepend(bar);
  const upd = () => {
    const t = document.title.replace(/\s+—\s+Cuplock$/, "") || "Cuplock";
    bar.querySelector(".tb-t").textContent = t === "Cuplock" ? "Cuplock" : t;
    const sid = S.route?.params?.sid, s = sid && S.servers.find(x => x.id === sid);
    bar.querySelector(".tb-ic").innerHTML = s ? (okUrl(s.icon_url) ? srvIcon(s) : `<span class="tb-emo">${esc(s.icon)}</span>`) : cupLogo(16);
  };
  new MutationObserver(upd).observe(document.querySelector("title"), { childList: true, characterData: true, subtree: true });
  upd();
  if (TWIN) {
    const mx = async () => { try { const m = await TWIN.isMaximized(); document.body.classList.toggle("maxed", m); const b = document.getElementById("tbmax"); if (b) { b.innerHTML = I(m ? "winRestore" : "winMax", 13); b.title = m ? "Restaurar" : "Maximizar"; } } catch {} };
    addEventListener("resize", mx); mx();
  }
}
function helpModal() {
  const k = (a, b) => `<div class="row" style="padding:8px 0"><span>${b}</span><kbd>${a}</kbd></div>`;
  modal(h`<h2>${I("help", 20)} Atalhos</h2>${k("Ctrl K", "Buscar / ir para")}${k("Enter", "Enviar mensagem")}${k("Shift Enter", "Nova linha")}${k("Esc", "Fechar janela / cancelar resposta")}${k("← →", "Trocar foto no visualizador")}${k("Roda do mouse", "Zoom no visualizador")}
    <div class="acts"><button class="btn" onclick="closeLayer()">Ok</button></div>`);
}
if (document.readyState === "loading") addEventListener("DOMContentLoaded", initTitlebar); else initTitlebar();

// ---------------------------------------------------------------- visualizador de fotos
let LB = null;
function openImage(url, name) {
  const imgs = [...document.querySelectorAll(".att img, .pmedia img")].map(i => ({ url: i.getAttribute("src"), name: i.getAttribute("alt") || "imagem" }));
  const seen = new Set(), list = imgs.filter(x => x.url && !seen.has(x.url) && seen.add(x.url));
  let i = list.findIndex(x => x.url === url);
  if (i < 0) { list.splice(0, list.length, { url, name }); i = 0; }
  LB = { list, i, s: 1, x: 0, y: 0, r: 0 };
  layer.innerHTML = `<div class="lightbox v2" id="lb" tabindex="-1">
    <div class="lb-top"><div class="lb-name"><b id="lbn"></b><small id="lbc"></small></div><div class="grow"></div>
      <button title="Diminuir (-)" onclick="lbZoom(1/1.25)">${I("zoomOut", 18)}</button><span id="lbz" class="lb-z" onclick="lbReset()" title="Tamanho original (0)">100%</span><button title="Aumentar (+)" onclick="lbZoom(1.25)">${I("zoomIn", 18)}</button>
      <button title="Girar (R)" onclick="LB.r=(LB.r+90)%360;lbApply()">${I("rotate", 18)}</button><span class="lb-sep"></span>
      <button title="Baixar" onclick="lbDownload()">${I("download", 18)}</button><button title="Copiar link" onclick="copy(LB.list[LB.i].url)">${I("file", 18)}</button><button title="Abrir no navegador" onclick="window.open(LB.list[LB.i].url,'_blank')">${I("external", 18)}</button>
      <button title="Fechar (Esc)" class="lb-x" onclick="closeLayer()">${I("x", 20)}</button></div>
    <div class="lb-stage" id="lbs"><img id="lbi" alt="" draggable="false"></div>
    ${list.length > 1 ? `<button class="lb-arrow l" onclick="lbGo(-1)">${I("chevL", 26)}</button><button class="lb-arrow r" onclick="lbGo(1)">${I("chevR", 26)}</button>
    <div class="lb-thumbs">${list.map((x, j) => `<img src="${esc(x.url)}" data-j="${j}" onclick="lbGo(${j}-LB.i)" alt="">`).join("")}</div>` : ""}</div>`;
  const st = document.getElementById("lbs"), img = document.getElementById("lbi");
  st.addEventListener("click", e => { if (e.target === st && LB.s <= 1) closeLayer(); });
  st.addEventListener("wheel", e => {
    e.preventDefault();
    const f = e.deltaY < 0 ? 1.15 : 1 / 1.15, r = st.getBoundingClientRect();
    const cx = e.clientX - r.left - r.width / 2, cy = e.clientY - r.top - r.height / 2;
    const ns = Math.min(8, Math.max(1, LB.s * f)), k = ns / LB.s;
    LB.x = cx - (cx - LB.x) * k; LB.y = cy - (cy - LB.y) * k; LB.s = ns; if (ns === 1) LB.x = LB.y = 0; lbApply();
  }, { passive: false });
  img.addEventListener("dblclick", e => { if (LB.s > 1) lbReset(); else { const r = st.getBoundingClientRect(); LB.s = 2.5; LB.x = -(e.clientX - r.left - r.width / 2) * 1.5; LB.y = -(e.clientY - r.top - r.height / 2) * 1.5; lbApply(); } });
  img.addEventListener("pointerdown", e => {
    if (LB.s <= 1) return; e.preventDefault(); img.setPointerCapture(e.pointerId);
    const x0 = e.clientX - LB.x, y0 = e.clientY - LB.y; img.classList.add("grab");
    const mv = ev => { LB.x = ev.clientX - x0; LB.y = ev.clientY - y0; lbApply(); };
    const up = () => { img.removeEventListener("pointermove", mv); img.removeEventListener("pointerup", up); img.classList.remove("grab"); };
    img.addEventListener("pointermove", mv); img.addEventListener("pointerup", up);
  });
  // deslizar no celular
  let tx = null;
  st.addEventListener("touchstart", e => { tx = LB.s === 1 && e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  st.addEventListener("touchend", e => { if (tx == null) return; const d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 60) lbGo(d < 0 ? 1 : -1); tx = null; });
  lbShow();
}
function lbShow() {
  const it = LB.list[LB.i], img = document.getElementById("lbi"); if (!img) return;
  LB.s = 1; LB.x = LB.y = 0; LB.r = 0;
  img.classList.add("loading"); img.onload = () => img.classList.remove("loading"); img.src = it.url;
  document.getElementById("lbn").textContent = it.name;
  document.getElementById("lbc").textContent = LB.list.length > 1 ? `${LB.i + 1} de ${LB.list.length}` : "";
  document.querySelectorAll(".lb-thumbs img").forEach(t => t.classList.toggle("on", +t.dataset.j === LB.i));
  document.querySelector(".lb-thumbs img.on")?.scrollIntoView({ inline: "center", block: "nearest" });
  lbApply();
}
function lbApply() {
  const img = document.getElementById("lbi"); if (!img) return;
  img.style.transform = `translate(${LB.x}px,${LB.y}px) scale(${LB.s}) rotate(${LB.r}deg)`;
  img.classList.toggle("zoomed", LB.s > 1);
  const z = document.getElementById("lbz"); if (z) z.textContent = Math.round(LB.s * 100) + "%";
}
function lbZoom(f) { LB.s = Math.min(8, Math.max(1, LB.s * f)); if (LB.s === 1) LB.x = LB.y = 0; else { LB.x *= f; LB.y *= f; } lbApply(); }
function lbReset() { LB.s = 1; LB.x = LB.y = 0; lbApply(); }
function lbGo(d) { if (!LB || LB.list.length < 2) return; LB.i = (LB.i + d + LB.list.length) % LB.list.length; lbShow(); }
async function lbDownload() {
  const it = LB.list[LB.i];
  try {
    const blob = await (await fetch(it.url)).blob();
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: (it.name || "imagem").replace(/[\\/:*?"<>|]/g, "_") });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast("Baixando…");
  } catch { window.open(it.url, "_blank"); }
}
addEventListener("keydown", e => {
  if (!LB || !document.getElementById("lb")) return;
  if (e.key === "ArrowRight") lbGo(1); else if (e.key === "ArrowLeft") lbGo(-1);
  else if (e.key === "+" || e.key === "=") lbZoom(1.25); else if (e.key === "-") lbZoom(1 / 1.25);
  else if (e.key === "0") lbReset(); else if (e.key.toLowerCase() === "r" && !e.ctrlKey) { LB.r = (LB.r + 90) % 360; lbApply(); }
});
