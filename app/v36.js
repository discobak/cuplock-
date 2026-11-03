// Cuplock 3.6 — imagens de servidor, fundo do PC, janelas livres, melhores amigos
const okUrl = u => typeof u === "string" && /^https:\/\/[^\s"'()<>\\]+$/.test(u);

// ---------------------------------------------------------------- servidores com foto e banner
function srvIcon(s, cls = "") {
  if (okUrl(s.icon_url)) return `<img class="srv-img ${cls}" src="${s.icon_url}" alt="">`;
  return esc(s.icon || (s.name || "?").slice(0, 1).toUpperCase());
}
function srvBg(s) {
  return okUrl(s.banner_url) ? `url('${s.banner_url}') center/cover no-repeat, ${esc(s.banner)}` : esc(s.banner);
}
function editServerModal(sid) {
  closeLayer();
  const s = S.servers.find(x => x.id === sid); if (!s) return;
  const draft = { icon_url: s.icon_url || null, banner_url: s.banner_url || null };
  modal(h`<h2>Editar servidor</h2><p class="sub">Foto e banner vêm direto do seu PC.</p>
    <div class="srv-edit-pv" id="sepv"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">
      <button class="btn sm" id="seIcon">${I("image", 16)} Foto do servidor</button>
      <button class="btn sm" id="seBan">${I("upload", 16)} Banner</button>
      <button class="btn ghost sm" id="seClr">${I("trash", 16)} Remover imagens</button></div>
    <label class="f">Nome</label><input class="input" id="seName" maxlength="40" value="${esc(s.name)}">
    <label class="f">Ícone (emoji, usado sem foto)</label><input class="input" id="seEmoji" maxlength="4" value="${esc(s.icon || "")}">
    <label class="f">Descrição</label><input class="input" id="seDesc" maxlength="160" value="${esc(s.description || "")}">
    <div class="err" id="seErr"></div>
    <div class="acts"><button class="btn ghost" onclick="closeLayer()">Cancelar</button><button class="btn" id="seSave">Salvar</button></div>`, m => {
    const pv = () => { const t = { ...s, ...draft, name: $("#seName", m).value, icon: $("#seEmoji", m).value };
      $("#sepv", m).innerHTML = `<div class="b" style="background:${srvBg(t)}"></div><div class="i">${srvIcon(t)}</div><b>${esc(t.name)}</b>`; };
    pv(); $("#seName", m).oninput = pv; $("#seEmoji", m).oninput = pv;
    const up = async (key, opts) => {
      const [f] = await pickFile("image/png,image/jpeg,image/webp,image/gif"); if (!f) return;
      if (f.size > 6 * 1048576) return toast("Imagem até 6 MB.");
      toast("Enviando imagem…");
      try { draft[key] = await uploadTo("avatars", f, opts); pv(); } catch (e) { toast(e.message); }
    };
    $("#seIcon", m).onclick = () => up("icon_url", { maxSide: 512, square: true });
    $("#seBan", m).onclick = () => up("banner_url", { maxSide: 1400 });
    $("#seClr", m).onclick = () => { draft.icon_url = null; draft.banner_url = null; pv(); };
    $("#seSave", m).onclick = async e => {
      e.target.disabled = true;
      const patch = { ...draft, name: $("#seName", m).value.trim() || s.name, icon: $("#seEmoji", m).value.trim() || s.icon, description: $("#seDesc", m).value.trim() };
      try { await q(sb.from("servers").update(patch).eq("id", sid)); Object.assign(s, patch); closeLayer(); render(); toast("Servidor atualizado"); }
      catch (err) { $("#seErr", m).textContent = err.message; e.target.disabled = false; }
    };
  });
}

// ---------------------------------------------------------------- fundo personalizado do PC
async function uploadWallpaper() {
  const [f] = await pickFile("image/png,image/jpeg,image/webp,image/gif"); if (!f) return;
  if (f.size > 8 * 1048576) return toast("Imagem até 8 MB.");
  toast("Enviando fundo…");
  try {
    const url = await uploadTo("avatars", f, { maxSide: 2560 });
    S.prefs.wallUrl = url; setPref("wallpaper", "imagem"); renderSettings(); toast("Fundo aplicado");
  } catch (e) { toast(e.message); }
}

// ---------------------------------------------------------------- janelas livres (arrastar / redimensionar)
const LAYOUT_KEYS = ["rail", "side", "main"];
const isMobile = () => matchMedia("(max-width: 760px)").matches;
function applyLayout() {
  const a = document.getElementById("app"); if (!a) return;
  const on = !!S.prefs.freeLayout && !isMobile() && !!$(".rail", a);
  a.classList.toggle("free", on);
  for (const k of LAYOUT_KEYS) {
    const el = $("." + k, a); if (!el) continue;
    if (!on) { el.style.left = el.style.top = el.style.width = el.style.height = el.style.zIndex = ""; el.querySelectorAll(":scope > .grip").forEach(g => g.remove()); continue; }
    const r = (S.prefs.layout || {})[k] || defaultBox(k);
    const W = innerWidth, H = innerHeight;
    const w = Math.min(Math.max(r.w, k === "rail" ? 60 : 200), W), hh = Math.min(Math.max(r.h, 200), H);
    Object.assign(el.style, { left: Math.min(Math.max(r.x, 0), W - 60) + "px", top: Math.min(Math.max(r.y, 0), H - 40) + "px", width: w + "px", height: hh + "px" });
    if (!el.querySelector(":scope > .grip.move")) {
      el.insertAdjacentHTML("beforeend", `<div class="grip move" title="Arrastar janela">${I("move", 13)}</div><div class="grip size" title="Redimensionar"></div>`);
      bindGrip(el, k);
    }
  }
}
function defaultBox(k) {
  const g = 10, H = innerHeight - 2 * g;
  if (k === "rail") return { x: g, y: g, w: 74, h: H };
  if (k === "side") return { x: 94, y: g, w: 256, h: H };
  return { x: 360, y: g, w: Math.max(400, innerWidth - 370), h: H };
}
let topZ = 2;
function bindGrip(el, k) {
  el.addEventListener("pointerdown", () => { if (document.getElementById("app")?.classList.contains("free")) el.style.zIndex = ++topZ; }, true);
  const start = (e, mode) => {
    e.preventDefault(); e.stopPropagation();
    const r0 = el.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
    el.classList.add("dragging"); document.body.classList.add("nosel");
    const mv = ev => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (mode === "move") { el.style.left = Math.max(0, Math.min(innerWidth - 60, r0.left + dx)) + "px"; el.style.top = Math.max(0, Math.min(innerHeight - 40, r0.top + dy)) + "px"; }
      else { el.style.width = Math.max(k === "rail" ? 60 : 200, r0.width + dx) + "px"; el.style.height = Math.max(200, r0.height + dy) + "px"; }
    };
    const end = () => {
      removeEventListener("pointermove", mv); removeEventListener("pointerup", end);
      el.classList.remove("dragging"); document.body.classList.remove("nosel");
      const r = el.getBoundingClientRect();
      setPref("layout", { ...(S.prefs.layout || {}), [k]: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } });
    };
    addEventListener("pointermove", mv); addEventListener("pointerup", end);
  };
  el.querySelector(":scope > .grip.move").onpointerdown = e => start(e, "move");
  el.querySelector(":scope > .grip.size").onpointerdown = e => start(e, "size");
}
function resetLayout() { setPref("layout", {}); applyLayout(); toast("Janelas voltaram ao lugar"); }
addEventListener("resize", () => { if (S.prefs.freeLayout) applyLayout(); });

// ---------------------------------------------------------------- melhores amigos
const BFF_COLORS = ["#f472b6", "#a78bfa", "#38bdf8", "#34d399", "#fbbf24", "#f87171", "#fb923c", "#e879f9"];
// S.bff: friend_id -> cor (quem eu fixei)
let bffCh;
async function loadBff() {
  try {
    const rows = await q(sb.from("best_friends").select("user_id, friend_id, color").eq("user_id", uid()));
    S.bff = Object.fromEntries(rows.map(r => [r.friend_id, r.color]));
  } catch { S.bff = {}; }
}
function connectBff() {
  if (bffCh) sb.removeChannel(bffCh);
  const me = uid();
  bffCh = sb.channel("cuplock-bff-" + me)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "best_friends", filter: `friend_id=eq.${me}` }, async p => {
      await ensureUsers([p.new.user_id]);
      const u = S.users[p.new.user_id], msg = `${dname(u)} fixou você como melhor amigo!`;
      toast(msg); playNotify();
      if (typeof desktopNotify === "function") desktopNotify("Melhor amigo", msg, { href: "/dm/" + p.new.user_id, force: true });
    })
    .subscribe();
}
const isBff = id => !!(S.bff && S.bff[id]);
const bffStyle = id => isBff(id) ? `--bff:${esc(S.bff[id])}` : "";
function sortBff(ids) { return [...ids].sort((a, b) => (isBff(b) ? 1 : 0) - (isBff(a) ? 1 : 0)); }
function bffMenu(id) {
  closeLayer();
  S.bff ||= {}; const u = S.users[id], cur = S.bff[id];
  modal(h`<h2>${I("star", 20)} Melhor amigo</h2><p class="sub">Fixe ${esc(dname(u))} no topo das suas listas com uma cor. ${cur ? "" : "Essa pessoa vai ser avisada."}</p>
    <div class="bff-colors">${BFF_COLORS.map(c => `<button class="bff-c ${cur === c ? "on" : ""}" style="background:${c}" data-c="${c}"></button>`).join("")}</div>
    <div class="acts">${cur ? `<button class="btn ghost danger" id="bffRm">Desafixar</button>` : ""}<button class="btn ghost" onclick="closeLayer()">Fechar</button></div>`, m => {
    m.querySelectorAll(".bff-c").forEach(b => b.onclick = async () => {
      const color = b.dataset.c;
      try {
        if (cur) await q(sb.from("best_friends").update({ color }).eq("user_id", uid()).eq("friend_id", id));
        else await q(sb.from("best_friends").insert({ friend_id: id, color }));
        S.bff[id] = color; closeLayer(); render(); toast(cur ? "Cor atualizada" : `${dname(u)} fixado!`);
      } catch (e) { toast(e.message); }
    });
    $("#bffRm", m)?.addEventListener("click", async () => {
      try { await q(sb.from("best_friends").delete().eq("user_id", uid()).eq("friend_id", id)); delete S.bff[id]; closeLayer(); render(); }
      catch (e) { toast(e.message); }
    });
  });
}
