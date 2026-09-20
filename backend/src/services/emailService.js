import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('[email] SMTP not configured — verification emails disabled');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.qq.com',
    port: parseInt(SMTP_PORT, 10) || 465,
    secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

export async function sendVerificationCode(email, code) {
  const t = getTransporter();
  if (!t) {
    console.log(`[DEV] Verification code for ${email}: ${code}`);
    return;
  }

  await t.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: 'NJU树洞 — 邮箱验证码',
    text: `您的验证码是：${code}\n\n验证码 5 分钟内有效，请勿泄露给他人。\n\n如非本人操作，请忽略此邮件。`,
  });
}

export async function sendBanNotification(email, { reason, days, postTitle, postContent }) {
  const t = getTransporter();
  const contactQQ = process.env.ADMIN_CONTACT_QQ || '请联系管理员';
  const contentPreview = postContent ? postContent.slice(0, 50) + (postContent.length > 50 ? '...' : '') : '';

  if (!t) {
    console.log(`[DEV] Ban notification for ${email}: ${reason}, ${days} days`);
    return;
  }

  await t.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: '【NJU树洞】账号禁言通知',
    text: `同学你好，

你的账号因 "${reason}" 被禁言 ${days} 天。
禁言期间无法发帖和评论。

${postTitle ? `相关内容：\n【${postTitle}】\n${contentPreview}\n` : ''}
如有疑问，请联系 QQ: ${contactQQ}。

— NJU树洞管理团队`,
  });
}

export async function sendUnbanNotification(email, { reason, isManual }) {
  const t = getTransporter();
  const contactQQ = process.env.ADMIN_CONTACT_QQ || '请联系管理员';

  if (!t) {
    console.log(`[DEV] Unban notification for ${email}: ${reason || '自动解禁'}`);
    return;
  }

  await t.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: '【NJU树洞】账号解禁通知',
    text: `同学你好，

${isManual ? `你的账号已被提前解禁，原因：${reason}` : '你的账号禁言期已结束，现恢复正常使用权限'}。
你现在可以正常发帖和评论了。

如有疑问，请联系 QQ: ${contactQQ}。

— NJU树洞管理团队`,
  });
}
