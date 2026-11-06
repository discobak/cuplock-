// Cuplock 3.9 — CLAUT (atualizações), termos, sem "coisas de navegador", dicas estilizadas,
// modo desempenho e layout experimental.
"use strict";

// ================================================================ diálogos próprios (no lugar de confirm/prompt/alert)
function uiConfirm(msg, { ok = "Confirmar", danger = /apagar|excluir|sair|tirar|banir/i.test(msg), title = "Tem certeza?" } = {}) {
  return new Promise(res => {
    const prev = layer.innerHTML ? null : null;
    modal(h`<h2>${esc(title)}</h2><p class="sub" style="white-space:pre-wrap">${esc(msg)}</p>
      <div class="acts"><button class="btn ghost" id="ucNo">Cancelar</button><button class="btn ${danger ? "danger-btn" : ""}" id="ucOk">${esc(ok)}</button></div>`, m => {
      const done = v => { closeLayer(); res(v); };
      $("#ucNo", m).onclick = () => done(false); $("#ucOk", m).onclick = () => done(true);
      m.parentNode.onmousedown = e => { if (e.target === m.parentNode) done(false); };
      setTimeout(() => $("#ucOk", m)?.focus(), 30);
      m.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); done(false); } });
    });
  });
}
function uiPrompt(msg, def = "", { title = "", ok = "Ok" } = {}) {
  return new Promise(res => {
    modal(h`${title ? `<h2>${esc(title)}</h2>` : ""}<p class="sub" style="white-space:pre-wrap">${esc(msg)}</p><input class="input" id="upIn" value="${esc(def)}" maxlength="80">
      <div class="acts"><button class="btn ghost" id="upNo">Cancelar</button><button class="btn" id="upOk">${esc(ok)}</button></div>`, m => {
      const inp = $("#upIn", m), done = v => { closeLayer(); res(v); };
      $("#upNo", m).onclick = () => done(null); $("#upOk", m).onclick = () => done(inp.value);
      inp.addEventListener("keydown", e => { if (e.key === "Enter") done(inp.value); if (e.key === "Escape") { e.stopPropagation(); done(null); } });
      setTimeout(() => { inp.focus(); inp.select(); }, 30);
    });
  });
}
window.alert = m => toast(String(m));

// ================================================================ esconder coisas de navegador
const IN_APP = !!window.__TAURI__ || /CuplockAndroid\//.test(navigator.userAgent);
document.addEventListener("contextmenu", e => {
  if (e.defaultPrevented) return;            // menus próprios do Cuplock já cuidaram
  e.preventDefault();
  const t = e.target.closest?.("input:not([type=checkbox]):not([type=range]):not([type=color]),textarea");
  const sel = String(getSelection?.() || "");
  if (!t && !sel) return;
  showCtx(e, `${t ? `<button onclick="clipCut()">${I("scissors", 15)} Recortar</button>` : ""}<button onclick="clipCopy()">${I("file", 15)} Copiar</button>
    ${t ? `<button onclick="clipPaste()">${I("paperclip", 15)} Colar</button><button onclick="clipSelectAll()">${I("check", 15)} Selecionar tudo</button>` : ""}`);
  window.__ctxTarget = t;
});
async function clipCopy() { const t = window.__ctxTarget, s = t ? t.value.slice(t.selectionStart, t.selectionEnd) : String(getSelection()); closeLayer(); try { await navigator.clipboard.writeText(s); } catch { document.execCommand("copy"); } t?.focus(); }
async function clipCut() { const t = window.__ctxTarget; closeLayer(); if (!t) return; const a = t.selectionStart, b = t.selectionEnd; try { await navigator.clipboard.writeText(t.value.slice(a, b)); } catch {} t.focus(); t.setRangeText("", a, b, "end"); t.dispatchEvent(new Event("input", { bubbles: true })); }
async function clipPaste() { const t = window.__ctxTarget; closeLayer(); if (!t) return; t.focus(); try { const s = await navigator.clipboard.readText(); t.setRangeText(s, t.selectionStart, t.selectionEnd, "end"); t.dispatchEvent(new Event("input", { bubbles: true })); } catch { toast("Use Ctrl+V para colar."); } }
function clipSelectAll() { const t = window.__ctxTarget; closeLayer(); t?.focus(); t?.select(); }
// teclas do navegador (atualizar, imprimir, salvar, ver código, zoom…)
addEventListener("keydown", e => {
  const k = e.key.toLowerCase(), c = e.ctrlKey || e.metaKey;
  const block = k === "f5" || k === "f3" || k === "f7" || (IN_APP && k === "f12") ||
    (c && ["r", "p", "s", "u", "j", "h", "g", "n", "t", "o", "+", "=", "-", "0"].includes(k) && !(k === "0" && document.getElementById("lb"))) ||
    (IN_APP && c && e.shiftKey && ["i", "j", "c", "r", "delete"].includes(k));
  if (block && !(c && k === "s" && e.target.closest?.(".bot-ed"))) e.preventDefault();
}, true);
addEventListener("wheel", e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
// sem arrastar imagens/links para fora (o que é arrastável no Cuplock continua)
document.addEventListener("dragstart", e => { if ((e.target.tagName === "IMG" || e.target.tagName === "A") && !e.target.closest("[draggable=true]")) e.preventDefault(); });

// ================================================================ dicas estilizadas (no lugar do title do navegador)
let tipEl = null, tipFor = null, tipT = null;
function hideTip() { clearTimeout(tipT); tipFor = null; tipEl?.classList.remove("on"); }
document.addEventListener("mouseover", e => {
  const t = e.target.closest?.("[title],[data-tt]"); if (!t || t === tipFor) return;
  if (t.hasAttribute("title")) { const v = t.getAttribute("title"); t.removeAttribute("title"); if (v) t.dataset.tt = v; }
  const text = t.dataset.tt; if (!text || t.closest(".pill[data-tip]")) return;
  tipFor = t; clearTimeout(tipT);
  tipT = setTimeout(() => {
    if (tipFor !== t || !t.isConnected) return;
    tipEl ||= document.body.appendChild(Object.assign(document.createElement("div"), { className: "ctip" }));
    tipEl.textContent = text; tipEl.classList.remove("below");
    const r = t.getBoundingClientRect(), w = tipEl.offsetWidth, hgt = tipEl.offsetHeight;
    let x = Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2)), y = r.top - hgt - 8;
    if (y < 40) { y = r.bottom + 8; tipEl.classList.add("below"); }
    tipEl.style.left = x + "px"; tipEl.style.top = y + "px"; tipEl.classList.add("on");
  }, 350);
});
document.addEventListener("mouseout", e => { if (tipFor && !tipFor.contains(e.relatedTarget)) hideTip(); });
addEventListener("mousedown", hideTip, true); addEventListener("scroll", hideTip, true);

// ================================================================ CLAUT — Cuplock Auto Updating Tool
showUpdateCard = function () {
  if (!updateInfo || document.getElementById("updcard")) return;
  const v = updateInfo.version, auto = S.prefs.autoUpdate !== false && !call && !IS_ANDROID;
  if (window.__clautNotified !== v) { window.__clautNotified = v; desktopNotify("CLAUT — atualização do Cuplock", `${verLabel(v)} está disponível.`, { force: true }); playNotify?.(); }
  const el = Object.assign(document.createElement("div"), { id: "updcard", className: "claut" });
  el.innerHTML = `<div class="claut-card">
    <div class="claut-top"><span class="claut-badge">CLAUT</span><small>Cuplock Auto Updating Tool</small><span class="grow"></span><button class="icon-btn" title="Agora não" onclick="clautLater()">${I("x", 16)}</button></div>
    <div class="claut-body"><div class="claut-logo">${cupLogo(64)}<i></i></div>
      <div><h2>${esc(verLabel(v))} chegou!</h2><p class="muted">Você está no ${esc(verLabel(VERSION))}. ${updateInfo.size ? fmtBytes(updateInfo.size) + " · " : ""}leva menos de 1 minuto${IS_ANDROID ? "" : " e o app abre de novo sozinho"}.</p></div></div>
    ${auto ? `<div class="claut-bar"><i id="clautbar"></i></div><p class="small muted" style="margin:6px 0 0">Atualizando em <b id="updcount">15</b> s…</p>` : ""}
    <div class="acts"><button class="btn ghost" onclick="clautLater()">Depois</button><button class="btn" onclick="installUpdate()">${I("download", 16)} ${IS_ANDROID ? "Baixar" : "Atualizar agora"}</button></div></div>`;
  document.body.appendChild(el);
  if (auto) {
    let n = 15; const bar = document.getElementById("clautbar");
    requestAnimationFrame(() => { if (bar) { bar.style.transition = "width 15s linear"; bar.style.width = "100%"; } });
    window.__updc = setInterval(() => { n--; const c = document.getElementById("updcount"); if (c) c.textContent = n; if (n <= 0) { clearInterval(window.__updc); if (!call) installUpdate(); } }, 1000);
  }
};
function clautLater() { clearInterval(window.__updc); document.getElementById("updcard")?.remove(); toast("O CLAUT avisa de novo mais tarde."); setTimeout(() => checkUpdate(false), 30 * 60e3); }
let clautCh;
function connectClaut() {
  if (clautCh) sb.removeChannel(clautCh);
  clautCh = sb.channel("cuplock-claut")
    .on("postgres_changes", { event: "*", schema: "public", table: "app_settings", filter: "key=eq.release" }, () => setTimeout(() => checkUpdate(false), 1500))
    .subscribe();
}
// confere também a cada 10 min (se o aviso instantâneo não estiver ligado no banco)
setInterval(() => { if (S.session && !document.getElementById("updcard")) checkUpdate(false); }, 10 * 60e3);
async function clautPing() {
  try { await q(sb.from("app_settings").upsert({ key: "release", value: { name: "manual", at: new Date().toISOString() }, updated_at: new Date().toISOString() })); toast("Todo mundo com o app aberto vai ver a atualização agora."); }
  catch (e) { toast(e.message); }
}

// ================================================================ termos de uso e privacidade
const TERMS_VERSION = 1;
const TERMS_TXT = `
## Termos de Uso do Cuplock
-# Última atualização: novembro de 2026

**1. O que é.** O Cuplock é um app de mensagens, chamadas e feed para conversar com amigos e comunidades. Ao usar, você concorda com estes termos.

**2. Sua conta.** Você precisa ter **13 anos ou mais**. Cuide da sua senha: o que for feito na sua conta é responsabilidade sua. Uma pessoa, uma conta principal.

**3. O que não pode.**
- Assédio, ameaças, discurso de ódio ou perseguição.
- Conteúdo sexual envolvendo menores — denunciamos às autoridades.
- Conteúdo sexual explícito ou violento fora de lugares próprios para isso, e nunca para quem não quer ver.
- Golpes, spam, vírus, phishing ou se passar por outra pessoa (inclusive pela equipe do Cuplock).
- Divulgar dados pessoais de alguém sem permissão.
- Qualquer coisa ilegal no Brasil.
- Usar bots para spam ou para contornar banimentos.

**4. Seu conteúdo.** O que você manda continua sendo seu. Você permite que o Cuplock guarde e mostre esse conteúdo para quem você escolheu (servidor, DM, feed), só para o app funcionar.

**5. Moderação.** A equipe (STAFF e OWNER) pode apagar conteúdo, suspender ou banir contas que quebrem estas regras, com ou sem aviso.

**6. Bots e servidores.** Quem cria um servidor ou bot é responsável pelo que acontece nele.

**7. Sem garantia.** O Cuplock é oferecido "como está". Pode ter falhas, ficar fora do ar ou mudar funções. Faça backup do que for importante.

**8. Mudanças.** Se estes termos mudarem, o app avisa e pede para você aceitar de novo.

## Política de Privacidade

**O que guardamos:** nome de usuário, e-mail, foto e perfil; mensagens, posts, reações e arquivos que você envia; servidores e amigos; preferências do app; quando você aceitou estes termos.

**O que o app usa enquanto está aberto:** status online, plataforma (PC, celular ou navegador), versão do app e, se você ligar, o jogo ou app que está usando (detectado no seu PC — a lista de programas não sai do seu computador, só o nome do jogo reconhecido).

**Chamadas:** voz, vídeo e tela vão direto entre as pessoas da call (ou por um servidor TURN que só repassa os dados). Não gravamos chamadas.

**Onde fica:** no Supabase (banco de dados e arquivos). Fotos e arquivos enviados ficam em links públicos difíceis de adivinhar — não mande nada que não possa vazar.

**Quem vê:** quem está na conversa, servidor ou feed que você escolheu. A equipe pode ver conteúdo denunciado ou para moderação. Contas invisíveis enviam um sinal de "online" que só o OWNER vê, para moderação.

**GIFs:** a busca de GIFs vai para o GIPHY, que recebe o termo pesquisado.

**Não vendemos seus dados** e não usamos anúncios.

**Seus direitos (LGPD):** você pode pedir para ver, corrigir ou apagar seus dados falando com a equipe do Cuplock. Apagar a conta remove perfil, mensagens e arquivos ligados a ela.

**Dúvidas:** fale com a STAFF ou o OWNER pelo próprio app.
`;
function termsHtml() { return `<div class="terms-txt">${md(TERMS_TXT.trim())}</div>`; }
function checkTerms() {
  if (!S.me || (S.me.terms_version || 0) >= TERMS_VERSION || document.getElementById("termsgate")) return;
  const el = Object.assign(document.createElement("div"), { id: "termsgate", className: "terms-gate" });
  el.innerHTML = `<div class="terms-card"><div class="terms-head">${cupLogo(40)}<div><h2>${(S.me.terms_version || 0) ? "Os termos mudaram" : "Antes de continuar"}</h2><p class="muted small">Leia e aceite os Termos de Uso e a Política de Privacidade do Cuplock.</p></div></div>
    <div class="terms-scroll" id="termsscroll">${termsHtml()}</div>
    <label class="chk terms-chk"><input type="checkbox" id="termsok"> Li e aceito os Termos de Uso e a Política de Privacidade</label>
    <div class="acts"><button class="btn ghost" onclick="logout()">Sair</button><button class="btn" id="termsbtn" disabled onclick="acceptTerms(this)">Aceitar e continuar</button></div></div>`;
  document.body.appendChild(el);
  $("#termsok").onchange = e => ($("#termsbtn").disabled = !e.target.checked);
}
async function acceptTerms(btn) {
  btn.disabled = true;
  try { await q(sb.rpc("accept_terms", { v: TERMS_VERSION })); S.me.terms_version = TERMS_VERSION; document.getElementById("termsgate")?.remove(); toast("Obrigado! Bem-vindo ao Cuplock."); }
  catch (e) { btn.disabled = false; toast(e.message); }
}
function openTerms() { modal(h`<h2>Termos e privacidade</h2><div class="terms-scroll">${termsHtml()}</div><div class="acts"><button class="btn" onclick="closeLayer()">Fechar</button></div>`); }

// ================================================================ modo desempenho (PCs mais fracos)
const WEAK_PC = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
function perfOn() { const m = S.prefs.perfMode || "auto"; return m === "on" || (m === "auto" && WEAK_PC); }
function applyPerf() {
  const on = perfOn();
  document.body.classList.toggle("perf", on);
  if (on) { setBubbles?.(false); setParticles?.(null); document.getElementById("wall")?.classList.remove("anim"); }
}
// junta várias mensagens chegando no mesmo instante num único desenho
(() => {
  const _am = appendMessage; let pend = null, last;
  appendMessage = m => { last = m; if (pend) return; pend = requestAnimationFrame(() => { pend = null; _am(last); }); };
  const _ap = applyPrefs;
  applyPrefs = (...a) => { const r = _ap(...a); applyPerf(); applyExp(); return r; };
})();

// ================================================================ layout experimental
function applyExp() {
  const on = !!S.prefs.expLayout;
  document.body.classList.toggle("exp", on);
  if (on && S.prefs.freeLayout && typeof applyLayout === "function") applyLayout();
}

// ================================================================ ganchos
(() => {
  const _rs = renderSettings;
  renderSettings = (...a) => {
    const r = _rs(...a), sec = document.querySelector(".settings section");
    if (sec && settingsTab === "appearance" && !sec.querySelector("#exprow")) {
      const p = S.prefs, mode = p.perfMode || "auto";
      sec.querySelector(".mythemes")?.insertAdjacentHTML("afterend", `
        <div class="card exp-card" id="exprow"><div class="row" style="border:0;padding:0"><div class="l"><b>${I("sparkles", 16)} Tema Experimental <span class="beta">Teste beta, provavelmente não fica</span></b><span>Mostra um layout novo: servidores no topo, conversa centralizada e caixa de mensagem flutuante. Dá para desligar quando quiser.</span></div>
          <button class="toggle ${p.expLayout ? "on" : ""}" onclick="setPref('expLayout',!S.prefs.expLayout);renderSettings()"></button></div></div>
        <div class="row"><div class="l"><b>Desempenho</b><span>Desliga vidro, animações e efeitos pesados. ${WEAK_PC ? "Seu aparelho parece mais fraco — no automático já fica ligado." : "No automático liga sozinho em aparelhos mais fracos."}</span></div>
          <div class="seg">${[["auto", "Automático"], ["on", "Leve"], ["off", "Completo"]].map(([v, n]) => `<button class="${mode === v ? "on" : ""}" onclick="setPref('perfMode','${v}');renderSettings()">${n}</button>`).join("")}</div></div>`);
    }
    if (sec && settingsTab === "about" && !sec.querySelector("#termslink")) {
      sec.insertAdjacentHTML("beforeend", `<div class="row" id="termslink"><div class="l"><b>Termos de Uso e Privacidade</b><span>${S.me?.terms_version ? "Você aceitou estes termos." : ""}</span></div><button class="btn ghost sm" onclick="openTerms()">Ler</button></div>
        <div class="row"><div class="l"><b>CLAUT</b><span>Cuplock Auto Updating Tool — procura atualizações e avisa na hora.</span></div><button class="btn ghost sm" onclick="checkUpdate(true)">Procurar agora</button></div>
        ${isOwner() ? `<div class="row"><div class="l"><b>Avisar atualização (OWNER)</b><span>Depois de subir o instalador, faz todo mundo com o app aberto ver o CLAUT na hora.</span></div><button class="btn sm" onclick="clautPing()">Avisar todos</button></div>` : ""}`);
    }
    return r;
  };
  const _cb = connectBff;
  connectBff = (...a) => { _cb(...a); connectClaut(); };
  const _boot = bootstrap;
  bootstrap = async (...a) => { const r = await _boot(...a); setTimeout(checkTerms, 300); return r; };
  applyPrefs();
  if (S.loaded) { setTimeout(checkTerms, 300); if (typeof presenceCh !== "undefined" && presenceCh) connectClaut(); }
})();
