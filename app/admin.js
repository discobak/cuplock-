"use strict";
/* ============================================================
   Painel da staff/owner, anúncios e tela de conta banida.
   As permissões de verdade ficam no banco (admin_set_ban,
   admin_set_role, policies); aqui é só a interface.
   ============================================================ */

const ADMIN = { tab: "users", q: "", users: [], anns: [], log: [], loading: false };
const ACTION_TXT = { ban: "baniu", unban: "desbaniu", staff: "deu STAFF para", unstaff: "tirou o STAFF de" };

async function renderAdmin(main) {
  document.title = "Painel — Cuplock";
  const tabs = [["users", `${I("users", 15)} Usuários`], ["ann", `${I("megaphone", 15)} Anúncios`], ["log", `${I("scroll", 15)} Registro`], ...(isOwner() ? [["owner", `${I("crown", 15)} Owner`]] : [])];
  if (!tabs.some(t => t[0] === ADMIN.tab)) ADMIN.tab = "users";
  main.innerHTML = `<div class="top">${navBtn()}<span class="hash">${I("shield", 21)}</span><h1>Painel da ${isOwner() ? "owner" : "staff"}</h1>
      <div class="tabs" style="margin-left:10px">${tabs.map(([k, n]) => `<button class="tab ${ADMIN.tab === k ? "on" : ""}" onclick="ADMIN.tab='${k}';renderAdmin($('.main'))">${n}</button>`).join("")}</div><div class="spacer"></div></div>
    <div class="content"><div class="page" id="adminpage" style="max-width:900px;margin:0 auto"></div></div>`;
  const pg = document.getElementById("adminpage");
  if (ADMIN.tab === "users") return adminUsers(pg);
  if (ADMIN.tab === "ann") return adminAnns(pg);
  if (ADMIN.tab === "log") return adminLog(pg);
  if (ADMIN.tab === "owner") return adminOwner(pg);
}

// ---------------------------------------------------------------- usuários
async function adminUsers(pg) {
  pg.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:14px"><input class="input" id="aq" placeholder="Buscar por @usuário ou nome…" value="${esc(ADMIN.q)}">
    <button class="btn" onclick="ADMIN.q=$('#aq').value.trim();adminLoadUsers()">Buscar</button></div>
    <div class="seg" style="margin-bottom:12px">${[["all", "Todos"], ["staff", "Staff"], ["banned", "Banidos"]].map(([k, n]) => `<button class="${(ADMIN.filter || "all") === k ? "on" : ""}" onclick="ADMIN.filter='${k}';adminLoadUsers()">${n}</button>`).join("")}</div>
    <div id="alist"><div class="muted">Carregando…</div></div>`;
  $("#aq").addEventListener("keydown", e => { if (e.key === "Enter") { ADMIN.q = e.target.value.trim(); adminLoadUsers(); } });
  adminLoadUsers();
}
async function adminLoadUsers() {
  const box = document.getElementById("alist"); if (!box) return;
  try {
    let qb = sb.from("profiles").select("*").order("created_at", { ascending: false }).limit(80);
    const term = ADMIN.q.replace(/[^\p{L}\p{N}_. -]/gu, "").slice(0, 30);
    if (term) qb = qb.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`);
    if (ADMIN.filter === "staff") qb = qb.in("role", ["owner", "staff"]);
    if (ADMIN.filter === "banned") qb = qb.eq("banned", true);
    ADMIN.users = await q(qb);
    ADMIN.users.forEach(u => (S.users[u.id] = u));
    drawAdminUsers();
  } catch (e) { box.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}
function drawAdminUsers() {
  const box = document.getElementById("alist"); if (!box) return;
  if (!ADMIN.users.length) { box.innerHTML = `<div class="empty"><div class="e">${I("search", 48)}</div>Ninguém encontrado.</div>`; return; }
  box.innerHTML = ADMIN.users.map(u => {
    const me = u.id === uid(), protectedUser = u.role === "owner" || (u.role === "staff" && !isOwner());
    return `<div class="admin-row ${u.banned ? "banned" : ""}">${avatar(u)}
      <div class="grow" style="min-width:0"><b>${uname(u)}</b> <span class="muted small">@${esc(u.username)}</span>
        ${u.banned ? `<div class="small" style="color:var(--busy)">${I("ban", 13)} Banido${u.ban_reason ? ` — ${esc(u.ban_reason)}` : ""}</div>` : `<div class="muted small">${u.bio ? esc(u.bio.slice(0, 80)) : "Sem bio"}</div>`}</div>
      <div class="acts">
        <button class="btn ghost sm" onclick="navigate('/user/${u.id}')">Perfil</button>
        ${isOwner() && !me && u.role !== "owner" ? `<button class="btn ghost sm" onclick="adminRole('${u.id}', ${u.role === "staff" ? "null" : "'staff'"})">${u.role === "staff" ? "Tirar STAFF" : "Dar STAFF"}</button>` : ""}
        ${!me && !protectedUser ? (u.banned ? `<button class="btn ok sm" onclick="adminBan('${u.id}', false)">Desbanir</button>` : `<button class="btn danger sm" onclick="adminBanModal('${u.id}')">Banir</button>`) : ""}
      </div></div>`;
  }).join("");
}
function adminBanModal(id) {
  const u = S.users[id];
  modal(`<h2>Banir ${uname(u)}?</h2><p class="sub">A pessoa não vai conseguir mandar mensagens, postar, curtir, criar servidores nem fazer chamadas até ser desbanida.</p>
    <label class="f">Motivo (aparece para a pessoa)</label><textarea class="input" id="banwhy" rows="3" maxlength="200" placeholder="ex: spam no Cupdive"></textarea>
    <div class="acts"><button class="btn ghost" onclick="closeLayer()">Cancelar</button><button class="btn danger" onclick="adminBan('${id}', true, $('#banwhy').value)">Banir</button></div>`);
}
async function adminBan(id, ban, reason) {
  try {
    await q(sb.rpc("admin_set_ban", { target: id, ban, reason: reason || null }));
    closeLayer(); toast(ban ? "Usuário banido" : "Usuário desbanido");
    const u = ADMIN.users.find(x => x.id === id); if (u) { u.banned = ban; u.ban_reason = ban ? (reason || null) : null; }
    drawAdminUsers();
  } catch (e) { toast(e.message); }
}
async function adminRole(id, role) {
  const u = S.users[id];
  if (!await uiConfirm(role ? `Dar STAFF para @${u.username}? A pessoa vai poder editar/apagar posts, banir e publicar anúncios.` : `Tirar o STAFF de @${u.username}?`)) return;
  try {
    await q(sb.rpc("admin_set_role", { target: id, new_role: role }));
    toast(role ? "Agora é STAFF ✓" : "STAFF removido");
    const x = ADMIN.users.find(v => v.id === id); if (x) x.role = role; if (S.users[id]) S.users[id].role = role;
    drawAdminUsers();
  } catch (e) { toast(e.message); }
}

// ---------------------------------------------------------------- anúncios
async function adminAnns(pg) {
  pg.innerHTML = `<div class="card" style="padding:18px"><h3 style="margin-bottom:4px">Novo anúncio</h3><p class="muted small">Aparece como um popup para todo mundo (na hora para quem está online, e ao abrir o app para os outros).</p>
      <label class="f">Título</label><input class="input" id="an-t" maxlength="80" placeholder="ex: Chegou o Cupdive!">
      <label class="f">Subtítulo</label><input class="input" id="an-s" maxlength="140" placeholder="ex: Versão 3.5.0">
      <label class="f">Conteúdo</label><textarea class="input" id="an-c" rows="6" maxlength="4000" placeholder="Aceita **negrito**, *itálico*, \`código\` e links."></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn ghost" onclick="previewAnn()">Pré-visualizar</button><button class="btn" onclick="publishAnn(this)">${I("megaphone", 16)} Publicar para todos</button></div></div>
    <div class="side-label" style="padding-left:0;margin-top:10px">Publicados</div><div id="anlist"><div class="muted">Carregando…</div></div>`;
  try {
    ADMIN.anns = await q(sb.from("announcements").select("*").order("created_at", { ascending: false }).limit(50));
    await ensureUsers(ADMIN.anns.map(a => a.author));
  } catch (e) { ADMIN.anns = []; toast(e.message); }
  const box = document.getElementById("anlist"); if (!box) return;
  box.innerHTML = ADMIN.anns.length ? ADMIN.anns.map(a => `<div class="admin-row" style="align-items:flex-start"><div class="hero-ic">${I("megaphone", 22)}</div>
      <div class="grow" style="min-width:0"><b>${esc(a.title)}</b>${a.subtitle ? `<div class="muted small">${esc(a.subtitle)}</div>` : ""}
        <div class="muted small" style="margin-top:4px">por ${uname(S.users[a.author])} · ${fmtDay(Date.parse(a.created_at))} ${fmtTime(Date.parse(a.created_at))}</div></div>
      <div class="acts"><button class="btn ghost sm" onclick="showAnnouncement(ADMIN.anns.find(x=>x.id==='${a.id}'),true)">Ver</button><button class="btn danger sm" onclick="deleteAnn('${a.id}')">Apagar</button></div></div>`).join("")
    : `<div class="muted small" style="padding:10px 0">Nenhum anúncio ainda.</div>`;
}
function annDraft() { return { title: $("#an-t").value.trim(), subtitle: $("#an-s").value.trim(), content: $("#an-c").value.trim() }; }
function previewAnn() {
  const d = annDraft(); if (!d.title || !d.content) return toast("Preencha título e conteúdo.");
  showAnnouncement({ ...d, id: "preview", author: uid(), created_at: new Date().toISOString() }, true);
}
async function publishAnn(btn) {
  const d = annDraft(); if (!d.title || !d.content) return toast("Preencha título e conteúdo.");
  if (!await uiConfirm("Publicar este anúncio para todos os usuários?")) return;
  btn.disabled = true;
  try { await q(sb.from("announcements").insert(d)); toast("Anúncio publicado 📢"); renderAdmin($(".main")); }
  catch (e) { toast(e.message); btn.disabled = false; }
}
async function deleteAnn(id) {
  if (!await uiConfirm("Apagar este anúncio?")) return;
  try { await q(sb.from("announcements").delete().eq("id", id)); toast("Anúncio apagado"); renderAdmin($(".main")); } catch (e) { toast(e.message); }
}

// ---------------------------------------------------------------- registro
async function adminLog(pg) {
  pg.innerHTML = `<div class="muted">Carregando…</div>`;
  try {
    ADMIN.log = await q(sb.from("mod_log").select("*").order("created_at", { ascending: false }).limit(100));
    await ensureUsers(ADMIN.log.flatMap(l => [l.actor, l.target]).filter(Boolean));
  } catch (e) { pg.innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  pg.innerHTML = ADMIN.log.length ? ADMIN.log.map(l => `<div class="admin-row"><span class="muted small" style="width:110px;flex:none">${fmtDay(Date.parse(l.created_at))} ${fmtTime(Date.parse(l.created_at))}</span>
      <span class="grow">${uname(S.users[l.actor])} <b>${ACTION_TXT[l.action] || esc(l.action)}</b> ${uname(S.users[l.target])}${l.detail ? ` <span class="muted">— ${esc(l.detail)}</span>` : ""}</span></div>`).join("")
    : `<div class="empty"><div class="e">${I("scroll", 48)}</div>Nenhuma ação registrada ainda.</div>`;
}

// ---------------------------------------------------------------- área do owner
function adminOwner(pg) {
  pg.innerHTML = `<div class="card" style="padding:18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div class="hero-ic">${I("crown", 28)}</div>
      <div style="flex:1;min-width:220px"><b>Você é o OWNER</b><div class="muted small">Pode dar e tirar STAFF (aba Usuários), banir qualquer um (inclusive staff), publicar anúncios e mexer nas ferramentas de desenvolvedor.</div></div></div>
    <div class="admin-row" style="margin-top:12px"><div class="hero-ic">${I("wrench", 20)}</div><div class="grow"><b>Ferramentas de desenvolvedor</b><div class="muted small">Servidor TURN das calls, testes de consulta e eventos ao vivo</div></div><a class="btn sm" href="/dev" data-link>Abrir</a></div>
    <div class="admin-row"><div class="hero-ic">${I("shield", 20)}</div><div class="grow"><b>Equipe atual</b><div class="muted small" id="teamlist">Carregando…</div></div><button class="btn ghost sm" onclick="ADMIN.tab='users';ADMIN.filter='staff';renderAdmin($('.main'))">Gerenciar</button></div>`;
  sb.from("profiles").select("*").in("role", ["owner", "staff"]).then(({ data }) => {
    const el = document.getElementById("teamlist"); if (el && data) el.innerHTML = data.map(u => uname(u)).join(" · ") || "Ninguém";
  });
}

// ---------------------------------------------------------------- anúncios (popup)
let annQueue = [], annShowing = false;
const annKey = () => "cl.annseen." + uid();
async function checkAnnouncements() {
  try {
    const rows = await q(sb.from("announcements").select("*").order("created_at", { ascending: false }).limit(5));
    let seen = +localStorage.getItem(annKey()) || 0;
    // conta nova (ou app instalado agora): não despeja os anúncios antigos — só os que saírem daqui pra frente
    const joined = Date.parse(S.me?.created_at || "") || Date.now();
    if (!seen) { seen = Math.max(joined, Date.now() - 3 * 864e5); localStorage.setItem(annKey(), String(seen)); }
    rows.filter(r => Date.parse(r.created_at) > seen).reverse().forEach(a => showAnnouncement(a));
  } catch {}
}
async function showAnnouncement(a, force) {
  if (!a) return;
  if (!force && (annQueue.some(x => x.id === a.id))) return;
  await ensureUsers([a.author]).catch(() => {});
  annQueue.push({ ...a, force });
  if (!annShowing) nextAnnouncement();
}
function nextAnnouncement() {
  const a = annQueue.shift();
  if (!a) { annShowing = false; return; }
  annShowing = true;
  const el = Object.assign(document.createElement("div"), { className: "ann-bg", id: "annmodal" });
  el.innerHTML = `<div class="ann"><div class="ann-head"><span class="ann-badge">${I("megaphone", 12)} ANÚNCIO</span><span class="muted small">${fmtDay(Date.parse(a.created_at))}</span></div>
      <h2>${esc(a.title)}</h2>${a.subtitle ? `<div class="ann-sub">${esc(a.subtitle)}</div>` : ""}
      <div class="ann-body text">${md(a.content)}</div>
      <div class="ann-foot"><span class="muted small">— ${uname(S.users[a.author])}</span><button class="btn" id="annok">Entendi</button></div></div>`;
  document.body.appendChild(el);
  playNotify();
  el.querySelector("#annok").onclick = () => {
    if (a.id !== "preview" && !a.force) localStorage.setItem(annKey(), String(Math.max(+localStorage.getItem(annKey()) || 0, Date.parse(a.created_at))));
    el.remove(); nextAnnouncement();
  };
}
async function openAnnouncements() {
  try {
    const rows = await q(sb.from("announcements").select("*").order("created_at", { ascending: false }).limit(30));
    await ensureUsers(rows.map(r => r.author));
    window.__annList = rows;
    modal(`<h2>${I("megaphone", 20)} Anúncios</h2><div style="max-height:60vh;overflow-y:auto;margin-top:12px">${rows.length ? rows.map((a, i) => `<div class="admin-row" style="cursor:pointer;align-items:flex-start" onclick="closeLayer();showAnnouncement(__annList[${i}],true)">
        <div class="grow"><b>${esc(a.title)}</b>${a.subtitle ? `<div class="muted small">${esc(a.subtitle)}</div>` : ""}<div class="muted small">${fmtDay(Date.parse(a.created_at))}</div></div></div>`).join("") : '<p class="muted">Nenhum anúncio ainda.</p>'}</div>`);
  } catch (e) { toast(e.message); }
}

// ---------------------------------------------------------------- conta banida
function renderBanned() {
  S.bannedShown = true;
  try { leaveCall?.(true); } catch {}
  app.className = "";
  app.innerHTML = `<div class="center"><div class="panel" style="text-align:center"><div class="e" style="color:var(--busy)">${I("ban", 64)}</div><h1>Sua conta foi banida</h1>
    <p class="sub">${S.me?.ban_reason ? `Motivo: <b>${esc(S.me.ban_reason)}</b>` : "A equipe do Cuplock suspendeu sua conta."}</p>
    <p class="muted small" style="margin-top:10px">Se você acha que foi um engano, fale com alguém da staff.</p><br>
    <button class="btn ghost" onclick="logout()">Sair da conta</button></div></div>`;
  $(".settings")?.remove();
}
