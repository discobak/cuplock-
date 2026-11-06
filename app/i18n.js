// Idiomas: troca os textos principais da interface (menus, botões, configurações).
// Mensagens das pessoas nunca são traduzidas.
"use strict";
const LANGS = { pt: "Português (Brasil)", en: "English", es: "Español" };
const T_EN = {
  "Amigos": "Friends", "Feed": "Feed", "Anúncios": "Announcements", "Explorar": "Explore", "Apps": "Apps", "Conversas": "Conversations", "Servidores": "Servers", "Você": "You",
  "Painel da owner": "Owner panel", "Painel da staff": "Staff panel", "Mensagens diretas": "Direct messages", "Buscar…": "Search…", "Online": "Online", "Todos": "All", "Pendentes": "Pending",
  "Adicionar amigo": "Add friend", "Mensagem": "Message", "Perfil": "Profile", "Editar perfil": "Edit profile", "Sair": "Log out", "Configurações": "Settings",
  "Minha conta": "My account", "Atividade": "Activity", "Aparência": "Appearance", "Voz e vídeo": "Voice & video", "Chat": "Chat", "Notificações": "Notifications", "Desenvolvedor": "Developer", "Sobre": "About",
  "Salvar": "Save", "Cancelar": "Cancel", "Fechar": "Close", "Confirmar": "Confirm", "Apagar": "Delete", "Enviar": "Send", "Criar": "Create", "Entrar": "Join", "Voltar": "Back", "Pronto": "Done", "Ok": "OK",
  "Responder": "Reply", "Copiar texto": "Copy text", "Reagir": "React", "Excluir mensagem": "Delete message", "Fixar melhor amigo": "Pin best friend",
  "Enviar um arquivo": "Upload a file", "Criar enquete": "Create poll", "Agendar mensagem": "Schedule message", "Postar enquete": "Post poll", "Agendar": "Schedule",
  "Criar servidor": "Create server", "Tenho um convite": "I have an invite", "Criar canal": "Create channel", "Criar categoria": "Create category", "Editar servidor": "Edit server", "Convidar": "Invite",
  "Emojis do servidor": "Server emojis", "Canais": "Channels", "Membros": "Members", "Sair do servidor": "Leave server", "Excluir servidor": "Delete server",
  "Online agora": "Online now", "Ausente": "Away", "Não perturbe": "Do not disturb", "Invisível": "Invisible", "Offline": "Offline", "Jogando": "Playing", "Ouvindo": "Listening to", "Assistindo": "Watching",
  "Tema": "Theme", "Cores": "Colors", "Fontes": "Fonts", "Janelas": "Windows", "Fundo": "Background", "Mensagens": "Messages", "Botões": "Buttons", "Efeitos": "Effects",
  "Abrir Cuplock Theme Editor": "Open Cuplock Theme Editor", "Meus temas": "My themes", "Salvar o visual atual": "Save current look", "Desempenho": "Performance", "Automático": "Automatic", "Leve": "Light", "Completo": "Full",
  "Balões": "Bubbles", "Clássico": "Classic", "Compacto": "Compact", "Arredondado": "Rounded", "Círculo": "Circle",
  "Moldura e adesivos": "Frame & stickers", "Modo Penetrar": "Penetrate mode", "Nome real": "Real name", "Idade": "Age", "Religião": "Religion", "Signo": "Zodiac sign", "Cidade": "City", "Aniversário": "Birthday",
  "Mais sobre": "More about", "Sobre mim": "About me", "Status personalizado": "Custom status", "Adicionar status": "Add status", "Seu status": "Your status", "Limpar": "Clear",
  "Mini-games": "Mini-games", "Jogo da velha": "Tic-tac-toe", "Xadrez": "Chess", "Chamar a galera": "Call everyone", "Recomeçar": "Restart", "Partidas abertas": "Open matches", "Começar": "Start",
  "Atender": "Answer", "Recusar": "Decline", "Chamada de voz": "Voice call", "Chamada de vídeo": "Video call", "Sair da call": "Leave call", "Compartilhar tela": "Share screen",
  "Termos e privacidade": "Terms & privacy", "Aceitar e continuar": "Accept and continue", "Antes de continuar": "Before you continue", "Os termos mudaram": "The terms changed",
  "Ninguém online agora.": "Nobody online right now.", "Carregando…": "Loading…", "Sem mensagens ainda": "No messages yet", "Hoje": "Today", "Ontem": "Yesterday",
  "Idioma": "Language", "Modo manutenção (OWNER)": "Maintenance mode (OWNER)", "Pré-visualizar": "Preview", "Ativar": "Enable", "Encerrar": "End",
  "Cuplock em manutenção": "Cuplock is under maintenance", "Esta tela some sozinha quando terminar.": "This screen goes away by itself when it's done.",
  "Prévia": "Preview", "Exportar": "Export", "Mandar": "Send", "Pincel": "Brush", "Tamanho": "Size", "Opacidade": "Opacity", "Cor": "Color", "Velocidade": "Speed",
  "+ Quadro": "+ Frame", "Duplicar": "Duplicate", "Papel de cebola": "Onion skin", "Mandar animação": "Send animation", "Escolha uma": "Pick one", "Escolha uma ou mais": "Pick one or more", "Encerrada": "Ended",
  "Pergunta": "Question", "Respostas": "Answers", "Duração": "Duration", "Quando": "When", "Suas agendadas": "Your scheduled", "Quem pode ver estas informações": "Who can see this",
  "Todo mundo": "Everyone", "Só amigos": "Friends only", "Só eu": "Only me", "Conversar em": "Message",
};
const T_ES = {
  "Amigos": "Amigos", "Anúncios": "Anuncios", "Explorar": "Explorar", "Conversas": "Chats", "Servidores": "Servidores", "Você": "Tú", "Mensagens diretas": "Mensajes directos", "Buscar…": "Buscar…",
  "Todos": "Todos", "Pendentes": "Pendientes", "Adicionar amigo": "Añadir amigo", "Mensagem": "Mensaje", "Perfil": "Perfil", "Editar perfil": "Editar perfil", "Sair": "Salir", "Configurações": "Ajustes",
  "Minha conta": "Mi cuenta", "Atividade": "Actividad", "Aparência": "Apariencia", "Voz e vídeo": "Voz y video", "Notificações": "Notificaciones", "Desenvolvedor": "Desarrollador", "Sobre": "Acerca de",
  "Salvar": "Guardar", "Cancelar": "Cancelar", "Fechar": "Cerrar", "Confirmar": "Confirmar", "Apagar": "Borrar", "Enviar": "Enviar", "Criar": "Crear", "Entrar": "Entrar", "Voltar": "Volver", "Pronto": "Listo",
  "Responder": "Responder", "Copiar texto": "Copiar texto", "Reagir": "Reaccionar", "Enviar um arquivo": "Subir un archivo", "Criar enquete": "Crear encuesta", "Agendar mensagem": "Programar mensaje",
  "Criar servidor": "Crear servidor", "Tenho um convite": "Tengo una invitación", "Criar canal": "Crear canal", "Criar categoria": "Crear categoría", "Editar servidor": "Editar servidor", "Convidar": "Invitar",
  "Canais": "Canales", "Membros": "Miembros", "Ausente": "Ausente", "Não perturbe": "No molestar", "Invisível": "Invisible", "Jogando": "Jugando", "Ouvindo": "Escuchando", "Assistindo": "Viendo",
  "Tema": "Tema", "Cores": "Colores", "Fontes": "Fuentes", "Janelas": "Ventanas", "Fundo": "Fondo", "Mensagens": "Mensajes", "Botões": "Botones", "Efeitos": "Efectos",
  "Abrir Cuplock Theme Editor": "Abrir Cuplock Theme Editor", "Meus temas": "Mis temas", "Desempenho": "Rendimiento", "Automático": "Automático", "Leve": "Ligero", "Completo": "Completo",
  "Modo Penetrar": "Modo Penetrar", "Nome real": "Nombre real", "Idade": "Edad", "Religião": "Religión", "Cidade": "Ciudad", "Aniversário": "Cumpleaños", "Sobre mim": "Sobre mí",
  "Adicionar status": "Añadir estado", "Jogo da velha": "Tres en raya", "Xadrez": "Ajedrez", "Atender": "Contestar", "Recusar": "Rechazar", "Chamada de voz": "Llamada de voz", "Chamada de vídeo": "Videollamada",
  "Termos e privacidade": "Términos y privacidad", "Aceitar e continuar": "Aceptar y continuar", "Hoje": "Hoy", "Ontem": "Ayer", "Idioma": "Idioma", "Carregando…": "Cargando…",
  "Cuplock em manutenção": "Cuplock en mantenimiento", "Prévia": "Vista previa", "Exportar": "Exportar", "Mandar": "Enviar", "Todo mundo": "Todos", "Só amigos": "Solo amigos", "Só eu": "Solo yo",
};
function tDict() { const l = S?.prefs?.lang; return l === "en" ? T_EN : l === "es" ? T_ES : null; }
function tr(s) { const d = tDict(); return d ? (d[s] ?? s) : s; }
function translateNode(root) {
  const d = tDict(); if (!d || !root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentNode && !n.parentNode.closest(".text,.bubble,.sp-txt,.bl,textarea,code,.poll-q,.gm-sub,.act-det,.uname") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
  const list = []; while (w.nextNode()) list.push(w.currentNode);
  for (const n of list) { const raw = n.nodeValue, k = raw.trim(); if (k && d[k] && d[k] !== k) n.nodeValue = raw.replace(k, d[k]); }
  root.querySelectorAll?.("[placeholder],[data-tt]").forEach(el => {
    for (const a of ["placeholder", "data-tt"]) { const v = el.getAttribute(a); if (v && d[v.trim()]) el.setAttribute(a, d[v.trim()]); }
  });
}
let trObs = null;
function applyLang() {
  document.documentElement.lang = S.prefs.lang === "en" ? "en" : S.prefs.lang === "es" ? "es" : "pt-BR";
  trObs?.disconnect(); trObs = null;
  if (!tDict()) return;
  translateNode(document.body);
  let pend = null;
  trObs = new MutationObserver(ms => {
    if (pend) return;
    pend = requestAnimationFrame(() => { pend = null; for (const m of ms) m.addedNodes.forEach(n => { if (n.nodeType === 1) translateNode(n); else if (n.nodeType === 3 && n.parentNode) translateNode(n.parentNode); }); });
  });
  trObs.observe(document.body, { childList: true, subtree: true });
}
(() => {
  const _ap = applyPrefs;
  applyPrefs = (...a) => { const r = _ap(...a); if (applyLang.last !== S.prefs.lang) { applyLang.last = S.prefs.lang; applyLang(); } return r; };
  const _rs = renderSettings;
  renderSettings = (...a) => {
    const r = _rs(...a), sec = document.querySelector(".settings section");
    if (sec && settingsTab === "appearance" && !sec.querySelector("#langrow")) sec.querySelector("h2")?.insertAdjacentHTML("afterend", `<div class="row" id="langrow"><div class="l"><b>Idioma</b><span>Menus e botões do Cuplock. As mensagens das pessoas continuam como foram escritas.</span></div>
      <select class="input" style="width:auto" onchange="setPref('lang',this.value);toast('Mudando o idioma…');setTimeout(()=>location.reload(),900)">${Object.entries(LANGS).map(([k, n]) => `<option value="${k}" ${(S.prefs.lang || "pt") === k ? "selected" : ""}>${n}</option>`).join("")}</select></div>`);
    return r;
  };
  applyPrefs();
})();
