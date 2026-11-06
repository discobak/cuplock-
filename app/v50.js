// Cuplock 5 (Cakepop) — versões com nome de comida, Cuplock Theme Editor e modo manutenção.
"use strict";

// ================================================================ versões: número simples + comida
// Quanto MAIS DOCE a comida, MAIOR a atualização. Salgado = correção pequena.
// (o instalador continua usando N.0.0 por dentro, porque o Windows/Tauri exige esse formato)
const CUP_FOODS = {
  5: ["Cakepop", 9],          // doce — atualização grande
  6: ["Pipoca", 2], 7: ["Brigadeiro", 8], 8: ["Pão de Queijo", 3], 9: ["Churros", 7], 10: ["Coxinha", 2],
  11: ["Pudim", 9], 12: ["Pastel", 3], 13: ["Donut", 8], 14: ["Batata Frita", 1], 15: ["Brownie", 9],
  16: ["Esfiha", 3], 17: ["Macaron", 8], 18: ["Empada", 2], 19: ["Petit Gâteau", 10], 20: ["Pão de Mel", 7],
};
function verNum(v) { return parseInt(String(v || "0").split(".")[0], 10) || 0; }
function verLabel(v) {
  const n = verNum(v);
  if (n < 5) return "Cuplock " + v;                      // versões antigas continuam no formato antigo
  const f = CUP_FOODS[n];
  return f ? `Cuplock ${n} (${f[0]})` : `Cuplock ${n}`;
}
function verSweet(v) { const f = CUP_FOODS[verNum(v)]; return f ? (f[1] >= 6 ? "doce" : "salgada") : ""; }

// ================================================================ cores personalizadas (por cima do tema)
const CC_KEYS = [["--bg0", "Fundo do app"], ["--bg1", "Painéis"], ["--bg3", "Cartões e campos"], ["--fg", "Texto"], ["--fg2", "Texto secundário"], ["--line", "Bordas"]];
function applyCustomColors() {
  const r = document.documentElement.style, c = S.prefs.customColors || {};
  for (const [k] of CC_KEYS) {
    if (c[k] && /^#[0-9a-f]{6}$/i.test(c[k])) { r.setProperty(k, c[k]); if (k === "--bg1") r.setProperty("--bg2", c[k]); }
  }
  document.body.classList.toggle("cc-on", Object.keys(c).length > 0);
}

// ================================================================ linha nas Configurações + aviso que some
function themeEditorRowHtml() {
  const seen = !!S.prefs.teHintSeen;
  return `<div class="te-row">${seen ? "" : `<div class="te-hint">${I("sparkles", 15)} <span><b>Novo:</b> as janelas arrastáveis agora ficam dentro do <b>Cuplock Theme Editor</b> — lá dá para mexer em tudo.</span></div>`}
    <button class="te-open" onclick="openThemeEditor()"><span class="te-ic">${I("palette", 22)}</span><span class="grow"><b>Abrir Cuplock Theme Editor</b><small>Mova as janelas, troque fontes, cores, fundo e muito mais — vendo ao vivo.</small></span>${I("chevR", 18)}</button></div>`;
}

// ================================================================ Cuplock Theme Editor
let TE = null;
const TE_TABS = [["tema", "palette", "Tema"], ["cores", "sun", "Cores"], ["fonte", "type", "Fonte"], ["janelas", "layout", "Janelas"], ["fundo", "image", "Fundo"], ["msgs", "chat", "Mensagens"], ["efeitos", "sparkles", "Efeitos"], ["css", "code", "CSS"]];
function openThemeEditor() {
  if (!S.prefs.teHintSeen) setPref("teHintSeen", true);
  if (S.route.name === "settings") { const back = S.prevRoute && S.prevRoute !== location.pathname ? S.prevRoute : "/friends"; navigate(back); }
  document.getElementById("themeed")?.remove();
  TE = { tab: TE?.tab || "tema", snap: JSON.stringify(S.prefs) };
  const el = Object.assign(document.createElement("div"), { id: "themeed", className: "themeed" });
  const pos = S.prefs.tePos || { x: innerWidth - 380, y: 60 };
  el.style.left = Math.max(8, Math.min(innerWidth - 360, pos.x)) + "px"; el.style.top = Math.max(40, Math.min(innerHeight - 200, pos.y)) + "px";
  document.body.appendChild(el);
  document.body.classList.add("te-open");
  drawTE();
  // arrastar o próprio editor pelo topo
  el.addEventListener("pointerdown", e => {
    if (!e.target.closest(".te-head") || e.target.closest("button")) return;
    const r = el.getBoundingClientRect(), x0 = e.clientX - r.left, y0 = e.clientY - r.top;
    const mv = ev => { el.style.left = Math.max(0, Math.min(innerWidth - 80, ev.clientX - x0)) + "px"; el.style.top = Math.max(0, Math.min(innerHeight - 50, ev.clientY - y0)) + "px"; };
    const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); setPref("tePos", { x: parseInt(el.style.left), y: parseInt(el.style.top) }); };
    addEventListener("pointermove", mv); addEventListener("pointerup", up);
  });
}
function closeThemeEditor(revert) {
  if (revert && TE) { const old = JSON.parse(TE.snap); for (const k of Object.keys(old)) S.prefs[k] = old[k]; setPref("theme", S.prefs.theme); applyLayout?.(); toast("Mudanças desfeitas"); }
  document.getElementById("themeed")?.remove(); document.body.classList.remove("te-open"); TE = null;
}
function teSet(k, v, redraw = false) { setPref(k, v); if (k === "freeLayout" || k === "gap" || k === "expLayout") applyLayout?.(); if (redraw) drawTE(); }
function teColor(k, v) { const c = { ...(S.prefs.customColors || {}) }; if (v) c[k] = v; else delete c[k]; setPref("customColors", c); applyCustomColors(); }
function drawTE() {
  const el = document.getElementById("themeed"); if (!el || !TE) return;
  const p = S.prefs, t = THEMES[p.theme] || THEMES.meianoite;
  const rng = (k, label, min, max, unit = "", step = 1) => `<label class="te-f">${label}<span>${p[k]}${unit}</span></label><input type="range" min="${min}" max="${max}" step="${step}" value="${p[k]}" oninput="teSet('${k}',+this.value);this.previousElementSibling.lastChild.textContent=this.value+'${unit}'">`;
  const tog = (k, label, sub = "") => `<div class="te-tog"><div><b>${label}</b>${sub ? `<small>${sub}</small>` : ""}</div><button class="toggle ${p[k] ? "on" : ""}" onclick="teSet('${k}',!S.prefs.${k},true)"></button></div>`;
  const seg = (k, opts) => `<div class="seg te-seg">${opts.map(([v, n]) => `<button class="${p[k] === v ? "on" : ""}" onclick="teSet('${k}','${v}',true)">${n}</button>`).join("")}</div>`;
  const tabs = {
    tema: `<div class="te-themes">${Object.entries(THEMES).map(([k, th]) => `<button class="te-th ${p.theme === k ? "on" : ""}" onclick="applyThemeKit('${k}');drawTE()" title="${esc(th.name)}"><span style="background:${th.preview || `linear-gradient(135deg,${th.bg0},${th.bg3})`}"></span><small>${esc(th.name)}</small></button>`).join("")}</div>
      <label class="te-f">Destaque</label><div class="te-row2"><input type="color" value="${esc(p.accent)}" oninput="teSet('accent',this.value)"><input type="color" value="${esc(p.accent2)}" oninput="teSet('accent2',this.value)"><span class="te-grad" style="background:linear-gradient(90deg,${esc(p.accent)},${esc(p.accent2)})"></span></div>
      <div class="te-row2" style="margin-top:12px"><button class="btn sm" onclick="saveMyTheme()">${I("save", 14)} Salvar como meu tema</button></div>
      ${(p.savedThemes || []).length ? `<label class="te-f">Meus temas</label><div class="te-chips">${p.savedThemes.map((s, i) => `<button class="chip2" onclick="applyMyTheme(${i});drawTE()">${esc(s.name)}</button>`).join("")}</div>` : ""}`,
    cores: `<p class="te-note">Cores por cima do tema "${esc(t.name)}". Deixe em branco para usar a do tema.</p>
      ${CC_KEYS.map(([k, n]) => { const cur = (p.customColors || {})[k], base = getComputedStyle(document.documentElement).getPropertyValue(k).trim(); return `<div class="te-color"><span>${n}</span><input type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(cur || "") ? cur : (/^#[0-9a-f]{6}$/i.test(base) ? base : "#888888"))}" oninput="teColor('${k}',this.value)">${cur ? `<button class="icon-btn" title="Voltar à cor do tema" onclick="teColor('${k}',null);applyPrefs();drawTE()">${I("rotate", 14)}</button>` : `<span class="te-def">tema</span>`}</div>`; }).join("")}
      <button class="btn ghost sm" style="margin-top:10px" onclick="setPref('customColors',{});applyPrefs();drawTE()">Voltar todas às cores do tema</button>`,
    fonte: `<div class="te-fonts">${Object.entries(FONTS).map(([k, [n]]) => `<button class="te-font ${p.font === k ? "on" : ""}" onclick="teSet('font','${k}',true)" style="font-family:'${n}',system-ui"><b>Aa</b><small>${esc(n)}</small></button>`).join("")}</div>
      ${rng("fontSize", "Tamanho do texto", 12, 20, "px")}
      <div class="te-preview" style="font-size:${p.fontSize}px">O rato roeu a roupa do rei de Roma. <b>Negrito</b> · <i>itálico</i> · <code>código</code></div>`,
    janelas: `${tog("freeLayout", "Mover janelas livremente", "Arraste pela alça no topo de cada janela e redimensione no canto. Fica salvo.")}
      ${p.freeLayout ? `<button class="btn ghost sm" onclick="resetLayout();drawTE()">${I("layout", 14)} Reorganizar janelas</button>` : ""}
      ${rng("gap", "Espaço entre janelas", 0, 24, "px")}${rng("radius", "Arredondamento", 0, 30, "px")}
      ${tog("glass", "Efeito vidro", "Janelas translúcidas com desfoque")}${p.glass ? rng("panelOpacity", "Opacidade das janelas", 30, 100, "%") : ""}
      ${tog("expLayout", "Tema Experimental", "Servidores no topo e conversa centralizada (beta)")}`,
    fundo: `<div class="te-walls">${Object.entries(WALLPAPERS).map(([k, w]) => `<button class="te-wall ${p.wallpaper === k ? "on" : ""}" onclick="teSet('wallpaper','${k}',true)" title="${esc(w.name)}"><span style="background:${k === "imagem" && p.wallUrl ? `url('${esc(p.wallUrl)}') center/cover` : (() => { try { return w.css(p, t); } catch { return t.bg0; } })()}"></span><small>${esc(w.name)}</small></button>`).join("")}</div>
      <button class="btn sm" style="margin:10px 0" onclick="uploadWallpaper().then(()=>setTimeout(drawTE,800))">${I("folder", 14)} Imagem ou GIF do PC</button>
      ${rng("wallBlur", "Desfoque", 0, 30, "px")}${rng("wallDim", "Escurecer", 0, 80, "%")}${tog("wallAnim", "Fundo animado")}`,
    msgs: `<label class="te-f">Estilo das mensagens</label>${seg("msgStyle", [["bubbles", "Balões"], ["classic", "Clássico"], ["compact", "Compacto"]])}
      <label class="te-f">Formato das fotos</label>${seg("avatarShape", [["squircle", "Arredondado"], ["round", "Círculo"]])}
      ${tog("time24", "Relógio 24 horas")}`,
    efeitos: `${tog("appCursor", "Cursor do Cuplock", "Seta e mãozinha nas cores do tema")}
      ${tog("reduceMotion", "Reduzir movimento", "Menos animações")}
      <label class="te-f">Desempenho</label>${seg("perfMode", [["auto", "Automático"], ["on", "Leve"], ["off", "Completo"]])}
      ${tog("splashSound", "Som de abertura")}`,
    css: `<p class="te-note">CSS próprio, aplicado por cima de tudo. Ex.: <code>.bubble{border-radius:4px}</code></p>
      <textarea class="input te-css" spellcheck="false" oninput="clearTimeout(window.__teCss);window.__teCss=setTimeout(()=>teSet('customCss',this.value),300)">${esc(p.customCss || "")}</textarea>`,
  };
  el.innerHTML = `<div class="te-head">${cupLogo(22)}<b>Cuplock Theme Editor</b><span class="grow"></span>
      <button class="icon-btn" title="Desfazer tudo desde que abriu" onclick="closeThemeEditor(true)">${I("rotate", 16)}</button>
      <button class="icon-btn" title="Fechar (fica salvo)" onclick="closeThemeEditor()">${I("x", 17)}</button></div>
    <div class="te-tabs">${TE_TABS.map(([k, ic, n]) => `<button class="${TE.tab === k ? "on" : ""}" onclick="TE.tab='${k}';drawTE()" title="${n}">${I(ic, 16)}<span>${n}</span></button>`).join("")}</div>
    <div class="te-body">${tabs[TE.tab]}</div>
    <div class="te-foot"><span class="muted small">Tudo salva na hora.</span><span class="grow"></span><button class="btn sm" onclick="closeThemeEditor()">Pronto</button></div>`;
}
// as cores próprias e os detalhes do perfil se aplicam depois do tema
(() => {
  const _ap = applyPrefs;
  applyPrefs = (...a) => { const r = _ap(...a); applyCustomColors(); return r; };
  const _nav = navigate;
  navigate = (to, ...a) => { if (location.pathname !== to) S.prevRoute = location.pathname; return _nav(to, ...a); };
  applyPrefs();
})();
addEventListener("keydown", e => { if (e.key === "Escape" && document.getElementById("themeed") && !document.querySelector(".modal-bg")) closeThemeEditor(); });

// ================================================================ modo manutenção (OWNER)
let MAINT = null;
async function loadMaintenance() {
  try { const r = await q(sb.from("app_settings").select("value").eq("key", "maintenance").maybeSingle()); applyMaintenance(r?.value || null); } catch {}
}
function applyMaintenance(v) {
  MAINT = v && v.on ? v : null;
  const staff = isStaff?.() || isOwner?.();
  let el = document.getElementById("maint");
  document.getElementById("maintbar")?.remove();
  if (!MAINT) { el?.remove(); return; }
  if (staff) {
    document.body.insertAdjacentHTML("beforeend", `<div id="maintbar" class="maintbar">${I("wrench", 15)} Cuplock em manutenção para todo mundo — você vê porque é da equipe.${isOwner() ? ` <button class="btn sm" onclick="setMaintenance(false)">Encerrar manutenção</button>` : ""}</div>`);
    el?.remove(); return;
  }
  if (!el) { el = Object.assign(document.createElement("div"), { id: "maint", className: "maint" }); document.body.appendChild(el); }
  el.innerHTML = `<div class="maint-card"><div class="maint-ic">${cupLogo(72)}<span>${I("wrench", 26)}</span></div>
    <h1>Cuplock em manutenção</h1><p>${esc(MAINT.msg || "Estamos deixando o Cuplock melhor. Volte daqui a pouco!")}</p>
    ${MAINT.until ? `<p class="muted small">Previsão de volta: ${esc(new Date(MAINT.until).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }))}</p>` : ""}
    <div class="maint-dots"><i></i><i></i><i></i></div><p class="muted small">Esta tela some sozinha quando terminar.</p></div>`;
}
async function setMaintenance(on) {
  if (!isOwner()) return;
  let value = { on: false };
  if (on) {
    const msg = await uiPrompt("Mensagem para todo mundo:", "Estamos fazendo uma atualização rápida. Já voltamos!", { title: "Ativar manutenção", ok: "Ativar" });
    if (msg === null) return;
    const mins = await uiPrompt("Quanto tempo mais ou menos? (minutos, ou deixe vazio)", "30", { title: "Previsão", ok: "Pronto" });
    value = { on: true, msg: msg.trim().slice(0, 300), until: +mins > 0 ? new Date(Date.now() + +mins * 60e3).toISOString() : null, by: uid(), at: new Date().toISOString() };
  }
  try { await q(sb.from("app_settings").upsert({ key: "maintenance", value, updated_at: new Date().toISOString() })); applyMaintenance(value); toast(on ? "Manutenção ativada para todos" : "Manutenção encerrada"); if (S.route.name === "settings") renderSettings(); }
  catch (e) { toast(e.message); }
}
let maintCh;
function connectMaint() {
  if (maintCh) sb.removeChannel(maintCh);
  maintCh = sb.channel("cuplock-maint")
    .on("postgres_changes", { event: "*", schema: "public", table: "app_settings", filter: "key=eq.maintenance" }, p => applyMaintenance(p.new?.value || null))
    .subscribe();
}
setInterval(() => { if (S.session) loadMaintenance(); }, 120000);
(() => {
  const _boot = bootstrap;
  bootstrap = async (...a) => { const r = await _boot(...a); loadMaintenance(); connectMaint(); return r; };
  const _rs = renderSettings;
  renderSettings = (...a) => {
    const r = _rs(...a), sec = document.querySelector(".settings section");
    if (sec && settingsTab === "about" && isOwner() && !sec.querySelector("#maintrow"))
      sec.insertAdjacentHTML("beforeend", `<div class="row" id="maintrow"><div class="l"><b>${I("wrench", 15)} Modo manutenção (OWNER)</b><span>Mostra uma tela de manutenção para todo mundo (menos a equipe) até você encerrar.</span></div>
        <button class="btn sm ${MAINT ? "" : "danger-btn"}" onclick="setMaintenance(${MAINT ? "false" : "true"})">${MAINT ? "Encerrar manutenção" : "Ativar manutenção"}</button></div>`);
    return r;
  };
  if (S.loaded) { loadMaintenance(); connectMaint(); }
})();
