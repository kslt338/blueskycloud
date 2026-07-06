const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const emailService = require('./email-service');
const pages = require('./pages');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3890;
const JWT_SECRET = process.env.JWT_SECRET || 'blueskycloud-secret-2026';
// 动态获取 HOST（支持云端部署和隧道）
function getHost(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || (req.connection.encrypted ? 'https' : 'http');
  return `${proto}://${req.headers.host}`;
}

// ==================== 中间件 ====================
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = db.prepare('SELECT id, email, role, nickname, status FROM users WHERE id = ?').get(payload.id);
    if (!req.user) return res.status(401).json({ error: '用户不存在' });
    if (req.user.status !== 'active') return res.status(403).json({ error: '账号已被禁用' });
    next();
  } catch (e) {
    return res.status(401).json({ error: '登录已过期' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
}

// ==================== 认证接口 ====================
// 发送验证码
app.post('/api/auth/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: '邮箱格式不正确' });
  }
  try {
    await emailService.sendVerificationCode(email);
    res.json({ success: true, message: '验证码已发送，请查收邮箱' });
  } catch (err) {
    // SMTP 不可用时回退：返回验证码供 APP 显示
    const code = emailService.getLastCode(email);
    if (code) {
      res.json({ success: true, message: '邮件服务暂不可用，验证码如下', code });
    } else {
      res.status(500).json({ error: '验证码发送失败: ' + err.message });
    }
  }
});

// 注册
app.post('/api/auth/register', (req, res) => {
  const { email, password, code, nickname } = req.body;
  if (!email || !password || !code) {
    return res.status(400).json({ error: '请填写完整信息' });
  }
  if (!emailService.verifyCode(email, code)) {
    return res.status(400).json({ error: '验证码错误或已过期' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(400).json({ error: '该邮箱已注册' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (email, password, nickname) VALUES (?,?,?)')
    .run(email, hash, nickname || email.split('@')[0]);
  const user = db.prepare('SELECT id, email, role, nickname FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, user });
});

// 登录
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(400).json({ error: '邮箱或密码错误' });
  }
  if (user.status !== 'active') return res.status(403).json({ error: '账号已被禁用' });
  const safeUser = { id: user.id, email: user.email, role: user.role, nickname: user.nickname };
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, user: safeUser });
});

// 当前用户
app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// ==================== 网页管理 ====================
app.get('/api/pages', auth, (req, res) => {
  const list = req.user.role === 'admin'
    ? pages.listPages()
    : pages.listPages(req.user.id);
  res.json({ pages: list.map(p => ({ ...p, url: `${getHost(req)}/host/${p.subdomain}/` })) });
});

app.post('/api/pages', auth, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: '请输入网页名称' });
  const page = pages.createPage(req.user.id, name, description);
  res.json({ success: true, page: { ...page, url: `${getHost(req)}/host/${page.subdomain}/` } });
});

app.delete('/api/pages/:id', auth, (req, res) => {
  const page = pages.getPage(req.params.id);
  if (!page) return res.status(404).json({ error: '网页不存在' });
  if (req.user.role !== 'admin' && page.owner_id !== req.user.id) {
    return res.status(403).json({ error: '无权操作' });
  }
  pages.deletePage(req.params.id);
  res.json({ success: true });
});

// 文件列表
app.get('/api/pages/:id/files', auth, (req, res) => {
  const page = pages.getPage(req.params.id);
  if (!page) return res.status(404).json({ error: '网页不存在' });
  if (req.user.role !== 'admin' && page.owner_id !== req.user.id) {
    return res.status(403).json({ error: '无权操作' });
  }
  res.json({ files: pages.listFiles(req.params.id) });
});

// 读取文件
app.get('/api/pages/:id/files/*', auth, (req, res) => {
  const page = pages.getPage(req.params.id);
  if (!page) return res.status(404).json({ error: '网页不存在' });
  if (req.user.role !== 'admin' && page.owner_id !== req.user.id) {
    return res.status(403).json({ error: '无权操作' });
  }
  const filePath = req.params[0];
  const file = pages.readFile(req.params.id, filePath);
  if (!file) return res.status(404).json({ error: '文件不存在' });
  res.json({ file });
});

// 保存文件
app.put('/api/pages/:id/files/*', auth, (req, res) => {
  const page = pages.getPage(req.params.id);
  if (!page) return res.status(404).json({ error: '网页不存在' });
  if (req.user.role !== 'admin' && page.owner_id !== req.user.id) {
    return res.status(403).json({ error: '无权操作' });
  }
  const filePath = req.params[0];
  const { content } = req.body;
  pages.writeFile(req.params.id, filePath, content);
  res.json({ success: true });
});

// 新建文件
app.post('/api/pages/:id/files', auth, (req, res) => {
  const page = pages.getPage(req.params.id);
  if (!page) return res.status(404).json({ error: '网页不存在' });
  if (req.user.role !== 'admin' && page.owner_id !== req.user.id) {
    return res.status(403).json({ error: '无权操作' });
  }
  const { path: filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: '请输入文件路径' });
  pages.createFile(req.params.id, filePath, content);
  res.json({ success: true });
});

// 删除文件
app.delete('/api/pages/:id/files/*', auth, (req, res) => {
  const page = pages.getPage(req.params.id);
  if (!page) return res.status(404).json({ error: '网页不存在' });
  if (req.user.role !== 'admin' && page.owner_id !== req.user.id) {
    return res.status(403).json({ error: '无权操作' });
  }
  const filePath = req.params[0];
  pages.deleteFile(req.params.id, filePath);
  res.json({ success: true });
});

// ==================== 管理员接口 ====================
app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  const users = db.prepare('SELECT id, email, role, status, nickname, created_at FROM users ORDER BY id DESC').all();
  res.json({ users });
});

app.put('/api/admin/users/:id/status', auth, adminOnly, (req, res) => {
  const { status } = req.body;
  if (!['active', 'disabled'].includes(status)) {
    return res.status(400).json({ error: '状态无效' });
  }
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: '用户不存在' });
  if (target.role === 'admin') return res.status(400).json({ error: '不能删除管理员' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/stats', auth, adminOnly, (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE role = ?').get('user').c;
  const pageCount = db.prepare('SELECT COUNT(*) as c FROM pages').get().c;
  const fileCount = db.prepare('SELECT COUNT(*) as c FROM files').get().c;
  const emailCount = db.prepare('SELECT COUNT(*) as c FROM email_logs').get().c;
  const successEmails = db.prepare('SELECT COUNT(*) as c FROM email_logs WHERE status = ?').get('success').c;
  res.json({ userCount, pageCount, fileCount, emailCount, successEmails });
});

app.get('/api/admin/email-logs', auth, adminOnly, (req, res) => {
  const logs = db.prepare('SELECT * FROM email_logs ORDER BY id DESC LIMIT 200').all();
  res.json({ logs });
});

app.get('/api/admin/pages', auth, adminOnly, (req, res) => {
  const list = db.prepare(`
    SELECT p.*, u.email as owner_email, u.nickname as owner_name
    FROM pages p LEFT JOIN users u ON p.owner_id = u.id
    ORDER BY p.id DESC`).all();
  res.json({ pages: list.map(p => ({ ...p, url: `${getHost(req)}/host/${p.subdomain}/` })) });
});

// ==================== 托管网页访问 ====================
app.get('/host/:subdomain/*', (req, res) => {
  const content = pages.serveHosted(req.params.subdomain, req.params[0] || 'index.html');
  if (content === null) return res.status(404).send('网页不存在');
  const filePath = (req.params[0] || 'index.html').toLowerCase();
  if (filePath.endsWith('.css')) res.type('text/css');
  else if (filePath.endsWith('.js')) res.type('application/javascript');
  else res.type('text/html');
  res.send(content);
});

app.get('/host/:subdomain', (req, res) => {
  res.redirect(`/host/${req.params.subdomain}/`);
});

app.get('/host', (req, res) => {
  res.send('<h2>蓝天云托管服务</h2><p>请在 URL 后加上 /host/{网页子域名}/</p>');
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: '蓝天云', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  const host = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
  console.log('========================================');
  console.log('  蓝天云后端服务已启动');
  console.log(`  API 地址: ${host}/api`);
  console.log(`  托管访问: ${host}/host/{子域名}/`);
  console.log(`  健康检查: ${host}/api/health`);
  console.log('  管理员账号: admin@blueskycloud.local / admin123');
  console.log('========================================');
});
