"use strict";
/* ============================================================
   Cuplock — calls (voz, vídeo, tela), fotos, uploads e atualização.
   Carregado antes do app.js; usa as funções globais dele em tempo de execução.
   ============================================================ */

// ---------------------------------------------------------------- utilidades
const SAFE_URL = /^https:\/\/[^\s"'()<>\\]+$/;
function dname(u) { return (u?.display_name && u.display_name.trim()) || u?.username || "Desconhecido"; }
function fmtBytes(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
function pickFile(accept, multiple) {
  return new Promise(res => {
    const i = Object.assign(document.createElement("input"), { type: "file", accept, multiple: !!multiple });
    i.onchange = () => res([...i.files]); i.click();
  });
}
async function uploadTo(bucket, file, { maxSide = 0, square = false, keepGif = true } = {}) {
  let blob = file, ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "png", type = file.type;
  const isSvg = /svg/i.test(file.type) || /\.svg$/i.test(file.name);
  if (isSvg) { ext = "svg"; type = "image/svg+xml"; }
  if (maxSide && !isSvg && !(keepGif && file.type === "image/gif")) {
    const bmp = await createImageBitmap(file);
    let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
    if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
    const scale = Math.min(1, maxSide / Math.max(sw, sh));
    const c = Object.assign(document.createElement("canvas"), { width: Math.round(sw * scale), height: Math.round(sh * scale) });
    c.getContext("2d").drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
    blob = await new Promise(r => c.toBlob(r, "image/webp", 0.9)); ext = "webp"; type = "image/webp";
  }
  const path = `${uid()}/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await sb.storage.from(bucket).upload(path, blob, { contentType: type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(/bucket|not found/i.test(error.message) ? "Armazenamento não configurado: rode o schema.sql novo no Supabase." : /size|large/i.test(error.message) ? "Arquivo grande demais." : trErr(error.message));
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// ---------------------------------------------------------------- foto de perfil / banner
const IMG_ACCEPT = () => "image/png,image/jpeg,image/webp,image/gif" + (isStaff() ? ",image/svg+xml,.svg" : "");
async function uploadAvatar() {
  const [f] = await pickFile(IMG_ACCEPT()); if (!f) return;
  if (/svg/i.test(f.type) || /\.svg$/i.test(f.name)) { if (!isStaff()) return toast("SVG é só para a staff."); }
  if (f.size > 4 * 1048576) return toast("Imagem até 4 MB.");
  toast("Enviando foto…");
  try { const url = await uploadTo("avatars", f, { maxSide: 512, square: true }); await saveProfile({ avatar_url: url }); }
  catch (e) { toast(e.message); }
}
async function uploadBanner() {
  const [f] = await pickFile(IMG_ACCEPT()); if (!f) return;
  if (/svg/i.test(f.type) || /\.svg$/i.test(f.name)) { if (!isStaff()) return toast("SVG é só para a staff."); }
  if (f.size > 4 * 1048576) return toast("Imagem até 4 MB.");
  toast("Enviando banner…");
  try { const url = await uploadTo("avatars", f, { maxSide: 1400 }); await saveProfile({ banner_url: url }); }
  catch (e) { toast(e.message); }
}

// ---------------------------------------------------------------- anexos nas conversas (foto, vídeo, áudio)
let pendingFiles = [];
const IMG_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const VID_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const AUD_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/flac"];
const EXT_TYPE = { mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac", opus: "audio/ogg",
  mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mov: "video/quicktime", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
const ATTACH_ACCEPT = [...IMG_TYPES, ...VID_TYPES, ...AUD_TYPES, ".mp3,.wav,.ogg,.m4a,.aac,.flac,.mp4,.webm,.mov"].join(",");
function fileKind(f) {
  let t = f.type;
  if (!t || t === "application/octet-stream") t = EXT_TYPE[(f.name.split(".").pop() || "").toLowerCase()] || "";
  if (t === "audio/mp3") t = "audio/mpeg";
  if (t === "audio/x-m4a") t = "audio/mp4";
  if (t === "audio/x-wav") t = "audio/wav";
  return { type: t, kind: IMG_TYPES.includes(t) ? "image" : VID_TYPES.includes(t) ? "video" : AUD_TYPES.includes(t) ? "audio" : null };
}
function addFiles(files) {
  for (let f of files) {
    const { type, kind } = fileKind(f);
    if (!kind) { toast(`${f.name}: formato não suportado. Envie foto, vídeo (MP4, WEBM, MOV) ou áudio (MP3, WAV, OGG, M4A).`); continue; }
    if (f.size > 50 * 1048576) { toast(`${f.name} passa de 50 MB.`); continue; }
    if (pendingFiles.length >= 10) { toast("Até 10 arquivos por vez."); break; }
    if (type !== f.type) f = new File([f], f.name, { type });
    pendingFiles.push({ file: f, kind, url: URL.createObjectURL(f) });
  }
  renderPendingFiles();
}
function clearPendingFiles() { pendingFiles.forEach(p => URL.revokeObjectURL(p.url)); pendingFiles = []; renderPendingFiles(); }
function renderPendingFiles() {
  const el = document.getElementById("pending"); if (!el) return;
  el.innerHTML = pendingFiles.map((p, i) => `<div class="pf ${p.kind}">${p.kind === "image" ? `<img src="${p.url}" alt="">` : p.kind === "video" ? `<video src="${p.url}" muted preload="metadata"></video><b class="pf-badge">${I("video", 14)}</b>` : `<div class="pf-audio">${I("music", 22)}<small>${esc(p.file.name)}</small></div>`}
    <button onclick="URL.revokeObjectURL(pendingFiles[${i}].url);pendingFiles.splice(${i},1);renderPendingFiles()" title="Remover">${I("x", 12)}</button><span>${fmtBytes(p.file.size)}</span></div>`).join("");
  el.style.display = pendingFiles.length ? "flex" : "none";
}
function mediaInfo(file, kind, url) {
  return new Promise(res => {
    const info = {}, done = () => res(info);
    if (kind === "image") { createImageBitmap(file).then(b => { info.w = b.width; info.h = b.height; done(); }).catch(done); return; }
    const el = document.createElement(kind === "video" ? "video" : "audio"); el.preload = "metadata";
    el.onloadedmetadata = () => { info.duration = Math.round((el.duration || 0) * 10) / 10; if (kind === "video") { info.w = el.videoWidth; info.h = el.videoHeight; } done(); };
    el.onerror = done; el.src = url; setTimeout(done, 5000);
  });
}
async function sendWithFiles(cid, text, replyTo) {
  const files = pendingFiles.splice(0); renderPendingFiles();
  for (let i = 0; i < files.length; i++) {
    const { file, url, kind } = files[i];
    const caption = i === files.length - 1 ? text : "";
    const rt = i === 0 ? replyTo || null : null;
    const temp = { id: "tmp" + Math.random(), channel: cid, author: uid(), content: caption, reply_to: rt, ts: Date.now(), pending: true, attachment: { url, type: file.type, name: file.name, local: true } };
    (S.msgs[cid] ||= []).push(temp); if (currentChannel() === cid) appendMessage(temp);
    try {
      const info = await mediaInfo(file, kind, url);
      const pub = await uploadTo("attachments", file);
      const att = { url: pub, name: file.name.slice(0, 80), type: file.type, size: file.size, ...info };
      const m = norm(await q(sb.from("messages").insert({ ...cidFilter(cid), content: caption, attachment: att, reply_to: rt }).select().single()));
      const l = S.msgs[cid], k = l.indexOf(temp);
      if (k >= 0) { if (l.some(x => x.id === m.id)) l.splice(k, 1); else l[k] = m; }
      URL.revokeObjectURL(url);
    } catch (e) { temp.pending = false; temp.failed = true; temp.retry = { file, caption, kind }; toast(e.message); }
    if (currentChannel() === cid) appendMessage(S.msgs[cid].at(-1));
  }
}
function attachHtml(a, mine) {
  if (!a?.url || !(SAFE_URL.test(a.url) || a.local)) return "";
  const ratio = a.w && a.h ? `aspect-ratio:${a.w}/${a.h};` : "";
  if (a.type?.startsWith("audio")) {
    if (a.voice || /^voz\./.test(a.name || "")) return voiceHtml(a.url, a.duration, mine);
    return `<div class="afile" onclick="event.stopPropagation()"><div class="afile-ic">${I("music", 20)}</div><div class="afile-main"><b title="${esc(a.name || "")}">${esc(a.name || "áudio")}</b>
      <audio src="${esc(a.url)}" controls preload="metadata"></audio></div></div>`;
  }
  if (a.type?.startsWith("video")) return `<div class="att vid" onclick="event.stopPropagation()"><video src="${esc(a.url)}" controls playsinline preload="metadata" style="${ratio}"></video></div>`;
  return `<div class="att" onclick="openImage('${esc(a.url)}','${esc(a.name || "imagem")}')"><img src="${esc(a.url)}" loading="lazy" alt="${esc(a.name || "")}" style="${ratio}"></div>`;
}
function bindDropAndPaste(root) {
  root.addEventListener("dragover", e => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); root.classList.add("dropping"); } });
  root.addEventListener("dragleave", e => { if (!root.contains(e.relatedTarget)) root.classList.remove("dropping"); });
  root.addEventListener("drop", e => { e.preventDefault(); root.classList.remove("dropping"); addFiles([...e.dataTransfer.files]); });
}
document.addEventListener("paste", e => {
  if (!document.getElementById("input")) return;
  const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith("image/"));
  if (files.length) { e.preventDefault(); addFiles(files); }
});

// ================================================================ CALLS
// Malha WebRTC (cada pessoa conecta direto com as outras). A sinalização usa canais
// privados do Supabase Realtime ("call:<canal>"), protegidos pelas regras do banco.
let call = null;
let inboxCh = null, ringing = null;
// STUN descobre o endereço público; TURN retransmite quando a conexão direta é bloqueada
// (comum em internet com CGNAT, 4G e redes de empresa/faculdade).
let iceServers = null, iceLoadedAt = 0;
const BASE_STUN = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
function asList(v) { return !v ? [] : Array.isArray(v) ? v : [v]; }
function validIce(s) { return s && (typeof s.urls === "string" || Array.isArray(s.urls)) && asList(s.urls).every(u => /^(stun|turns?):/.test(u)); }
async function loadIceServers(force) {
  if (!force && iceServers && Date.now() - iceLoadedAt < 30 * 60e3) return iceServers;
  let saved = [];
  try { const r = await q(sb.from("app_settings").select("value").eq("key", "turn").maybeSingle()); saved = asList(r?.value); } catch {}
  iceServers = [...BASE_STUN, ...asList(window.CUPLOCK_CONFIG?.TURN), ...saved].filter(validIce);
  iceLoadedAt = Date.now();
  return iceServers;
}
const hasTurn = () => (iceServers || []).some(s => asList(s.urls).some(u => /^turns?:/.test(u)));
const iceConfig = () => ({ iceServers: iceServers || BASE_STUN, iceCandidatePoolSize: 2 });
const audioConstraints = () => ({ deviceId: S.prefs.micId ? { ideal: S.prefs.micId } : undefined, echoCancellation: S.prefs.echo !== false, noiseSuppression: S.prefs.noise !== false, autoGainControl: S.prefs.agc !== false });
const videoConstraints = () => ({ deviceId: S.prefs.camId ? { ideal: S.prefs.camId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } });
function callLabel(cid) {
  if (!cid) return "";
  if (cid.startsWith("dm:")) { const o = cid.slice(3).split(":").find(x => x !== uid()); return "@" + dname(S.users[o]); }
  for (const s of S.servers) { const c = s.channels.find(x => x.id === cid); if (c) return `#${c.name} · ${s.name}`; }
  return "call";
}
function callRoute(cid) {
  if (cid.startsWith("dm:")) return "/dm/" + cid.slice(3).split(":").find(x => x !== uid());
  const s = S.servers.find(x => x.channels.some(c => c.id === cid)); return s ? `/server/${s.id}/channel/${cid}` : "/friends";
}
function callAllowedPeer(cid, id) {
  if (cid.startsWith("dm:")) return cid.slice(3).split(":").includes(id);
  const s = S.servers.find(x => x.channels.some(c => c.id === cid)); return !!s && s.members.includes(id);
}
function inCallUsers(cid) { return Object.entries(S.online).filter(([, o]) => o.call === cid).map(([id]) => id).filter(id => id !== uid() || call?.cid === cid); }

async function joinCall(cid, { video = false, ringTo = null } = {}) {
  if (call?.cid === cid) { if (video && !call.cam) toggleCam(); return; }
  if (call) await leaveCall(true);
  await loadIceServers();
  if (!navigator.mediaDevices?.getUserMedia) return toast("Este dispositivo não suporta chamadas.");
  let local;
  try { local = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints(), video: video ? videoConstraints() : false }); }
  catch {
    try { local = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints() }); if (video) toast("Câmera indisponível — entrando só com voz."); }
    catch { local = new MediaStream(); toast("Microfone indisponível ou bloqueado — você entrou mudo."); }
  }
  call = { cid, peers: new Map(), local, mic: local.getAudioTracks().length > 0, cam: local.getVideoTracks().length > 0, screen: null, deaf: false, startedAt: Date.now(), tiles: new Map(), ringTo };
  if (S.prefs.joinMuted && call.mic) { local.getAudioTracks().forEach(t => (t.enabled = false)); call.mic = false; }
  call.ch = sb.channel("call:" + cid, { config: { private: true, broadcast: { self: false } } })
    .on("broadcast", { event: "sig" }, ({ payload }) => onSignal(payload))
    .subscribe(st => {
      if (st === "SUBSCRIBED") {
        sig({ type: "join" });
        // se o "oi" se perder no caminho, repete algumas vezes até alguém responder
        [1500, 4000, 8000, 14000].forEach(ms => setTimeout(() => { if (call?.cid === cid && call.peers.size === 0) sig({ type: "join" }); }, ms));
      }
      else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") { toast("Não consegui entrar na call. Rode o schema.sql novo no Supabase."); leaveCall(true); }
    });
  startLevelMeter();
  trackPresence(); renderCallUI(); renderChrome(); tone("join");
  if (ringTo) {
    playRing();
    ring(ringTo, { cid, video });
    call.ringTimer = setTimeout(() => { if (call?.cid === cid && call.peers.size === 0) { setInvite(call.inviteId, "missed"); call.inviteId = null; toast("Ninguém atendeu."); leaveCall(); } }, 40000);
  }
}
function sig(msg) { call?.ch?.send({ type: "broadcast", event: "sig", payload: { ...msg, from: uid() } }); }
function sendStateTo(to) { sig({ type: "state", to, state: { mic: call.mic, cam: call.cam || !!call.screen, screen: !!call.screen, deaf: call.deaf } }); }
function broadcastState() { if (call) sig({ type: "state", state: { mic: call.mic, cam: call.cam || !!call.screen, screen: !!call.screen, deaf: call.deaf } }); }

async function onSignal(m) {
  if (!call || !m?.from || m.from === uid() || (m.to && m.to !== uid())) return;
  if (!callAllowedPeer(call.cid, m.from)) return;
  await ensureUsers([m.from]).catch(() => {});
  if (m.type === "join") { if (!call.peers.has(m.from)) { ensurePeer(m.from, true); tone("join"); } }
  else if (m.type === "sdp") await handleSdp(m).catch(e => console.warn("sdp", e));
  else if (m.type === "ice") {
    const p = call.peers.get(m.from); if (!p) return;
    if (p.pc.remoteDescription) p.pc.addIceCandidate(m.cand).catch(() => {}); else p.pendingIce.push(m.cand);
  }
  else if (m.type === "state") { const p = call.peers.get(m.from); if (p) { p.state = m.state || {}; renderCallUI(); } }
  else if (m.type === "leave") { dropPeer(m.from); tone("leave"); }
}
function currentVideoTrack() { return call?.screen || (call?.cam ? call.local.getVideoTracks()[0] : null) || null; }
function ensurePeer(id, initiator) {
  if (call.peers.has(id)) return call.peers.get(id);
  clearTimeout(call.ringTimer); stopRing();
  const pc = new RTCPeerConnection(iceConfig());
  const peer = { id, pc, stream: new MediaStream(), polite: uid() > id, making: false, pendingIce: [], state: {} };
  call.peers.set(id, peer);
  if (initiator) {
    const at = call.local.getAudioTracks()[0];
    peer.audioTx = pc.addTransceiver(at || "audio", { direction: "sendrecv" });
    peer.videoTx = pc.addTransceiver("video", { direction: "sendrecv" });
    const vt = currentVideoTrack(); if (vt) peer.videoTx.sender.replaceTrack(vt);
  }
  pc.ontrack = e => {
    if (!peer.stream.getTracks().includes(e.track)) peer.stream.addTrack(e.track);
    e.track.onmute = e.track.onunmute = e.track.onended = () => renderCallUI();
    attachRemoteAudio(peer); renderCallUI();
  };
  pc.onicecandidate = e => { if (e.candidate) sig({ type: "ice", to: id, cand: e.candidate.toJSON() }); };
  pc.onnegotiationneeded = async () => {
    try { peer.making = true; await pc.setLocalDescription(); sig({ type: "sdp", to: id, desc: pc.localDescription.toJSON() }); }
    catch (e) { console.warn("negotiation", e); } finally { peer.making = false; }
  };
  peer.started = Date.now(); peer.restarts = 0;
  peer.watch = setTimeout(() => checkStuck(peer), 15000);
  pc.onconnectionstatechange = () => {
    const st = pc.connectionState;
    if (st === "connected") { clearTimeout(peer.watch); peer.warned = false; sendStateTo(id); }
    if (st === "failed") {
      if (peer.restarts < 2) { peer.restarts++; pc.restartIce?.(); if (!peer.polite) pc.onnegotiationneeded?.(); }
      else callFailHint(peer);
    }
    if (st === "disconnected") setTimeout(() => { if (pc.connectionState === "disconnected" && peer.restarts < 2) { peer.restarts++; pc.restartIce?.(); } }, 4000);
    renderCallUI();
  };
  renderCallUI();
  return peer;
}
function checkStuck(peer) {
  if (!call || !call.peers.has(peer.id)) return;
  if (peer.pc.connectionState !== "connected") callFailHint(peer);
}
function callFailHint(peer) {
  if (peer.warned) return; peer.warned = true;
  const who = dname(S.users[peer.id]);
  toast(hasTurn()
    ? `Não deu para conectar com ${who}. Tentando de novo… se continuar, peça para ${who} reiniciar o app.`
    : `Não deu para conectar com ${who}: a internet de um de vocês bloqueia conexão direta. O OWNER precisa configurar um servidor TURN (Voz e vídeo → Testar conexão).`);
}
async function handleSdp(m) {
  const peer = call.peers.get(m.from) || ensurePeer(m.from, false), pc = peer.pc, desc = m.desc;
  const collision = desc.type === "offer" && (peer.making || pc.signalingState !== "stable");
  if (!peer.polite && collision) return;
  await pc.setRemoteDescription(desc);
  if (!peer.audioTx) bindTransceivers(peer);
  for (const c of peer.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {});
  if (desc.type === "offer") { await pc.setLocalDescription(); sig({ type: "sdp", to: m.from, desc: pc.localDescription.toJSON() }); }
}
function bindTransceivers(peer) {
  const tr = peer.pc.getTransceivers();
  peer.audioTx = tr.find(t => t.receiver.track?.kind === "audio");
  peer.videoTx = tr.find(t => t.receiver.track?.kind === "video");
  for (const t of [peer.audioTx, peer.videoTx]) if (t) t.direction = "sendrecv";
  const at = call.local.getAudioTracks()[0]; if (at && peer.audioTx) peer.audioTx.sender.replaceTrack(at);
  const vt = currentVideoTrack(); if (vt && peer.videoTx) peer.videoTx.sender.replaceTrack(vt);
}
function attachRemoteAudio(peer) {
  let box = document.getElementById("call-audio");
  if (!box) { box = Object.assign(document.createElement("div"), { id: "call-audio" }); box.style.display = "none"; document.body.appendChild(box); }
  if (!peer.audioEl) {
    peer.audioEl = Object.assign(document.createElement("audio"), { autoplay: true });
    box.appendChild(peer.audioEl);
    if (S.prefs.speakerId && peer.audioEl.setSinkId) peer.audioEl.setSinkId(S.prefs.speakerId).catch(() => {});
  }
  peer.audioEl.srcObject = peer.stream;
  peer.audioEl.muted = !!call.deaf;
  peer.audioEl.volume = Math.min(1, (S.prefs.peerVolume?.[peer.id] ?? 100) / 100);
  peer.audioEl.play?.().catch(() => {});
}
function dropPeer(id) {
  const p = call?.peers.get(id); if (!p) return;
  clearTimeout(p.watch);
  try { p.pc.close(); } catch {}
  p.audioEl?.remove(); call.tiles.get(id)?.remove(); call.tiles.delete(id);
  call.peers.delete(id); renderCallUI();
  if (call.cid.startsWith("dm:") && call.peers.size === 0 && !call.ringTo) { toast("A call terminou."); leaveCall(); }
}
async function leaveCall(silent) {
  if (!call) return;
  const c = call; call = null;
  clearTimeout(c.ringTimer); stopRing();
  try { c.ch?.send({ type: "broadcast", event: "sig", payload: { type: "leave", from: uid() } }); } catch {}
  for (const p of c.peers.values()) { try { p.pc.close(); } catch {} p.audioEl?.remove(); }
  c.local.getTracks().forEach(t => t.stop()); c.screen?.stop();
  setTimeout(() => { try { sb.removeChannel(c.ch); } catch {} }, 300);
  if (c.ringTo && c.inviteId && c.peers.size === 0) unring(c.ringTo, c.cid, c.inviteId);
  if (!silent) tone("leave");
  trackPresence(); renderCallUI(); renderChrome();
}
function toggleMic() {
  if (!call) return;
  const t = call.local.getAudioTracks()[0];
  if (!t) return toast("Nenhum microfone disponível.");
  call.mic = !call.mic; t.enabled = call.mic; if (call.mic && call.deaf) toggleDeaf();
  broadcastState(); renderCallUI(); tone(call.mic ? "on" : "off");
}
function toggleDeaf() {
  if (!call) return;
  call.deaf = !call.deaf;
  for (const p of call.peers.values()) if (p.audioEl) p.audioEl.muted = call.deaf;
  if (call.deaf && call.mic) { call.mic = false; call.local.getAudioTracks().forEach(t => (t.enabled = false)); }
  broadcastState(); renderCallUI(); tone(call.deaf ? "off" : "on");
}
async function toggleCam() {
  if (!call) return;
  if (call.cam) {
    call.local.getVideoTracks().forEach(t => { t.stop(); call.local.removeTrack(t); });
    call.cam = false;
  } else {
    try { const s = await navigator.mediaDevices.getUserMedia({ video: videoConstraints() }); call.local.addTrack(s.getVideoTracks()[0]); call.cam = true; }
    catch { return toast("Não consegui abrir a câmera."); }
  }
  replaceVideoEverywhere(); broadcastState(); renderCallUI();
}
async function toggleScreen() {
  if (!call) return;
  if (call.screen) { call.screen.stop(); call.screen = null; replaceVideoEverywhere(); broadcastState(); return renderCallUI(); }
  if (!navigator.mediaDevices.getDisplayMedia) return toast("Compartilhar tela não é suportado aqui.");
  try {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: S.prefs.screenFps || 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    call.screen = s.getVideoTracks()[0];
    call.screen.contentHint = "detail";
    call.screen.onended = () => { if (call?.screen) { call.screen = null; replaceVideoEverywhere(); broadcastState(); renderCallUI(); } };
    replaceVideoEverywhere(); broadcastState(); renderCallUI();
  } catch { /* usuário cancelou */ }
}
function replaceVideoEverywhere() {
  const vt = currentVideoTrack();
  for (const p of call.peers.values()) p.videoTx?.sender.replaceTrack(vt).catch(() => {});
}

// ---- campainha (DM) ----
// O convite de chamada é uma linha na tabela call_invites. O banco só deixa o próprio
// destinatário ver o convite, e o tempo real (postgres_changes) entrega na hora.
function connectInbox() {
  if (inboxCh) sb.removeChannel(inboxCh);
  const me = uid();
  inboxCh = sb.channel("cuplock-calls-" + me)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_invites", filter: `callee=eq.${me}` }, p => onRing(p.new))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "call_invites", filter: `callee=eq.${me}` }, p => {
      if (ringing?.id === p.new.id && p.new.status !== "ringing") stopRinging(p.new.status === "cancelled" || p.new.status === "missed");
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "call_invites", filter: `caller=eq.${me}` }, p => {
      if (call?.inviteId === p.new.id && p.new.status === "declined" && call.peers.size === 0) {
        stopRing(); toast(`${dname(S.users[p.new.callee])} recusou a chamada.`); leaveCall();
      }
    })
    .subscribe(st => { if (st === "SUBSCRIBED") checkPendingRings(); });
}
// ao abrir o app (ou reconectar): pega uma chamada que ainda está tocando
async function checkPendingRings() {
  try {
    const since = new Date(Date.now() - 40000).toISOString();
    const rows = await q(sb.from("call_invites").select("*").eq("callee", uid()).eq("status", "ringing").gte("created_at", since).order("created_at", { ascending: false }).limit(1));
    if (rows[0]) onRing(rows[0]);
  } catch {}
}
async function ring(to, d) {
  try {
    const row = await q(sb.from("call_invites").insert({ callee: to, cid: d.cid, video: !!d.video }).select().single());
    if (call?.cid === d.cid) call.inviteId = row.id;
  } catch (e) { toast("Não consegui chamar: " + e.message); }
}
function setInvite(id, status) { if (id) sb.from("call_invites").update({ status }).eq("id", id).then(() => {}); }
function unring(to, cid, inviteId, status = "cancelled") { setInvite(inviteId, status); }
async function onRing(row) {
  if (!row?.id || row.status !== "ringing" || row.callee !== uid()) return;
  if (Date.now() - Date.parse(row.created_at) > 45000) return;          // convite velho
  if (ringing?.id === row.id || call?.cid === row.cid) return;
  await ensureUsers([row.caller]).catch(() => {});
  if (S.me?.status === "busy") return setInvite(row.id, "declined");
  if (call) { toast(`${dname(S.users[row.caller])} está te ligando (você já está em uma call).`); }
  const u = S.users[row.caller];
  stopRinging();
  ringing = { id: row.id, from: row.caller, cid: row.cid, video: row.video, timer: setTimeout(() => { setInvite(row.id, "missed"); stopRinging(true); }, 40000), osc: startRingtone() };
  const box = Object.assign(document.createElement("div"), { className: "incoming-bg" });
  box.id = "incoming";
  box.innerHTML = `<div class="incoming"><div class="ring-av">${avatar(u, "xl", false)}</div>
    <small class="muted" style="letter-spacing:.08em;font-weight:800;text-transform:uppercase">${row.video ? I("video", 13) + " Chamada de vídeo" : I("phone", 13) + " Chamada de voz"}</small>
    <b style="font-size:22px">${uname(u)}</b><span class="muted small">está te ligando…</span>
    <div style="display:flex;gap:16px;margin-top:18px"><button class="cbtn danger big" title="Recusar" onclick="declineRing()">${CI.hang}</button>
    <button class="cbtn ok big" title="Atender com voz" onclick="acceptRing(false)">${CI.phone}</button><button class="cbtn ok big" title="Atender com vídeo" onclick="acceptRing(true)">${CI.cam}</button></div></div>`;
  document.body.appendChild(box);
  bringToFront();
  desktopNotify(`${dname(u)} está te ligando`, row.video ? "📹 Chamada de vídeo — toque para atender" : "📞 Chamada de voz — toque para atender", { tag: "call", force: true, href: callRoute(row.cid) });
}
function stopRinging(missed) {
  if (!ringing) return;
  clearTimeout(ringing.timer); ringing.osc?.stop?.(); document.getElementById("incoming")?.remove();
  if (missed === true) toast(`Chamada perdida de ${dname(S.users[ringing.from])}`);
  ringing = null;
}
function acceptRing(video) { const r = ringing; stopRinging(); if (!r) return; setInvite(r.id, "accepted"); navigate(callRoute(r.cid)); joinCall(r.cid, { video }); }
function declineRing() { const r = ringing; stopRinging(); if (r) setInvite(r.id, "declined"); }
// traz o Cuplock para frente (app de PC) e pisca na barra de tarefas
async function bringToFront() {
  try {
    const w = window.__TAURI__?.window?.getCurrentWindow?.();
    if (w) { await w.unminimize().catch(() => {}); await w.show().catch(() => {}); await w.setFocus().catch(() => {}); await w.requestUserAttention(1).catch(() => {}); }
  } catch {}
}

// ---- sons (arquivos em client/sounds) ----
const SND = { ring: "sounds/ring.mp3", notify: "sounds/notify.mp3", notifyLong: "sounds/notify-long.mp3" };
let ringAudio = null;
["pointerdown", "keydown"].forEach(ev => addEventListener(ev, function unlock() {
  try { const a = new Audio(SND.notify); a.volume = 0; a.play().then(() => a.pause()).catch(() => {}); } catch {}
  removeEventListener(ev, unlock, true);
}, true));
function soundOut(a) { if (S.prefs.speakerId && a.setSinkId) a.setSinkId(S.prefs.speakerId).catch(() => {}); return a; }
function playRing() {
  stopRing();
  if (S.prefs.callSounds === false) return;
  ringAudio = soundOut(new Audio(SND.ring)); ringAudio.loop = true; ringAudio.volume = Math.min(1, (S.prefs.ringVolume ?? 80) / 100);
  ringAudio.play().catch(() => {});
}
function stopRing() { if (ringAudio) { ringAudio.pause(); ringAudio = null; } }
function playNotify() {
  if (S.prefs.sounds === false || S.me?.status === "busy") return;
  const a = soundOut(new Audio(S.prefs.notifySound === "long" ? SND.notifyLong : SND.notify));
  a.volume = Math.min(1, (S.prefs.notifyVolume ?? 70) / 100); a.play().catch(() => {});
}
// Notificação na área de trabalho: no app de PC usa a notificação nativa do Windows
// (plugin do Tauri), no Android usa a ponte nativa, no navegador a API Notification.
async function desktopNotify(title, body, opts = {}) {
  if (S.prefs.desktopNotif === false) return;
  if (!opts.force && document.hasFocus() && !document.hidden) return;
  try {
    if (window.CuplockNative?.notify) return window.CuplockNative.notify(String(title).slice(0, 80), String(body).slice(0, 200));
    if (window.__TAURI__?.core?.invoke) return await window.__TAURI__.core.invoke("plugin:notification|notify", { options: { title: String(title).slice(0, 80), body: String(body).slice(0, 200) } });
    if ("Notification" in window) {
      if (Notification.permission === "default") await Notification.requestPermission();
      if (Notification.permission === "granted") { const n = new Notification(title, { body, icon: "icon.svg", tag: opts.tag, silent: true }); n.onclick = () => { window.focus(); opts.href && navigate(opts.href); }; return; }
    }
  } catch {}
}
let toneCtx;
function tone(kind) {
  if (!S.prefs.callSounds && S.prefs.callSounds !== undefined) return;
  try {
    toneCtx ||= new AudioContext();
    const seq = { join: [523, 784], leave: [784, 523], on: [660], off: [440] }[kind] || [600];
    seq.forEach((f, i) => {
      const o = toneCtx.createOscillator(), g = toneCtx.createGain(), t = toneCtx.currentTime + i * 0.11;
      o.frequency.value = f; o.type = "sine"; g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(toneCtx.destination); o.start(t); o.stop(t + 0.2);
    });
  } catch {}
}
function startRingtone() { playRing(); return { stop: stopRing }; }

// ---- quem está falando ----
let meterT = null, meterCtx = null;
const analysers = new Map();
function startLevelMeter() {
  clearInterval(meterT);
  meterT = setInterval(() => {
    if (!call) { clearInterval(meterT); analysers.clear(); return; }
    try { meterCtx ||= new AudioContext(); } catch { return; }
    const streams = [[uid(), call.local], ...[...call.peers.values()].map(p => [p.id, p.stream])];
    for (const [id, st] of streams) {
      const tr = st.getAudioTracks()[0];
      let a = analysers.get(id);
      if (tr && (!a || a.track !== tr)) {
        try { const src = meterCtx.createMediaStreamSource(new MediaStream([tr])), an = meterCtx.createAnalyser(); an.fftSize = 512; src.connect(an); a = { an, track: tr, buf: new Uint8Array(512) }; analysers.set(id, a); } catch {}
      }
      if (!a) continue;
      a.an.getByteTimeDomainData(a.buf);
      let sum = 0; for (const v of a.buf) sum += (v - 128) ** 2;
      const lvl = Math.sqrt(sum / a.buf.length);
      const muted = id === uid() ? !call.mic : call.peers.get(id)?.state?.mic === false;
      call.tiles.get(id)?.classList.toggle("speaking", lvl > 6 && !muted);
      document.querySelectorAll(`[data-voice="${id}"]`).forEach(el => el.classList.toggle("speaking", lvl > 6 && !muted));
    }
  }, 160);
}

// ---- interface da call ----
const CI = {
  phone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
  hang: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1a1 1 0 0 1-.56.9 11.5 11.5 0 0 0-2.66 1.85 1 1 0 0 1-1.41-.02L.29 13.08a1 1 0 0 1 0-1.41A16.9 16.9 0 0 1 12 7c4.55 0 8.68 1.8 11.71 4.67a1 1 0 0 1 0 1.41l-2.48 2.48a1 1 0 0 1-1.41.02 11.3 11.3 0 0 0-2.67-1.85 1 1 0 0 1-.56-.9v-3.1A15 15 0 0 0 12 9z"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z"/></svg>',
  micOff: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-2a5 5 0 0 1-.7 2.53l1.46 1.46A6.9 6.9 0 0 0 19 11zM15 11V5a3 3 0 0 0-5.94-.6L15 10.35zM4.27 3 3 4.27l6 6V11a3 3 0 0 0 4.53 2.58l1.65 1.65A5 5 0 0 1 7 11H5a7 7 0 0 0 6 6.92V21h2v-3.08a6.9 6.9 0 0 0 3.6-1.47L19.73 21 21 19.73z"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11z"/></svg>',
  camOff: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 6.5l-4 4V7a1 1 0 0 0-1-1H9.82L21 17.18zM3.27 2 2 3.27 4.73 6H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12c.21 0 .39-.08.55-.18L19.73 21 21 19.73z"/></svg>',
  screen: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 3H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h6v2H8v2h8v-2h-2v-2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-8 3 4 4h-3v4h-2v-4H8z"/></svg>',
  headset: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 0 0-9 9v7a2 2 0 0 0 2 2h2v-8H5v-1a7 7 0 0 1 14 0v1h-2v8h2a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9z"/></svg>',
  deaf: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 0 0-8.1 12.9L2 17.8l1.4 1.4L20.6 2 19.2.6l-2 2A8.9 8.9 0 0 0 12 3zm-7 9a7 7 0 0 1 10.73-5.93L5 16.8V12zm14 0v1h-2v8h2a2 2 0 0 0 2-2v-7c0-1.03-.18-2.02-.5-2.94l-1.6 1.6c.06.44.1.89.1 1.34zM7 21v-2.17l-2 2V21z"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
};
function callHeaderButtons(cid) {
  const here = call?.cid === cid;
  const n = inCallUsers(cid).length;
  if (here) return `<span class="live-pill" onclick="document.getElementById('callpanel')?.scrollIntoView()">● AO VIVO</span>`;
  return `${n && !cid.startsWith("dm:") ? `<button class="live-pill join" onclick="joinCall('${cid}')">${I("volume", 13)} ${n} na call · Entrar</button>` : ""}
    <button class="icon-btn" title="Chamada de voz" onclick="startCallHere('${cid}',false)">${CI.phone}</button>
    <button class="icon-btn" title="Chamada de vídeo" onclick="startCallHere('${cid}',true)">${CI.cam}</button>`;
}
function startCallHere(cid, video) {
  const other = cid.startsWith("dm:") ? cid.slice(3).split(":").find(x => x !== uid()) : null;
  joinCall(cid, { video, ringTo: other });
}
function tileFor(id) {
  let t = call.tiles.get(id);
  if (!t) {
    t = document.createElement("div"); t.className = "tile"; t.dataset.id = id;
    t.innerHTML = `<video autoplay playsinline muted></video><div class="tile-av"></div><div class="tile-name"></div>`;
    t.ondblclick = () => t.classList.toggle("focus");
    call.tiles.set(id, t);
  }
  return t;
}
function renderCallUI() {
  // painel dentro do chat da call
  const panel = document.getElementById("callpanel");
  if (!call) { panel?.remove(); updateCallBar(); refreshCallHeader(); return; }
  if (panel && panel.dataset.cid === call.cid) {
    const grid = panel.querySelector(".tiles");
    const ids = [uid(), ...call.peers.keys()];
    for (const id of ids) {
      const t = tileFor(id), u = S.users[id], me = id === uid(), peer = call.peers.get(id);
      const st = me ? { mic: call.mic, cam: !!currentVideoTrack(), screen: !!call.screen, deaf: call.deaf } : peer.state || {};
      const vt = me ? currentVideoTrack() : peer.stream.getVideoTracks().find(x => x.readyState === "live" && !x.muted);
      const v = t.querySelector("video");
      const showVideo = !!vt && (me || st.cam !== false);
      if (showVideo) { if (v.srcObject?.getVideoTracks()[0] !== vt) v.srcObject = new MediaStream([vt]); v.play?.().catch(() => {}); }
      else if (v.srcObject) v.srcObject = null;
      t.classList.toggle("has-video", showVideo);
      t.classList.toggle("mirror", me && showVideo && !call.screen);
      t.classList.toggle("is-screen", !!st.screen);
      t.querySelector(".tile-av").innerHTML = avatar(u, "xl", false);
      const conn = me ? "" : peer.pc.connectionState;
      t.querySelector(".tile-name").innerHTML = `${st.mic === false ? `<i class="mut">${CI.micOff}</i>` : ""}${st.deaf ? `<i class="mut">${CI.deaf}</i>` : ""}${esc(dname(u))}${me ? " (você)" : ""}${conn && conn !== "connected" ? ` <span class="muted">· ${conn === "failed" ? "falhou" : "conectando…"}</span>` : ""}${st.screen ? ` · ${I("monitor", 12)} tela` : ""}`;
      if (t.parentNode !== grid) grid.appendChild(t);
    }
    for (const [id, t] of call.tiles) if (!ids.includes(id)) { t.remove(); call.tiles.delete(id); }
    grid.dataset.n = Math.min(ids.length, 9);
    const waiting = panel.querySelector(".waiting");
    if (waiting) waiting.style.display = call.peers.size ? "none" : "";
    const c = panel.querySelector(".call-ctl");
    c.innerHTML = `<button class="cbtn ${call.mic ? "" : "off"}" title="${call.mic ? "Silenciar" : "Ativar microfone"}" onclick="toggleMic()">${call.mic ? CI.mic : CI.micOff}</button>
      <button class="cbtn ${call.deaf ? "off" : ""}" title="${call.deaf ? "Voltar a ouvir" : "Ensurdecer"}" onclick="toggleDeaf()">${call.deaf ? CI.deaf : CI.headset}</button>
      <button class="cbtn ${call.cam ? "on" : ""}" title="${call.cam ? "Desligar câmera" : "Ligar câmera"}" onclick="toggleCam()">${call.cam ? CI.cam : CI.camOff}</button>
      ${navigator.mediaDevices?.getDisplayMedia ? `<button class="cbtn ${call.screen ? "on" : ""}" title="${call.screen ? "Parar de compartilhar" : "Compartilhar tela"}" onclick="toggleScreen()">${CI.screen}</button>` : ""}
      <button class="cbtn" title="Tela cheia" onclick="document.getElementById('callpanel').classList.toggle('full')">${CI.expand}</button>
      <button class="cbtn danger" title="Sair da call" onclick="leaveCall()">${CI.hang}</button>`;
  }
  updateCallBar(); refreshCallHeader();
}
function callPanelHtml(cid) {
  if (call?.cid !== cid) return "";
  return `<div id="callpanel" data-cid="${esc(cid)}"><div class="tiles"></div><div class="waiting muted small">${cid.startsWith("dm:") && call.ringTo ? "Chamando…" : "Esperando mais gente entrar…"}</div><div class="call-ctl"></div></div>`;
}
function mountCallPanel() {
  const cid = currentChannel(); const slot = document.getElementById("callslot");
  if (!slot) return;
  const want = call?.cid === cid;
  const has = document.getElementById("callpanel");
  if (want && !has) { slot.innerHTML = callPanelHtml(cid); call.tiles.forEach(t => t.remove()); }
  if (!want && has) has.remove();
  renderCallUI();
}
function refreshCallHeader() {
  const box = document.getElementById("callbtns"); const cid = currentChannel();
  if (box && cid) box.innerHTML = callHeaderButtons(cid);
  if (call && cid === call.cid && !document.getElementById("callpanel")) mountCallPanel();
  if ((!call || cid !== call.cid) && document.getElementById("callpanel")) document.getElementById("callpanel").remove();
}
function callBarHtml() {
  if (!call) return "";
  const secs = Math.floor((Date.now() - call.startedAt) / 1000);
  return `<div class="callbar"><div style="flex:1;min-width:0;cursor:pointer" onclick="navigate(callRoute(call.cid))"><b class="live">● Em call · <span id="calltime">${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}</span></b><small>${esc(callLabel(call.cid))}</small></div>
    <button class="icon-btn ${call.mic ? "" : "on"}" title="Microfone" onclick="toggleMic()">${call.mic ? CI.mic : CI.micOff}</button><button class="icon-btn" style="color:var(--busy)" title="Sair" onclick="leaveCall()">${CI.hang}</button></div>`;
}
function updateCallBar() {
  const side = document.querySelector(".side"); if (!side) return;
  const old = side.querySelector(".callbar"), html = callBarHtml();
  if (!html) { old?.remove(); return; }
  const tmp = document.createElement("div"); tmp.innerHTML = html;
  if (old) old.replaceWith(tmp.firstChild); else side.querySelector(".me-bar")?.before(tmp.firstChild);
}
setInterval(() => { const t = document.getElementById("calltime"); if (t && call) { const s = Math.floor((Date.now() - call.startedAt) / 1000); t.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; } }, 1000);
window.addEventListener("beforeunload", () => { if (call) leaveCall(true); });

// ---- configurações de voz e vídeo ----
async function listDevices(ask) {
  if (ask) { try { const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => navigator.mediaDevices.getUserMedia({ audio: true })); s.getTracks().forEach(t => t.stop()); } catch {} }
  const d = await navigator.mediaDevices?.enumerateDevices?.() || [];
  S.devices = { mics: d.filter(x => x.kind === "audioinput"), cams: d.filter(x => x.kind === "videoinput"), speakers: d.filter(x => x.kind === "audiooutput") };
  if (S.route.name === "settings") renderSettings();
}
let testStream = null, testT = null;
async function testMic(btn) {
  if (testStream) { testStream.getTracks().forEach(t => t.stop()); testStream = null; clearInterval(testT); btn.textContent = "Testar microfone"; document.getElementById("micbar").style.width = "0%"; return; }
  try { testStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints() }); } catch { return toast("Não consegui acessar o microfone."); }
  btn.textContent = "Parar teste";
  const ctx = new AudioContext(), an = ctx.createAnalyser(); ctx.createMediaStreamSource(testStream).connect(an); const buf = new Uint8Array(512);
  testT = setInterval(() => { an.getByteTimeDomainData(buf); let s = 0; for (const v of buf) s += (v - 128) ** 2; const l = Math.min(100, Math.sqrt(s / buf.length) * 4); const b = document.getElementById("micbar"); if (b) b.style.width = l + "%"; else { clearInterval(testT); testStream?.getTracks().forEach(t => t.stop()); testStream = null; } }, 80);
}
let camTest = null;
async function testCam(btn) {
  const v = document.getElementById("campv");
  if (camTest) { camTest.getTracks().forEach(t => t.stop()); camTest = null; v.srcObject = null; v.style.display = "none"; btn.textContent = "Testar câmera"; return; }
  try { camTest = await navigator.mediaDevices.getUserMedia({ video: videoConstraints() }); } catch { return toast("Não consegui abrir a câmera."); }
  v.srcObject = camTest; v.style.display = "block"; btn.textContent = "Parar câmera";
}
async function testConnection(btn) {
  const out = document.getElementById("conntest"); if (!out) return;
  btn.disabled = true; out.innerHTML = "Testando… (até 8 s)";
  await loadIceServers(true);
  const found = { host: false, srflx: false, relay: false };
  try {
    const pc = new RTCPeerConnection({ iceServers });
    pc.createDataChannel("t");
    pc.onicecandidate = e => { const c = e.candidate?.candidate || ""; for (const t of ["host", "srflx", "relay"]) if (c.includes(" typ " + t)) found[t] = true; };
    await pc.setLocalDescription(await pc.createOffer());
    await new Promise(r => { const t = setTimeout(r, 8000); pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === "complete") { clearTimeout(t); r(); } }; });
    pc.close();
  } catch {}
  const ok = (b, t) => `<div class="ckrow ${b ? "yes" : "no"}">${I(b ? "check" : "x", 15)} ${t}</div>`;
  out.innerHTML = ok(found.host, "Rede local") + ok(found.srflx, "Conexão direta pela internet (STUN)") +
    (hasTurn() ? ok(found.relay, "Servidor TURN (para redes bloqueadas)") : `<div class="ckrow">${I("circle", 15)} Servidor TURN não configurado</div>`) +
    `<p class="small" style="margin-top:8px">${found.relay ? "Tudo certo: as calls devem funcionar em qualquer rede." :
      found.srflx ? (hasTurn() ? "O TURN configurado não respondeu — confira os dados no painel de desenvolvedor." : "Calls diretas devem funcionar. Se alguém não conseguir conectar, o OWNER precisa configurar um TURN.") :
      hasTurn() ? "Sua rede bloqueia conexão direta e o TURN não respondeu — confira os dados do TURN no painel de desenvolvedor (ou sua internet está fora do ar)." :
      "Sua rede bloqueia conexão direta. Sem um servidor TURN, as calls podem não conectar."}</p>`;
  btn.disabled = false;
}
function voiceSettingsHtml() {
  const p = S.prefs, d = S.devices || { mics: [], cams: [], speakers: [] };
  const sel = (k, list, label) => `<select class="input" onchange="setPref('${k}',this.value)"><option value="">Padrão do sistema</option>${list.map(x => `<option value="${esc(x.deviceId)}" ${p[k] === x.deviceId ? "selected" : ""}>${esc(x.label || label)}</option>`).join("")}</select>`;
  const tog = (k, label, sub, def = true) => { const on = p[k] ?? def; return `<div class="row"><div class="l"><b>${label}</b><span>${sub}</span></div><button class="toggle ${on ? "on" : ""}" onclick="setPref('${k}',!(S.prefs.${k} ?? ${def}));renderSettings()"></button></div>`; };
  return `<h2>Voz e vídeo</h2><p>Microfone, fones, câmera e compartilhamento de tela.</p>
    ${!d.mics.length ? `<div class="card" style="padding:14px;display:flex;gap:12px;align-items:center">${I("mic", 22)}<span style="flex:1">Permita o acesso para escolher seus dispositivos.</span><button class="btn sm" onclick="listDevices(true)">Permitir e listar</button></div>` : ""}
    <label class="f">Microfone</label>${sel("micId", d.mics, "Microfone")}
    <div style="display:flex;gap:10px;align-items:center;margin-top:10px"><button class="btn ghost sm" onclick="testMic(this)">Testar microfone</button><div style="flex:1;height:10px;border-radius:5px;background:var(--bg3);overflow:hidden"><div id="micbar" style="height:100%;width:0;background:var(--grad);transition:width .08s"></div></div></div>
    <label class="f">Saída de áudio (fones / caixas)</label>${sel("speakerId", d.speakers, "Saída")}
    <label class="f">Câmera</label>${sel("camId", d.cams, "Câmera")}
    <div style="margin-top:10px"><button class="btn ghost sm" onclick="testCam(this)">Testar câmera</button><video id="campv" autoplay playsinline muted style="display:none;margin-top:10px;width:100%;max-width:420px;border-radius:var(--r);transform:scaleX(-1)"></video></div>
    <label class="f" style="margin-top:24px">Processamento de voz</label>
    ${tog("noise", "Supressão de ruído", "Reduz barulho de fundo (teclado, ventilador)")}${tog("echo", "Cancelamento de eco", "Evita que sua voz volte para os outros")}${tog("agc", "Volume automático", "Ajusta o volume do microfone sozinho")}
    ${tog("joinMuted", "Entrar mudo nas calls", "O microfone começa desligado", false)}${tog("callSounds", "Sons da call", "Toca um som quando alguém entra ou sai", true)}
    <label class="f" style="margin-top:24px">Volume do toque de chamada <span class="muted" id="v-ring">${p.ringVolume ?? 80}%</span></label>
    <input type="range" min="0" max="100" value="${p.ringVolume ?? 80}" oninput="setPref('ringVolume',+this.value);document.getElementById('v-ring').textContent=this.value+'%'">
    <div style="margin-top:8px"><button class="btn ghost sm" onclick="ringAudio ? stopRing() : playRing()">▶ Ouvir toque</button></div>
    <label class="f" style="margin-top:24px">Conexão das calls</label>
    <div class="card" style="padding:14px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:200px">Verifica se sua internet permite calls (e se o servidor TURN está funcionando).</span><button class="btn sm" onclick="testConnection(this)">Testar conexão</button></div><div id="conntest" class="small" style="margin-top:10px;line-height:1.8"></div></div>
    <label class="f" style="margin-top:24px">Compartilhar tela</label>
    <div class="seg">${[[15, "15 fps (leve)"], [30, "30 fps"], [60, "60 fps (jogos)"]].map(([v, n]) => `<button class="${(p.screenFps || 30) === v ? "on" : ""}" onclick="setPref('screenFps',${v});renderSettings()">${n}</button>`).join("")}</div>
    <p class="muted small" style="margin-top:14px">As calls conectam direto entre os PCs. Em algumas redes muito fechadas (empresa, faculdade) pode ser preciso um servidor TURN — veja o LEIA-ME.</p>`;
}

// ================================================================ ATUALIZAÇÃO AUTOMÁTICA
const IS_ANDROID = /CuplockAndroid\//.test(navigator.userAgent);
const IS_LINUX_APP = !!window.__TAURI__ && /Linux/i.test(navigator.userAgent) && !IS_ANDROID;
// nome do instalador de cada sistema no bucket "releases"
const RELEASE_RE = IS_ANDROID ? /^Cuplock_(\d+\.\d+\.\d+)\.apk$/i : IS_LINUX_APP ? /^Cuplock_(\d+\.\d+\.\d+)_amd64\.AppImage$/i : /^Cuplock_(\d+\.\d+\.\d+)_x64-setup\.exe$/i;
async function appVersion() {
  if (IS_ANDROID) { const m = /CuplockAndroid\/(\d+\.\d+\.\d+)/.exec(navigator.userAgent); return m ? m[1] : VERSION; }
  try { return await window.__TAURI__.app.getVersion(); } catch { return VERSION; }
}
function cmpVer(a, b) { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; }
let updateInfo = null, updateT = null;
async function latestFromSupabase() {
  // Lista o bucket "releases" e pega o maior Cuplock_X.Y.Z_x64-setup.exe
  const { data, error } = await sb.storage.from("releases").list("", { limit: 200 });
  if (error) throw new Error(trErr(error.message));
  let best = null;
  for (const f of data || []) {
    const m = RELEASE_RE.exec(f.name || "");
    if (m && (!best || cmpVer(m[1], best.version) > 0)) best = { version: m[1], name: f.name, size: f.metadata?.size || 0 };
  }
  if (best) best.url = sb.storage.from("releases").getPublicUrl(best.name).data.publicUrl;
  return best;
}
async function latestFromGitHub(repo) {
  const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("GitHub respondeu " + r.status);
  const rel = await r.json(), version = String(rel.tag_name || "").replace(/^v/, "");
  const asset = (rel.assets || []).find(a => (IS_ANDROID ? /\.apk$/i : IS_LINUX_APP ? /\.AppImage$/i : /-setup\.exe$/i).test(a.name));
  return asset && /^\d+\.\d+\.\d+$/.test(version) ? { version, url: asset.browser_download_url, size: asset.size } : null;
}
async function checkUpdate(manual) {
  if (!window.__TAURI__?.core?.invoke && !IS_ANDROID) { if (manual) toast("Atualização automática só nos apps de PC e Android."); return; }
  const repo = window.CUPLOCK_CONFIG?.UPDATE_REPO;
  try {
    const found = [await latestFromSupabase().catch(e => { if (manual) console.warn(e); return null; })];
    if (repo && /^[\w.-]+\/[\w.-]+$/.test(repo)) found.push(await latestFromGitHub(repo).catch(() => null));
    const best = found.filter(Boolean).sort((x, y) => cmpVer(y.version, x.version))[0];
    const cur = await appVersion();
    if (best) window.LATEST_VER = best.version;
    if (best && cmpVer(best.version, cur) > 0) { updateInfo = best; showUpdateCard(); }
    else if (manual) toast(best ? `Você já está na versão mais nova (${cur}).` : `Nenhuma atualização publicada ainda (você está na ${cur}).`);
  } catch (e) { if (manual) toast("Não consegui verificar atualizações: " + e.message); }
}
function showUpdateCard() {
  if (!updateInfo || document.getElementById("updcard")) return;
  const auto = S.prefs.autoUpdate !== false && !call && !IS_ANDROID;
  const el = Object.assign(document.createElement("div"), { id: "updcard", className: "updcard" });
  el.innerHTML = `<div class="hero-ic">${I("rocket", 24)}</div><div style="flex:1;min-width:0"><b>Cuplock ${esc(updateInfo.version)} disponível</b>
    <small>${auto ? `Atualizando em <span id="updcount">10</span> s…` : `${fmtBytes(updateInfo.size || 0)} · leva menos de 1 minuto`}</small></div>
    <button class="btn sm" onclick="installUpdate()">${IS_ANDROID ? "Baixar" : "Atualizar agora"}</button><button class="icon-btn" title="Depois" onclick="clearInterval(window.__updc);this.parentNode.remove()">${ICON.x}</button>`;
  document.body.appendChild(el);
  if (auto) {
    let n = 10;
    window.__updc = setInterval(() => { n--; const c = document.getElementById("updcount"); if (c) c.textContent = n; if (n <= 0) { clearInterval(window.__updc); if (!call) installUpdate(); } }, 1000);
  }
}
async function installUpdate() {
  if (!updateInfo) return;
  if (IS_ANDROID) { location.href = updateInfo.url; toast("Abrindo o download — depois toque no arquivo para instalar."); return; }
  if (call && !await uiConfirm("Você está em uma call. Atualizar agora vai encerrar a call. Continuar?")) return;
  clearInterval(window.__updc);
  const card = document.getElementById("updcard");
  if (card) card.innerHTML = `<div style="font-size:26px">⏳</div><div style="flex:1"><b>Baixando Cuplock ${esc(updateInfo.version)}…</b><small>O app vai fechar e abrir de novo sozinho.</small></div>`;
  try { await leaveCall(true); await window.__TAURI__.core.invoke("install_update", { url: updateInfo.url }); }
  catch (e) {
    card?.remove();
    if (String(e) === "deb") { copy(updateInfo.url); toast("Você instalou pelo .deb: o link da versão nova foi copiado. Baixe e instale por cima (ou use o AppImage, que se atualiza sozinho)."); }
    else toast("Falha na atualização: " + e);
  }
}
function startUpdateChecks() { clearInterval(updateT); setTimeout(() => checkUpdate(false), 4000); updateT = setInterval(() => checkUpdate(false), 3 * 3600 * 1000); }
