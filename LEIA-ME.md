# Site do Cuplock

- `/` — página inicial com **Baixar app** e **Navegador**
- `/app/` — Cuplock no navegador (mesmas contas e conversas do app de PC)
- `/download/` — instalador de reserva

O botão **Baixar app** sempre pega a versão mais nova que estiver no Supabase
(Storage → `releases`). Se não tiver nada lá, usa o arquivo da pasta `download/`.

## Publicar na Vercel
1. Crie um repositório novo no GitHub (ex: `cuplock-site`) e envie **o conteúdo** desta pasta.
2. Em vercel.com → **Add New… → Project** → importe o repositório → **Deploy**
   (Framework: *Other*; não precisa de comando de build).
3. Pronto: o site fica em `https://cuplock-site.vercel.app` (dá para trocar o nome em Settings → Domains).

## Atualizar a versão de navegador
Quando mudar o app, copie de novo os arquivos de `client/` do projeto Cuplock para `app/` aqui
(menos o `supabase.js`) e envie pro GitHub — a Vercel publica sozinha.
