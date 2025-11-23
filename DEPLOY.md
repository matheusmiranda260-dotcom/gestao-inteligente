# Guia de Deploy na Vercel

Este projeto está configurado para ser implantado na Vercel. Siga os passos abaixo:

## 1. Pré-requisitos

Certifique-se de que seu projeto está no GitHub (ou GitLab/Bitbucket).

## 2. Configuração na Vercel

1.  Acesse [vercel.com](https://vercel.com) e faça login.
2.  Clique em **"Add New..."** -> **"Project"**.
3.  Importe o repositório do GitHub onde este projeto está hospedado.
4.  A Vercel deve detectar automaticamente que é um projeto **Vite**.
    *   **Framework Preset**: Vite
    *   **Root Directory**: ./ (padrão)
    *   **Build Command**: `vite build` (ou `npm run build`)
    *   **Output Directory**: `dist`

## 3. Variáveis de Ambiente

Antes de clicar em "Deploy", expanda a seção **"Environment Variables"** e adicione as seguintes chaves (você pode encontrá-las no seu arquivo `.env` ou `.env.local`):

| Nome | Valor |
|------|-------|
| `VITE_SUPABASE_URL` | *Sua URL do Supabase* |
| `VITE_SUPABASE_ANON_KEY` | *Sua chave Anon do Supabase* |

> **Nota:** Se você estiver usando a API do Gemini, adicione também `GEMINI_API_KEY`.

## 4. Deploy

Clique em **"Deploy"**. A Vercel irá construir o projeto e fornecer uma URL de acesso.

## 5. Configuração de Rotas (SPA)

O arquivo `vercel.json` já foi criado na raiz do projeto para garantir que o roteamento (SPA) funcione corretamente ao recarregar as páginas.

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
