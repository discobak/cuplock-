"use strict";
/* ============================================================
   Cupdive — o feed do Cuplock (posts, fotos, vídeos, voz,
   curtidas, comentários e respostas) + mensagens de voz.
   Carregado antes do app.js; usa as funções dele em tempo de execução.
   ============================================================ */

const FEED = { tab: "all", posts: [], more: false, loading: false, fresh: [], cache: new Map(), liked: new Set() };
const drafts = {};           // estado de cada caixa de postagem (mídia anexada)
const FEED_PAGE = 20;
const FEED_TYPES = {
  image: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
};

function timeAgo(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return Math.floor(s / 60) + " min";
  if (s < 86400) return Math.floor(s / 3600) + " h";
  if (s < 604800) return Math.floor(s / 86400) + " d";
  return new Date(ts).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}
const fmtDur = s => `${Math.floor((s || 0) / 60)}:${String(Math.round(s || 0) % 60).padStart(2, "0")}`;
const normPost = p => ({ ...p, ts: Date.parse(p.created_at) });
function cachePosts(list) { for (const p of list) FEED.cache.set(p.id, p); return list; }

// ---------------------------------------------------------------- mensagens de voz (gravar)
let rec = null;
async function startVoice(box, onDone) {
  if (rec) return;
  if (!window.MediaRecorder) return toast("Gravação de voz não é suportada aqui.");
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: typeof audioConstraints === "function" ? audioConstraints() : true }); }
  catch { return toast("Não consegui acessar o microfone."); }
  const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find(m => MediaRecorder.isTypeSupported(m)) || "";
  const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined);
  const chunks = []; const t0 = Date.now();
  mr.ondataavailable = e => e.data.size && chunks.push(e.data);
  mr.start(250);
  const bar = document.createElement("div"); bar.className = "recbar";
  bar.innerHTML = `<span class="recdot"></span><b id="rect">0:00</b><div class="recwave">${"<i></i>".repeat(18)}</div>
    <button class="icon-btn" title="Cancelar" onclick="stopVoice(false)">${ICON.x}</button><button class="send-btn" title="Enviar" onclick="stopVoice(true)">${ICON.send}</button>`;
  box.classList.add("recording"); box.appendChild(bar);
  rec = { mr, stream, box, bar, onDone, t0 };
  // barrinhas reagindo à voz
  try {
    const ctx = new AudioContext(), an = ctx.createAnalyser(); an.fftSize = 64; ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.frequencyBinCount); rec.ctx = ctx;
    rec.timer = setInterval(() => {
      const el = document.getElementById("rect"); if (!el || !rec) return;
      const s = (Date.now() - t0) / 1000; el.textContent = fmtDur(s);
      an.getByteFrequencyData(buf);
      box.querySelectorAll(".recwave i").forEach((b, i) => (b.style.height = 4 + (buf[i % buf.length] / 255) * 22 + "px"));
      if (s >= 180) stopVoice(true);
    }, 90);
  } catch { rec.timer = setInterval(() => { const el = document.getElementById("rect"); if (el) el.textContent = fmtDur((Date.now() - t0) / 1000); }, 250); }
  mr.onstop = () => {
    const r = rec; rec = null;
    clearInterval(r.timer); r.ctx?.close?.(); r.stream.getTracks().forEach(t => t.stop());
    r.bar.remove(); r.box.classList.remove("recording");
    if (r.send) {
      const type = (mr.mimeType || mime || "audio/webm").split(";")[0];
      const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
      const dur = (Date.now() - r.t0) / 1000;
      if (dur < 0.8) return toast("Áudio muito curto.");
      r.onDone(new File(chunks, `voz.${ext}`, { type }), dur);
    }
  };
}
function stopVoice(send) { if (!rec) return; rec.send = send; rec.mr.stop(); }

// ---------------------------------------------------------------- mensagens de voz (tocar)
let voiceAudio = null, voiceEl = null;
function voiceHtml(url, dur, mine) {
  let h = 0; for (const c of url) h = (h * 31 + c.charCodeAt(0)) | 0;
  const bars = Array.from({ length: 28 }, (_, i) => { h = (h * 1103515245 + 12345) | 0; return 25 + Math.abs(h % 75); });
  return `<div class="voice ${mine ? "mine" : ""}" data-src="${esc(url)}" data-dur="${dur || 0}"><button class="vplay" onclick="event.stopPropagation();playVoice(this.parentNode)">▶</button>
    <div class="vwave" onclick="event.stopPropagation();seekVoice(event,this.parentNode)">${bars.map(b => `<i style="height:${b}%"></i>`).join("")}</div><span class="vtime">${fmtDur(dur)}</span></div>`;
}
function paintVoice(el, frac) {
  const bars = el.querySelectorAll(".vwave i"), n = Math.round(frac * bars.length);
  bars.forEach((b, i) => b.classList.toggle("on", i < n));
}
function playVoice(el) {
  const src = el.dataset.src;
  if (voiceEl === el && voiceAudio) { if (voiceAudio.paused) voiceAudio.play(); else voiceAudio.pause(); return; }
  if (voiceAudio) { voiceAudio.pause(); if (voiceEl) { voiceEl.querySelector(".vplay").textContent = "▶"; paintVoice(voiceEl, 0); } }
  voiceEl = el; voiceAudio = new Audio(src);
  if (S.prefs.speakerId && voiceAudio.setSinkId) voiceAudio.setSinkId(S.prefs.speakerId).catch(() => {});
  const btn = el.querySelector(".vplay"), t = el.querySelector(".vtime"), dur = +el.dataset.dur || 0;
  voiceAudio.onplay = () => (btn.textContent = "❚❚");
  voiceAudio.onpause = () => (btn.textContent = "▶");
  voiceAudio.ontimeupdate = () => { const d = isFinite(voiceAudio.duration) ? voiceAudio.duration : dur; paintVoice(el, d ? voiceAudio.currentTime / d : 0); t.textContent = fmtDur(voiceAudio.currentTime); };
  voiceAudio.onended = () => { btn.textContent = "▶"; paintVoice(el, 0); t.textContent = fmtDur(dur); };
  voiceAudio.play().catch(() => toast("Não consegui tocar o áudio."));
}
function seekVoice(e, el) {
  if (voiceEl !== el || !voiceAudio) return playVoice(el);
  const r = e.currentTarget.getBoundingClientRect(), d = isFinite(voiceAudio.duration) ? voiceAudio.duration : +el.dataset.dur;
  if (d) voiceAudio.currentTime = ((e.clientX - r.left) / r.width) * d;
}

// voz no chat
function chatVoice() {
  const cid = currentChannel(), box = document.querySelector(".composer-box"); if (!cid || !box) return;
  startVoice(box, async (file, dur) => {
    const temp = { id: "tmp" + Math.random(), channel: cid, author: uid(), content: "", ts: Date.now(), pending: true, attachment: { url: URL.createObjectURL(file), type: file.type, duration: dur, local: true } };
    (S.msgs[cid] ||= []).push(temp); if (currentChannel() === cid) appendMessage(temp);
    try {
      const url = await uploadTo("attachments", file);
      const att = { url, type: file.type, duration: Math.round(dur * 10) / 10, size: file.size, name: file.name };
      const m = norm(await q(sb.from("messages").insert({ ...cidFilter(cid), content: "", attachment: att }).select().single()));
      const l = S.msgs[cid], k = l.indexOf(temp); if (k >= 0) { if (l.some(x => x.id === m.id)) l.splice(k, 1); else l[k] = m; }
    } catch (e) { temp.pending = false; temp.failed = true; toast(e.message); }
    if (currentChannel() === cid) appendMessage(S.msgs[cid].at(-1));
  });
}

// ---------------------------------------------------------------- caixa de postagem
function composerHtml(id, placeholder, parentId) {
  const me = S.me;
  return `<div class="pcomposer" id="pc-${id}" data-parent="${parentId || ""}">${avatar(me, "lg", false)}
    <div class="pc-main"><textarea rows="${parentId ? 1 : 2}" maxlength="2000" placeholder="${esc(placeholder)}" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,320)+'px'"></textarea>
    <div class="pc-media"></div>
    <div class="pc-bar"><div class="pc-tools">
      <button class="icon-btn" title="Foto ou vídeo" onclick="pickPostMedia('${id}')">🖼️</button>
      <button class="icon-btn" title="Mensagem de voz" onclick="recordPostVoice('${id}')">🎙️</button>
      </div><span class="pc-count"></span><button class="btn sm" onclick="submitPost('${id}')">${parentId ? "Responder" : "Publicar"}</button></div></div></div>`;
}
async function pickPostMedia(id) {
  const [f] = await pickFile([...FEED_TYPES.image, ...FEED_TYPES.video].join(","), false); if (!f) return;
  const kind = FEED_TYPES.image.includes(f.type) ? "image" : FEED_TYPES.video.includes(f.type) ? "video" : null;
  if (!kind) return toast("Formato não suportado. Use imagem (PNG, JPG, WEBP, GIF) ou vídeo (MP4, WEBM, MOV).");
  if (f.size > 50 * 1048576) return toast("Arquivo até 50 MB.");
  setDraftMedia(id, { file: f, kind, url: URL.createObjectURL(f) });
}
function recordPostVoice(id) {
  const bar = document.querySelector(`#pc-${id} .pc-bar`); if (!bar) return;
  startVoice(bar, (file, dur) => setDraftMedia(id, { file, kind: "audio", url: URL.createObjectURL(file), duration: dur }));
}
function setDraftMedia(id, media) {
  if (drafts[id]?.media?.url) URL.revokeObjectURL(drafts[id].media.url);
  drafts[id] = { media };
  const box = document.querySelector(`#pc-${id} .pc-media`); if (!box) return;
  if (!media) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="pc-prev">${media.kind === "image" ? `<img src="${media.url}">` : media.kind === "video" ? `<video src="${media.url}" controls playsinline></video>` : voiceHtml(media.url, media.duration)}
    <button class="pc-x" title="Remover" onclick="setDraftMedia('${id}', null)">✕</button></div>`;
}
async function mediaMeta(m) {
  const meta = { type: m.kind, size: m.file.size };
  if (m.kind === "audio") meta.duration = Math.round(m.duration * 10) / 10;
  if (m.kind === "image") { try { const b = await createImageBitmap(m.file); meta.w = b.width; meta.h = b.height; } catch {} }
  if (m.kind === "video") {
    await new Promise(res => { const v = document.createElement("video"); v.preload = "metadata"; v.onloadedmetadata = () => { meta.w = v.videoWidth; meta.h = v.videoHeight; meta.duration = Math.round(v.duration * 10) / 10; res(); }; v.onerror = res; v.src = m.url; setTimeout(res, 4000); });
  }
  return meta;
}
async function submitPost(id) {
  const box = document.getElementById("pc-" + id); if (!box) return;
  const ta = box.querySelector("textarea"), btn = box.querySelector(".pc-bar .btn");
  const content = ta.value.trim(), media = drafts[id]?.media, parentId = box.dataset.parent || null;
  if (!content && !media) return toast("Escreva algo ou anexe uma mídia.");
  btn.disabled = true; btn.textContent = media ? "Enviando…" : "Publicando…";
  try {
    let mediaJson = null;
    if (media) {
      const meta = await mediaMeta(media);
      const url = await uploadTo("feed", media.file, media.kind === "image" && media.file.type !== "image/gif" ? { maxSide: 2048 } : {});
      mediaJson = { ...meta, url };
    }
    const par = parentId ? FEED.cache.get(parentId) : null, before = par?.replies_count || 0;
    const row = await q(sb.from("posts").insert({ content, media: mediaJson, parent_id: parentId }).select().single());
    // o aviso em tempo real pode chegar antes desta resposta: reaproveita o mesmo objeto
    const p = FEED.cache.get(row.id) || cachePosts([normPost(row)])[0];
    ta.value = ""; ta.style.height = ""; setDraftMedia(id, null);
    if (parentId) { if (par) par.replies_count = Math.max(par.replies_count, before + 1); onNewReply(p); }
    else { if (!FEED.posts.some(x => x.id === p.id)) FEED.posts.unshift(p); FEED.fresh = FEED.fresh.filter(x => x.id !== p.id); drawFeedList(); }
    toast(parentId ? "Resposta enviada" : "Publicado no Cupdive ☕");
  } catch (e) { toast(e.message); }
  btn.disabled = false; btn.textContent = parentId ? "Responder" : "Publicar";
}

// ---------------------------------------------------------------- render de um post
function mediaHtml(m, mine) {
  if (!m?.url || !SAFE_URL.test(m.url)) return "";
  const ratio = m.w && m.h ? `aspect-ratio:${m.w}/${m.h};` : "";
  if (m.type === "image") return `<div class="pmedia" onclick="event.stopPropagation();openImage('${esc(m.url)}','imagem')"><img src="${esc(m.url)}" loading="lazy" style="${ratio}" alt=""></div>`;
  if (m.type === "video") return `<div class="pmedia" onclick="event.stopPropagation()"><video src="${esc(m.url)}" controls playsinline preload="metadata" style="${ratio}"></video></div>`;
  if (m.type === "audio") return `<div onclick="event.stopPropagation()">${voiceHtml(m.url, m.duration, mine)}</div>`;
  return "";
}
function postHtml(p, { detail = false, reply = false } = {}) {
  const u = S.users[p.author], mine = p.author === uid(), liked = FEED.liked.has(p.id);
  const parent = reply && p.parent_id && p.parent_id !== p.root_id ? FEED.cache.get(p.parent_id) : null;
  return `<article class="post ${detail ? "detail" : ""} ${reply ? "reply" : ""}" data-post="${p.id}" ${detail || reply ? "" : `onclick="openPost('${p.id}')"`}>
    <div class="p-av" onclick="event.stopPropagation();profilePopout(event,'${p.author}')">${avatar(u, reply ? "" : "lg", false)}</div>
    <div class="p-body">
      <div class="p-head"><b onclick="event.stopPropagation();profilePopout(event,'${p.author}')">${uname(u)}</b><span class="muted">@${esc(u?.username || "")} · ${timeAgo(p.ts)}</span>
        <button class="icon-btn p-more" title="Mais" onclick="event.stopPropagation();postMenu(event,'${p.id}')">${ICON.dots}</button></div>
      ${parent ? `<div class="muted small">respondendo a <b>@${esc(S.users[parent.author]?.username || "")}</b></div>` : ""}
      ${p.content ? `<div class="p-text text">${md(p.content)}</div>` : ""}
      ${mediaHtml(p.media, mine)}
      <div class="p-actions">
        <button class="pa ${liked ? "liked" : ""}" onclick="event.stopPropagation();toggleLike('${p.id}')" title="Curtir"><span class="heart">${liked ? "♥" : "♡"}</span><span data-likes="${p.id}">${p.likes_count || ""}</span></button>
        <button class="pa" onclick="event.stopPropagation();${reply ? `replyTo('${p.id}')` : `openPost('${p.id}',true)`}" title="Comentar">💬 <span data-replies="${p.id}">${p.replies_count || ""}</span></button>
        <button class="pa" onclick="event.stopPropagation();sharePost('${p.id}')" title="Compartilhar">↗</button>
      </div>
      <div class="reply-slot" id="rs-${p.id}"></div>
    </div></article>`;
}
function postMenu(e, id) {
  const p = FEED.cache.get(id); if (!p) return;
  showCtx(e, `<button onclick="copy(FEED.cache.get('${id}').content||'');closeLayer()">Copiar texto</button>
    <button onclick="closeLayer();navigate('/user/${p.author}')">Ver perfil</button>
    ${p.author === uid() ? `<button class="danger" onclick="deletePost('${id}')">Apagar</button>` : ""}`);
}
function sharePost(id) {
  const p = FEED.cache.get(id); if (!p) return;
  const friends = S.friends.map(f => S.users[f]).filter(Boolean);
  modal(`<h2>Compartilhar post</h2><p class="sub">Mande para um amigo pela DM.</p><div style="max-height:300px;overflow-y:auto;margin-top:12px">
    ${friends.length ? friends.map(u => `<div class="item" style="cursor:default">${avatar(u)}<span class="grow">${uname(u)}</span><button class="btn ghost sm" onclick="sendPostTo('${u.id}','${id}',this)">Enviar</button></div>`).join("") : '<p class="muted">Adicione amigos para compartilhar.</p>'}</div>`);
}
async function sendPostTo(friendId, postId, btn) {
  const p = FEED.cache.get(postId), a = S.users[p.author];
  const text = `📌 Post de @${a?.username}${p.content ? `:\n> ${p.content.slice(0, 280)}` : ""}\n(veja no Cupdive)`;
  btn.disabled = true;
  try { await q(sb.from("messages").insert({ dm_key: dmId(uid(), friendId).slice(3), content: text })); btn.textContent = "Enviado ✓"; }
  catch (e) { toast(e.message); btn.disabled = false; }
}
async function deletePost(id) {
  closeLayer();
  if (!confirm("Apagar este post? Os comentários também somem.")) return;
  try {
    await q(sb.from("posts").delete().eq("id", id));
    removePostLocal(id); toast("Post apagado");
    if (S.route.name === "post" && S.route.params.id === id) navigate("/feed");
  } catch (e) { toast(e.message); }
}
function removePostLocal(id) {
  const p = FEED.cache.get(id);
  FEED.posts = FEED.posts.filter(x => x.id !== id); FEED.cache.delete(id);
  document.querySelectorAll(`[data-post="${id}"]`).forEach(el => el.remove());
  if (p?.parent_id) { const par = FEED.cache.get(p.parent_id); if (par) { par.replies_count = Math.max(0, par.replies_count - 1); updateCounts(par); } }
}
async function toggleLike(id) {
  const p = FEED.cache.get(id); if (!p) return;
  const was = FEED.liked.has(id);
  if (was) { FEED.liked.delete(id); p.likes_count = Math.max(0, p.likes_count - 1); } else { FEED.liked.add(id); p.likes_count++; }
  updateCounts(p);
  try {
    if (was) await q(sb.from("post_likes").delete().eq("post_id", id).eq("user_id", uid()));
    else await q(sb.from("post_likes").insert({ post_id: id }));
  } catch (e) {
    if (!/Isso já existe/.test(e.message)) { if (was) { FEED.liked.add(id); p.likes_count++; } else { FEED.liked.delete(id); p.likes_count--; } updateCounts(p); toast(e.message); }
  }
}
function updateCounts(p) {
  document.querySelectorAll(`[data-likes="${p.id}"]`).forEach(el => {
    el.textContent = p.likes_count || "";
    const b = el.closest(".pa"); const on = FEED.liked.has(p.id);
    b.classList.toggle("liked", on); b.querySelector(".heart").textContent = on ? "♥" : "♡";
    if (on) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
  });
  document.querySelectorAll(`[data-replies="${p.id}"]`).forEach(el => (el.textContent = p.replies_count || ""));
}
async function loadLiked(ids) {
  if (!ids.length) return;
  const rows = await q(sb.from("post_likes").select("post_id").eq("user_id", uid()).in("post_id", ids));
  rows.forEach(r => FEED.liked.add(r.post_id));
}

// ---------------------------------------------------------------- tela do feed
async function renderFeed(main) {
  document.title = "Cupdive — Cuplock";
  main.innerHTML = `<div class="top">${navBtn()}<span class="hash" style="font-size:20px">🌊</span><h1>Cupdive</h1>
      <div class="tabs" style="margin-left:10px">${[["all", "Para você"], ["friends", "Amigos"]].map(([k, n]) => `<button class="tab ${FEED.tab === k ? "on" : ""}" onclick="FEED.tab='${k}';loadFeed(true)">${n}</button>`).join("")}</div>
      <div class="spacer"></div></div>
    <div class="content" id="feedscroll"><div class="feed">
      ${composerHtml("main", "O que está rolando?", null)}
      <button class="fresh-pill" id="freshpill" style="display:none" onclick="showFresh()"></button>
      <div id="feedlist"><div class="empty"><div class="muted">Carregando…</div></div></div>
    </div></div>`;
  if (!FEED.posts.length || FEED.loadedTab !== FEED.tab) await loadFeed(true); else drawFeedList();
}
async function loadFeed(reset) {
  if (FEED.loading) return;
  FEED.loading = true;
  if (reset) { FEED.posts = []; FEED.fresh = []; FEED.loadedTab = FEED.tab; document.querySelectorAll(".feed ~ .tabs .tab, .top .tab").forEach(t => t.classList.toggle("on", t.textContent === (FEED.tab === "all" ? "Para você" : "Amigos"))); }
  try {
    let qb = sb.from("posts").select("*").is("parent_id", null).order("created_at", { ascending: false }).limit(FEED_PAGE + 1);
    if (FEED.tab === "friends") qb = qb.in("author", [uid(), ...S.friends]);
    const last = FEED.posts.at(-1); if (!reset && last) qb = qb.lt("created_at", last.created_at);
    const rows = (await q(qb)).map(normPost);
    FEED.more = rows.length > FEED_PAGE;
    const page = cachePosts(rows.slice(0, FEED_PAGE));
    await Promise.all([ensureUsers(page.map(p => p.author)), loadLiked(page.map(p => p.id))]);
    FEED.posts.push(...page.filter(p => !FEED.posts.some(x => x.id === p.id)));
  } catch (e) { toast(e.message); }
  FEED.loading = false;
  drawFeedList();
}
function drawFeedList() {
  const el = document.getElementById("feedlist"); if (!el) return;
  el.innerHTML = FEED.posts.length ? FEED.posts.map(p => postHtml(p)).join("") + (FEED.more ? `<button class="load-more" onclick="loadFeed(false)">Carregar mais</button>` : `<p class="muted small" style="text-align:center;padding:24px">Você chegou ao fim ☕</p>`)
    : `<div class="empty"><div class="e">🌊</div><div>${FEED.tab === "friends" ? "Seus amigos ainda não postaram nada." : "Ninguém postou ainda. Seja o primeiro!"}</div></div>`;
  const pill = document.getElementById("freshpill");
  if (pill) { pill.style.display = FEED.fresh.length ? "" : "none"; pill.textContent = `↑ ${FEED.fresh.length} post${FEED.fresh.length > 1 ? "s" : ""} novo${FEED.fresh.length > 1 ? "s" : ""}`; }
}
function showFresh() {
  FEED.posts = [...FEED.fresh.filter(p => !FEED.posts.some(x => x.id === p.id)), ...FEED.posts]; FEED.fresh = [];
  drawFeedList(); document.getElementById("feedscroll")?.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------------------------------------------------------------- post aberto (com comentários)
function openPost(id, focus) { navigate("/post/" + id); if (focus) setTimeout(() => document.querySelector("#pc-detail textarea")?.focus(), 400); }
async function renderPostPage(main) {
  const id = S.route.params.id;
  main.innerHTML = `<div class="top">${navBtn()}<button class="icon-btn" title="Voltar" onclick="history.length > 1 ? history.back() : navigate('/feed')">←</button><h1>Post</h1><div class="spacer"></div></div>
    <div class="content"><div class="feed" id="postpage"><div class="empty"><div class="muted">Carregando…</div></div></div></div>`;
  try {
    let p = FEED.cache.get(id);
    if (!p) { const r = await q(sb.from("posts").select("*").eq("id", id).maybeSingle()); if (!r) throw new Error("Este post foi apagado."); p = normPost(r); cachePosts([p]); }
    const replies = (await q(sb.from("posts").select("*").eq("root_id", p.root_id || p.id).order("created_at", { ascending: true }).limit(500))).map(normPost);
    cachePosts(replies);
    await Promise.all([ensureUsers([p.author, ...replies.map(r => r.author)]), loadLiked([p.id, ...replies.map(r => r.id)])]);
    if (S.route.name !== "post" || S.route.params.id !== id) return;
    const pg = document.getElementById("postpage");
    pg.dataset.root = p.root_id || p.id;
    pg.innerHTML = (p.parent_id ? `<button class="load-more" onclick="navigate('/post/${p.root_id}')">↑ Ver o post original</button>` : "") + postHtml(p, { detail: true }) +
      `<div class="replies-head">Comentários</div>${composerHtml("detail", "Escreva um comentário…", p.id)}<div id="replies"></div>`;
    drawReplies(p.id, replies);
    document.title = `${dname(S.users[p.author])} no Cupdive`;
  } catch (e) { document.getElementById("postpage").innerHTML = `<div class="empty"><div class="e">🫥</div>${esc(e.message)}</div>`; }
}
function drawReplies(postId, all) {
  const box = document.getElementById("replies"); if (!box) return;
  // comentários diretos + respostas agrupadas debaixo de cada comentário
  const byParent = {}; for (const r of all) (byParent[r.parent_id] ||= []).push(r);
  const descend = (pid, depth) => (byParent[pid] || []).map(r => postHtml(r, { reply: true }) + (byParent[r.id] ? `<div class="thread">${descend(r.id, depth + 1)}</div>` : "")).join("");
  const html = descend(postId, 0);
  box.innerHTML = html || `<p class="muted small" style="text-align:center;padding:18px">Nenhum comentário ainda. Comece a conversa!</p>`;
}
function replyTo(id) {
  const slot = document.getElementById("rs-" + id); if (!slot) return;
  if (slot.innerHTML) { slot.innerHTML = ""; return; }
  document.querySelectorAll(".reply-slot").forEach(s => { if (s !== slot) s.innerHTML = ""; });
  const u = S.users[FEED.cache.get(id)?.author];
  slot.innerHTML = composerHtml("r" + id.slice(0, 8), `Responder @${u?.username || ""}…`, id);
  slot.querySelector("textarea").focus();
}
function onNewReply(p) {
  if (S.route.name !== "post") return;
  const pg = document.getElementById("postpage"); if (!pg || pg.dataset.root !== (p.root_id || "")) return;
  const all = [...FEED.cache.values()].filter(x => x.root_id === p.root_id).sort((a, b) => a.ts - b.ts);
  drawReplies(S.route.params.id === p.root_id ? p.root_id : S.route.params.id, all);
  const par = FEED.cache.get(p.parent_id); if (par) updateCounts(par);
}

// ---------------------------------------------------------------- tempo real
async function feedEvent(type, row) {
  if (type === "DELETE") { if (row?.id) removePostLocal(row.id); return; }
  const p = normPost(row);
  if (type === "UPDATE") {
    const c = FEED.cache.get(p.id); if (!c) return;
    c.likes_count = p.likes_count; c.replies_count = p.replies_count; updateCounts(c); return;
  }
  if (FEED.cache.has(p.id)) return;                 // foi eu que postei
  await ensureUsers([p.author]).catch(() => {});
  cachePosts([p]);
  if (!p.parent_id) {
    if (FEED.tab === "friends" && ![uid(), ...S.friends].includes(p.author)) return;
    if (FEED.posts.some(x => x.id === p.id) || FEED.fresh.some(x => x.id === p.id)) return;
    if (p.author === uid()) { FEED.posts.unshift(p); } else FEED.fresh.unshift(p);
    if (S.route.name === "feed") drawFeedList();
  } else onNewReply(p);
}
