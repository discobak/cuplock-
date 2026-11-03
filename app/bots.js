// Cuplock 3.7 — modo desenvolvedor + bots com blocos (flow)
// Os bots rodam no app do dono: enquanto ele estiver com o Cuplock aberto, o bot responde.
const DEV_PASS = "cuplock3";
const BOT_START = Date.now();
let MY_BOTS = [];
const botRate = {};

function unlockDev(inp) {
  if ((inp.value || "").trim() !== DEV_PASS) { inp.value = ""; inp.classList.add("shake"); setTimeout(() => inp.classList.remove("shake"), 400); return toast("Senha errada"); }
  setPref("devMode", true); toast("Modo desenvolvedor ativado"); renderSettings(); renderChrome();
}

// ---------------------------------------------------------------- bots como "usuários" nas mensagens
function regBot(b) {
  S.users["bot:" + b.id] = { id: "bot:" + b.id, username: b.name, color: b.color, avatar_url: b.avatar_url, isBot: true, botOwner: b.owner, status: "online", bio: "" };
}
async function ensureBots(ids) {
  const miss = [...new Set(ids)].filter(i => !S.users["bot:" + i]);
  if (!miss.length) return;
  try { (await q(sb.from("user_bots").select("id, owner, name, color, avatar_url").in("id", miss))).forEach(regBot); } catch {}
  miss.forEach(i => { if (!S.users["bot:" + i]) S.users["bot:" + i] = { id: "bot:" + i, username: "Bot apagado", color: "#666", isBot: true, status: "offline" }; });
}
async function loadMyBots() {
  try { MY_BOTS = await q(sb.from("user_bots").select("*").eq("owner", uid()).order("created_at")); MY_BOTS.forEach(regBot); } catch { MY_BOTS = []; }
}

// ---------------------------------------------------------------- motor
const BLOCKS = {
  send:   { name: "Enviar mensagem", cat: "msg", ic: "chat", fields: [["text", "area", "Olá {user}!"]] },
  reply:  { name: "Responder à mensagem", cat: "msg", ic: "reply", fields: [["text", "area", "Oi, {user}!"]] },
  random: { name: "Enviar uma aleatória", cat: "msg", ic: "sparkles", fields: [["options", "area", "Sim\nNão\nTalvez"]], hint: "Uma opção por linha" },
  wait:   { name: "Esperar", cat: "ctl", ic: "circle", fields: [["s", "num", "1"]], suffix: "segundos" },
  onlyif: { name: "Só continua se", cat: "ctl", ic: "check", fields: [["left", "text", "{args}"], ["op", "sel", "contém", ["contém", "é igual a", "não contém", "está vazio", "não está vazio"]], ["right", "text", "oi"]] },
  setvar: { name: "Guardar variável", cat: "var", ic: "pin", fields: [["name", "text", "nome"], ["value", "text", "{random:1-100}"]], hint: "Use depois como {nome}" },
  card:   { name: "Enviar cartão", cat: "msg", ic: "layout", fields: [["title", "text", "Título"], ["text", "area", "Texto do cartão com **formatação**"]], hint: "Sai com título grande e texto embaixo" },
  gif:    { name: "Enviar GIF", cat: "msg", ic: "gif", fields: [["q", "text", "gato dançando"]], hint: "Pesquisa no GIPHY e manda um dos primeiros" },
  pick:   { name: "Sortear membro", cat: "var", ic: "users", fields: [["name", "text", "sorteado"]], hint: "Guarda o nome de alguém do servidor em {sorteado}" },
  choose: { name: "Escolher palavra", cat: "var", ic: "sparkles", fields: [["name", "text", "fruta"], ["options", "area", "maçã\nbanana\nuva"]], hint: "Guarda uma das opções (uma por linha) em {fruta}" },
  counter:{ name: "Somar no contador", cat: "var", ic: "up", fields: [["name", "text", "usos"]], hint: "Conta pra sempre. Use {contador:usos}" },
};
const TRIGGERS = { command: "Comando !", exact: "Mensagem igual a", contains: "Mensagem contém", starts: "Mensagem começa com" };
const BOT_VARS = ["{user}", "{args}", "{arg1}", "{arg2}", "{canal}", "{servidor}", "{membros}", "{random:1-6}", "{calc:2*(3+4)}", "{hora}", "{data}", "{contador:nome}"];

function matchFlow(f, text) {
  const v = (f.trigger?.value || "").trim().toLowerCase(), t = text.trim();
  if (!v || f.off) return null;
  if (f.trigger.type === "command") {
    const [cmd, ...rest] = t.split(/\s+/);
    if (cmd.toLowerCase() !== "!" + v.replace(/^!/, "")) return null;
    return { args: rest.join(" "), argv: rest };
  }
  if (f.trigger.type === "exact") return t.toLowerCase() === v ? { args: "", argv: [] } : null;
  if (f.trigger.type === "contains") return t.toLowerCase().includes(v) ? { args: t, argv: t.split(/\s+/) } : null;
  if (f.trigger.type === "starts") { if (!t.toLowerCase().startsWith(v)) return null; const rest = t.slice(v.length).trim(); return { args: rest, argv: rest ? rest.split(/\s+/) : [] }; }
  return null;
}
function botCalc(expr) {
  if (!/^[\d\s+\-*/%().,]{1,60}$/.test(expr)) return "?";
  try { const r = Function(`"use strict";return (${expr.replace(/,/g, ".")})`)(); return Number.isFinite(r) ? String(Math.round(r * 1e6) / 1e6).replace(".", ",") : "?"; } catch { return "?"; }
}
function fillVars(s, ctx) {
  s = String(s ?? "").replace(/\{calc:([^}]{1,60})\}/gi, (_, e) => botCalc(fillVars(e, ctx)));
  return String(s ?? "").replace(/\{([a-z0-9_:\-]+)\}/gi, (all, k) => {
    const kl = k.toLowerCase();
    if (kl === "user") return ctx.user; if (kl === "args") return ctx.args; if (kl === "canal") return ctx.canal; if (kl === "servidor") return ctx.servidor;
    if (/^arg\d$/.test(kl)) return ctx.argv[+kl.slice(3) - 1] || "";
    if (kl === "hora") return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (kl === "data") return new Date().toLocaleDateString("pt-BR");
    let m = kl.match(/^random:(-?\d+)-(-?\d+)$/); if (m) { const a = +m[1], b = +m[2]; return String(Math.floor(Math.random() * (b - a + 1)) + Math.min(a, b)); }
    m = kl.match(/^contador:(.+)$/); if (m) return String(ctx.bot.counters?.[m[1]] || 0);
    if (kl === "membros") return String(ctx.members?.length || 1);
    if (kl in ctx.vars) return ctx.vars[kl];
    return all;
  });
}
async function runFlow(bot, flow, ctx, out) {
  let steps = 0;
  for (const b of flow.blocks || []) {
    if (++steps > 25) break;
    const F = k => fillVars(b[k], ctx);
    if (b.t === "send") await out.send(F("text").slice(0, 2000));
    else if (b.t === "reply") await out.send(F("text").slice(0, 2000), true);
    else if (b.t === "card") { const t = F("title").replace(/\n/g, " ").slice(0, 80), x = F("text"); await out.send(`## ${t}\n${x}`.slice(0, 2000)); }
    else if (b.t === "gif") { try { const l = await gifSearch(F("q"), 8); if (l.length) await out.send(l[Math.floor(Math.random() * l.length)].url); else await out.send("_(nenhum GIF encontrado)_"); } catch { await out.send("_(GIFs não configurados)_"); } }
    else if (b.t === "pick") { const ms = ctx.members || []; const id = ms[Math.floor(Math.random() * ms.length)]; ctx.vars[String(b.name || "sorteado").toLowerCase()] = id ? dname(S.users[id]) : ctx.user; }
    else if (b.t === "choose") { const o = String(b.options || "").split("\n").map(x => x.trim()).filter(Boolean); ctx.vars[String(b.name || "escolha").toLowerCase()] = o.length ? fillVars(o[Math.floor(Math.random() * o.length)], ctx) : ""; }
    else if (b.t === "random") { const o = String(b.options || "").split("\n").map(x => x.trim()).filter(Boolean); if (o.length) await out.send(fillVars(o[Math.floor(Math.random() * o.length)], ctx)); }
    else if (b.t === "wait") await new Promise(r => setTimeout(r, Math.min(Math.max(+b.s || 0, 0), 30) * 1000));
    else if (b.t === "setvar") ctx.vars[String(b.name || "").toLowerCase()] = F("value");
    else if (b.t === "counter") { const n = String(b.name || "usos"); bot.counters = bot.counters || {}; bot.counters[n] = (bot.counters[n] || 0) + 1; out.counted?.(); }
    else if (b.t === "onlyif") {
      const L = F("left").toLowerCase(), R = F("right").toLowerCase();
      const ok = b.op === "é igual a" ? L === R : b.op === "não contém" ? !L.includes(R) : b.op === "está vazio" ? !L.trim() : b.op === "não está vazio" ? !!L.trim() : L.includes(R);
      if (!ok) break;
    }
  }
}
function botCtx(bot, m, hit) {
  const s = S.servers.find(x => x.channels.some(c => c.id === m.channel));
  const c = s?.channels.find(x => x.id === m.channel);
  return { bot, user: dname(S.users[m.author]), args: hit.args, argv: hit.argv, canal: c ? "#" + c.name : "DM", servidor: s?.name || "DM", members: s ? s.members : m.channel.slice(3).split(":"), vars: {} };
}
function botCanTalk(bot, m) {
  if (m.channel.startsWith("dm:")) return (bot.servers || []).includes("00000000-0000-0000-0000-000000000000");
  const s = S.servers.find(x => x.channels.some(c => c.id === m.channel));
  return !!s && s.owner === uid() && (bot.servers || []).includes(s.id);
}
async function botsOnMessage(m) {
  if (!MY_BOTS.length || !m.content || String(m.author).startsWith("bot:") || m.ts < BOT_START) return;
  for (const bot of MY_BOTS) {
    if (!bot.enabled || !botCanTalk(bot, m)) continue;
    for (const flow of bot.flows || []) {
      const hit = matchFlow(flow, m.content); if (!hit) continue;
      const now = Date.now(), r = (botRate[bot.id] ||= []).filter(t => now - t < 10000);
      if (r.length >= 5) { botRate[bot.id] = r; continue; }
      r.push(now); botRate[bot.id] = r;
      try { await q(sb.from("bot_runs").insert({ bot_id: bot.id, message_id: m.id })); } catch { continue; } // outra aba já respondeu
      const ctx = botCtx(bot, m, hit);
      let counted = false;
      runFlow(bot, flow, ctx, {
        send: (text, reply) => text.trim() && q(sb.from("messages").insert({ ...cidFilter(m.channel), content: text, bot_id: bot.id, reply_to: reply ? m.id : null })).catch(e => console.warn("bot", e.message)),
        counted: () => { counted = true; },
      }).then(() => counted && q(sb.from("user_bots").update({ flows: bot.flows }).eq("id", bot.id)).catch(() => {}));
      break;
    }
  }
}

// ---------------------------------------------------------------- editor
let BOTED = null; // { bot, dirty }
const DM_SCOPE = "00000000-0000-0000-0000-000000000000";
function renderBots(main) {
  document.title = "Bots — Cuplock";
  if (!S.prefs.devMode) { main.innerHTML = `<div class="empty"><div class="e">${I("lock", 48)}</div>Ative o modo desenvolvedor em Configurações → Desenvolvedor.<a class="btn sm" href="/settings/dev" data-link>Abrir</a></div>`; return; }
  const id = S.route.params.bid;
  if (id && (!BOTED || BOTED.bot.id !== id)) {
    const b = id === "novo" ? { id: "novo", name: "Meu bot", color: "#5865f2", avatar_url: null, enabled: true, servers: [], flows: [{ trigger: { type: "command", value: "oi" }, blocks: [{ t: "reply", text: "Oi, {user}! 👋" }] }] } : MY_BOTS.find(x => x.id === id);
    if (!b) { navigate("/bots", true); return; }
    BOTED = { bot: JSON.parse(JSON.stringify(b)), dirty: id === "novo", log: [] };
  }
  if (!id) BOTED = null;
  main.innerHTML = h`<div class="top">${navBtn()}<span class="hash">${I("wrench", 20)}</span><h1>${BOTED ? esc(BOTED.bot.name) : "Meus bots"}</h1>
    ${BOTED ? `<div style="margin-left:auto;display:flex;gap:8px"><a class="btn ghost sm" href="/bots" data-link>${I("back", 15)} Voltar</a><button class="btn sm" id="botSave" ${BOTED.dirty ? "" : "disabled"} onclick="saveBot()">${I("check", 15)} Salvar</button></div>` : ""}</div>
    <div class="content" id="botpage">${BOTED ? botEditorHtml() : botListHtml()}</div>`;
  if (BOTED) bindBotEditor();
}
function botListHtml() {
  return h`<div class="page">
    <div class="card bot-intro"><div class="hero-ic">${I("sparkles", 26)}</div><div class="grow"><b>Crie bots montando blocos</b><div class="muted small">Escolha um gatilho (ex: <code>!dado</code>) e empilhe ações. O bot responde nos seus servidores enquanto seu Cuplock estiver aberto.</div></div>
    ${MY_BOTS.length < 5 ? `<a class="btn" href="/bots/novo" data-link>+ Novo bot</a>` : ""}</div>
    ${MY_BOTS.length ? `<div class="bot-grid">${MY_BOTS.map(b => `<a class="card bot-card" href="/bots/${b.id}" data-link>${avatar(S.users["bot:" + b.id], "lg", false)}<div class="grow"><b>${esc(b.name)} <span class="rtag bot">BOT</span></b><div class="muted small">${(b.flows || []).length} comando${(b.flows || []).length === 1 ? "" : "s"} · ${b.enabled ? "ligado" : "desligado"}</div></div>${I("edit", 17)}</a>`).join("")}</div>`
      : `<div class="empty"><div class="e">${I("ghost", 48)}</div>Você ainda não tem bots.</div>`}</div>`;
}
function fieldHtml(fi, bi, [k, kind, def, opts], b) {
  const v = b[k] ?? def, d = `data-f="${fi}" data-b="${bi}" data-k="${k}"`;
  if (kind === "area") return `<textarea class="input blk-in" rows="${Math.min(5, String(v).split("\n").length)}" ${d}>${esc(v)}</textarea>`;
  if (kind === "num") return `<input class="input blk-in num" type="number" min="0" max="30" ${d} value="${esc(v)}">`;
  if (kind === "sel") return `<select class="input blk-in sel" ${d}>${opts.map(o => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select>`;
  return `<input class="input blk-in" ${d} value="${esc(v)}">`;
}
function botEditorHtml() {
  const b = BOTED.bot, owned = S.servers.filter(s => s.owner === uid());
  return h`<div class="bot-ed">
    <div class="bot-main">
      <div class="card bot-meta">
        <div class="bot-av" style="background:${okUrl(b.avatar_url) ? `url('${b.avatar_url}') center/cover,` : ""}${esc(b.color)}" onclick="botAvatar()" title="Trocar foto">${okUrl(b.avatar_url) ? "" : initials(b.name)}<span>${I("image", 14)}</span></div>
        <div class="grow"><label class="f">Nome do bot</label><input class="input" id="bname" maxlength="32" value="${esc(b.name)}"></div>
        <div><label class="f">Cor</label><input type="color" id="bcolor" value="${esc(b.color)}" class="colorpick"></div>
        <div><label class="f">Ligado</label><button class="toggle ${b.enabled ? "on" : ""}" onclick="BOTED.bot.enabled=!BOTED.bot.enabled;botDirty(true)"></button></div>
      </div>
      <div class="card" style="padding:14px 16px"><b>Onde o bot responde</b><div class="muted small" style="margin-bottom:8px">Só nos servidores que você é dono.</div>
        <div class="bot-scope">${owned.map(s => `<label class="chk"><input type="checkbox" data-scope="${s.id}" ${b.servers.includes(s.id) ? "checked" : ""}> ${okUrl(s.icon_url) ? srvIcon(s, "tiny") : esc(s.icon)} ${esc(s.name)}</label>`).join("") || `<span class="muted small">Você ainda não é dono de nenhum servidor.</span>`}
        <label class="chk"><input type="checkbox" data-scope="${DM_SCOPE}" ${b.servers.includes(DM_SCOPE) ? "checked" : ""}> ${I("chat", 14)} Minhas mensagens diretas</label></div></div>
      ${b.flows.map((f, fi) => h`<div class="flow ${f.off ? "off" : ""}">
        <div class="blk trig"><span class="blk-h">${I("play", 13)} QUANDO</span>
          <select class="input blk-in sel" data-f="${fi}" data-k="trigger.type">${Object.entries(TRIGGERS).map(([k, n]) => `<option value="${k}" ${f.trigger.type === k ? "selected" : ""}>${n}</option>`).join("")}</select>
          <input class="input blk-in" style="max-width:200px" data-f="${fi}" data-k="trigger.value" value="${esc(f.trigger.value)}" placeholder="${f.trigger.type === "command" ? "dado" : "texto"}">
          <span class="grow"></span>
          <button class="icon-btn" title="${f.off ? "Ligar" : "Desligar"} comando" onclick="BOTED.bot.flows[${fi}].off=!BOTED.bot.flows[${fi}].off;botDirty(true)">${I(f.off ? "circle" : "check", 15)}</button>
          <button class="icon-btn" title="Apagar comando" onclick="uiConfirm('Apagar este comando?').then(ok=>{if(ok){BOTED.bot.flows.splice(${fi},1);botDirty(true)}})">${I("trash", 15)}</button></div>
        <div class="blk-stack" data-f="${fi}">
          ${(f.blocks || []).map((bl, bi) => { const B = BLOCKS[bl.t]; if (!B) return ""; return `<div class="blk ${B.cat}" draggable="true" data-f="${fi}" data-b="${bi}">
            <span class="blk-grip" title="Arraste para mover">${I("move", 13)}</span><span class="blk-h">${I(B.ic, 13)} ${B.name}</span>
            ${B.fields.map(fd => fieldHtml(fi, bi, fd, bl)).join("")}${B.suffix ? `<span class="blk-s">${B.suffix}</span>` : ""}
            <span class="blk-tools"><button class="icon-btn" title="Subir" onclick="moveBlock(${fi},${bi},-1)">${I("up", 13)}</button><button class="icon-btn" title="Apagar" onclick="BOTED.bot.flows[${fi}].blocks.splice(${bi},1);botDirty(true)">${I("x", 13)}</button></span>
            ${B.hint ? `<small class="blk-hint">${B.hint}</small>` : ""}</div>`; }).join("")}
        </div>
        <div class="blk-add">${Object.entries(BLOCKS).map(([k, B]) => `<button class="chip ${B.cat}" onclick="addBlock(${fi},'${k}')">${I(B.ic, 13)} ${B.name}</button>`).join("")}</div>
      </div>`)}
      <button class="btn ghost" style="width:100%" onclick="BOTED.bot.flows.push({trigger:{type:'command',value:''},blocks:[]});botDirty(true)">+ Novo comando</button>
      ${b.id !== "novo" ? `<button class="btn ghost danger sm" style="margin-top:18px" onclick="deleteBot()">${I("trash", 15)} Apagar bot</button>` : ""}
    </div>
    <aside class="bot-side card">
      <b>${I("play", 14)} Testar</b><div class="muted small">Simula aqui, sem mandar nada de verdade.</div>
      <div class="bot-log" id="botlog">${BOTED.log.map(l => `<div class="bl ${l.me ? "me" : ""}"><b>${esc(l.who)}</b>${md(l.text)}</div>`).join("") || `<div class="muted small" style="padding:10px 0">Digite um comando, ex: <code>!${esc(b.flows[0]?.trigger.value || "oi")}</code></div>`}</div>
      <form id="bottest" style="display:flex;gap:6px"><input class="input" id="btin" placeholder="!comando" autocomplete="off"><button class="btn sm">${I("play", 14)}</button></form>
      <div class="side-label" style="padding:12px 0 4px">Variáveis</div>
      <div class="bot-vars">${BOT_VARS.map(v => `<code onclick="copy('${v}')" title="Copiar">${v}</code>`).join("")}</div>
    </aside></div>`;
}
function botDirty(rerender) {
  BOTED.dirty = true;
  if (rerender) { const sc = $("#botpage")?.scrollTop; renderBots($(".main")); if ($("#botpage")) $("#botpage").scrollTop = sc; }
  else { const s = $("#botSave"); if (s) s.disabled = false; }
}
function addBlock(fi, t) {
  const bl = { t }; BLOCKS[t].fields.forEach(([k, , d]) => (bl[k] = d));
  BOTED.bot.flows[fi].blocks.push(bl); botDirty(true);
}
function moveBlock(fi, bi, d) {
  const a = BOTED.bot.flows[fi].blocks, j = bi + d; if (j < 0 || j >= a.length) return;
  [a[bi], a[j]] = [a[j], a[bi]]; botDirty(true);
}
function bindBotEditor() {
  const root = $("#botpage"), b = BOTED.bot;
  root.addEventListener("input", e => {
    const el = e.target;
    if (el.id === "bname") { b.name = el.value; return botDirty(); }
    if (el.id === "bcolor") { b.color = el.value; $(".bot-av").style.backgroundColor = el.value; return botDirty(); }
    if (el.dataset.scope) { b.servers = el.checked ? [...new Set([...b.servers, el.dataset.scope])] : b.servers.filter(x => x !== el.dataset.scope); return botDirty(); }
    if (!el.dataset.k) return;
    const f = b.flows[+el.dataset.f];
    if (el.dataset.k.startsWith("trigger.")) f.trigger[el.dataset.k.slice(8)] = el.value;
    else f.blocks[+el.dataset.b][el.dataset.k] = el.value;
    botDirty(el.tagName === "SELECT" && el.dataset.k === "trigger.type");
  });
  let drag = null;
  root.querySelectorAll(".blk[draggable]").forEach(el => {
    el.addEventListener("dragstart", e => { if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return e.preventDefault(); drag = [+el.dataset.f, +el.dataset.b]; el.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; });
    el.addEventListener("dragend", () => el.classList.remove("dragging"));
    el.addEventListener("dragover", e => { if (drag && +el.dataset.f === drag[0]) { e.preventDefault(); el.classList.add("over"); } });
    el.addEventListener("dragleave", () => el.classList.remove("over"));
    el.addEventListener("drop", e => {
      e.preventDefault(); el.classList.remove("over"); if (!drag) return;
      const a = b.flows[drag[0]].blocks, [it] = a.splice(drag[1], 1); a.splice(+el.dataset.b, 0, it); drag = null; botDirty(true);
    });
  });
  $("#bottest").addEventListener("submit", async e => {
    e.preventDefault(); const text = $("#btin").value.trim(); if (!text) return; $("#btin").value = "";
    const push = (who, t, me) => { BOTED.log.push({ who, text: t, me }); BOTED.log = BOTED.log.slice(-40); const l = $("#botlog"); if (l) { l.innerHTML = BOTED.log.map(x => `<div class="bl ${x.me ? "me" : ""}"><b>${esc(x.who)}</b>${md(x.text)}</div>`).join(""); l.scrollTop = l.scrollHeight; } };
    push(dname(S.me), text, true);
    const flow = b.flows.find(f => matchFlow(f, text));
    if (!flow) return push("Cuplock", "_Nenhum comando reconheceu essa mensagem._");
    const ctx = { bot: JSON.parse(JSON.stringify(b)), user: dname(S.me), ...matchFlow(flow, text), canal: "#teste", servidor: "Teste", members: S.friends.length ? [uid(), ...S.friends.slice(0, 20)] : [uid()], vars: {} };
    await runFlow(ctx.bot, flow, ctx, { send: (t, reply) => push(b.name, (reply ? `↪ ${dname(S.me)}: ` : "") + t) });
  });
}
async function botAvatar() {
  const [f] = await pickFile("image/png,image/jpeg,image/webp,image/gif"); if (!f) return;
  if (f.size > 4 * 1048576) return toast("Imagem até 4 MB.");
  try { BOTED.bot.avatar_url = await uploadTo("avatars", f, { maxSide: 512, square: true }); botDirty(true); } catch (e) { toast(e.message); }
}
async function saveBot() {
  const b = BOTED.bot;
  if (b.name.trim().length < 2) return toast("O nome precisa de 2 letras ou mais");
  b.flows = b.flows.filter(f => f.trigger.value.trim() || f.blocks.length);
  const row = { name: b.name.trim(), color: b.color, avatar_url: okUrl(b.avatar_url) ? b.avatar_url : null, enabled: b.enabled, servers: b.servers, flows: b.flows };
  try {
    if (b.id === "novo") { const r = await q(sb.from("user_bots").insert(row).select().single()); MY_BOTS.push(r); regBot(r); BOTED = null; toast("Bot criado!"); navigate("/bots/" + r.id, true); return; }
    await q(sb.from("user_bots").update(row).eq("id", b.id));
    const i = MY_BOTS.findIndex(x => x.id === b.id); MY_BOTS[i] = { ...MY_BOTS[i], ...row }; regBot(MY_BOTS[i]);
    BOTED.dirty = false; toast("Bot salvo"); renderBots($(".main"));
  } catch (e) { toast(e.message); }
}
async function deleteBot() {
  const b = BOTED.bot;
  if (!await uiConfirm(`Apagar ${b.name}? As mensagens dele também somem.`)) return;
  try { await q(sb.from("user_bots").delete().eq("id", b.id)); MY_BOTS = MY_BOTS.filter(x => x.id !== b.id); BOTED = null; navigate("/bots"); toast("Bot apagado"); } catch (e) { toast(e.message); }
}
