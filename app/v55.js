// Cuplock 5.5 (Energy Bar) — emblemas e balão de status no perfil, menu "+" (arquivo, enquete,
// agendar), qualquer tipo de arquivo, Apps (Cupgine), modo Penetrar e mais temas.
"use strict";
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ================================================================ emblemas do perfil
const BADGE_DEFS = [
  ["owner", "crown", "Cuplock Owner", "#fbbf24", u => u.role === "owner"],
  ["staff", "shield", "Cuplock Staff", "#a78bfa", u => u.role === "staff"],
  ["pioneer", "rocket", "Pioneiro do Cuplock — entrou antes de 2027", "#38bdf8", u => u.created_at && Date.parse(u.created_at) < Date.parse("2027-01-01")],
  ["server", "users", "Dono de servidor", "#34d399", u => S.servers.some(s => s.owner === u.id)],
  ["dev", "bot", "Criador de bots", "#5865f2", u => decoOf(u).dev || (u.id === uid() && (typeof MY_BOTS !== "undefined" && MY_BOTS.length))],
  ["artist", "edit", "Animador do Cupgine", "#f472b6", u => decoOf(u).cupgine],
  ["deco", "sparkles", "Perfil decorado", "#e879f9", u => decoOf(u).frame && decoOf(u).frame !== "nenhuma"],
  ["pen", "heart", "Modo Penetrar", "#fb7185", u => decoOf(u).pen],
  ["bff", "star", "Seu melhor amigo", "#fbbf24", u => u.id !== uid() && isBff?.(u.id)],
  ["fresh", "check", "Usa a versão mais nova", "#4ade80", u => u.id === uid() ? !isOutdated?.(u) : (S.online[u.id]?.ver && !isOutdated?.(u))],
];
function badgesHtml(u) {
  if (!u || u.isBot || decoOf(u).hideBadges) return "";
  const list = BADGE_DEFS.filter(b => { try { return b[4](u); } catch { return false; } });
  if (!list.length) return "";
  const show = list.slice(0, 7), more = list.length - show.length;
  return `<span class="badges">${show.map(([k, ic, t, c]) => `<i class="bdg" title="${esc(t)}" style="--bc:${c}">${I(ic, 14)}</i>`).join("")}${more ? `<i class="bdg more" title="${esc(list.slice(7).map(b => b[2]).join(", "))}">+${more}</i>` : ""}</span>`;
}
// balão de pensamento com o status (clica e edita quando é você)
function statusBubble(u) {
  if (!u || u.isBot) return "";
  const has = u.custom_status || u.status_emoji, me = u.id === uid();
  if (!has && !me) return "";
  return `<div class="sbubble ${has ? "" : "empty"}" ${me ? `onclick="event.stopPropagation();closeLayer();editStatus()" title="Mudar status"` : ""}>${has ? `${esc(u.status_emoji || "")} ${emojify(esc(u.custom_status || ""))}` : `${I("smilePlus", 14)} <span>Adicionar status</span>`}<i></i><b></b></div>`;
}
function editStatus() {
  const u = S.me;
  modal(h`<h2>Seu status</h2><p class="sub">Aparece num balão em cima da sua foto.</p>
    <div style="display:flex;gap:8px"><input class="input" id="stE" maxlength="4" placeholder="😎" style="width:64px;text-align:center" value="${esc(u.status_emoji || "")}"><input class="input" id="stT" maxlength="80" placeholder="No que você está pensando?" value="${esc(u.custom_status || "")}"></div>
    <div class="te-chips" style="margin-top:10px">${[["🎮", "Jogando"], ["📚", "Estudando"], ["😴", "Dormindo"], ["🍕", "Comendo"], ["💻", "Trabalhando"], ["🎧", "Ouvindo música"], ["🏖️", "De férias"]].map(([e, t]) => `<button class="chip2" onclick="$('#stE').value='${e}';$('#stT').value='${t}'">${e} ${t}</button>`).join("")}</div>
    <div class="acts"><button class="btn ghost" onclick="saveStatus(true)">Limpar</button><button class="btn" onclick="saveStatus()">Salvar</button></div>`, m => setTimeout(() => $("#stT", m)?.focus(), 30));
}
async function saveStatus(clear) {
  const status_emoji = clear ? null : $("#stE").value.trim() || null, custom_status = clear ? null : $("#stT").value.trim() || null;
  try { await saveProfile({ status_emoji, custom_status }); closeLayer(); render(); } catch (e) { toast(e.message); }
}

// ================================================================ menu "+" do chat
function openPlusMenu(e) {
  e.stopPropagation();
  const cid = currentChannel();
  showCtx(e, `<button onclick="closeLayer();pickFile('',true).then(addFiles)">${I("upload", 17)} Enviar um arquivo</button>
    <button onclick="closeLayer();pollModal()">${I("list", 17)} Criar enquete</button>
    <button onclick="closeLayer();scheduleModal()">${I("bell", 17)} Agendar mensagem <span class="grow"></span>${I("chevR", 14)}</button>`);
  // abre para cima, como no Discord
  const c = document.querySelector(".ctx"), r = e.currentTarget.getBoundingClientRect();
  if (c) { c.style.left = r.left + "px"; c.style.top = Math.max(8, r.top - c.offsetHeight - 8) + "px"; c.classList.add("plusmenu"); }
}
// qualquer tipo de arquivo (o resto vira um cartão para baixar)
const MAX_FILE_MB = 100;
(() => {
  const _fk = fileKind;
  fileKind = f => { const r = _fk(f); return r.kind ? r : { type: f.type || "application/octet-stream", kind: "file" }; };
  addFiles = function (files) {
    for (let f of files) {
      const { type, kind } = fileKind(f);
      if (f.size > MAX_FILE_MB * 1048576) { toast(`${f.name} passa de ${MAX_FILE_MB} MB.`); continue; }
      if (pendingFiles.length >= 10) { toast("Até 10 arquivos por vez."); break; }
      if (type !== f.type) f = new File([f], f.name, { type });
      pendingFiles.push({ file: f, kind, url: URL.createObjectURL(f) });
    }
    renderPendingFiles();
  };
  const _rp = renderPendingFiles;
  renderPendingFiles = () => {
    _rp();
    const el = document.getElementById("pending"); if (!el) return;
    el.querySelectorAll(".pf.file").forEach((d, i) => { const p = pendingFiles.filter(x => x.kind === "file")[i]; if (p) d.innerHTML = `<div class="pf-audio">${I("file", 22)}<small>${esc(p.file.name)}</small></div>` + (d.querySelector("button")?.outerHTML || ""); });
  };
  const _at = attachHtml;
  attachHtml = (a, mine) => {
    if (!a?.url) return "";
    const t = a.type || "";
    if (t.startsWith("image/") || t.startsWith("video/") || t.startsWith("audio/")) return _at(a, mine);
    if (!(SAFE_URL.test(a.url) || a.local)) return "";
    const ext = (a.name || "").split(".").pop().toUpperCase().slice(0, 5);
    return `<div class="gfile" onclick="event.stopPropagation()"><div class="gfile-ic"><span>${esc(ext || "ARQ")}</span></div><div class="gfile-main"><b title="${esc(a.name || "")}">${esc(a.name || "arquivo")}</b><small>${a.size ? fmtBytes(a.size) : ""}</small></div>
      <a class="icon-btn" title="Baixar" href="${esc(a.url)}" download="${esc(a.name || "arquivo")}" target="_blank" rel="noopener">${I("download", 18)}</a></div>`;
  };
})();

// ================================================================ enquetes
S.votes = {};
function pollModal() {
  const cid = currentChannel(); if (!cid) return;
  modal(h`<h2>${I("list", 20)} Criar enquete</h2>
    <label class="f">Pergunta</label><input class="input" id="pq" maxlength="200" placeholder="ex: Qual jogo hoje?">
    <label class="f">Respostas</label><div id="popts">${[0, 1].map(i => `<input class="input popt" maxlength="60" placeholder="Resposta ${i + 1}">`).join("")}</div>
    <button class="btn ghost sm" onclick="if($$('.popt').length<10)$('#popts').insertAdjacentHTML('beforeend','<input class=&quot;input popt&quot; maxlength=&quot;60&quot; placeholder=&quot;Resposta '+($$('.popt').length+1)+'&quot;>')">+ Adicionar resposta</button>
    <label class="f">Duração</label><div class="seg" id="pdur">${[["1", "1 hora"], ["24", "1 dia"], ["72", "3 dias"], ["168", "1 semana"], ["0", "Sem fim"]].map(([v, n], i) => `<button class="${i === 1 ? "on" : ""}" data-h="${v}" onclick="this.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===this))">${n}</button>`).join("")}</div>
    <label class="chk" style="margin-top:12px"><input type="checkbox" id="pmulti"> Permitir escolher mais de uma</label>
    <div class="acts"><button class="btn ghost" onclick="closeLayer()">Cancelar</button><button class="btn" onclick="sendPoll('${cid}')">Postar enquete</button></div>`, m => setTimeout(() => $("#pq", m).focus(), 30));
}
async function sendPoll(cid) {
  const qn = $("#pq").value.trim(), options = $$(".popt").map(i => i.value.trim()).filter(Boolean);
  if (!qn) return toast("Escreva a pergunta."); if (options.length < 2) return toast("Coloque pelo menos 2 respostas.");
  const hrs = +$("#pdur .on").dataset.h, poll = { options, multi: $("#pmulti").checked, ends: hrs ? new Date(Date.now() + hrs * 3600e3).toISOString() : null };
  try { await q(sb.from("messages").insert({ ...cidFilter(cid), content: qn, poll })); closeLayer(); }
  catch (e) { toast(e.message); }
}
async function loadVotes(ids) {
  ids = ids.filter(Boolean); if (!ids.length) return;
  try {
    const rows = await q(sb.from("poll_votes").select("message_id, user_id, option").in("message_id", ids));
    ids.forEach(i => (S.votes[i] = {}));
    rows.forEach(r => ((S.votes[r.message_id] ||= {})[r.option] ||= []).push(r.user_id));
  } catch {}
}
function pollHtml(m) {
  const p = m.poll, v = S.votes[m.id] || {}, me = uid();
  const counts = p.options.map((_, i) => (v[i] || []).length), voters = new Set(Object.values(v).flat()), total = voters.size;
  const ended = p.ends && Date.parse(p.ends) < Date.now(), mine = p.options.map((_, i) => (v[i] || []).includes(me)), voted = mine.some(Boolean);
  const max = Math.max(...counts);
  return `<div class="poll ${ended ? "ended" : ""}" onclick="event.stopPropagation()"><div class="poll-q">${md(m.content)}</div><small class="muted">${p.multi ? "Escolha uma ou mais" : "Escolha uma"}</small>
    ${p.options.map((o, i) => { const pct = total ? Math.round(counts[i] / total * 100) : 0; return `<button class="popt-row ${mine[i] ? "mine" : ""} ${ended && counts[i] === max && max ? "win" : ""}" ${ended ? "disabled" : `onclick="votePoll('${m.id}',${i})"`}>
      <span class="pbar" style="width:${voted || ended ? pct : 0}%"></span><span class="pchk">${mine[i] ? I("check", 13) : ""}</span><span class="grow">${esc(o)}</span>${voted || ended ? `<b>${pct}%</b><small>${counts[i]}</small>` : ""}</button>`; }).join("")}
    <small class="muted">${total} voto${total === 1 ? "" : "s"} · ${ended ? "Encerrada" : p.ends ? "Termina " + relTime(Date.parse(p.ends)) : "Sem prazo"}</small></div>`;
}
function relTime(t) { const d = t - Date.now(), h = Math.round(d / 3600e3); return d < 3600e3 ? `em ${Math.max(1, Math.round(d / 60e3))} min` : h < 48 ? `em ${h} h` : `em ${Math.round(h / 24)} dias`; }
async function votePoll(mid, opt) {
  const m = Object.values(S.msgs).flat().find(x => x.id === mid); if (!m?.poll) return;
  const v = (S.votes[mid] ||= {}), me = uid(), had = (v[opt] || []).includes(me);
  const ops = [];
  if (had) ops.push(["del", opt]);
  else { if (!m.poll.multi) Object.keys(v).forEach(k => { if ((v[k] || []).includes(me)) ops.push(["del", +k]); }); ops.push(["add", opt]); }
  for (const [o, k] of ops) { v[k] = (v[k] || []).filter(x => x !== me); if (o === "add") v[k].push(me); }
  rerenderMsgs();
  try {
    for (const [o, k] of ops) {
      if (o === "del") await q(sb.from("poll_votes").delete().eq("message_id", mid).eq("user_id", me).eq("option", k));
      else await q(sb.from("poll_votes").insert({ message_id: mid, option: k }));
    }
  } catch (e) { toast(e.message); await loadVotes([mid]); rerenderMsgs(); }
}

// ================================================================ mensagens agendadas
async function scheduleModal() {
  const cid = currentChannel(); if (!cid) return;
  let mine = [];
  try { mine = await q(sb.from("scheduled_messages").select("*").order("send_at")); } catch {}
  const pad = n => String(n).padStart(2, "0"), d = new Date(Date.now() + 3600e3);
  const val = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  modal(h`<h2>${I("bell", 20)} Agendar mensagem</h2><p class="sub">Sai sozinha na hora marcada, nesta conversa.</p>
    <textarea class="input" id="scT" rows="3" maxlength="2000" placeholder="Mensagem">${esc($("#input")?.value || "")}</textarea>
    <label class="f">Quando</label><input class="input" type="datetime-local" id="scW" value="${val}">
    <div class="te-chips" style="margin-top:8px">${[["Em 1 hora", 1], ["Hoje à noite", "n"], ["Amanhã 9h", "m"], ["Em 1 semana", 168]].map(([n, v]) => `<button class="chip2" onclick="schedQuick('${v}')">${n}</button>`).join("")}</div>
    ${mine.length ? `<label class="f">Suas agendadas</label><div class="sched-list">${mine.map(s => `<div class="sched-i"><div class="grow"><b>${esc(new Date(s.send_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }))}</b><small>${esc(s.content.slice(0, 80))}</small></div><button class="icon-btn" title="Cancelar" onclick="cancelSched('${s.id}')">${I("trash", 15)}</button></div>`).join("")}</div>` : ""}
    <div class="acts"><button class="btn ghost" onclick="closeLayer()">Cancelar</button><button class="btn" onclick="saveSched('${cid}')">Agendar</button></div>`);
}
function schedQuick(v) {
  const d = new Date(); if (v === "n") { d.setHours(20, 0, 0, 0); if (d < Date.now()) d.setDate(d.getDate() + 1); } else if (v === "m") { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); } else d.setTime(Date.now() + +v * 3600e3);
  const pad = n => String(n).padStart(2, "0"); $("#scW").value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
async function saveSched(cid) {
  const content = $("#scT").value.trim(), when = new Date($("#scW").value);
  if (!content) return toast("Escreva a mensagem."); if (!(when > Date.now() + 30e3)) return toast("Escolha um horário no futuro.");
  try {
    await q(sb.from("scheduled_messages").insert({ ...cidFilter(cid), content, send_at: when.toISOString() }));
    if ($("#input") && $("#input").value.trim() === content) { $("#input").value = ""; $("#input").dispatchEvent(new Event("input")); }
    closeLayer(); toast(`Agendada para ${when.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`);
  } catch (e) { toast(e.message); }
}
async function cancelSched(id) { try { await q(sb.from("scheduled_messages").delete().eq("id", id)); closeLayer(); scheduleModal(); } catch (e) { toast(e.message); } }
// se o banco não tiver o relógio (pg_cron), o próprio app do autor manda as suas
setInterval(() => { if (S.session && S.loaded) sb.rpc("send_due_messages").then(() => {}, () => {}); }, 30000);

// ================================================================ Apps
function openAppsMenu(e) {
  e.stopPropagation();
  showCtx(e, `<div class="ctx-label">Apps do Cuplock</div>
    <button onclick="closeLayer();openCupgine()"><span class="app-ic cupg">${I("edit", 16)}</span><span class="grow"><b>Cupgine</b><small>Animação quadro a quadro</small></span></button>
    ${S.prefs.devMode ? `<button onclick="closeLayer();navigate('/bots')"><span class="app-ic bots">${I("bot", 16)}</span><span class="grow"><b>Meus bots</b><small>Bots com blocos</small></span></button>` : ""}
    <div class="ctx-label muted" style="text-transform:none;font-weight:600">Mais apps em breve</div>`);
  document.querySelector(".ctx")?.classList.add("appsmenu");
}

// ================================================================ modo Penetrar (mais coisas no perfil)
const RELIGIOES = ["Católica", "Evangélica", "Espírita", "Umbandista", "Candomblecista", "Judaica", "Muçulmana", "Budista", "Hindu", "Agnóstico", "Ateu", "Nenhuma", "Outra"];
const SIGNOS = ["Áries", "Touro", "Gêmeos", "Câncer", "Leão", "Virgem", "Libra", "Escorpião", "Sagitário", "Capricórnio", "Aquário", "Peixes"];
const PEN_FIELDS = [
  ["nome", "Nome real", "text", "user"], ["idade", "Idade", "num", "idcard"], ["religiao", "Religião", RELIGIOES, "heart"], ["signo", "Signo", SIGNOS, "sparkles"],
  ["cidade", "Cidade", "text", "compass"], ["aniversario", "Aniversário", "date", "star"], ["genero", "Gênero", "text", "user"], ["relacao", "Relacionamento", ["Solteiro(a)", "Namorando", "Casado(a)", "Enrolado(a)", "Prefiro não dizer"], "heartFill"],
  ["escola", "Escola / trabalho", "text", "scroll"], ["jogo", "Jogo favorito", "text", "gamepad"], ["comida", "Comida favorita", "text", "coffee"], ["musica", "Música do perfil (link Spotify/YouTube)", "url", "music"],
  ["instagram", "Instagram", "text", "image"], ["tiktok", "TikTok", "text", "video"], ["youtube", "YouTube", "text", "play"], ["site", "Site", "url", "globe"],
];
S.extra = {};
async function loadExtra(id) {
  if (S.extra[id] !== undefined) return S.extra[id];
  try { const r = await q(sb.from("profile_extra").select("data, visibility").eq("user_id", id).maybeSingle()); S.extra[id] = r || null; } catch { S.extra[id] = null; }
  return S.extra[id];
}
function extraSlot(u) { if (!u || u.isBot || !decoOf(u).pen) return ""; setTimeout(() => fillExtra(u.id), 0); return `<div class="pextra" data-u="${u.id}"></div>`; }
async function fillExtra(id) {
  const r = await loadExtra(id), els = document.querySelectorAll(`.pextra[data-u="${id}"]`); if (!els.length) return;
  const d = r?.data || {}, rows = PEN_FIELDS.filter(([k]) => d[k] !== undefined && d[k] !== "" && d[k] !== null);
  const val = (k, v) => k === "idade" ? `${+v} anos` : k === "aniversario" ? new Date(v + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })
    : ["musica", "site"].includes(k) ? `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v.replace(/^https?:\/\//, "").slice(0, 40))}</a>`
    : k === "instagram" ? `<a href="https://instagram.com/${esc(v.replace(/^@/, ""))}" target="_blank" rel="noopener">@${esc(v.replace(/^@/, ""))}</a>`
    : k === "tiktok" ? `<a href="https://tiktok.com/@${esc(v.replace(/^@/, ""))}" target="_blank" rel="noopener">@${esc(v.replace(/^@/, ""))}</a>` : esc(v);
  const html = rows.length ? `<div class="side-label" style="padding-left:0">Mais sobre</div><div class="pex-grid">${rows.map(([k, n, , ic]) => `<div class="pex"><span class="pex-ic">${I(ic, 14)}</span><div><small>${n.replace(/ \(.*\)/, "")}</small><b>${val(k, d[k])}</b></div></div>`).join("")}</div>` : "";
  els.forEach(e => (e.innerHTML = html));
}
function penEditorHtml() {
  const on = !!decoOf(S.me).pen;
  return `<div class="card pen-card" id="penrow"><div class="row" style="border:0;padding:0"><div class="l"><b>${I("heart", 16)} Modo Penetrar</b><span>Desbloqueia mais coisas no perfil: nome real, idade, religião, signo, cidade, aniversário, links, música do perfil, efeitos e cores do cartão.</span></div>
    <button class="toggle ${on ? "on" : ""}" onclick="togglePen()"></button></div>${on ? `<div id="penbody" class="muted small" style="padding:10px 0">Carregando…</div>` : ""}</div>`;
}
async function togglePen() { await setDeco({ pen: !decoOf(S.me).pen }); }
async function drawPenBody() {
  const box = document.getElementById("penbody"); if (!box) return;
  delete S.extra[uid()];
  const r = await loadExtra(uid()), d = r?.data || {}, vis = r?.visibility || "friends", deco = decoOf(S.me);
  box.className = "";
  box.innerHTML = `<label class="f">Quem pode ver estas informações</label><div class="seg" id="penvis">${[["all", "Todo mundo"], ["friends", "Só amigos"], ["me", "Só eu"]].map(([v, n]) => `<button class="${vis === v ? "on" : ""}" data-v="${v}" onclick="this.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===this))">${n}</button>`).join("")}</div>
    <div class="pen-grid">${PEN_FIELDS.map(([k, n, t]) => `<label class="pen-f"><span>${n}</span>${Array.isArray(t) ? `<select class="input" data-k="${k}"><option value="">—</option>${t.map(o => `<option ${d[k] === o ? "selected" : ""}>${o}</option>`).join("")}</select>`
      : `<input class="input" data-k="${k}" type="${t === "num" ? "number" : t === "date" ? "date" : "text"}" ${t === "num" ? 'min="13" max="120"' : ""} maxlength="80" value="${esc(d[k] ?? "")}">`}</label>`).join("")}</div>
    <label class="f">Cartão do perfil</label>
    <div class="cc-row" style="flex-wrap:wrap"><span class="small">Cores</span><input type="color" value="${esc(deco.card1 || "#2a2140")}" id="penc1"><input type="color" value="${esc(deco.card2 || "#1a1626")}" id="penc2">
      <select class="input" id="pfx" style="width:auto">${[["", "Sem efeito"], ["neve", "Neve"], ["brilhos", "Brilhos"], ["coracoes", "Corações"], ["confete", "Confete"], ["estrelas", "Estrelas"]].map(([v, n]) => `<option value="${v}" ${deco.cardFx === v ? "selected" : ""}>${n}</option>`).join("")}</select>
      <label class="chk"><input type="checkbox" id="penhb" ${deco.hideBadges ? "checked" : ""}> Esconder emblemas</label></div>
    <div class="acts" style="justify-content:flex-start"><button class="btn" onclick="savePen()">Salvar</button><span class="muted small">Idade: só a partir de 13 anos.</span></div>`;
}
async function savePen() {
  const data = {};
  document.querySelectorAll("#penbody [data-k]").forEach(i => { const v = i.value.trim(); if (v) data[i.dataset.k] = i.dataset.k === "idade" ? Math.min(120, Math.max(13, +v || 13)) : v.slice(0, 80); });
  for (const k of ["musica", "site"]) if (data[k] && !/^https:\/\/[^\s"'<>]+$/.test(data[k])) { toast("Links precisam começar com https://"); return; }
  const visibility = document.querySelector("#penvis .on")?.dataset.v || "friends";
  try {
    await q(sb.from("profile_extra").upsert({ user_id: uid(), data, visibility, updated_at: new Date().toISOString() }));
    await setDeco({ card1: $("#penc1").value, card2: $("#penc2").value, cardFx: $("#pfx").value, hideBadges: $("#penhb").checked });
    S.extra[uid()] = { data, visibility }; toast("Perfil salvo");
  } catch (e) { toast(e.message); }
}
// cores e efeito do cartão (quem ligou o Penetrar)
function cardStyle(u) { const d = decoOf(u); return d.pen && d.card1 ? `--pc1:${esc(d.card1)};--pc2:${esc(d.card2 || d.card1)}` : ""; }

// ================================================================ ganchos
(() => {
  const _lm = loadMessages;
  loadMessages = async (cid, before) => { const r = await _lm(cid, before); await loadVotes((S.msgs[cid] || []).filter(m => m.poll && !(m.id in S.votes)).map(m => m.id)); return r; };
  const _mt = msgText;
  msgText = (m, extra = "") => m.poll ? pollHtml(m) : _mt(m, extra);
  const _rs = renderSettings;
  renderSettings = (...a) => {
    const r = _rs(...a), sec = document.querySelector(".settings section");
    if (sec && settingsTab === "profile" && !sec.querySelector("#penrow")) { (sec.querySelector("#decoed") || sec.querySelector("h2")).insertAdjacentHTML("afterend", penEditorHtml()); drawPenBody(); }
    return r;
  };
  // cartão do perfil com as cores/efeito do Penetrar
  const _ss = stickersHtml;
  stickersHtml = (u, ed) => { const d = decoOf(u); return (d.pen && (d.card1 || d.cardFx) ? `<i class="pcard-bg ${d.cardFx ? "fx-" + esc(d.cardFx) : ""}" style="${cardStyle(u)}"></i>` : "") + _ss(u, ed); };
  let votesCh;
  const _cb = connectBff;
  connectBff = (...a) => {
    _cb(...a);
    if (votesCh) sb.removeChannel(votesCh);
    votesCh = sb.channel("cuplock-votes-" + uid()).on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, p => {
      const row = p.new?.message_id ? p.new : p.old; if (!row?.message_id || !(row.message_id in S.votes)) return;
      const v = S.votes[row.message_id], l = (v[row.option] ||= []);
      if (p.eventType === "INSERT") { if (!l.includes(row.user_id)) l.push(row.user_id); } else if (p.eventType === "DELETE") v[row.option] = l.filter(x => x !== row.user_id);
      if ((S.msgs[currentChannel()] || []).some(m => m.id === row.message_id)) rerenderMsgs();
    }).subscribe();
  };
  // bots criados → emblema de criador
  if (typeof saveBot === "function") { const _sb = saveBot; saveBot = async (...a) => { const r = await _sb(...a); if (!decoOf(S.me).dev) setDeco({ dev: true }); return r; }; }
})();
