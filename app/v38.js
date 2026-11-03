// Cuplock 3.8 — categorias, emojis do servidor, reações, GIFs, busca, formatação,
// presença (plataforma, versão, invisível p/ OWNER), temas de Natal/Halloween, temas salvos e abertura.
"use strict";

// ================================================================ partículas (Natal / Halloween)
function setParticles(kind) {
  let el = document.getElementById("particles");
  if (!kind) { el?.remove(); return; }
  if (el?.dataset.kind === kind) return;
  el?.remove();
  el = Object.assign(document.createElement("div"), { id: "particles" });
  el.dataset.kind = kind;
  const n = kind === "snow" ? 60 : 18;
  el.innerHTML = Array.from({ length: n }, () => {
    const size = kind === "snow" ? 2 + Math.random() * 5 : 10 + Math.random() * 16, left = Math.random() * 100, dur = (kind === "snow" ? 8 : 14) + Math.random() * 12, delay = -Math.random() * dur, drift = Math.round(Math.random() * 80 - 40);
    return `<i class="${kind === "spooky" ? (Math.random() < .5 ? "bat" : "ember") : ""}" style="width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;left:${left.toFixed(1)}%;animation-duration:${dur.toFixed(1)}s;animation-delay:${delay.toFixed(1)}s;--drift:${drift}px"></i>`;
  }).join("");
  document.body.insertBefore(el, document.getElementById("app"));
}

// ================================================================ presença: plataforma, versão, invisível
function myPlatform() { return window.__TAURI__ ? "desktop" : (window.CuplockNative || /Android|iPhone|iPad/i.test(navigator.userAgent)) ? "mobile" : "web"; }
const PLAT = { desktop: ["monitor", "No app de PC"], mobile: ["smartphone", "No celular"], web: ["globe", "No navegador"] };
function cmpV(a, b) { const x = String(a || "0").split(".").map(Number), y = String(b || "0").split(".").map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; }
function latestVer() {
  let v = VERSION;
  if (window.LATEST_VER && cmpV(window.LATEST_VER, v) > 0) v = window.LATEST_VER;
  for (const id in S.online) { const o = S.online[id]?.ver; if (o && /^\d+\.\d+\.\d+$/.test(o) && cmpV(o, v) > 0) v = o; }
  return v;
}
function userVer(u) { return u?.id === uid() ? VERSION : S.online[u?.id]?.ver || null; }
function isOutdated(u) {
  if (!u || u.isBot || effStatus(u) === "offline") return false;
  const v = userVer(u);
  return !v || cmpV(v, latestVer()) < 0;
}
function userPlat(u) { return u?.id === uid() ? myPlatform() : S.online[u?.id]?.plat || (isGhost(u) ? S.ghosts[u.id].platform : null); }
function platBadge(u) {
  if (!u || u.isBot) return "";
  const p = (effStatus(u) !== "offline" || isGhost(u)) && userPlat(u); if (!p || !PLAT[p]) return "";
  return ` <span class="plat" title="${PLAT[p][1]}">${I(PLAT[p][0], 13)}</span>`;
}
S.ghosts = {};
const isGhost = u => isOwner() && u && u.id !== uid() && effStatus(u) === "offline" && S.ghosts[u.id] && Date.now() - S.ghosts[u.id].t < 150000;
function statusText(u) {
  if (u?.isBot) return "Bot";
  if (isGhost(u)) return `Invisível — online agora${S.ghosts[u.id].version ? " · v" + esc(S.ghosts[u.id].version) : ""}`;
  const base = statusLabel[effStatus(u)];
  if (isOutdated(u)) { const v = userVer(u); return `Desatualizado · ${v ? "v" + esc(v) : "versão antiga"}`; }
  return base;
}
function dotExtra(u) { return isGhost(u) ? " ghost" : isOutdated(u) ? " old" : ""; }
let ghostT = 0;
async function ghostPing() {
  if (S.me?.status !== "invisible" || Date.now() - ghostT < 50000) return;
  ghostT = Date.now();
  try { await q(sb.from("app_presence").upsert({ user_id: uid(), at: new Date().toISOString(), platform: myPlatform(), version: VERSION })); } catch {}
}
setInterval(() => { if (S.me?.status === "invisible") ghostPing(); }, 60000);
async function loadGhosts() {
  if (!isOwner()) return;
  try {
    const rows = await q(sb.from("app_presence").select("*").gte("at", new Date(Date.now() - 150000).toISOString()));
    const next = {}; rows.forEach(r => (next[r.user_id] = { t: Date.parse(r.at), platform: r.platform, version: r.version }));
    const changed = JSON.stringify(Object.keys(next).sort()) !== JSON.stringify(Object.keys(S.ghosts).sort());
    S.ghosts = next; await ensureUsers(Object.keys(next));
    if (changed) refreshPresenceUI();
  } catch {}
}
setInterval(loadGhosts, 60000);

// ================================================================ emojis do servidor
S.emojis = {}; S.emojiList = [];
async function loadEmojis() {
  try {
    const rows = await q(sb.from("server_emojis").select("*").order("created_at").limit(2000));
    S.emojiList = rows; S.emojis = {};
    const sid = S.route?.params?.sid;
    for (const e of rows) if (!S.emojis[e.name.toLowerCase()] || e.server_id === sid) S.emojis[e.name.toLowerCase()] = e.url;
  } catch {}
}
// troca :nome: pela imagem (o texto já vem escapado)
function emojify(s) {
  if (!s || s.indexOf(":") < 0) return s;
  return s.replace(/:([a-zA-Z0-9_]{2,32}):/g, (all, n) => {
    const url = S.emojis?.[n.toLowerCase()];
    return url && okUrl(url) ? `<img class="cemoji" src="${url}" alt=":${n}:" title=":${n}:" draggable="false">` : all;
  });
}
function emojiManager(sid) {
  closeLayer();
  const s = S.servers.find(x => x.id === sid); if (!s) return;
  const draw = m => {
    const list = S.emojiList.filter(e => e.server_id === sid);
    $("#emlist", m).innerHTML = list.length ? list.map(e => `<div class="em-row"><img class="cemoji big" src="${esc(e.url)}" alt=""><code>:${esc(e.name)}:</code><span class="grow"></span>
      <button class="btn ghost sm" title="Usar como sua foto de perfil" onclick="saveProfile({avatar_url:'${esc(e.url)}'}).then(()=>toast('Foto de perfil trocada'))">${I("user", 14)} Foto</button>
      <button class="icon-btn" title="Apagar" onclick="deleteEmoji('${e.id}','${sid}')">${I("trash", 15)}</button></div>`).join("")
      : `<div class="muted small" style="padding:10px 0">Nenhum emoji ainda.</div>`;
    $("#emcount", m).textContent = `${list.length}/50`;
  };
  modal(h`<h2>${I("smile", 20)} Emojis de ${esc(s.name)}</h2>
    <p class="sub">Envie uma imagem (PNG, GIF animado, WEBP). Todo mundo pode usar com <code>:nome:</code> nas mensagens, reações, nome e status.</p>
    <div style="display:flex;gap:8px;align-items:center;margin:10px 0"><input class="input" id="emname" maxlength="32" placeholder="nome (ex: gato_feliz)"><button class="btn" id="emup">${I("upload", 15)} Enviar imagem</button></div>
    <div class="muted small" style="text-align:right" id="emcount"></div>
    <div id="emlist" class="em-list"></div>
    <div class="acts"><button class="btn ghost" onclick="closeLayer()">Fechar</button></div>`, m => {
    draw(m);
    $("#emup", m).onclick = async () => {
      const name = $("#emname", m).value.trim().replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 32);
      if (name.length < 2) return toast("Dê um nome com 2 letras ou mais (letras, números e _).");
      const [f] = await pickFile("image/png,image/jpeg,image/webp,image/gif"); if (!f) return;
      if (f.size > 2 * 1048576) return toast("Emoji até 2 MB.");
      toast("Enviando emoji…");
      try {
        const url = await uploadTo("avatars", f, { maxSide: 128 });
        const row = await q(sb.from("server_emojis").insert({ server_id: sid, name, url }).select().single());
        S.emojiList.push(row); S.emojis[name.toLowerCase()] = url; $("#emname", m).value = ""; draw(m); toast(`:${name}: adicionado`);
      } catch (e) { toast(/duplicate|unique/i.test(e.message) ? "Já existe um emoji com esse nome aqui." : e.message); }
    };
  });
}
async function deleteEmoji(id, sid) {
  try { await q(sb.from("server_emojis").delete().eq("id", id)); S.emojiList = S.emojiList.filter(e => e.id !== id); await loadEmojis(); emojiManager(sid); } catch (e) { toast(e.message); }
}

// ================================================================ seletor de emojis
const UNI_EMOJIS = "😀 😂 🤣 😊 😍 🥰 😘 😎 🤩 🥳 😇 🙂 😉 😋 😜 🤪 🤔 🤨 😐 😴 😮 😱 😭 😢 😤 😡 🤬 🥺 😳 🤯 😬 🙄 😏 🤗 🤭 🫡 🫠 💀 👻 🤡 💩 🤖 👽 😺 😹 🙈 🙉 🙊 👍 👎 👏 🙌 🙏 🤝 💪 👀 👋 🤙 ✌️ 🤞 👌 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💖 💯 🔥 ✨ ⭐ 🌟 💥 🎉 🎊 🎁 🎂 🍕 🍔 🍟 🍿 🍩 🍪 ☕ 🧋 🍺 🎮 🕹️ 🎧 🎵 🎶 📸 💻 📱 ⚽ 🏀 🏆 🚀 🌈 ☀️ 🌙 ❄️ 🌊 🐶 🐱 🐸 🐼 🦊 🦄 🐧 🌸 🌹 🍀 🎃 🎄 ✅ ❌ ⚠️ ❓ ❗ 💤 🆗 🆒".split(" ");
const QUICK_REACTS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
function popover(e, html, cls = "") {
  closeLayer();
  const r = (e.currentTarget || e.target).getBoundingClientRect();
  layer.innerHTML = `<div class="pop-bg" onmousedown="if(event.target===this)closeLayer()"><div class="pop ${cls}">${html}</div></div>`;
  const p = layer.querySelector(".pop"), pr = p.getBoundingClientRect();
  let x = Math.min(innerWidth - pr.width - 10, Math.max(10, r.right - pr.width)), y = r.top - pr.height - 8;
  if (y < 40) y = Math.min(innerHeight - pr.height - 10, r.bottom + 8);
  p.style.left = x + "px"; p.style.top = y + "px";
  return p;
}
function emojiGridHtml(onpick) {
  const sid = S.route?.params?.sid;
  const groups = {};
  for (const e of S.emojiList) (groups[e.server_id] ||= []).push(e);
  const order = Object.keys(groups).sort((a, b) => (b === sid) - (a === sid));
  const custom = order.map(gid => { const s = S.servers.find(x => x.id === gid); return `<div class="ep-label">${esc(s?.name || "Outros servidores")}</div><div class="ep-grid">${groups[gid].map(e => `<button title=":${esc(e.name)}:" data-e=":${esc(e.name)}:" data-n="${esc(e.name.toLowerCase())}"><img class="cemoji" src="${esc(e.url)}" alt=""></button>`).join("")}</div>`; }).join("");
  return `<input class="input ep-q" placeholder="Buscar emoji…" autocomplete="off">
    <div class="ep-body">${custom}<div class="ep-label">Emojis</div><div class="ep-grid">${UNI_EMOJIS.map(x => `<button data-e="${x}" data-n="">${x}</button>`).join("")}</div></div>`;
}
function bindEmojiGrid(p, onpick) {
  p.addEventListener("click", ev => { const b = ev.target.closest("button[data-e]"); if (b) onpick(b.dataset.e); });
  const qn = p.querySelector(".ep-q");
  qn.addEventListener("input", () => { const v = qn.value.trim().toLowerCase(); p.querySelectorAll("button[data-e]").forEach(b => (b.style.display = !v || (b.dataset.n && b.dataset.n.includes(v)) ? "" : "none")); });
  setTimeout(() => qn.focus(), 30);
}
function openEmojiPicker(e) {
  const p = popover(e, emojiGridHtml(), "ep");
  bindEmojiGrid(p, em => { const ta = $("#input"); if (!ta) return; insertAtCursor(ta, em + (em.startsWith(":") ? " " : "")); });
}
function insertAtCursor(ta, text) {
  const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a;
  ta.value = ta.value.slice(0, a) + text + ta.value.slice(b);
  ta.selectionStart = ta.selectionEnd = a + text.length; ta.dispatchEvent(new Event("input")); ta.focus();
}

// ================================================================ reações
S.reactions = {}; // msgId -> { emoji: [userIds] }
async function loadReactions(ids) {
  ids = ids.filter(i => i && !String(i).startsWith("tmp")); if (!ids.length) return;
  try {
    const rows = await q(sb.from("reactions").select("message_id, user_id, emoji").in("message_id", ids));
    ids.forEach(i => (S.reactions[i] = {}));
    rows.forEach(r => ((S.reactions[r.message_id] ||= {})[r.emoji] ||= []).push(r.user_id));
  } catch {}
}
function emojiHtml(em) {
  if (em.startsWith(":")) { const n = em.slice(1, -1).toLowerCase(), url = S.emojis[n]; return url && okUrl(url) ? `<img class="cemoji" src="${url}" alt="${esc(em)}">` : esc(em); }
  return esc(em);
}
function reactsHtml(m) {
  const r = S.reactions[m.id]; if (!r) return "";
  const ks = Object.keys(r).filter(k => r[k].length); if (!ks.length) return "";
  const me = uid();
  return `<div class="reacts">${ks.map(k => { const who = r[k].map(id => dname(S.users[id]) || "alguém"); return `<button class="react ${r[k].includes(me) ? "mine" : ""}" title="${esc(who.slice(0, 8).join(", "))}${who.length > 8 ? "…" : ""} reagiu com ${esc(k)}" onclick="event.stopPropagation();toggleReaction('${m.id}','${esc(k).replace(/'/g, "")}')">${emojiHtml(k)}<b>${r[k].length}</b></button>`; }).join("")}
    <button class="react add" title="Reagir" onclick="event.stopPropagation();openReactPicker(event,'${m.id}')">${I("smilePlus", 15)}</button></div>`;
}
async function toggleReaction(mid, emoji) {
  const me = uid(), r = (S.reactions[mid] ||= {}), list = (r[emoji] ||= []), had = list.includes(me);
  if (had) r[emoji] = list.filter(x => x !== me); else list.push(me);
  rerenderMsgs();
  try {
    if (had) await q(sb.from("reactions").delete().eq("message_id", mid).eq("user_id", me).eq("emoji", emoji));
    else await q(sb.from("reactions").insert({ message_id: mid, emoji }));
  } catch (e) {
    if (had) r[emoji].push(me); else r[emoji] = r[emoji].filter(x => x !== me);
    rerenderMsgs(); toast(e.message);
  }
}
function openReactPicker(e, mid) {
  const p = popover(e, `<div class="ep-quick">${QUICK_REACTS.map(x => `<button data-e="${x}">${x}</button>`).join("")}</div>` + emojiGridHtml(), "ep");
  bindEmojiGrid(p, em => { closeLayer(); toggleReaction(mid, em); });
}
function rerenderMsgs() {
  const list = $("#list"), sc = $("#scroller"); if (!list) return;
  const top = sc?.scrollTop;
  list.innerHTML = renderMessages(S.msgs[currentChannel()] || []);
  if (sc) sc.scrollTop = top;
}

// ================================================================ GIFs (GIPHY — o Tenor fechou a API em 2026)
let giphyKey = null;
async function getGiphyKey() {
  if (giphyKey !== null) return giphyKey;
  try { const r = await q(sb.from("app_settings").select("value").eq("key", "giphy").maybeSingle()); giphyKey = r?.value?.key || window.CUPLOCK_CONFIG?.GIPHY_KEY || ""; } catch { giphyKey = ""; }
  return giphyKey;
}
async function gifSearch(term, limit = 24) {
  const key = await getGiphyKey(); if (!key) throw new Error("sem chave");
  const u = term ? `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(key)}&q=${encodeURIComponent(term)}&limit=${limit}&rating=pg-13&lang=pt`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(key)}&limit=${limit}&rating=pg-13`;
  const r = await fetch(u); if (!r.ok) throw new Error("GIPHY respondeu " + r.status);
  return (await r.json()).data.map(g => ({ thumb: g.images.fixed_width?.url, url: (g.images.downsized_medium || g.images.original).url.split("?")[0], w: +g.images.fixed_width?.width, h: +g.images.fixed_width?.height, title: g.title }));
}
async function openGifPicker(e) {
  const p = popover(e, `<input class="input gp-q" placeholder="Pesquisar GIFs…" autocomplete="off"><div class="gp-grid"><div class="muted small">Carregando…</div></div><div class="gp-foot">Powered by GIPHY</div>`, "gp");
  const grid = p.querySelector(".gp-grid"), qn = p.querySelector(".gp-q");
  const load = async term => {
    try {
      const list = await gifSearch(term);
      grid.innerHTML = list.length ? list.map(g => `<button data-u="${esc(g.url)}" title="${esc(g.title)}"><img src="${esc(g.thumb)}" loading="lazy" alt=""></button>`).join("") : `<div class="muted small">Nada encontrado.</div>`;
    } catch (err) {
      grid.innerHTML = err.message === "sem chave"
        ? (isOwner() ? `<div class="small"><b>Configure os GIFs</b><p class="muted">Crie uma chave grátis em developers.giphy.com (API Key) e cole aqui:</p><div style="display:flex;gap:6px"><input class="input" id="gpk" placeholder="chave da API GIPHY"><button class="btn sm" onclick="saveGiphyKey()">Salvar</button></div></div>`
          : `<div class="muted small">Os GIFs ainda não foram ativados pelo OWNER.</div>`)
        : `<div class="muted small">Não consegui carregar os GIFs (${esc(err.message)}).</div>`;
    }
  };
  let t; qn.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => load(qn.value.trim()), 350); });
  grid.addEventListener("click", ev => { const b = ev.target.closest("button[data-u]"); if (!b) return; closeLayer(); const cid = currentChannel(); if (cid) sendMessage(cid, b.dataset.u, S.replyTo[cid] || null).then(() => cancelReply?.()); });
  setTimeout(() => qn.focus(), 30); load("");
}
async function saveGiphyKey() {
  const v = document.getElementById("gpk")?.value.trim(); if (!v) return;
  try { await q(sb.from("app_settings").upsert({ key: "giphy", value: { key: v }, updated_at: new Date().toISOString() })); giphyKey = v; toast("GIFs ativados para todo mundo"); closeLayer(); }
  catch (e) { toast(e.message); }
}
const GIF_RE = /^https:\/\/(media\d*|i)\.giphy\.com\/[^\s"'<>]+\.(gif|webp|mp4)$/i;
function msgText(m, extra = "") {
  const c = m.content.trim();
  if (GIF_RE.test(c)) return /\.mp4$/i.test(c) ? `<div class="att gifv"><video src="${esc(c)}" autoplay loop muted playsinline></video></div>` : `<div class="att gifv" onclick="openImage('${esc(c)}','GIF')"><img src="${esc(c)}" loading="lazy" alt="GIF"></div>`;
  // mensagem só com emojis → emojis grandes
  const toks = c.match(/:[a-zA-Z0-9_]{2,32}:|\p{Extended_Pictographic}/gu) || [];
  const rest = c.replace(/:[a-zA-Z0-9_]{2,32}:|\p{Extended_Pictographic}|[\uFE0F\u200D\s]|\p{Emoji_Modifier}/gu, "");
  const big = toks.length > 0 && toks.length <= 6 && !rest && toks.every(t => !t.startsWith(":") || S.emojis[t.slice(1, -1).toLowerCase()]);
  return `<div class="text ${big ? "jumbo" : ""}">${md(m.content)}${extra}</div>`;
}

// ================================================================ busca na conversa
function openSearch() {
  const cid = currentChannel(); if (!cid) return;
  let pane = document.getElementById("searchpane");
  if (pane) { pane.querySelector("input").focus(); return; }
  pane = Object.assign(document.createElement("aside"), { id: "searchpane", className: "searchpane" });
  pane.innerHTML = `<div class="sp-head">${I("search", 16)}<input class="input" placeholder="Buscar mensagens…" autocomplete="off"><button class="icon-btn" title="Fechar" onclick="this.closest('.searchpane').remove()">${I("x", 16)}</button></div><div class="sp-res"><div class="muted small" style="padding:12px">Digite para buscar nesta conversa.</div></div>`;
  ($("#members") || $("#chatcol")).insertAdjacentElement("afterend", pane);
  const inp = pane.querySelector("input"), res = pane.querySelector(".sp-res");
  let t;
  inp.addEventListener("input", () => {
    clearTimeout(t); const v = inp.value.trim();
    if (v.length < 2) { res.innerHTML = `<div class="muted small" style="padding:12px">Digite pelo menos 2 letras.</div>`; return; }
    t = setTimeout(async () => {
      res.innerHTML = `<div class="muted small" style="padding:12px">Buscando…</div>`;
      try {
        const rows = (await q(sb.from("messages").select("*").match(cidFilter(cid)).ilike("content", `%${v.replace(/[%_\\]/g, "\\$&")}%`).order("created_at", { ascending: false }).limit(40))).map(norm);
        await ensureUsers(rows.map(m => m.author));
        const hl = s => esc(s).replace(new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[&<>"']/g, c => esc(c)), "gi"), x => `<mark>${x}</mark>`);
        res.innerHTML = rows.length ? `<div class="muted small" style="padding:8px 12px">${rows.length}${rows.length === 40 ? "+" : ""} resultado${rows.length === 1 ? "" : "s"}</div>` + rows.map(m => { const u = S.users[m.author]; return `<div class="sp-item" onclick="searchJump('${m.id}','${esc(m.created)}')">${avatar(u, "", false)}<div class="grow"><b style="color:${esc(u?.color)}">${uname(u)}</b> <small class="muted">${fmtDay(m.ts)} ${fmtTime(m.ts)}</small><div class="sp-txt">${hl(m.content.slice(0, 220))}</div></div></div>`; }).join("")
          : `<div class="muted small" style="padding:12px">Nada encontrado para “${esc(v)}”.</div>`;
      } catch (e) { res.innerHTML = `<div class="muted small" style="padding:12px">${esc(e.message)}</div>`; }
    }, 300);
  });
  inp.focus();
}
async function searchJump(id, created) {
  const cid = currentChannel();
  for (let i = 0; i < 12 && !msgById(cid, id) && S.more[cid]; i++) { try { await loadMessages(cid, S.msgs[cid][0].created); } catch { break; } }
  if (!msgById(cid, id)) return toast("Não consegui chegar nessa mensagem.");
  rerenderMsgs(); jumpTo(id);
}
addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && currentChannel() && ["channel", "dm"].includes(S.route.name)) { e.preventDefault(); openSearch(); }
});

// ================================================================ barra de formatação (selecionar texto)
const FMT = [["bold", "**", "**", "Negrito"], ["italic", "*", "*", "Itálico"], ["underline", "__", "__", "Sublinhado"], ["strike", "~~", "~~", "Riscado"], ["highlight", "==", "==", "Marca-texto"], ["eyeOff", "||", "||", "Spoiler"], ["code", "`", "`", "Código"],
  ["heading", "# ", "", "Título"], ["type", "## ", "", "Subtítulo"], ["quote", "> ", "", "Citação"], ["list", "- ", "", "Lista"]];
function fmtBarFor(ta) {
  let bar = document.getElementById("fmtbar");
  const a = ta.selectionStart, b = ta.selectionEnd;
  if (a === b || document.activeElement !== ta) { bar?.remove(); return; }
  if (!bar) {
    bar = Object.assign(document.createElement("div"), { id: "fmtbar", className: "fmtbar" });
    bar.innerHTML = FMT.map(([ic, , , n], i) => `<button title="${n}" data-i="${i}">${I(ic, 16)}</button>`).join("");
    bar.addEventListener("mousedown", ev => ev.preventDefault());
    bar.addEventListener("click", ev => { const btn = ev.target.closest("button"); if (btn) applyFmt(ta, FMT[+btn.dataset.i]); });
    ta.closest(".composer").appendChild(bar);
  }
}
function applyFmt(ta, [, pre, post]) {
  const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value, sel = v.slice(a, b);
  let out;
  if (!post) out = sel.split("\n").map(l => (l.startsWith(pre) ? l.slice(pre.length) : pre + l)).join("\n"); // por linha
  else out = sel.startsWith(pre) && sel.endsWith(post) && sel.length >= pre.length + post.length ? sel.slice(pre.length, sel.length - post.length) : pre + sel + post;
  const lineStart = !post ? v.lastIndexOf("\n", a - 1) + 1 : a;
  if (!post && lineStart !== a) { ta.selectionStart = lineStart; return applyFmt(ta, [null, pre, post]); }
  ta.value = v.slice(0, a) + out + v.slice(b);
  ta.selectionStart = a; ta.selectionEnd = a + out.length; ta.dispatchEvent(new Event("input")); ta.focus();
}
document.addEventListener("selectionchange", () => { const ta = document.getElementById("input"); if (ta) fmtBarFor(ta); else document.getElementById("fmtbar")?.remove(); });
document.addEventListener("keydown", e => {
  const ta = e.target; if (ta?.id !== "input" || !(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase(), f = k === "b" ? FMT[0] : k === "i" ? FMT[1] : k === "u" ? FMT[2] : null;
  if (f && ta.selectionStart !== ta.selectionEnd) { e.preventDefault(); applyFmt(ta, f); }
});

// ================================================================ categorias de canais
S.cats = {}; // sid -> [{id,name,position}]
async function loadCats(sids) {
  if (!sids.length) return;
  try {
    const rows = await q(sb.from("channel_categories").select("*").in("server_id", sids));
    sids.forEach(s => (S.cats[s] = []));
    rows.forEach(c => (S.cats[c.server_id] ||= []).push(c));
    for (const s of sids) S.cats[s].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
  } catch {}
}
function chanSort(a, b) { return (a.position || 0) - (b.position || 0) || a.created_at.localeCompare(b.created_at); }
function channelItemHtml(s, c) {
  const r = S.route, inc = inCallUsers(c.id), owner = s.owner === uid();
  return `<a class="item ${r.params.cid === c.id ? "on" : ""} ${S.unread.has(c.id) && r.params.cid !== c.id ? "unread" : ""}" href="/server/${s.id}/channel/${c.id}" data-link onclick="closeNav()" ${owner ? `draggable="true" data-chan="${c.id}" oncontextmenu="channelMenu(event,'${s.id}','${c.id}')"` : ""}><span class="hash">#</span><span class="grow">${esc(c.name)}</span>${inc.length ? `<span class="incall" title="${inc.length} na call">${I("volume", 13)}${inc.length}</span>` : ""}</a>${inc.length ? `<div class="voice-users">${inc.map(id => `<span data-voice="${id}" title="${esc(dname(S.users[id]))}">${avatar(S.users[id], "", false)}</span>`).join("")}</div>` : ""}`;
}
function channelListHtml(s) {
  const cats = S.cats[s.id] || [], owner = s.owner === uid(), collapsed = new Set(S.prefs.collapsedCats || []);
  const chans = [...s.channels].sort(chanSort);
  const none = chans.filter(c => !c.category_id || !cats.some(k => k.id === c.category_id));
  const head = (id, name, catId) => `<div class="side-label cat-h ${collapsed.has(id) ? "closed" : ""}" data-cat="${catId || ""}" ${owner && catId ? `oncontextmenu="catMenu(event,'${s.id}','${catId}')"` : ""}>
    <span class="cat-name" onclick="toggleCat('${id}')">${catId ? I("chevD", 12) : ""}${esc(name)}</span>
    ${owner ? `<span class="cat-acts">${catId ? `<button class="icon-btn" title="Opções da categoria" onclick="catMenu(event,'${s.id}','${catId}')">${ICON.dots}</button>` : ""}<button class="icon-btn" title="Criar canal" onclick="S.newChanCat=${catId ? `'${catId}'` : "null"};createChannelModal('${s.id}')">${ICON.plus.replace("<svg", '<svg width="14"')}</button></span>` : ""}</div>`;
  let out = `<div class="chanlist" data-sid="${s.id}">`;
  out += head("_" + s.id, "Canais", null) + `<div class="cat-body" data-cat="">${collapsed.has("_" + s.id) ? none.filter(c => c.id === S.route.params.cid || S.unread.has(c.id)).map(c => channelItemHtml(s, c)).join("") : none.map(c => channelItemHtml(s, c)).join("")}</div>`;
  for (const k of cats) {
    const list = chans.filter(c => c.category_id === k.id), closed = collapsed.has(k.id);
    out += head(k.id, k.name, k.id) + `<div class="cat-body" data-cat="${k.id}">${(closed ? list.filter(c => c.id === S.route.params.cid || S.unread.has(c.id)) : list).map(c => channelItemHtml(s, c)).join("")}</div>`;
  }
  if (owner) out += `<button class="item add-cat" onclick="createCatModal('${s.id}')"><span class="hash">${I("folderTree", 16)}</span><span class="grow">Criar categoria</span></button>`;
  return out + "</div>";
}
function toggleCat(id) {
  const c = new Set(S.prefs.collapsedCats || []); c.has(id) ? c.delete(id) : c.add(id);
  setPref("collapsedCats", [...c]); renderChrome();
}
function createCatModal(sid, cat) {
  closeLayer();
  modal(h`<h2>${cat ? "Renomear categoria" : "Criar categoria"}</h2><form id="catf"><label class="f">Nome</label><input class="input" name="n" maxlength="32" required value="${esc(cat?.name || "")}" placeholder="ex: Jogos">
    <div class="err" id="caterr"></div><div class="acts"><button type="button" class="btn ghost" onclick="closeLayer()">Cancelar</button><button class="btn">${cat ? "Salvar" : "Criar"}</button></div></form>`, m => {
    $("#catf", m).addEventListener("submit", async e => {
      e.preventDefault(); const name = e.target.n.value.trim().slice(0, 32); if (!name) return;
      try {
        if (cat) { await q(sb.from("channel_categories").update({ name }).eq("id", cat.id)); cat.name = name; }
        else { const row = await q(sb.from("channel_categories").insert({ server_id: sid, name, position: (S.cats[sid] || []).length }).select().single()); (S.cats[sid] ||= []).push(row); }
        closeLayer(); renderChrome();
      } catch (err) { $("#caterr").textContent = err.message; }
    });
  });
}
function catMenu(e, sid, cid) {
  e.preventDefault(); e.stopPropagation();
  const cats = S.cats[sid] || [], i = cats.findIndex(c => c.id === cid), cat = cats[i];
  showCtx(e, `<button onclick="closeLayer();createCatModal('${sid}',S.cats['${sid}'].find(c=>c.id==='${cid}'))">${I("edit", 15)} Renomear</button>
    ${i > 0 ? `<button onclick="closeLayer();moveCat('${sid}','${cid}',-1)">${I("up", 15)} Subir</button>` : ""}${i < cats.length - 1 ? `<button onclick="closeLayer();moveCat('${sid}','${cid}',1)">${I("chevD", 15)} Descer</button>` : ""}
    <button onclick="closeLayer();S.newChanCat='${cid}';createChannelModal('${sid}')">${I("chat", 15)} Criar canal aqui</button>
    <button class="danger" onclick="closeLayer();deleteCat('${sid}','${cid}')">${I("trash", 15)} Apagar categoria</button>`);
}
async function moveCat(sid, cid, d) {
  const cats = S.cats[sid], i = cats.findIndex(c => c.id === cid), j = i + d; if (j < 0 || j >= cats.length) return;
  [cats[i], cats[j]] = [cats[j], cats[i]]; renderChrome();
  try { await Promise.all(cats.map((c, k) => c.position === k ? null : (c.position = k, q(sb.from("channel_categories").update({ position: k }).eq("id", c.id))))); } catch (e) { toast(e.message); }
}
async function deleteCat(sid, cid) {
  if (!await uiConfirm("Apagar a categoria? Os canais dela continuam, só ficam sem categoria.")) return;
  try { await q(sb.from("channel_categories").delete().eq("id", cid)); S.cats[sid] = S.cats[sid].filter(c => c.id !== cid); S.servers.find(s => s.id === sid)?.channels.forEach(c => { if (c.category_id === cid) c.category_id = null; }); renderChrome(); }
  catch (e) { toast(e.message); }
}
function channelMenu(e, sid, chid) {
  e.preventDefault(); e.stopPropagation();
  const cats = S.cats[sid] || [], s = S.servers.find(x => x.id === sid), c = s?.channels.find(x => x.id === chid); if (!c) return;
  showCtx(e, `<div class="ctx-label">Mover #${esc(c.name)} para</div>${[{ id: null, name: "Sem categoria" }, ...cats].map(k => `<button ${k.id === (c.category_id || null) ? "disabled" : ""} onclick="closeLayer();moveChannel('${sid}','${chid}',${k.id ? `'${k.id}'` : "null"},null)">${I("folderTree", 15)} ${esc(k.name)}</button>`).join("")}
    <button onclick="closeLayer();inviteModal('${sid}')">${ICON.link.replace("<svg", '<svg width="15"')} Convidar</button>`);
}
// coloca o canal na categoria `cat`, antes do canal `before` (ou no fim)
async function moveChannel(sid, chid, cat, before) {
  const s = S.servers.find(x => x.id === sid); if (!s) return;
  const ch = s.channels.find(c => c.id === chid); if (!ch) return;
  const list = s.channels.filter(c => (c.category_id || null) === cat && c.id !== chid).sort(chanSort);
  const at = before ? Math.max(0, list.findIndex(c => c.id === before)) : list.length;
  list.splice(at, 0, ch);
  const old = { cat: ch.category_id || null };
  ch.category_id = cat;
  const changed = list.map((c, i) => ({ c, i })).filter(({ c, i }) => c.position !== i || c === ch);
  changed.forEach(({ c, i }) => (c.position = i));
  renderChrome();
  try { await Promise.all(changed.map(({ c, i }) => q(sb.from("channels").update(c === ch ? { position: i, category_id: cat } : { position: i }).eq("id", c.id)))); }
  catch (e) { ch.category_id = old.cat; toast(e.message); renderChrome(); }
}
// arrastar canais (só o dono)
let dragChan = null;
document.addEventListener("dragstart", e => { const a = e.target.closest?.("[data-chan]"); if (!a) return; dragChan = a.dataset.chan; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", ""); a.classList.add("dragging"); });
document.addEventListener("dragend", () => { dragChan = null; document.querySelectorAll(".chanlist .dragging,.chanlist .over").forEach(x => x.classList.remove("dragging", "over")); });
document.addEventListener("dragover", e => {
  if (!dragChan) return; const t = e.target.closest?.(".chanlist [data-chan], .chanlist .cat-h, .chanlist .cat-body"); if (!t) return;
  e.preventDefault(); document.querySelectorAll(".chanlist .over").forEach(x => x !== t && x.classList.remove("over")); t.classList.add("over");
});
document.addEventListener("drop", e => {
  if (!dragChan) return; const t = e.target.closest?.(".chanlist [data-chan], .chanlist .cat-h, .chanlist .cat-body"); if (!t) return;
  e.preventDefault(); const sid = t.closest(".chanlist").dataset.sid, id = dragChan; dragChan = null;
  if (t.dataset.chan) { if (t.dataset.chan === id) return; const s = S.servers.find(x => x.id === sid), tc = s.channels.find(c => c.id === t.dataset.chan); moveChannel(sid, id, tc.category_id || null, tc.id); }
  else moveChannel(sid, id, t.dataset.cat || null, null);
});

// ================================================================ temas salvos
const THEME_KEYS = ["theme", "accent", "accent2", "wallpaper", "wallUrl", "wallBlur", "wallDim", "wallAnim", "panelOpacity", "glass", "radius", "gap", "font", "fontSize", "msgStyle", "avatarShape", "customCss"];
async function saveMyTheme() {
  const name = await uiPrompt("Nome do seu tema:", "Meu tema " + ((S.prefs.savedThemes || []).length + 1), { title: "Salvar tema", ok: "Salvar" }); if (!name?.trim()) return;
  const snap = Object.fromEntries(THEME_KEYS.map(k => [k, S.prefs[k]]));
  const list = [...(S.prefs.savedThemes || []).filter(t => t.name !== name.trim()), { name: name.trim().slice(0, 32), at: Date.now(), p: snap }].slice(-20);
  setPref("savedThemes", list); renderSettings(); toast("Tema salvo");
}
function applyMyTheme(i) { const t = S.prefs.savedThemes?.[i]; if (!t) return; Object.assign(S.prefs, t.p); setPref("theme", S.prefs.theme); renderSettings(); toast(`Tema “${t.name}” aplicado`); }
async function deleteMyTheme(i) { const l = [...(S.prefs.savedThemes || [])]; const [t] = l.splice(i, 1); if (!t || !await uiConfirm(`Apagar o tema “${t.name}”?`)) return; setPref("savedThemes", l); renderSettings(); }
function myThemesHtml() {
  const l = S.prefs.savedThemes || [];
  return `<div class="card mythemes"><div style="display:flex;align-items:center;gap:10px;margin-bottom:${l.length ? 10 : 0}px"><b class="grow">${I("save", 16)} Meus temas</b><button class="btn sm" onclick="saveMyTheme()">Salvar o visual atual</button></div>
    ${l.length ? `<div class="mt-list">${l.map((t, i) => { const th = THEMES[t.p.theme] || THEMES.meianoite; return `<div class="mt-item"><button class="mt-pv" onclick="applyMyTheme(${i})" title="Aplicar" style="background:linear-gradient(135deg,${esc(t.p.accent)},${esc(t.p.accent2)}),${th.bg1}"><span style="background:${th.bg1}"></span></button><span class="grow">${esc(t.name)}</span><button class="icon-btn" title="Apagar" onclick="deleteMyTheme(${i})">${I("trash", 14)}</button></div>`; }).join("")}</div>` : `<div class="muted small">Monte um visual do seu jeito e salve aqui para voltar a ele quando quiser.</div>`}</div>`;
}

// ================================================================ abertura (logo + som + curiosidades)
const CUP_FACTS = [
  "O Cuplock é feito em Rust (Tauri), por isso o app de PC é bem mais leve que um app em Electron.",
  "Dá para arrastar e redimensionar as janelas do menu: Configurações → Aparência → Janelas.",
  "Selecione um texto na caixa de mensagem para aparecer a barra de formatação.",
  "Use ||spoiler|| para esconder um texto até alguém clicar.",
  "Ctrl K abre a busca rápida; Ctrl F busca dentro da conversa.",
  "Fixe seus melhores amigos com a estrela: eles ficam no topo, com a cor que você escolher.",
  "O dono do servidor pode criar emojis próprios e usar em mensagens, reações e no nome.",
  "O CupClip deixa você cortar, dar zoom e escrever no vídeo antes de enviar.",
  "Com o modo desenvolvedor dá para criar bots montando blocos.",
  "Os temas Frutiger Aero, 2015 Vibez, Natal e Halloween mudam o visual inteiro.",
  "Você pode salvar seus próprios temas em Aparência → Meus temas.",
  "Vídeos e áudios de até 50 MB vão sem pagar nada.",
  "O Cupdive é o feed do Cuplock: posts, curtidas, comentários e áudios.",
  "Mensagens com só emojis aparecem em tamanho grande.",
];
function startSplash() {
  const sp = document.getElementById("splash"); if (!sp) return;
  const logo = sp.querySelector(".sp-logo"); if (logo && typeof cupLogo === "function") logo.innerHTML = cupLogo(120);
  let audioDone = false, factT = null, shown = Date.now();
  const facts = () => {
    const f = sp.querySelector(".sp-fact"); if (!f || factT) return;
    const order = [...CUP_FACTS].sort(() => Math.random() - .5); let i = 0;
    const next = () => { f.classList.remove("in"); setTimeout(() => { f.textContent = order[i++ % order.length]; f.classList.add("in"); }, 250); };
    next(); factT = setInterval(next, 4200);
  };
  const finish = () => { audioDone = true; facts(); };
  const p = S.prefs || {};
  if (p.splashSound !== false && !p.reduceMotion) {
    const a = new Audio("sounds/intro.mp3"); a.volume = .8;
    a.onended = finish; a.onerror = finish;
    a.play().catch(() => setTimeout(finish, 1800));
    sp.addEventListener("click", () => { a.pause(); finish(); });
    setTimeout(finish, 12000);
  } else setTimeout(finish, 900);
  const ready = () => S.loaded || (S.route && ["login", "setup", "invite", "pwa", "notfound"].includes(S.route.name)) || (typeof sb !== "undefined" && !sb);
  const iv = setInterval(() => {
    const done = audioDone && ready();
    if (done || Date.now() - shown > 25000) {
      clearInterval(iv); clearInterval(factT);
      sp.classList.add("out"); setTimeout(() => sp.remove(), 600);
    }
  }, 150);
}

// ================================================================ ganchos no app
(() => {
  const _boot = bootstrap;
  bootstrap = async (...a) => { const r = await _boot(...a); await Promise.all([loadCats(S.servers.map(s => s.id)), loadEmojis()]); loadGhosts(); return r; };
  const _ls = loadServer;
  loadServer = async sid => { const r = await _ls(sid); await loadCats([sid]); return r; };
  const _lm = loadMessages;
  loadMessages = async (cid, before) => { const r = await _lm(cid, before); await loadReactions((S.msgs[cid] || []).filter(m => !(m.id in S.reactions)).map(m => m.id)); return r; };
  const _cb = connectBff;
  connectBff = (...a) => { _cb(...a); connectV38(); };
  const _rs = renderSettings;
  renderSettings = (...a) => {
    const r = _rs(...a);
    const sec = document.querySelector(".settings section");
    if (sec && settingsTab === "appearance" && !sec.querySelector(".mythemes")) sec.querySelector("h2")?.insertAdjacentHTML("afterend", myThemesHtml());
    if (sec && settingsTab === "notifications" && !sec.querySelector("#splashrow")) sec.querySelector("h2")?.insertAdjacentHTML("afterend", `<div class="row" id="splashrow"><div class="l"><b>Som de abertura</b><span>Toca o som do Cuplock quando o app abre</span></div><button class="toggle ${S.prefs.splashSound !== false ? "on" : ""}" onclick="setPref('splashSound',S.prefs.splashSound===false);renderSettings()"></button></div>`);
    return r;
  };
  const _sm = serverMenu;
  serverMenu = (e, sid) => {
    _sm(e, sid);
    const s = S.servers.find(x => x.id === sid), ctx = document.querySelector(".ctx");
    if (ctx && s?.owner === uid()) ctx.insertAdjacentHTML("afterbegin", `<button onclick="closeLayer();emojiManager('${sid}')">${I("smile", 15)} Emojis do servidor</button><button onclick="closeLayer();createCatModal('${sid}')">${I("folderTree", 15)} Criar categoria</button>`);
  };
  applyPrefs();
  // se o app já tinha carregado antes deste arquivo, completa agora
  if (S.loaded) bootstrapLate();
})();
async function bootstrapLate() {
  await Promise.all([loadCats(S.servers.map(s => s.id)), loadEmojis()]);
  if (typeof presenceCh !== "undefined" && presenceCh) connectV38();
  loadGhosts(); try { render(); } catch {}
}
let v38Ch;
function connectV38() {
  if (v38Ch) sb.removeChannel(v38Ch);
  const reload = sid => { if (S.servers.some(s => s.id === sid)) loadServer(sid).then(() => renderChrome()).catch(() => {}); };
  v38Ch = sb.channel("cuplock-v38-" + uid())
    .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, p => {
      const row = p.new?.message_id ? p.new : p.old; if (!row?.message_id) return;
      if (!(row.message_id in S.reactions)) { if (!Object.values(S.msgs).some(l => l.some(m => m.id === row.message_id))) return; S.reactions[row.message_id] = {}; }
      const r = S.reactions[row.message_id], list = (r[row.emoji] ||= []);
      if (p.eventType === "INSERT") { if (!list.includes(row.user_id)) list.push(row.user_id); ensureUsers([row.user_id]).catch(() => {}); }
      else if (p.eventType === "DELETE") r[row.emoji] = list.filter(x => x !== row.user_id);
      if ((S.msgs[currentChannel()] || []).some(m => m.id === row.message_id)) rerenderMsgs();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "channel_categories" }, p => reload((p.new || p.old)?.server_id))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "channels" }, p => reload(p.new?.server_id))
    .on("postgres_changes", { event: "*", schema: "public", table: "server_emojis" }, () => loadEmojis())
    .subscribe();
}
startSplash();
