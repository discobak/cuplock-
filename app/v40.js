// Cuplock 4.0 — cursor do tema, molduras e adesivos no perfil, atividade detalhada,
// overlay dentro do jogo, popup de chamada separado, mini-games e versão de celular.
"use strict";
const TAURI = window.__TAURI__ || null;

// ================================================================ cursor do app (segue as cores do tema)
function cursorSvg(fill, ring, kind) {
  const s = kind === "hand"
    ? `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'><circle cx='9' cy='9' r='7' fill='${fill}' fill-opacity='.35' stroke='${ring}' stroke-width='2'/><circle cx='9' cy='9' r='2.6' fill='${ring}'/></svg>`
    : `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'><path d='M3 2.5 21 11l-7.6 2.2L10 21z' fill='${fill}' stroke='${ring}' stroke-width='1.6' stroke-linejoin='round'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(s)}") ${kind === "hand" ? "9 9" : "3 2"}, ${kind === "hand" ? "pointer" : "auto"}`;
}
function applyCursor() {
  let st = document.getElementById("cupcursor");
  if (S.prefs.appCursor === false || matchMedia("(pointer: coarse)").matches) { st?.remove(); return; }
  st ||= document.head.appendChild(Object.assign(document.createElement("style"), { id: "cupcursor" }));
  const t = THEMES[S.prefs.theme] || THEMES.meianoite, ring = t.light ? "#1a1626" : "#ffffff";
  st.textContent = `html,body{cursor:${cursorSvg(S.prefs.accent, ring, "arrow")}}
a,button,[onclick],[data-href],.item,.pill,select,label,.react,.chip,.chip2,.sw,summary{cursor:${cursorSvg(S.prefs.accent2, ring, "hand")}}
input,textarea,[contenteditable]{cursor:text}`;
}

// ================================================================ molduras (avatar) e adesivos (perfil)
const FRAMES = {
  nenhuma: { name: "Nenhuma" },
  neon: { name: "Neon" }, arcoiris: { name: "Arco-íris" }, fogo: { name: "Fogo" }, gelo: { name: "Gelo" },
  galaxia: { name: "Galáxia" }, ouro: { name: "Ouro" }, pulso: { name: "Pulso" }, brilhos: { name: "Brilhos" },
  coracoes: { name: "Corações" }, matrix: { name: "Matrix" }, gif: { name: "GIF/PNG próprio" },
};
const decoOf = u => (u && typeof u.deco === "object" && u.deco) || {};
function frameHtml(u) {
  const d = decoOf(u), f = d.frame;
  if (!f || f === "nenhuma" || !FRAMES[f]) return "";
  if (f === "gif") return okUrl(d.frameUrl) ? `<i class="afr gif" style="background-image:url('${d.frameUrl}')"></i>` : "";
  return `<i class="afr f-${f}" style="--fc:${esc(d.frameColor || u.color || "#a78bfa")}"></i>`;
}
function stickersHtml(u, editable) {
  const list = (decoOf(u).stickers || []).filter(s => okUrl(s.url)).slice(0, 12);
  if (!list.length) return "";
  return `<div class="stk-layer">${list.map((s, i) => `<img class="stk ${s.outline ? "outline" : ""}" ${editable ? `data-i="${i}"` : ""} src="${s.url}" alt="" draggable="false"
    style="left:${(+s.x || 0).toFixed(2)}%;top:${(+s.y || 0).toFixed(2)}%;width:${Math.min(60, Math.max(6, +s.w || 18)).toFixed(1)}%;transform:translate(-50%,-50%) rotate(${(+s.r || 0) | 0}deg)">`).join("")}</div>`;
}
// editor em Configurações → Perfil
function decoEditorHtml() {
  const d = decoOf(S.me);
  return `<div class="card deco-card" id="decoed"><b>${I("sparkles", 16)} Moldura e adesivos</b>
    <div class="muted small" style="margin:4px 0 10px">A moldura aparece em volta da sua foto (lista de membros, perfil, mensagens). Os adesivos ficam colados no seu perfil, onde você arrastar.</div>
    <div class="fr-grid">${Object.entries(FRAMES).map(([k, f]) => `<button class="fr-opt ${(d.frame || "nenhuma") === k ? "on" : ""}" onclick="setFrame('${k}')"><span class="avatar" style="background:${esc(S.me.color)}">${initials(S.me.username)}${k === "gif" ? (okUrl(d.frameUrl) ? `<i class="afr gif" style="background-image:url('${d.frameUrl}')"></i>` : "") : k !== "nenhuma" ? `<i class="afr f-${k}" style="--fc:${esc(d.frameColor || S.me.color)}"></i>` : ""}</span><small>${f.name}</small></button>`).join("")}</div>
    <div class="cc-row" style="margin:10px 0"><label class="small">Cor da moldura</label><input type="color" value="${esc(d.frameColor || S.me.color || "#a78bfa")}" onchange="setDeco({frameColor:this.value})"><span class="grow"></span>
      <button class="btn ghost sm" onclick="uploadFrame()">${I("upload", 14)} Moldura GIF/PNG</button></div>
    <div class="deco-stage" id="decostage"><div class="profile-card"><div class="b" style="${bannerCss(S.me)}"></div><div class="c">${avatar(S.me, "xl")}<h3>${uname(S.me)}</h3><div class="pronouns">@${esc(S.me.username)}</div><p class="small muted">Arraste os adesivos · roda do mouse muda o tamanho · Shift+roda gira · clique duplo tira o contorno</p></div>${stickersHtml(S.me, true)}</div></div>
    <div class="cc-row" style="margin-top:10px;flex-wrap:wrap"><button class="btn sm" onclick="addSticker(true)">${I("image", 14)} Adesivo com contorno</button><button class="btn ghost sm" onclick="addSticker(false)">Sem contorno</button>
      ${(d.stickers || []).length ? `<button class="btn ghost sm" onclick="setDeco({stickers:[]})">${I("trash", 14)} Tirar todos</button>` : ""}</div></div>`;
}
async function setDeco(patch) {
  const deco = { ...decoOf(S.me), ...patch };
  S.me.deco = deco; S.users[uid()].deco = deco;
  try { await q(sb.from("profiles").update({ deco }).eq("id", uid())); } catch (e) { toast(e.message); }
  if (S.route.name === "settings") renderSettings();
  renderChrome();
}
function setFrame(k) { if (k === "gif" && !okUrl(decoOf(S.me).frameUrl)) return uploadFrame(); setDeco({ frame: k }); }
async function uploadFrame() {
  const [f] = await pickFile("image/png,image/gif,image/webp"); if (!f) return;
  if (f.size > 3 * 1048576) return toast("Moldura até 3 MB.");
  toast("Enviando moldura…");
  try { const url = await uploadTo("avatars", f, { maxSide: 256, square: true }); setDeco({ frame: "gif", frameUrl: url }); } catch (e) { toast(e.message); }
}
async function addSticker(outline) {
  const st = decoOf(S.me).stickers || [];
  if (st.length >= 12) return toast("Até 12 adesivos.");
  const [f] = await pickFile("image/png,image/jpeg,image/webp,image/gif"); if (!f) return;
  if (f.size > 4 * 1048576) return toast("Adesivo até 4 MB.");
  toast("Enviando adesivo…");
  try { const url = await uploadTo("avatars", f, { maxSide: 400 }); setDeco({ stickers: [...st, { url, x: 30 + Math.random() * 40, y: 25 + Math.random() * 40, w: 22, r: Math.round(Math.random() * 30 - 15), outline }] }); }
  catch (e) { toast(e.message); }
}
function bindDecoStage() {
  const stage = document.querySelector("#decostage .profile-card"); if (!stage) return;
  let saveT;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => setDeco({ stickers: decoOf(S.me).stickers }), 500); };
  stage.querySelectorAll(".stk[data-i]").forEach(img => {
    const i = +img.dataset.i, s = () => decoOf(S.me).stickers[i];
    img.addEventListener("pointerdown", e => {
      e.preventDefault(); img.setPointerCapture(e.pointerId); img.classList.add("drag");
      const r = stage.getBoundingClientRect();
      const mv = ev => { s().x = Math.min(100, Math.max(0, (ev.clientX - r.left) / r.width * 100)); s().y = Math.min(100, Math.max(0, (ev.clientY - r.top) / r.height * 100)); img.style.left = s().x + "%"; img.style.top = s().y + "%"; };
      const up = () => { img.removeEventListener("pointermove", mv); img.removeEventListener("pointerup", up); img.classList.remove("drag"); save(); };
      img.addEventListener("pointermove", mv); img.addEventListener("pointerup", up);
    });
    img.addEventListener("wheel", e => {
      e.preventDefault(); const st = s();
      if (e.shiftKey) st.r = ((st.r || 0) + (e.deltaY > 0 ? 8 : -8)) % 360; else st.w = Math.min(60, Math.max(6, (st.w || 18) * (e.deltaY > 0 ? .92 : 1.08)));
      img.style.width = st.w + "%"; img.style.transform = `translate(-50%,-50%) rotate(${st.r | 0}deg)`; save();
    }, { passive: false });
    img.addEventListener("dblclick", () => { s().outline = !s().outline; img.classList.toggle("outline", s().outline); save(); });
    img.addEventListener("contextmenu", e => { e.preventDefault(); showCtx(e, `<button class="danger" onclick="closeLayer();setDeco({stickers:decoOf(S.me).stickers.filter((_,k)=>k!==${i})})">${I("trash", 15)} Tirar adesivo</button>`); });
  });
}

// ================================================================ atividade detalhada (rich presence)
// ícones de verdade: Steam (pelo appid) ou o ícone do site oficial
const GAME_META = {
  "Counter-Strike 2": { steam: 730 }, "Dota 2": { steam: 570 }, "Apex Legends": { steam: 1172470 }, "PUBG: Battlegrounds": { steam: 578080 },
  "Rainbow Six Siege": { steam: 359550 }, "Destiny 2": { steam: 1085660 }, "Marvel Rivals": { steam: 2767030 }, "HELLDIVERS 2": { steam: 553850 },
  "Terraria": { steam: 105600 }, "Stardew Valley": { steam: 413150 }, "Palworld": { steam: 1623730 }, "Grand Theft Auto V": { steam: 271590 },
  "Rust": { steam: 252490 }, "ELDEN RING": { steam: 1245620 }, "Rocket League": { steam: 252950 }, "Among Us": { steam: 945360 },
  "Dead by Daylight": { steam: 381210 }, "Phasmophobia": { steam: 739630 }, "Lethal Company": { steam: 1966720 }, "Valheim": { steam: 892970 },
  "Cyberpunk 2077": { steam: 1091500 }, "Baldur's Gate 3": { steam: 1086940 }, "THE FINALS": { steam: 2073850 }, "Deep Rock Galactic": { steam: 548430 },
  "Team Fortress 2": { steam: 440 }, "Garry's Mod": { steam: 4000 }, "Euro Truck Simulator 2": { steam: 227300 }, "Sea of Thieves": { steam: 1172620 },
  "Fall Guys": { steam: 1097150 }, "Warframe": { steam: 230410 }, "Path of Exile 2": { steam: 2694490 }, "Hollow Knight": { steam: 367520 },
  "Overwatch 2": { steam: 2357570 }, "Delta Force": { steam: 2507950 }, "Call of Duty": { steam: 1938090 }, "Geometry Dash": { steam: 322170 },
  "Brawlhalla": { steam: 291550 }, "Repo": { steam: 3241660 }, "Peak": { steam: 3527290 }, "Schedule I": { steam: 3164500 },
  "Minecraft": { site: "minecraft.net" }, "Roblox": { site: "roblox.com" }, "VALORANT": { site: "playvalorant.com" }, "League of Legends": { site: "leagueoflegends.com" },
  "Fortnite": { site: "fortnite.com" }, "Free Fire": { site: "ff.garena.com" }, "Genshin Impact": { site: "genshin.hoyoverse.com" }, "Honkai: Star Rail": { site: "hsr.hoyoverse.com" },
  "Spotify": { site: "spotify.com" }, "Visual Studio Code": { site: "code.visualstudio.com" }, "YouTube": { site: "youtube.com" }, "Twitch": { site: "twitch.tv" },
  "Netflix": { site: "netflix.com" }, "Figma": { site: "figma.com" }, "Photoshop": { site: "adobe.com" }, "Blender": { site: "blender.org" }, "OBS Studio": { site: "obsproject.com" },
  "Osu!": { site: "osu.ppy.sh" }, "Steam": { site: "store.steampowered.com" }, "Epic Games": { site: "epicgames.com" }, "Prime Video": { site: "primevideo.com" },
};
function gameImg(name) {
  const m = GAME_META[name]; if (!m) return null;
  if (m.steam) return `https://cdn.cloudflare.steamstatic.com/steam/apps/${m.steam}/capsule_184x69.jpg`;
  if (m.site) return `https://www.google.com/s2/favicons?domain=${m.site}&sz=128`;
  return null;
}
// tira detalhes do título da janela
function detailsFrom(name, proc, title) {
  if (!title || S.prefs.activityDetails === false) return {};
  const t = title.replace(/\s+/g, " ").trim();
  if (proc === "spotify.exe" || proc === "spotify") { if (/^spotify( premium| free)?$/i.test(t)) return { details: "Pausado" }; const [a, ...s] = t.split(" - "); return s.length ? { type: "listening", details: s.join(" - "), state: "de " + a } : {}; }
  if (/code(\.exe)?$/.test(proc) || name === "Visual Studio Code") { const p = t.replace(/ - Visual Studio Code.*$/, "").replace(/^● /, "").split(" - "); return { type: "coding", details: p[0] ? "Editando " + p[0] : "", state: p[1] ? "em " + p[1] : "" }; }
  if (name === "Minecraft") { const m = /Minecraft\*? ?([\d.]+)?(?: - (.+))?/.exec(t); return m ? { details: m[2] ? m[2].replace("(3rd-party Server)", "servidor") : "No menu", state: m[1] ? "Versão " + m[1] : "" } : {}; }
  if (name === "Roblox") return { details: "Em uma experiência" };
  if (name === t || t.length < 3 || /^(n\/a|default ime|msctfime ui)$/i.test(t)) return {};
  return { details: t.slice(0, 80) };
}
// navegador: só YouTube, Twitch, Netflix e Prime viram atividade (o resto do que você abre não aparece)
const BROWSERS = /^(chrome|msedge|firefox|opera|brave|vivaldi|opera_gx|arc)(\.exe)?$/;
function browserActivity(proc, title) {
  if (!BROWSERS.test(proc) || !title || S.prefs.activityDetails === false) return null;
  let m;
  if ((m = /^(?:\(\d+\) )?(.+?) - YouTube/.exec(title))) return { type: "watching", name: "YouTube", details: m[1] };
  if ((m = /^(.+?) - Twitch/.exec(title))) return { type: "watching", name: "Twitch", details: m[1] };
  if (/Netflix/.test(title)) return { type: "watching", name: "Netflix" };
  if (/Prime Video/.test(title)) return { type: "watching", name: "Prime Video" };
  return null;
}
(() => {
  const invoke = TAURI?.core?.invoke;
  if (!invoke) return;
  const _det = detectActivity;
  detectActivity = async () => {
    clearTimeout(detectT);
    if (!S.prefs.showActivity) return _det();
    // títulos de janela a cada 45 s (o tasklist /v é pesado); no meio usa o último resultado
    let wins = window.__wins || [];
    if (!window.__winsAt || Date.now() - window.__winsAt > 44000) { try { wins = window.__wins = await invoke("running_windows"); window.__winsAt = Date.now(); } catch {} }
    await _det();                                  // acha o jogo/app pelo processo (lista + jogos próprios)
    clearTimeout(detectT);
    const cur = S.myActivity, manual = cur && S.prefs.manualActivity?.name === cur.name;
    let a = cur ? { type: cur.type, name: cur.name, icon: cur.icon } : null;
    if (a && !manual) {
      const proc = Object.entries(window.CUPLOCK_GAMES || {}).concat(Object.entries(window.CUPLOCK_APPS || {})).find(([, v]) => v[0] === a.name)?.[0];
      const w = wins.find(([p]) => p === proc) || wins.find(([p, t]) => t.toLowerCase().includes(a.name.toLowerCase()));
      Object.assign(a, detailsFrom(a.name, w?.[0] || proc || "", w?.[1] || ""));
    }
    if (!a || a.type === "listening") { for (const [p, t] of wins) { const b = browserActivity(p, t); if (b) { a = a || b; break; } } }
    if (a) a.img = gameImg(a.name) || null;
    const key = x => x ? [x.name, x.type, x.details, x.state].join("|") : "";
    if (key(a) !== key(S.lastAct)) {
      S.myActivity = a ? { ...a, since: S.lastAct?.name === a.name ? S.lastAct.since : Date.now() } : null;
      S.lastAct = S.myActivity; trackPresence(); renderChrome(); refreshPresenceUI();
    }
    detectT = setTimeout(detectActivity, 15000);
  };
})();
function actIcon(a, cls = "") {
  return a.img && okUrl(a.img) ? `<img class="act-img ${cls}" src="${esc(a.img)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${esc(a.icon || "🎮").replace(/'/g, "")}'}))">` : esc(a.icon || "🎮");
}
activityLine = function (u) {
  const a = activityOf(u);
  if (a) return `<span class="activity">${actIcon(a, "tiny")} ${a.type === "custom" ? `<b>${esc(a.name)}</b>` : `${ACT_LABEL[a.type] || "Jogando"} <b>${esc(a.name)}</b>`}</span>`;
  if (u?.custom_status || u?.status_emoji) return `<span class="activity">${esc(u.status_emoji || "")} ${emojify(esc(u.custom_status || ""))}</span>`;
  return "";
};
activityCard = function (u) {
  const a = activityOf(u); if (!a) return "";
  return `<div class="act-card rich"><div class="act-ico ${a.img ? "has-img" : ""}">${actIcon(a)}</div><div style="min-width:0;flex:1"><small>${a.type === "custom" ? "Status" : ACT_LABEL[a.type] || "Jogando"}</small>
    <b class="act-name">${esc(a.name)}</b>${a.details ? `<div class="act-det">${esc(a.details)}</div>` : ""}${a.state ? `<div class="act-det muted">${esc(a.state)}</div>` : ""}<span class="muted small">${a.since ? sinceTxt(a.since) : ""}</span></div><span class="pulse"></span></div>`;
};

// ================================================================ overlay por cima do jogo + popup de chamada (app de PC)
const WW = TAURI?.webviewWindow?.WebviewWindow, EV = TAURI?.event;
async function getWin(label) { try { return await WW.getByLabel(label); } catch { return null; } }
function themePayload() {
  const t = THEMES[S.prefs.theme] || THEMES.meianoite;
  return { accent: S.prefs.accent, accent2: S.prefs.accent2, bg: t.bg1, bg3: t.bg3, fg: t.fg, fg2: t.fg2, light: !!t.light, font: getComputedStyle(document.documentElement).getPropertyValue("--font") };
}
async function openSideWindow(label, opts) {
  if (!WW) return null;
  let w = await getWin(label);
  if (w) { try { await w.show(); } catch {} return w; }
  w = new WW(label, { decorations: false, transparent: true, resizable: false, skipTaskbar: true, alwaysOnTop: true, focus: false, shadow: false, ...opts });
  await new Promise(r => { w.once("tauri://created", r); w.once("tauri://error", e => { console.warn(e); r(); }); setTimeout(r, 2500); });
  return w;
}
// ---- overlay
let ovOn = false, ovT = null;
function overlayState() {
  if (!call) return { inCall: false, theme: themePayload() };
  const sp = window.SPEAK || {};
  const peers = [[uid(), { mic: call.mic }], ...[...call.peers.values()].map(p => [p.id, p.state || {}])].map(([id, st]) => { const u = S.users[id] || {}; return { id, name: dname(u) || "?", color: u.color || "#666", avatar: okUrl(u.avatar_url) ? u.avatar_url : "", mic: st.mic !== false, speaking: !!sp[id] }; });
  return { inCall: true, label: callLabel(call.cid), mic: call.mic, deaf: call.deaf, peers, game: S.myActivity?.name || "", theme: themePayload() };
}
async function showOverlay(force) {
  if (!WW || (!call && !force)) return;
  ovOn = true;
  await openSideWindow("overlay", { url: "overlay.html", width: 250, height: 320, x: 16, y: 80, title: "Cuplock Overlay" });
  pushOverlay(); clearInterval(ovT); ovT = setInterval(pushOverlay, 300);
}
async function hideOverlay() { ovOn = false; clearInterval(ovT); const w = await getWin("overlay"); try { await w?.hide(); } catch {} }
function toggleOverlay() { ovOn ? hideOverlay() : showOverlay(true); }
let lastOv = "";
function pushOverlay() {
  if (!ovOn || !EV) return;
  const st = overlayState(), k = JSON.stringify(st);
  if (k === lastOv) return; lastOv = k;
  EV.emitTo("overlay", "ov-state", st).catch(() => {});
}
// ---- popup de chamada separado (aparece no meio da tela sem abrir o Cuplock inteiro)
async function showRingWindow(row) {
  const u = S.users[row.caller] || {};
  const w = await openSideWindow("ring", { url: "ring.html", width: 340, height: 380, center: true, title: "Chamada no Cuplock", focus: true });
  if (!w) return false;
  const data = { name: dname(u), color: u.color || "#888", avatar: okUrl(u.avatar_url) ? u.avatar_url : "", video: !!row.video, theme: themePayload() };
  const send = () => EV.emitTo("ring", "ring-data", data).catch(() => {});
  send(); setTimeout(send, 400); setTimeout(send, 1200);
  try { await w.center(); await w.setAlwaysOnTop(true); await w.setFocus(); } catch {}
  return true;
}
async function hideRingWindow() { const w = await getWin("ring"); try { await w?.hide(); } catch {} }
if (EV) {
  EV.listen("ov-cmd", ({ payload }) => {
    if (payload === "mic") toggleMic(); else if (payload === "deaf") toggleDeaf(); else if (payload === "leave") leaveCall();
    else if (payload === "hide") hideOverlay(); else if (payload === "open") bringToFront();
    else if (payload === "ready") { lastOv = ""; pushOverlay(); }
    setTimeout(pushOverlay, 60);
  });
  EV.listen("ring-cmd", ({ payload }) => {
    hideRingWindow();
    if (payload === "decline") declineRing();
    else if (payload === "voice" || payload === "video") { bringToFront(); acceptRing(payload === "video"); }
  });
  (() => {
    const _on = onRing;
    onRing = async row => {
      await _on(row);
      if (ringing?.id !== row.id) return;
      // no PC: popup próprio no meio da tela; o Cuplock fica onde estava
      if (S.prefs.ringWindow !== false && await showRingWindow(row).catch(() => false)) document.getElementById("incoming")?.classList.add("moved");
    };
    const _stop = stopRinging;
    stopRinging = (...a) => { _stop(...a); hideRingWindow(); };
    const _join = joinCall;
    joinCall = async (...a) => { const r = await _join(...a); if (S.prefs.overlay !== false && S.myActivity && (S.myActivity.type === "playing")) showOverlay(); return r; };
    const _leave = leaveCall;
    leaveCall = async (...a) => { const r = await _leave(...a); pushOverlay(); setTimeout(() => { if (!call) hideOverlay(); }, 1500); return r; };
  })();
}
// atalhos globais (funcionam com o jogo em foco)
async function registerHotkeys() {
  const gs = TAURI?.globalShortcut; if (!gs?.register) return;
  try {
    await gs.unregisterAll?.();
    const on = (combo, fn) => gs.register(combo, e => { if (!e || e.state === "Pressed") fn(); }).catch(() => {});
    await on("CommandOrControl+Shift+M", () => { if (call) toggleMic(); });
    await on("CommandOrControl+Shift+D", () => { if (call) toggleDeaf(); });
    await on("CommandOrControl+Shift+O", toggleOverlay);
  } catch {}
}
if (TAURI) setTimeout(registerHotkeys, 3000);

// ================================================================ mini-games
let GAMES = null; // { cid, ch, room, kind, ... }
const GAME_LIST = { velha: ["Jogo da velha", "2 jogadores"], xadrez: ["Xadrez", "2 jogadores"], mousewars: ["Mouse Wars", "até 8 · lute com o mouse e poderes"] };
function gameTopic(cid) { return "game:" + cid; }
function openGames() {
  const cid = currentChannel(); if (!cid) return;
  if (GAMES?.cid !== cid) { leaveGames(); joinGameChannel(cid); }
  let pane = document.getElementById("gamepane");
  if (!pane) {
    pane = Object.assign(document.createElement("div"), { id: "gamepane", className: "gamepane" });
    ($("#chatcol") || $(".main")).prepend(pane);
  }
  drawGameLobby();
}
function closeGames() { document.getElementById("gamepane")?.remove(); if (GAMES?.mw) mwStop(); }
function joinGameChannel(cid) {
  GAMES = { cid, rooms: {}, ch: null, me: uid() };
  GAMES.ch = sb.channel(gameTopic(cid), { config: { private: true, broadcast: { self: false }, presence: { key: uid() } } })
    .on("broadcast", { event: "g" }, ({ payload }) => onGameMsg(payload))
    .on("presence", { event: "sync" }, () => { GAMES.present = Object.keys(GAMES.ch.presenceState()); drawGameLobby(); })
    .subscribe(st => { if (st === "SUBSCRIBED") { GAMES.ch.track({ at: Date.now() }); gsend({ t: "who" }); } });
}
function leaveGames() { if (!GAMES) return; if (GAMES.mw) mwStop(); try { sb.removeChannel(GAMES.ch); } catch {} GAMES = null; }
function gsend(m) { GAMES?.ch?.send({ type: "broadcast", event: "g", payload: { ...m, from: uid() } }); }
function onGameMsg(m) {
  if (!GAMES || !m?.from) return;
  ensureUsers([m.from]).catch(() => {});
  const R = GAMES.rooms;
  if (m.t === "who") { for (const r of Object.values(R)) if (r.host === uid()) gsend({ t: "room", room: r.id, kind: r.kind, host: r.host, players: r.players, state: r.state }); return; }
  if (m.t === "room") { R[m.room] = { ...(R[m.room] || {}), id: m.room, kind: m.kind, host: m.host, players: m.players, state: m.state }; if (GAMES.room === m.room) drawGame(); else drawGameLobby(); return; }
  if (m.t === "join") { const r = R[m.room]; if (r && r.host === uid() && !r.players.includes(m.from) && r.players.length < (r.kind === "mousewars" ? 8 : 2)) { r.players.push(m.from); broadcastRoom(r); drawGame(); } return; }
  if (m.t === "move") { const r = R[m.room]; if (!r) return; applyMove(r, m.move, m.from); if (GAMES.room === m.room) drawGame(); return; }
  if (m.t === "close") { delete R[m.room]; if (GAMES.room === m.room) { GAMES.room = null; toast("A partida foi encerrada."); if (GAMES.mw) mwStop(); } drawGameLobby(); return; }
  if (m.t === "mw") mwOnMsg(m);
}
function broadcastRoom(r) { gsend({ t: "room", room: r.id, kind: r.kind, host: r.host, players: r.players, state: r.state }); }
function newRoom(kind) {
  const id = Math.random().toString(36).slice(2, 10);
  const r = { id, kind, host: uid(), players: [uid()], state: kind === "velha" ? { b: Array(9).fill(""), turn: 0, win: null } : kind === "xadrez" ? chessNew() : { started: Date.now() } };
  GAMES.rooms[id] = r; GAMES.room = id; broadcastRoom(r); drawGame();
  if (kind === "mousewars") mwStart(r);
}
function joinRoom(id) {
  const r = GAMES.rooms[id]; if (!r) return;
  GAMES.room = id;
  if (!r.players.includes(uid())) gsend({ t: "join", room: id });
  drawGame();
  if (r.kind === "mousewars") mwStart(r);
}
async function inviteToGame(kind) {
  const cid = GAMES?.cid; if (!cid) return;
  await sendMessage(cid, `🎮 **${dname(S.me)}** abriu **${GAME_LIST[kind][0]}** — clique em ${"`"}Jogos${"`"} no topo da conversa para entrar!`);
}
function drawGameLobby() {
  const pane = document.getElementById("gamepane"); if (!pane || !GAMES) return;
  if (GAMES.room && GAMES.rooms[GAMES.room]) return drawGame();
  const rooms = Object.values(GAMES.rooms);
  pane.innerHTML = `<div class="gp-head"><b>${I("gamepad", 18)} Mini-games</b><span class="muted small">${(GAMES.present || []).length} aqui</span><span class="grow"></span><button class="icon-btn" title="Fechar" onclick="closeGames()">${I("x", 16)}</button></div>
    ${rooms.length ? `<div class="gp-label">Partidas abertas</div>${rooms.map(r => `<div class="gp-room"><b>${GAME_LIST[r.kind][0]}</b><span class="muted small">de ${esc(dname(S.users[r.host]))} · ${r.players.length} jogando</span><span class="grow"></span><button class="btn sm" onclick="joinRoom('${r.id}')">Entrar</button></div>`).join("")}` : ""}
    <div class="gp-label">Começar</div><div class="gp-cards">${Object.entries(GAME_LIST).map(([k, [n, d]]) => `<button class="gp-card k-${k}" onclick="newRoom('${k}')"><span class="gp-art"></span><b>${n}</b><small>${d}</small></button>`).join("")}</div>`;
}
function drawGame() {
  const pane = document.getElementById("gamepane"), r = GAMES?.rooms[GAMES?.room]; if (!pane || !r) return drawGameLobby();
  const me = uid(), seat = r.players.indexOf(me), names = r.players.map(id => esc(dname(S.users[id])));
  let body = "";
  if (r.kind === "velha") {
    const s = r.state, myTurn = !s.win && seat === s.turn % 2 && r.players.length === 2;
    body = `<div class="gm-status">${r.players.length < 2 ? "Esperando alguém entrar…" : s.win ? (s.win === "empate" ? "Deu velha!" : `${names[s.win === "X" ? 0 : 1]} venceu!`) : myTurn ? "Sua vez" : `Vez de ${names[s.turn % 2] || "…"}`}</div>
      <div class="ttt">${s.b.map((v, i) => `<button class="${v ? "v" + v : ""} ${s.line?.includes(i) ? "w" : ""}" ${myTurn && !v ? `onclick="gameMove({i:${i}})"` : "disabled"}>${v}</button>`).join("")}</div>
      <div class="gm-sub">${names[0] || "?"} (X) contra ${names[1] || "?"} (O)</div>`;
  } else if (r.kind === "xadrez") body = chessHtml(r, seat, names);
  else body = `<div class="gm-status">Mouse Wars — ${r.players.length} jogando</div><div class="mw-help"><b>Clique</b> atira · <b>Q</b> dash · <b>W</b> escudo · <b>E</b> bomba</div><div class="gm-sub">Use a arena que abriu por cima da conversa. Esc sai.</div>`;
  const host = r.host === me;
  pane.innerHTML = `<div class="gp-head"><button class="icon-btn" title="Voltar" onclick="GAMES.room=null;${r.kind === "mousewars" ? "mwStop();" : ""}drawGameLobby()">${I("back", 16)}</button><b>${GAME_LIST[r.kind][0]}</b><span class="grow"></span>
    <button class="btn ghost sm" onclick="inviteToGame('${r.kind}')">Chamar a galera</button>${host ? `<button class="btn ghost sm" onclick="gameRestart()">Recomeçar</button><button class="icon-btn" title="Encerrar" onclick="gsend({t:'close',room:'${r.id}'});onGameMsg({t:'close',room:'${r.id}',from:uid()})">${I("trash", 15)}</button>` : ""}<button class="icon-btn" title="Fechar" onclick="closeGames()">${I("x", 16)}</button></div>${body}`;
}
function gameMove(move) { const r = GAMES.rooms[GAMES.room]; if (!r) return; if (applyMove(r, move, uid())) { gsend({ t: "move", room: r.id, move }); drawGame(); } }
function gameRestart() {
  const r = GAMES.rooms[GAMES.room]; if (!r || r.host !== uid()) return;
  r.state = r.kind === "velha" ? { b: Array(9).fill(""), turn: 0, win: null } : r.kind === "xadrez" ? chessNew() : { started: Date.now() };
  broadcastRoom(r); drawGame();
}
function applyMove(r, mv, from) {
  const seat = r.players.indexOf(from); if (seat < 0) return false;
  if (r.kind === "velha") {
    const s = r.state; if (s.win || seat !== s.turn % 2 || s.b[mv.i]) return false;
    s.b[mv.i] = seat ? "O" : "X"; s.turn++;
    for (const l of [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]) if (s.b[l[0]] && s.b[l[0]] === s.b[l[1]] && s.b[l[1]] === s.b[l[2]]) { s.win = s.b[l[0]]; s.line = l; }
    if (!s.win && s.b.every(Boolean)) s.win = "empate";
    return true;
  }
  if (r.kind === "xadrez") return chessApply(r.state, mv, seat ? "b" : "w");
  return false;
}
// ---- xadrez (regras completas menos en passant; promoção vira dama)
function chessNew() {
  const back = "rnbqkbnr";
  const b = []; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) b.push(y === 0 ? "b" + back[x] : y === 1 ? "bp" : y === 6 ? "wp" : y === 7 ? "w" + back[x] : "");
  return { b, turn: "w", moved: {}, last: null, over: null };
}
function chessMoves(st, i, legalOnly = true) {
  const b = st.b, p = b[i]; if (!p) return [];
  const c = p[0], k = p[1], x = i % 8, y = (i / 8) | 0, out = [];
  const at = (xx, yy) => xx >= 0 && xx < 8 && yy >= 0 && yy < 8 ? yy * 8 + xx : -1;
  const ray = (dx, dy, one) => { for (let s = 1; s < 8; s++) { const j = at(x + dx * s, y + dy * s); if (j < 0) break; if (!b[j]) out.push(j); else { if (b[j][0] !== c) out.push(j); break; } if (one) break; } };
  if (k === "p") {
    const d = c === "w" ? -1 : 1, f = at(x, y + d);
    if (f >= 0 && !b[f]) { out.push(f); const f2 = at(x, y + 2 * d); if ((c === "w" ? y === 6 : y === 1) && !b[f2]) out.push(f2); }
    for (const dx of [-1, 1]) { const j = at(x + dx, y + d); if (j >= 0 && b[j] && b[j][0] !== c) out.push(j); }
  } else if (k === "n") for (const [dx, dy] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) { const j = at(x + dx, y + dy); if (j >= 0 && (!b[j] || b[j][0] !== c)) out.push(j); }
  else {
    const dirs = k === "b" ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : k === "r" ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) ray(dx, dy, k === "k");
    if (k === "k" && legalOnly && !st.moved[i] && !inCheck(st, c)) {
      for (const [rx, path, dest] of [[7, [5, 6], 6], [0, [1, 2, 3], 2]]) {
        const ri = y * 8 + rx;
        if (b[ri] === c + "r" && !st.moved[ri] && path.every(px => !b[y * 8 + px]) && [x + (dest > x ? 1 : -1), dest].every(px => !attacked(st, y * 8 + px, c))) out.push(y * 8 + dest);
      }
    }
  }
  return legalOnly ? out.filter(j => { const t = chessSim(st, i, j); return !inCheck(t, c); }) : out;
}
function chessSim(st, i, j) {
  const b = st.b.slice(), p = b[i]; b[j] = p; b[i] = "";
  if (p[1] === "k" && Math.abs((j % 8) - (i % 8)) === 2) { const y = (i / 8) | 0, rk = j % 8 === 6 ? [7, 5] : [0, 3]; b[y * 8 + rk[1]] = b[y * 8 + rk[0]]; b[y * 8 + rk[0]] = ""; }
  if (p[1] === "p" && ((j / 8) | 0) % 7 === 0) b[j] = p[0] + "q";
  return { ...st, b };
}
function attacked(st, sq, c) { for (let i = 0; i < 64; i++) { const p = st.b[i]; if (p && p[0] !== c && chessMoves(st, i, false).includes(sq)) return true; } return false; }
function inCheck(st, c) { const k = st.b.indexOf(c + "k"); return k >= 0 && attacked(st, k, c); }
function chessApply(st, mv, color) {
  if (st.over || st.turn !== color || st.b[mv.f]?.[0] !== color || !chessMoves(st, mv.f).includes(mv.t)) return false;
  const n = chessSim(st, mv.f, mv.t); st.b = n.b; st.moved[mv.f] = st.moved[mv.t] = 1; st.last = [mv.f, mv.t]; st.turn = color === "w" ? "b" : "w";
  const any = st.b.some((p, i) => p && p[0] === st.turn && chessMoves(st, i).length);
  if (!any) st.over = inCheck(st, st.turn) ? (color === "w" ? "Brancas" : "Pretas") + " venceram (xeque-mate)!" : "Empate (afogamento).";
  return true;
}
const PIECE = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
let chessSel = null;
function chessHtml(r, seat, names) {
  const st = r.state, color = seat === 0 ? "w" : seat === 1 ? "b" : null, flip = color === "b";
  const moves = chessSel != null ? chessMoves(st, chessSel) : [];
  const myTurn = color && st.turn === color && r.players.length === 2 && !st.over;
  let cells = "";
  for (let k = 0; k < 64; k++) {
    const i = flip ? 63 - k : k, p = st.b[i], dark = ((i % 8) + ((i / 8) | 0)) % 2;
    cells += `<button class="sq ${dark ? "d" : "l"} ${chessSel === i ? "sel" : ""} ${moves.includes(i) ? "mv" : ""} ${st.last?.includes(i) ? "last" : ""}" ${myTurn ? `onclick="chessClick(${i})"` : "disabled"}>${p ? `<span class="pc ${p[0]}">${PIECE[p[1]]}</span>` : ""}</button>`;
  }
  return `<div class="gm-status">${r.players.length < 2 ? "Esperando alguém entrar…" : st.over || (myTurn ? `Sua vez${inCheck(st, color) ? " — xeque!" : ""}` : `Vez das ${st.turn === "w" ? "brancas" : "pretas"}`)}</div>
    <div class="chess">${cells}</div><div class="gm-sub">${names[0] || "?"} (brancas) contra ${names[1] || "?"} (pretas)</div>`;
}
function chessClick(i) {
  const r = GAMES.rooms[GAMES.room], st = r.state, color = r.players.indexOf(uid()) ? "b" : "w";
  if (chessSel != null && chessMoves(st, chessSel).includes(i)) { const mv = { f: chessSel, t: i }; chessSel = null; gameMove(mv); return; }
  chessSel = st.b[i]?.[0] === color ? i : null; drawGame();
}
// ---- Mouse Wars
let MW = null;
function mwStart(r) {
  if (MW) return;
  const arena = Object.assign(document.createElement("div"), { id: "mwarena", className: "mwarena" });
  arena.innerHTML = `<canvas></canvas><div class="mw-hud"><b>Mouse Wars</b><span id="mwhp"></span><span id="mwcd"></span><span class="grow"></span><span id="mwscore"></span><button class="btn ghost sm" onclick="mwStop()">Sair (Esc)</button></div>`;
  ($("#chatcol") || $(".main")).appendChild(arena);
  const cv = arena.querySelector("canvas"), ctx = cv.getContext("2d");
  MW = { room: r.id, cv, ctx, arena, me: { x: .5, y: .5, hp: 100, dead: 0, shield: 0, kills: 0 }, others: {}, shots: [], booms: [], cd: { q: 0, w: 0, e: 0, fire: 0 }, lastSend: 0, raf: 0 };
  const resize = () => { const b = arena.getBoundingClientRect(); cv.width = b.width * devicePixelRatio; cv.height = b.height * devicePixelRatio; };
  resize(); MW.ro = new ResizeObserver(resize); MW.ro.observe(arena);
  const pos = e => { const b = cv.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) }; };
  cv.addEventListener("pointermove", e => { if (MW.me.dead) return; const p = pos(e); MW.me.vx = p.x - MW.me.x; MW.me.vy = p.y - MW.me.y; MW.me.x = p.x; MW.me.y = p.y; });
  cv.addEventListener("pointerdown", e => {
    if (MW.me.dead || Date.now() < MW.cd.fire) return; MW.cd.fire = Date.now() + 350;
    const p = pos(e), t = mwNearest() || { x: p.x + (MW.me.vx || .01) * 20, y: p.y + (MW.me.vy || 0) * 20 };
    const dx = t.x - p.x, dy = t.y - p.y, l = Math.hypot(dx, dy) || 1, shot = { x: p.x, y: p.y, vx: dx / l * .9, vy: dy / l * .9, by: uid(), t: Date.now() };
    MW.shots.push(shot); mwSend({ k: "shot", s: shot });
  });
  MW.key = e => {
    if (!MW || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    const k = e.key.toLowerCase(), now = Date.now();
    if (k === "escape") return mwStop();
    if (MW.me.dead) return;
    if (k === "q" && now > MW.cd.q) { MW.cd.q = now + 3000; const l = Math.hypot(MW.me.vx || 0, MW.me.vy || 0) || 1; MW.me.x = Math.min(1, Math.max(0, MW.me.x + (MW.me.vx || 0) / l * .18)); MW.me.y = Math.min(1, Math.max(0, MW.me.y + (MW.me.vy || 0) / l * .18)); MW.booms.push({ x: MW.me.x, y: MW.me.y, t: now, dash: 1 }); }
    if (k === "w" && now > MW.cd.w) { MW.cd.w = now + 8000; MW.me.shield = now + 2500; mwSend({ k: "shield" }); }
    if (k === "e" && now > MW.cd.e) { MW.cd.e = now + 10000; const b = { x: MW.me.x, y: MW.me.y, t: now + 900, by: uid() }; MW.booms.push(b); mwSend({ k: "bomb", b }); }
  };
  addEventListener("keydown", MW.key);
  const loop = () => { if (!MW) return; mwTick(); MW.raf = requestAnimationFrame(loop); };
  loop();
  mwSend({ k: "hi" });
}
function mwStop() {
  if (!MW) return;
  cancelAnimationFrame(MW.raf); removeEventListener("keydown", MW.key); MW.ro?.disconnect(); MW.arena.remove();
  mwSend({ k: "bye" }); MW = null;
}
function mwSend(m) { if (MW) gsend({ t: "mw", room: MW.room, ...m }); }
function mwNearest() {
  let best = null, bd = 9;
  for (const o of Object.values(MW.others)) { if (o.dead || Date.now() - o.seen > 3000) continue; const d = Math.hypot(o.x - MW.me.x, o.y - MW.me.y); if (d < bd) { bd = d; best = o; } }
  return best;
}
function mwOnMsg(m) {
  if (!MW || m.room !== MW.room) return;
  const o = (MW.others[m.from] ||= { x: .5, y: .5, hp: 100, kills: 0, seen: Date.now() });
  o.seen = Date.now();
  if (m.k === "pos") Object.assign(o, { x: m.x, y: m.y, hp: m.hp, dead: m.dead, kills: m.kills, shield: m.sh ? Date.now() + 300 : 0 });
  else if (m.k === "shot") MW.shots.push({ ...m.s, t: Date.now() });
  else if (m.k === "shield") o.shield = Date.now() + 2500;
  else if (m.k === "bomb") MW.booms.push({ ...m.b, t: Date.now() + 900 });
  else if (m.k === "kill" && m.by === uid()) { MW.me.kills++; toast(`Você derrubou ${dname(S.users[m.from])}!`); }
  else if (m.k === "bye") delete MW.others[m.from];
}
function mwTick() {
  const { cv, ctx, me } = MW, now = Date.now(), W = cv.width, H = cv.height, dpr = devicePixelRatio;
  const css = getComputedStyle(document.documentElement), acc = css.getPropertyValue("--accent").trim() || "#a78bfa", acc2 = css.getPropertyValue("--accent2").trim() || "#f472b6";
  if (me.dead && now > me.dead) { me.dead = 0; me.hp = 100; }
  // tiros
  MW.shots = MW.shots.filter(s => now - s.t < 1400);
  for (const s of MW.shots) {
    const age = (now - s.t) / 1000, x = s.x + s.vx * age, y = s.y + s.vy * age;
    if (s.by !== uid() && !me.dead && now > me.shield && !s.hit && Math.hypot(x - me.x, (y - me.y) * H / W) < .02) { s.hit = 1; mwDamage(14, s.by); }
    s.cx = x; s.cy = y;
  }
  // bombas
  for (const b of MW.booms) if (!b.dash && !b.done && now >= b.t) { b.done = 1; if (b.by !== uid() && !me.dead && now > me.shield && Math.hypot(b.x - me.x, (b.y - me.y) * H / W) < .12) mwDamage(45, b.by); }
  MW.booms = MW.booms.filter(b => now - b.t < 600);
  if (now - MW.lastSend > 70) { MW.lastSend = now; mwSend({ k: "pos", x: +me.x.toFixed(4), y: +me.y.toFixed(4), hp: me.hp, dead: me.dead ? 1 : 0, kills: me.kills, sh: now < me.shield ? 1 : 0 }); }
  // desenho
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,.05)"; ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += 40 * dpr) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
  for (let gy = 0; gy < H; gy += 40 * dpr) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
  for (const s of MW.shots) { if (s.hit) continue; ctx.fillStyle = s.by === uid() ? acc : "#ff5a5a"; ctx.beginPath(); ctx.arc(s.cx * W, s.cy * H, 5 * dpr, 0, 7); ctx.fill(); }
  for (const b of MW.booms) {
    const p = (now - b.t) / 600;
    if (b.dash) { ctx.strokeStyle = acc2; ctx.globalAlpha = Math.max(0, 1 - (now - b.t) / 400); ctx.lineWidth = 3 * dpr; ctx.beginPath(); ctx.arc(b.x * W, b.y * H, 18 * dpr, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; continue; }
    if (now < b.t) { ctx.strokeStyle = "#ffb347"; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(b.x * W, b.y * H, .12 * W, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    else { ctx.fillStyle = `rgba(255,140,40,${Math.max(0, .55 - p * .55)})`; ctx.beginPath(); ctx.arc(b.x * W, b.y * H, .12 * W * (.6 + p * .5), 0, 7); ctx.fill(); }
  }
  const drawCursor = (x, y, color, name, hp, shield, dead) => {
    const px = x * W, py = y * H;
    ctx.globalAlpha = dead ? .25 : 1;
    if (shield) { ctx.strokeStyle = "#7dd3fc"; ctx.lineWidth = 3 * dpr; ctx.beginPath(); ctx.arc(px + 6 * dpr, py + 8 * dpr, 20 * dpr, 0, 7); ctx.stroke(); }
    ctx.fillStyle = color; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 15 * dpr, py + 7 * dpr); ctx.lineTo(px + 8 * dpr, py + 9 * dpr); ctx.lineTo(px + 5 * dpr, py + 17 * dpr); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = `700 ${11 * dpr}px sans-serif`; ctx.fillText(name, px + 16 * dpr, py + 26 * dpr);
    ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(px + 16 * dpr, py + 30 * dpr, 40 * dpr, 4 * dpr);
    ctx.fillStyle = hp > 50 ? "#4ade80" : hp > 25 ? "#facc15" : "#f87171"; ctx.fillRect(px + 16 * dpr, py + 30 * dpr, 40 * dpr * hp / 100, 4 * dpr);
    ctx.globalAlpha = 1;
  };
  for (const [id, o] of Object.entries(MW.others)) { if (now - o.seen > 4000) continue; const u = S.users[id]; drawCursor(o.x, o.y, u?.color || "#ff5a5a", dname(u) || "?", o.hp, now < o.shield, o.dead); }
  drawCursor(me.x, me.y, acc, "você", me.hp, now < me.shield, !!me.dead);
  // HUD
  const cd = k => Math.max(0, Math.ceil((MW.cd[k] - now) / 1000));
  document.getElementById("mwhp").textContent = me.dead ? `Voltando em ${Math.ceil((me.dead - now) / 1000)}s` : `Vida ${me.hp}`;
  document.getElementById("mwcd").textContent = `Q ${cd("q") || "✓"} · W ${cd("w") || "✓"} · E ${cd("e") || "✓"}`;
  const board = [[uid(), me.kills], ...Object.entries(MW.others).map(([id, o]) => [id, o.kills || 0])].sort((a, b) => b[1] - a[1]).slice(0, 4);
  document.getElementById("mwscore").textContent = board.map(([id, k]) => `${id === uid() ? "você" : dname(S.users[id])} ${k}`).join(" · ");
}
function mwDamage(n, by) {
  const me = MW.me; me.hp = Math.max(0, me.hp - n);
  MW.arena.classList.remove("hurt"); void MW.arena.offsetWidth; MW.arena.classList.add("hurt");
  if (me.hp <= 0) { me.dead = Date.now() + 3000; mwSend({ k: "kill", by }); toast(`${dname(S.users[by])} te derrubou!`); }
}

// ================================================================ celular: barra de baixo e telas próprias
const isPhone = () => matchMedia("(max-width:820px)").matches;
function renderMobileNav() {
  let nav = document.getElementById("mnav");
  if (!isPhone() || !S.me || !$(".rail", app)) { nav?.remove(); document.body.classList.remove("phone"); return; }
  document.body.classList.add("phone");
  const r = S.route.name, inServer = !!S.route.params.sid;
  nav ||= document.body.appendChild(Object.assign(document.createElement("nav"), { id: "mnav", className: "mnav" }));
  const unread = [...S.unread].length;
  const tab = (key, ic, label, on, act) => `<button class="${on ? "on" : ""}" onclick="${act}">${I(ic, 22)}<span>${label}</span>${key === "home" && unread ? `<i class="mbadge">${unread > 9 ? "9+" : unread}</i>` : ""}</button>`;
  nav.innerHTML = tab("home", "chat", "Conversas", ["friends", "dm"].includes(r) && !inServer, "navigate('/friends');openNav()") +
    tab("srv", "users", "Servidores", inServer, "openServersSheet()") +
    tab("feed", "waves", "Feed", ["feed", "post"].includes(r), "navigate('/feed');closeNav()") +
    tab("me", "user", "Você", r === "settings", "navigate('/settings/profile')");
}
function openServersSheet() {
  modal(h`<h2>Servidores</h2><div class="msrv">${S.servers.map(s => `<a class="msrv-i" href="/server/${s.id}" data-link onclick="closeLayer();openNav()"><span class="pill">${srvIcon(s)}</span><b>${esc(s.name)}</b></a>`).join("")}
    <button class="msrv-i" onclick="closeLayer();createServerModal()"><span class="pill ghost">${ICON.plus}</span><b>Criar ou entrar</b></button>
    <a class="msrv-i" href="/discover" data-link onclick="closeLayer();closeNav()"><span class="pill ghost">${ICON.compass}</span><b>Explorar</b></a></div>`);
}
addEventListener("resize", () => renderMobileNav());

// ================================================================ ganchos
(() => {
  const _av = avatar;
  avatar = (u, size = "", dot = true) => { const html = _av(u, size, dot), fr = frameHtml(u); return fr ? html.replace(/<\/div>$/, fr + "</div>").replace('class="avatar', 'class="avatar framed') : html; };
  const _ap = applyPrefs;
  applyPrefs = (...a) => { const r = _ap(...a); applyCursor(); return r; };
  const _rc = renderChrome;
  renderChrome = (...a) => { const r = _rc(...a); renderMobileNav(); return r; };
  const _rs = renderSettings;
  renderSettings = (...a) => {
    const r = _rs(...a), sec = document.querySelector(".settings section");
    if (sec && settingsTab === "profile" && !sec.querySelector("#decoed")) { sec.querySelector("h2")?.nextElementSibling?.insertAdjacentHTML("afterend", decoEditorHtml()); bindDecoStage(); }
    if (sec && settingsTab === "appearance" && !sec.querySelector("#cursorrow")) sec.querySelector("#exprow")?.insertAdjacentHTML("beforebegin", `<div class="row" id="cursorrow"><div class="l"><b>Cursor do Cuplock</b><span>Seta e mãozinha nas cores do seu tema</span></div><button class="toggle ${S.prefs.appCursor !== false ? "on" : ""}" onclick="setPref('appCursor',S.prefs.appCursor===false);renderSettings()"></button></div>`);
    if (sec && settingsTab === "activity" && !sec.querySelector("#actdet")) sec.querySelector("h2")?.insertAdjacentHTML("afterend", `<div class="row" id="actdet"><div class="l"><b>Mostrar detalhes</b><span>Música do Spotify, arquivo no VS Code, servidor do Minecraft e vídeo do YouTube (pelo título da janela). Outras abas do navegador nunca aparecem.</span></div><button class="toggle ${S.prefs.activityDetails !== false ? "on" : ""}" onclick="setPref('activityDetails',S.prefs.activityDetails===false);detectActivity();renderSettings()"></button></div>`);
    if (sec && settingsTab === "voice" && TAURI && !sec.querySelector("#ovrow")) sec.querySelector("h2")?.insertAdjacentHTML("afterend", `<div class="card" id="ovrow" style="padding:14px 16px;margin-bottom:14px"><div class="row" style="border:0;padding:0"><div class="l"><b>${I("gamepad", 16)} Overlay no jogo</b><span>Janelinha por cima do jogo com quem está falando, mutar e desligar. Abre sozinha quando você entra numa call jogando.<br>Atalhos: <kbd>Ctrl Shift M</kbd> microfone · <kbd>Ctrl Shift D</kbd> áudio · <kbd>Ctrl Shift O</kbd> mostrar/esconder. Funciona com o jogo em janela ou tela cheia sem bordas.</span></div><button class="toggle ${S.prefs.overlay !== false ? "on" : ""}" onclick="setPref('overlay',S.prefs.overlay===false);renderSettings()"></button></div>
      <div class="row" style="border:0;padding:8px 0 0"><div class="l"><b>Popup de chamada separado</b><span>Quando alguém liga, aparece um popup no meio da tela (dá para arrastar) sem abrir o Cuplock inteiro.</span></div><button class="toggle ${S.prefs.ringWindow !== false ? "on" : ""}" onclick="setPref('ringWindow',S.prefs.ringWindow===false);renderSettings()"></button></div>
      <button class="btn ghost sm" style="margin-top:8px" onclick="showOverlay(true)">Testar overlay</button></div>`);
    return r;
  };
  // botão de jogos no topo das conversas
  const _rcChat = renderChat;
  renderChat = async (main, ...a) => {
    const r = await _rcChat(main, ...a);
    const top = main.querySelector(".top #callbtns");
    if (top && !main.querySelector("#gamesbtn")) top.insertAdjacentHTML("afterend", `<button class="icon-btn" id="gamesbtn" title="Mini-games" onclick="openGames()">${I("gamepad", 19)}</button>`);
    if (GAMES && GAMES.cid !== currentChannel()) leaveGames();
    return r;
  };
  applyPrefs();
})();
// guarda quem está falando (overlay)
setInterval(() => { if (!call) return; window.SPEAK = {}; document.querySelectorAll("[data-voice].speaking").forEach(el => (SPEAK[el.dataset.voice] = true)); call.tiles?.forEach((t, id) => { if (t.classList.contains("speaking")) SPEAK[id] = true; }); }, 250);
