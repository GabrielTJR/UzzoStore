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

> ⚠️ **Desde out/2026 os dois modelos abaixo levam o CÓDIGO (`{{ .Token }}`).** O
> checkout identifica o cliente por um código numérico de 8 dígitos por e-mail (o "Email OTP Length" do painel; o site lê `OTP_DIGITOS` em `src/lib/otp-config.ts`)
> (`signInWithOtp`): para e-mail NOVO o Supabase manda o "Confirm signup", para
> e-mail que já tem conta manda o "Magic Link". Se algum dos dois sair sem o
> código, o passo 1 do checkout só funciona pelo link, no mesmo navegador —
> exatamente o que quebrava a compra vinda do Instagram. Troque os dois LOGO
> depois do deploy do checkout novo.
>
> Também no painel (Authentication): **Email OTP Length = 6**; validade do
> código entre 900 e 3600 s; Rate Limit de e-mails por hora ACIMA de 60 (o teto
> global do site, em `src/lib/rate-limit.ts`); "Confirm email" continua ligado.

### Confirm signup — assunto: `{{ .Token }} é o seu código — Uzzo Store`

Usado pelo código de e-mail NOVO e pelo cadastro com senha de `/cadastro`; por
isso mantém o link de confirmação, em segundo plano. Se o painel recusar
variável no assunto, use `Seu código de acesso — Uzzo Store`.

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
  <h1 style="font-size:22px;margin:0 0 16px">Seu código da Uzzo Store</h1>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px">
    Digite este código na página da loja para continuar sua compra:
  </p>
  <p style="font-size:34px;font-weight:700;letter-spacing:6px;text-align:center;margin:0 0 20px;padding:16px 0;background:#f2f2f3;border-radius:2px">
    {{ .Token }}
  </p>
  <p style="font-size:13px;line-height:1.6;color:#666;margin:0 0 24px">
    Volte para a página em que você estava e digite os números. O código vale
    por alguns minutos e só pode ser usado uma vez. Se pediu mais de um, vale o
    mais recente.
  </p>
  <p style="font-size:13px;line-height:1.6;color:#666;margin:0 0 8px;border-top:1px solid #eee;padding-top:16px">
    Criou sua conta com senha pelo site? Então confirme seu e-mail por aqui, no
    mesmo navegador em que fez o cadastro:
  </p>
  <p style="margin:0 0 24px">
    <a href="{{ .ConfirmationURL }}" style="font-size:14px;color:#111">Confirmar meu e-mail</a>
  </p>
  <p style="font-size:13px;line-height:1.6;color:#666;margin:0">
    Ninguém da Uzzo Store pede este código por telefone, WhatsApp ou Instagram.
    Se não foi você que pediu, é só ignorar este e-mail.
  </p>
</div>
```

### Magic Link — assunto: `{{ .Token }} é o seu código — Uzzo Store`

Usado pelo código de quem JÁ tem conta — no login, no checkout E no "esqueci a
senha" da loja (desde 06/10/2026), por isso o texto fala das duas coisas. Sem
link, de propósito: o link abriria fora do navegador do Instagram, onde a
sacola não existe.

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
  <h1 style="font-size:22px;margin:0 0 16px">Seu código de acesso da Uzzo Store</h1>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px">
    Digite este código na página da loja para entrar na sua conta. Se você
    pediu para trocar a senha, depois de entrar é só escolher a nova.
  </p>
  <p style="font-size:34px;font-weight:700;letter-spacing:6px;text-align:center;margin:0 0 20px;padding:16px 0;background:#f2f2f3;border-radius:2px">
    {{ .Token }}
  </p>
  <p style="font-size:13px;line-height:1.6;color:#666;margin:0 0 24px">
    Volte para a página em que você estava e digite os números. O código vale
    por alguns minutos e só pode ser usado uma vez. Se pediu mais de um, vale o
    mais recente. Não precisa abrir nenhum link.
  </p>
  <p style="font-size:13px;line-height:1.6;color:#666;margin:0">
    Ninguém da Uzzo Store pede este código por telefone, WhatsApp ou Instagram.
    Se não foi você que pediu, é só ignorar este e-mail: ninguém entra na sua
    conta sem o código.
  </p>
</div>
```

### Reset password — assunto: `Recuperar sua senha — Uzzo Store`

Hoje só o PAINEL usa este modelo (o "esqueci a senha" da loja é por código,
com o modelo Magic Link acima).

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
