import nodemailer from 'nodemailer';

export interface EmailSendResult {
  sent: boolean;
  provider: 'smtp' | 'resend' | 'ethereal_test';
  messageId?: string;
  previewUrl?: string;
}

function isLocalOrigin(url?: string): boolean {
  if (!url) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(url.trim());
}

function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

export function resolvePublicBaseUrl(requestBaseUrl?: string): string {
  const envAppUrl = process.env.APP_URL?.trim().replace(/\/+$/, '');
  if (envAppUrl && !envAppUrl.includes('MY_APP_URL') && !isLocalOrigin(envAppUrl)) {
    return envAppUrl;
  }

  const cleanReqUrl = requestBaseUrl?.trim().replace(/\/+$/, '');
  if (cleanReqUrl && !isLocalOrigin(cleanReqUrl)) {
    return cleanReqUrl;
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim().replace(/\/+$/, '')}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/+$/, '')}`;
  }

  if (envAppUrl && !envAppUrl.includes('MY_APP_URL')) return envAppUrl;
  if (cleanReqUrl) return cleanReqUrl;
  return 'http://localhost:3000';
}

export function getConfiguredEmailProvider(): 'resend' | 'smtp' | 'ethereal_sandbox' {
  if (
    process.env.RESEND_API_KEY &&
    !process.env.RESEND_API_KEY.includes('xxxx') &&
    !process.env.RESEND_API_KEY.includes('MY_RESEND')
  ) {
    return 'resend';
  }
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (
    smtpHost &&
    smtpUser &&
    smtpPass &&
    !smtpUser.includes('seu-email') &&
    !smtpPass.includes('sua-senha')
  ) {
    return 'smtp';
  }
  return 'ethereal_sandbox';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildVerificationEmailHtml(params: {
  nome: string;
  verifyUrl: string;
  verificationCode: string;
  expiresInHours: number;
}): { subject: string; text: string; html: string } {
  const { nome, verifyUrl, verificationCode, expiresInHours } = params;
  const subject = `${verificationCode} — Confirme seu e-mail no IFCE Iventus`;

  const text = [
    `Olá, ${nome}!`,
    '',
    'Recebemos seu cadastro como aluno/participante no sistema de eventos científicos IFCE Iventus.',
    'Para ativar sua conta e liberar o acesso às inscrições e certificados, utilize o código de verificação abaixo ou acesse o link de confirmação:',
    '',
    `CÓDIGO DE VERIFICAÇÃO: ${verificationCode}`,
    '',
    `LINK DE CONFIRMAÇÃO: ${verifyUrl}`,
    '',
    `Este código e link são exclusivos, de uso único e expiram em ${expiresInHours} horas.`,
    'Se você não solicitou este cadastro, ignore esta mensagem com segurança.',
    '',
    'Atenciosamente,',
    'Equipe IFCE Iventus — Instituto Federal do Ceará',
  ].join('\n');

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="background-color:#15803d;padding:24px 32px;color:#ffffff;">
                    <div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;">IFCE Iventus</div>
                    <div style="font-size:12px;color:#dcfce7;margin-top:4px;">Sistema de Eventos Científicos e Acadêmicos</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#0f172a;">Confirme seu endereço de e-mail</h1>
                    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#475569;">
                      Olá, <strong style="color:#0f172a;">${escapeHtml(nome)}</strong>!
                    </p>
                    <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#475569;">
                      Seu cadastro como participante no <strong>IFCE Iventus</strong> foi registrado. Digite o código de 6 dígitos na tela do aplicativo ou clique no botão abaixo para ativar sua conta:
                    </p>

                    <div style="margin:0 0 24px 0;padding:18px;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;text-align:center;">
                      <div style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">
                        Código de Verificação
                      </div>
                      <div style="font-size:30px;font-weight:800;letter-spacing:0.22em;color:#14532d;font-family:monospace;">
                        ${escapeHtml(verificationCode)}
                      </div>
                    </div>

                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;">
                      <tr>
                        <td style="border-radius:10px;background-color:#16a34a;">
                          <a href="${verifyUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                            Confirmar meu e-mail
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 10px 0;font-size:12px;line-height:1.5;color:#64748b;">
                      Caso o botão acima não funcione, copie e cole o endereço abaixo no navegador:
                    </p>
                    <p style="margin:0 0 24px 0;padding:12px;background-color:#f1f5f9;border-radius:8px;font-size:12px;word-break:break-all;color:#334155;font-family:monospace;">
                      ${verifyUrl}
                    </p>
                    <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;border-top:1px solid #e2e8f0;padding-top:16px;">
                      Este código e link são válidos por <strong>${expiresInHours} horas</strong> e podem ser utilizados apenas uma vez. Caso você não tenha realizado este cadastro, desconsidere esta mensagem.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return { subject, text, html };
}

function buildPasswordResetEmailHtml(params: {
  nome: string;
  resetUrl: string;
  resetCode: string;
  expiresInMinutes: number;
}): { subject: string; text: string; html: string } {
  const { nome, resetUrl, resetCode, expiresInMinutes } = params;
  const subject = `${resetCode} — Recuperação de senha no IFCE Iventus`;

  const text = [
    `Olá, ${nome}!`,
    '',
    'Recebemos uma solicitação para redefinir sua senha no sistema IFCE Iventus.',
    `Use o código abaixo ou acesse o link de recuperação:`,
    '',
    `CÓDIGO DE RECUPERAÇÃO: ${resetCode}`,
    `LINK DE RECUPERAÇÃO: ${resetUrl}`,
    '',
    `Este código expira em ${expiresInMinutes} minutos e pode ser usado apenas uma vez.`,
    'Se você não solicitou a alteração de senha, ignore esta mensagem.',
  ].join('\n');

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="background-color:#15803d;padding:24px 32px;color:#ffffff;">
                    <div style="font-size:20px;font-weight:800;">IFCE Iventus</div>
                    <div style="font-size:12px;color:#dcfce7;margin-top:4px;">Recuperação Segura de Acesso</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#0f172a;">Redefinição de senha</h1>
                    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#475569;">
                      Olá, <strong style="color:#0f172a;">${escapeHtml(nome)}</strong>.
                    </p>
                    <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#475569;">
                      Utilize o código de 6 dígitos abaixo ou clique no botão para definir uma nova senha:
                    </p>
                    <div style="margin:0 0 24px 0;padding:18px;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;text-align:center;">
                      <div style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">
                        Código de Recuperação
                      </div>
                      <div style="font-size:30px;font-weight:800;letter-spacing:0.22em;color:#14532d;font-family:monospace;">
                        ${escapeHtml(resetCode)}
                      </div>
                    </div>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;">
                      <tr>
                        <td style="border-radius:10px;background-color:#16a34a;">
                          <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                            Definir nova senha
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;border-top:1px solid #e2e8f0;padding-top:16px;">
                      Este código expira em <strong>${expiresInMinutes} minutos</strong>. Caso você não tenha solicitado, desconsidere esta mensagem.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return { subject, text, html };
}

let cachedEtherealAccount: Awaited<ReturnType<typeof nodemailer.createTestAccount>> | null = null;

async function dispatchEmail(params: {
  toEmail: string;
  subject: string;
  text: string;
  html: string;
}): Promise<EmailSendResult> {
  const { toEmail, subject, text, html } = params;

  const fromAddress =
    process.env.SMTP_FROM ||
    process.env.EMAIL_FROM ||
    (process.env.SMTP_USER
      ? `IFCE Iventus <${process.env.SMTP_USER}>`
      : 'IFCE Iventus <onboarding@resend.dev>');

  const provider = getConfiguredEmailProvider();

  if (provider === 'resend') {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [toEmail],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Falha ao enviar e-mail via Resend API: ${response.status} ${errBody}`);
    }

    const data: any = await response.json();
    return {
      sent: true,
      provider: 'resend',
      messageId: data?.id,
    };
  }

  if (provider === 'smtp') {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });

    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject,
      text,
      html,
    });

    return {
      sent: true,
      provider: 'smtp',
      messageId: info.messageId,
    };
  }

  // In production, require a configured email provider unless sandbox fallback is explicitly allowed
  if (isProductionEnv() && process.env.ALLOW_ETHEREAL_FALLBACK !== 'true') {
    const err = new Error(
      'Serviço de envio de e-mails não configurado no servidor (defina RESEND_API_KEY ou SMTP_HOST/SMTP_USER/SMTP_PASS no painel do Vercel).'
    );
    (err as any).statusCode = 503;
    (err as any).errorCode = 'EMAIL_PROVIDER_NOT_CONFIGURED';
    throw err;
  }

  if (!cachedEtherealAccount) {
    cachedEtherealAccount = await nodemailer.createTestAccount();
  }

  const testTransporter = nodemailer.createTransport({
    host: cachedEtherealAccount.smtp.host,
    port: cachedEtherealAccount.smtp.port,
    secure: cachedEtherealAccount.smtp.secure,
    auth: {
      user: cachedEtherealAccount.user,
      pass: cachedEtherealAccount.pass,
    },
  });

  const info = await testTransporter.sendMail({
    from: `IFCE Iventus <${cachedEtherealAccount.user}>`,
    to: toEmail,
    subject,
    text,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
  return {
    sent: true,
    provider: 'ethereal_test',
    messageId: info.messageId,
    previewUrl,
  };
}

export async function sendVerificationEmail(params: {
  toEmail: string;
  nome: string;
  rawToken: string;
  verificationCode: string;
  baseUrl?: string;
}): Promise<EmailSendResult> {
  const { toEmail, nome, rawToken, verificationCode, baseUrl } = params;
  const origin = resolvePublicBaseUrl(baseUrl);
  const verifyUrl = `${origin}/?verify_token=${encodeURIComponent(rawToken)}`;

  const { subject, text, html } = buildVerificationEmailHtml({
    nome,
    verifyUrl,
    verificationCode,
    expiresInHours: 24,
  });

  return dispatchEmail({ toEmail, subject, text, html });
}

export async function sendPasswordResetEmail(params: {
  toEmail: string;
  nome: string;
  rawToken: string;
  resetCode: string;
  baseUrl?: string;
}): Promise<EmailSendResult> {
  const { toEmail, nome, rawToken, resetCode, baseUrl } = params;
  const origin = resolvePublicBaseUrl(baseUrl);
  const resetUrl = `${origin}/?reset_token=${encodeURIComponent(rawToken)}`;

  const { subject, text, html } = buildPasswordResetEmailHtml({
    nome,
    resetUrl,
    resetCode,
    expiresInMinutes: 60,
  });

  return dispatchEmail({ toEmail, subject, text, html });
}
