# E-mails de autenticação (Supabase + Resend)

Como o Supabase envia os e-mails de **confirmação de cadastro** e **recuperação
de senha**, e a configuração que faz eles chegarem certos, em português e na
caixa de entrada. O código do site já está pronto: o cadastro manda o cliente
para `/auth/callback`, que troca o código por sessão.

## 1. URL Configuration (Authentication → URL Configuration)

> ⚠️ Erro clássico: **Site URL sem o `https://`**. O link do e-mail vira
> `https://<projeto>.supabase.co/uzzostore.com.br` e o cliente recebe
> `{"error":"requested path is invalid"}` — o domínio foi lido como caminho.

- **Site URL**: `https://uzzostore.com.br`
- **Redirect URLs** (uma por linha):
  - `https://uzzostore.com.br/**`
  - `https://www.uzzostore.com.br/**`
  - `http://localhost:3000/**` (para desenvolvimento)

Sem o domínio na lista, o `emailRedirectTo` que o site envia é recusado e o
Supabase cai no Site URL.

## 2. SMTP (Project Settings → Authentication → SMTP)

- **Host**: `smtp.resend.com` — atenção: já esteve como `smpt.` (letras
  trocadas) e o cadastro quebrava com erro 500 `no such host`
- **Port**: `465`
- **Username**: `resend`
- **Password**: a API key do Resend (`re_...`)
- **Sender email**: um endereço do domínio **verificado** no Resend
- **Sender name**: `Uzzo Store`

## 3. Chegando no lixo eletrônico

Domínio novo cai em spam com facilidade, ainda mais no Outlook/Hotmail. O que
resolve, em ordem de impacto:

1. **Autenticar o domínio no Resend** (Domains → Add domain) e criar no DNS os
   registros que ele mostrar: **SPF**, **DKIM** e o de retorno. Só depois de
   ficar "Verified" a entrega melhora de verdade.
2. **DMARC**: registro TXT em `_dmarc.uzzostore.com.br` com
   `v=DMARC1; p=none; rua=mailto:contato@uzzostore.com.br`.
3. **Remetente com cara de gente**: `contato@uzzostore.com.br` entrega melhor
   que `naoresponda@` (alguns filtros penalizam "noreply").
4. Nos primeiros envios, marque **"Não é lixo eletrônico"** — isso ensina o
   filtro para o seu domínio.

## 4. Modelos em português

Authentication → **Emails** → aba do modelo → cole no corpo. As variáveis
`{{ .ConfirmationURL }}` são preenchidas pelo Supabase.

### Confirm signup — assunto: `Confirme seu e-mail — Uzzo Store`

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
  <h1 style="font-size:22px;margin:0 0 16px">Bem-vindo à Uzzo Store</h1>
  <p style="font-size:15px;line-height:1.6;margin:0 0 24px">
    Falta só confirmar seu e-mail para ativar sua conta.
  </p>
  <p style="margin:0 0 28px">
    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:15px">
      Confirmar meu e-mail
    </a>
  </p>
  <p style="font-size:13px;line-height:1.6;color:#666;margin:0 0 8px">
    Se o botão não funcionar, copie e cole este endereço no navegador:
  </p>
  <p style="font-size:12px;color:#666;word-break:break-all;margin:0 0 24px">
    {{ .ConfirmationURL }}
  </p>
  <p style="font-size:13px;color:#666;margin:0">
    Não foi você que criou a conta? É só ignorar este e-mail.
  </p>
</div>
```

### Reset password — assunto: `Recuperar sua senha — Uzzo Store`

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
  <h1 style="font-size:22px;margin:0 0 16px">Recuperar sua senha</h1>
  <p style="font-size:15px;line-height:1.6;margin:0 0 24px">
    Recebemos um pedido para criar uma nova senha da sua conta na Uzzo Store.
  </p>
  <p style="margin:0 0 28px">
    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:15px">
      Criar nova senha
    </a>
  </p>
  <p style="font-size:13px;line-height:1.6;color:#666;margin:0 0 8px">
    Se o botão não funcionar, copie e cole este endereço no navegador:
  </p>
  <p style="font-size:12px;color:#666;word-break:break-all;margin:0 0 24px">
    {{ .ConfirmationURL }}
  </p>
  <p style="font-size:13px;color:#666;margin:0">
    Não pediu a troca? Ignore este e-mail — sua senha atual continua valendo.
  </p>
</div>
```

## 5. Contas de teste que ficaram sem confirmar

Enquanto o SMTP estava com o host errado, o usuário era criado mas o e-mail
falhava. Essas contas ficam em Authentication → Users sem confirmação; podem
ser apagadas por lá sem afetar nada.
