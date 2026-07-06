const nodemailer = require('nodemailer');
const db = require('./database');
const { renderVerificationEmail } = require('./email-template');

// QQ 邮箱 SMTP 配置
// 在沙箱环境中通过 HTTP CONNECT 代理发送邮件（绕过端口封锁）
// 在 Render/云服务器上直接发送（不需要代理）
const PROXY_URL = process.env.SMTP_PROXY; // 未设置时为 undefined，不使用代理

const transportConfig = {
  host: 'smtp.qq.com',
  port: 465,
  secure: true,
  auth: {
    user: '2734526715@qq.com',
    pass: 'uhwqzwwrldiedcji'
  }
};

// 仅在设置了 SMTP_PROXY 时使用代理
if (PROXY_URL) {
  transportConfig.proxy = PROXY_URL;
}

const transporter = nodemailer.createTransport(transportConfig);

const SENDER_NAME = '蓝天云';

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function logEmail(toEmail, subject, type, status, message) {
  db.prepare('INSERT INTO email_logs (to_email, subject, type, status, message) VALUES (?,?,?,?,?)')
    .run(toEmail, subject, type, status, message || '');
}

// 发送验证码邮件
async function sendVerificationCode(toEmail) {
  const code = generateCode();

  // 保存验证码，10 分钟有效
  db.prepare(`INSERT INTO verifications (email, code) VALUES (?,?)`).run(toEmail, code);
  // 清理该邮箱超过 10 分钟的旧验证码
  db.prepare(`DELETE FROM verifications WHERE email = ? AND created_at < datetime('now','localtime','-10 minutes')`).run(toEmail);

  const html = renderVerificationEmail(code);
  const subject = '【蓝天云】你的邮箱验证码';

  try {
    const info = await transporter.sendMail({
      from: `"${SENDER_NAME}" <2734526715@qq.com>`,
      to: toEmail,
      subject,
      html
    });
    logEmail(toEmail, subject, 'verification', 'success', info.messageId || '');
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logEmail(toEmail, subject, 'verification', 'failed', err.message);
    throw err;
  }
}

// 发送通知邮件
async function sendNotification(toEmail, subject, content) {
  try {
    const info = await transporter.sendMail({
      from: `"${SENDER_NAME}" <2734526715@qq.com>`,
      to: toEmail,
      subject,
      html: content
    });
    logEmail(toEmail, subject, 'notification', 'success', info.messageId || '');
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logEmail(toEmail, subject, 'notification', 'failed', err.message);
    throw err;
  }
}

// 验证验证码
function verifyCode(toEmail, code) {
  const record = db.prepare(`SELECT id FROM verifications
    WHERE email = ? AND code = ? AND used = 0
    AND created_at >= datetime('now','localtime','-10 minutes')
    ORDER BY id DESC LIMIT 1`).get(toEmail, code);
  if (record) {
    db.prepare('UPDATE verifications SET used = 1 WHERE id = ?').run(record.id);
    return true;
  }
  return false;
}

// 获取最近发送的验证码（SMTP 不可用时的回退方案）
function getLastCode(toEmail) {
  const record = db.prepare(`SELECT code FROM verifications
    WHERE email = ? AND used = 0
    AND created_at >= datetime('now','localtime','-10 minutes')
    ORDER BY id DESC LIMIT 1`).get(toEmail);
  return record ? record.code : null;
}

module.exports = { sendVerificationCode, sendNotification, verifyCode, getLastCode, transporter };
