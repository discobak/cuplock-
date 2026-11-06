// Cuplock 5 (Cakepop) — versões com nome de comida, Cuplock Theme Editor e modo manutenção.
"use strict";

// ================================================================ versões: número simples + comida
// Quanto MAIS DOCE a comida, MAIOR a atualização. Salgado = correção pequena.
// (o instalador continua usando N.0.0 por dentro, porque o Windows/Tauri exige esse formato)
const CUP_FOODS = {
  5: ["Cakepop", 9],          // doce — atualização grande
  "5.5": ["Energy Bar", 5],   // meio doce — atualização média
  6: ["Pipoca", 2], 7: ["Brigadeiro", 8], 8: ["Pão de Queijo", 3], 9: ["Churros", 7], 10: ["Coxinha", 2],
  11: ["Pudim", 9], 12: ["Pastel", 3], 13: ["Donut", 8], 14: ["Batata Frita", 1], 15: ["Brownie", 9],
  16: ["Esfiha", 3], 17: ["Macaron", 8], 18: ["Empada", 2], 19: ["Petit Gâteau", 10], 20: ["Pão de Mel", 7],
};
function verNum(v) { return parseInt(String(v || "0").split(".")[0], 10) || 0; }
// "5.5.0" -> "5.5"; "6.0.0" -> "6"
function verKey(v) { const [a, b] = String(v || "0").split("."); return +b ? `${+a}.${+b}` : String(+a); }
function verLabel(v) {
  const n = verNum(v);
  if (n < 5) return "Cuplock " + v;                      // versões antigas continuam no formato antigo
  const k = verKey(v), f = CUP_FOODS[k] || CUP_FOODS[+k];
  return f ? `Cuplock ${k} (${f[0]})` : `Cuplock ${k}`;
}
function verSweet(v) { const k = verKey(v), f = CUP_FOODS[k] || CUP_FOODS[+k]; return f ? (f[1] >= 6 ? "doce" : f[1] >= 4 ? "meio doce" : "salgada") : ""; }

// ================================================================ cores personalizadas (por cima do tema)
const CC_KEYS = [["--bg0", "Fundo do app"], ["--bg1", "Painéis"], ["--bg3", "Cartões e campos"], ["--fg", "Texto"], ["--fg2", "Texto secundário"], ["--line", "Bordas"]];
// fontes importadas, botões, balões, escala, sombra, velocidade das animações e JS do tema
function applyThemeExtras() {
  const p = S.prefs, r = document.documentElement.style;
  let st = document.getElementById("te-extra"); st ||= document.head.appendChild(Object.assign(document.createElement("style"), { id: "te-extra" }));
  const fonts = (p.customFonts || []).map(f => f.css ? "" : `@font-face{font-family:"${f.name.replace(/"/g, "")}";src:url("${f.url}");font-display:swap}`).join("");
  (p.customFonts || []).forEach(f => { if (f.css && !document.querySelector(`link[data-gf="${CSS.escape(f.name)}"]`)) document.head.appendChild(Object.assign(document.createElement("link"), { rel: "stylesheet", href: f.css })).dataset.gf = f.name; });
  const cf = /^cf(\d+)$/.exec(p.font || ""), cfont = cf && p.customFonts?.[+cf[1]];
  st.textContent = fonts + `
    ${cfont ? `:root{--font:"${cfont.name.replace(/"/g, "")}",system-ui,sans-serif!important}` : ""}
    ${p.letterSp ? `body{letter-spacing:${+p.letterSp}px}` : ""}
    ${p.fontWeight && p.fontWeight !== 400 ? `.text,.bubble,.item .grow{font-weight:${+p.fontWeight}}` : ""}
    ${p.btnRadius != null && p.btnRadius !== "" ? `.btn,.icon-btn,.seg button,.chip2{border-radius:${+p.btnRadius}px!important}` : ""}
    ${p.myBubble ? `.bgroup.mine .bubble{background:${p.myBubble}!important}` : ""}
    ${p.otherBubble ? `.bgroup:not(.mine) .bubble{background:${p.otherBubble}!important}` : ""}
    ${p.linkColor ? `.text a,.bubble a{color:${p.linkColor}!important}` : ""}
    ${p.sideW ? `#app:not(.free)>.side{width:${+p.sideW}px!important;flex-basis:${+p.sideW}px!important}` : ""}
    ${p.uiScale && p.uiScale !== 100 ? `#app{zoom:${p.uiScale / 100}}` : ""}
    ${p.shadow != null && p.shadow !== "" ? `.isle{box-shadow:0 ${p.shadow / 5}px ${p.shadow / 2}px rgba(0,0,0,${p.shadow / 220})!important}` : ""}
    ${p.animSpeed && p.animSpeed !== 100 && !document.body.classList.contains("perf") ? `*,*::before,*::after{animation-duration:calc(var(--ad,1s) * ${100 / p.animSpeed})}` : ""}`;
  runThemeJs();
}
let lastJs = null;
function runThemeJs(force) {
  const p = S.prefs, code = p.customJsOn ? (p.customJs || "") : "";
  if (!force && code === lastJs) return; lastJs = code;
  if (!code.trim()) return;
  try { new Function("S", "toast", code)(S, toast); const m = document.getElementById("tejsmsg"); if (m) m.textContent = "Rodou sem erro ✓"; }
  catch (e) { const m = document.getElementById("tejsmsg"); if (m) m.textContent = "Erro: " + e.message; else console.warn("JS do tema:", e); }
}
async function importGoogleFont(name) {
  name = String(name || "").trim().replace(/[^\w \-]/g, "").slice(0, 40); if (!name) return;
  const css = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@400;600;700;800&display=swap`;
  const list = [...(S.prefs.customFonts || []).filter(f => f.name !== name), { name, css }].slice(-12);
  setPref("customFonts", list); setPref("font", "cf" + (list.length - 1)); applyThemeExtras(); drawTE(); toast(`Fonte "${name}" adicionada`);
}
async function importFontFile() {
  const [f] = await pickFile(".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"); if (!f) return;
  if (f.size > 8 * 1048576) return toast("Fonte até 8 MB.");
  toast("Enviando fonte…");
  try {
    const url = await uploadTo("attachments", f);
    const name = f.name.replace(/\.[^.]+$/, "").replace(/[^\w \-]/g, " ").trim().slice(0, 40) || "Minha fonte";
    const list = [...(S.prefs.customFonts || []), { name, url }].slice(-12);
    setPref("customFonts", list); setPref("font", "cf" + (list.length - 1)); applyThemeExtras(); drawTE();
  } catch (e) { toast(e.message); }
}
function removeFont(i) { const l = [...(S.prefs.customFonts || [])]; l.splice(i, 1); if (S.prefs.font === "cf" + i) setPref("font", "jakarta"); setPref("customFonts", l); applyThemeExtras(); drawTE(); }
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
const TE_TABS = [["tema", "palette", "Tema"], ["cores", "sun", "Cores"], ["fonte", "type", "Fontes"], ["janelas", "layout", "Janelas"], ["fundo", "image", "Fundo"], ["msgs", "chat", "Mensagens"], ["botoes", "circle", "Botões"], ["efeitos", "sparkles", "Efeitos"], ["css", "code", "CSS"], ["js", "bot", "JS"]];
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
    fonte: `<div class="te-fonts">${Object.entries(FONTS).map(([k, [n]]) => `<button class="te-font ${p.font === k ? "on" : ""}" onclick="teSet('font','${k}',true)" style="font-family:'${n}',system-ui"><b>Aa</b><small>${esc(n)}</small></button>`).join("")}
        ${(p.customFonts || []).map((f, i) => `<button class="te-font ${p.font === "cf" + i ? "on" : ""}" onclick="teSet('font','cf${i}',true)" oncontextmenu="event.preventDefault();removeFont(${i})" style="font-family:'${esc(f.name)}',system-ui" title="Clique direito para tirar"><b>Aa</b><small>${esc(f.name)}</small></button>`).join("")}</div>
      <label class="te-f">Importar fonte</label>
      <div class="te-row2"><input class="input" id="tegf" placeholder="Nome no Google Fonts (ex: Pacifico)"><button class="btn sm" onclick="importGoogleFont($('#tegf').value)">Adicionar</button></div>
      <button class="btn ghost sm" style="margin-top:8px" onclick="importFontFile()">${I("upload", 14)} Arquivo de fonte (.ttf .otf .woff .woff2)</button>
      ${rng("letterSp", "Espaçamento das letras", -2, 4, "px", .5)}${rng("fontWeight", "Peso do texto", 300, 700, "", 100)}
      ${rng("fontSize", "Tamanho do texto", 12, 20, "px")}
      <div class="te-preview" style="font-size:${p.fontSize}px">O rato roeu a roupa do rei de Roma. <b>Negrito</b> · <i>itálico</i> · <code>código</code></div>`,
    janelas: `<p class="te-note">As janelas já estão livres: arraste pela alça no topo e puxe qualquer lado ou canto para mudar o tamanho.</p>
      <button class="btn ghost sm" onclick="resetLayout();drawTE()">${I("layout", 14)} Reorganizar janelas</button>
      ${rng("sideW", "Largura da lista lateral", 200, 380, "px")}${rng("uiScale", "Tamanho da interface", 80, 125, "%")}
      ${rng("gap", "Espaço entre janelas", 0, 24, "px")}${rng("radius", "Arredondamento", 0, 30, "px")}
      ${tog("glass", "Efeito vidro", "Janelas translúcidas com desfoque")}${p.glass ? rng("panelOpacity", "Opacidade das janelas", 30, 100, "%") : ""}
      ${tog("expLayout", "Tema Experimental", "Servidores no topo e conversa centralizada (beta)")}`,
    fundo: `<div class="te-walls">${Object.entries(WALLPAPERS).map(([k, w]) => `<button class="te-wall ${p.wallpaper === k ? "on" : ""}" onclick="teSet('wallpaper','${k}',true)" title="${esc(w.name)}"><span style="background:${k === "imagem" && p.wallUrl ? `url('${esc(p.wallUrl)}') center/cover` : (() => { try { return w.css(p, t); } catch { return t.bg0; } })()}"></span><small>${esc(w.name)}</small></button>`).join("")}</div>
      <button class="btn sm" style="margin:10px 0" onclick="uploadWallpaper().then(()=>setTimeout(drawTE,800))">${I("folder", 14)} Imagem ou GIF do PC</button>
      ${rng("wallBlur", "Desfoque", 0, 30, "px")}${rng("wallDim", "Escurecer", 0, 80, "%")}${tog("wallAnim", "Fundo animado")}`,
    msgs: `<label class="te-f">Estilo das mensagens</label>${seg("msgStyle", [["bubbles", "Balões"], ["classic", "Clássico"], ["compact", "Compacto"]])}
      <label class="te-f">Formato das fotos</label>${seg("avatarShape", [["squircle", "Arredondado"], ["round", "Círculo"]])}
      ${tog("time24", "Relógio 24 horas")}`,
    botoes: `${rng("btnRadius", "Arredondamento dos botões", 0, 24, "px")}
      <label class="te-f">Cor do seu balão de mensagem</label><div class="te-row2"><input type="color" value="${esc(p.myBubble || p.accent)}" oninput="teSet('myBubble',this.value)"><button class="btn ghost sm" onclick="teSet('myBubble','',true)">Usar o destaque</button></div>
      <label class="te-f">Cor dos balões dos outros</label><div class="te-row2"><input type="color" value="${esc(p.otherBubble || "#2a2535")}" oninput="teSet('otherBubble',this.value)"><button class="btn ghost sm" onclick="teSet('otherBubble','',true)">Padrão do tema</button></div>
      <label class="te-f">Cor dos links</label><div class="te-row2"><input type="color" value="${esc(p.linkColor || p.accent)}" oninput="teSet('linkColor',this.value)"><button class="btn ghost sm" onclick="teSet('linkColor','',true)">Padrão</button></div>
      ${rng("shadow", "Sombra das janelas", 0, 100, "%")}`,
    efeitos: `${tog("appCursor", "Cursor do Cuplock", "Seta e mãozinha nas cores do tema")}
      ${rng("animSpeed", "Velocidade das animações", 50, 200, "%")}
      ${tog("reduceMotion", "Reduzir movimento", "Menos animações")}
      <label class="te-f">Desempenho</label>${seg("perfMode", [["auto", "Automático"], ["on", "Leve"], ["off", "Completo"]])}
      ${tog("splashSound", "Som de abertura")}`,
    css: `<p class="te-note">CSS próprio, aplicado por cima de tudo. Ex.: <code>.bubble{border-radius:4px}</code></p>
      <textarea class="input te-css" spellcheck="false" oninput="clearTimeout(window.__teCss);window.__teCss=setTimeout(()=>teSet('customCss',this.value),300)">${esc(p.customCss || "")}</textarea>`,
    js: `<p class="te-note"><b>JavaScript do tema</b> — roda só no seu Cuplock, toda vez que o tema é aplicado. Use para efeitos (ex: mudar cores com o horário). <b>Nunca cole código que alguém te mandou</b>: ele teria acesso à sua conta.</p>
      ${tog("customJsOn", "Ligar o JS do tema")}
      <textarea class="input te-css" id="tejs" spellcheck="false" placeholder="// exemplo: fundo muda com a hora\nconst h = new Date().getHours();\nif (h >= 18) document.body.style.filter = 'saturate(1.2)';">${esc(p.customJs || "")}</textarea>
      <div class="te-row2" style="margin-top:8px"><button class="btn sm" onclick="setPref('customJs',$('#tejs').value);runThemeJs(true)">Salvar e rodar</button><span class="muted small" id="tejsmsg"></span></div>`,
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
  // 5.5: janelas sempre livres (a opção sumiu) — menos no Tema Experimental, que tem layout próprio
  applyPrefs = (...a) => { S.prefs.freeLayout = !S.prefs.expLayout; const r = _ap(...a); applyCustomColors(); applyThemeExtras(); return r; };
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
  const owner = isOwner?.();
  let el = document.getElementById("maint");
  document.getElementById("maintbar")?.remove();
  if (!MAINT) { el?.remove(); return; }
  if (owner && !window.__maintPreview) {
    document.body.insertAdjacentHTML("beforeend", `<div id="maintbar" class="maintbar">${I("wrench", 15)} Cuplock em manutenção para todo mundo (inclusive a STAFF). <button class="btn ghost sm" onclick="previewMaintenance()">Pré-visualizar</button><button class="btn sm" onclick="setMaintenance(false)">Encerrar</button></div>`);
    el?.remove(); return;
  }
  if (!el) { el = Object.assign(document.createElement("div"), { id: "maint", className: "maint" }); document.body.appendChild(el); }
  el.innerHTML = `<div class="maint-card"><div class="maint-ic">${cupLogo(72)}<span>${I("wrench", 26)}</span></div>
    <h1>Cuplock em manutenção</h1><p>${esc(MAINT.msg || "Estamos deixando o Cuplock melhor. Volte daqui a pouco!")}</p>
    ${MAINT.until ? `<p class="muted small">Previsão de volta: ${esc(new Date(MAINT.until).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }))}</p>` : ""}
    <div class="maint-dots"><i></i><i></i><i></i></div><p class="muted small">Esta tela some sozinha quando terminar.</p>
    ${owner ? `<button class="btn" onclick="window.__maintPreview=false;applyMaintenance(MAINT)">Sair da pré-visualização</button>` : ""}</div>`;
}
function previewMaintenance(v) { window.__maintPreview = true; applyMaintenance(v || MAINT || { on: true, msg: "Estamos fazendo uma atualização rápida. Já voltamos!" }); }
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
      sec.insertAdjacentHTML("beforeend", `<div class="row" id="maintrow"><div class="l"><b>${I("wrench", 15)} Modo manutenção (OWNER)</b><span>Mostra uma tela de manutenção para todo mundo, inclusive a STAFF, até você encerrar. Você só vê se pré-visualizar.</span></div>
        <div style="display:flex;gap:6px"><button class="btn ghost sm" onclick="previewMaintenance()">Pré-visualizar</button><button class="btn sm ${MAINT ? "" : "danger-btn"}" onclick="setMaintenance(${MAINT ? "false" : "true"})">${MAINT ? "Encerrar" : "Ativar"}</button></div></div>`);
    return r;
  };
  if (S.loaded) { loadMaintenance(); connectMaint(); }
})();
