const db = require('./database');
const path = require('path');
const fs = require('fs');

const PAGES_DIR = path.join(__dirname, 'data', 'pages');
if (!fs.existsSync(PAGES_DIR)) {
  fs.mkdirSync(PAGES_DIR, { recursive: true });
}

function slugify(name) {
  // 仅使用 ASCII 字符，避免 URL 编码问题
  const base = String(name || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const rand = Math.random().toString(36).slice(2, 6);
  return (base || 'page') + '-' + rand;
}

// 创建网页
function createPage(ownerId, name, description) {
  let subdomain = slugify(name);
  // 确保唯一
  while (db.prepare('SELECT id FROM pages WHERE subdomain = ?').get(subdomain)) {
    subdomain = slugify(name);
  }
  const info = db.prepare('INSERT INTO pages (owner_id, name, subdomain, description) VALUES (?,?,?,?)')
    .run(ownerId, name, subdomain, description || '');

  const pageDir = path.join(PAGES_DIR, subdomain);
  fs.mkdirSync(pageDir, { recursive: true });

  // 默认 index.html
  const defaultHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'PingFang SC','Microsoft YaHei',sans-serif;background:#F0F4F8;color:#333;display:flex;min-height:100vh;align-items:center;justify-content:center;}
.card{background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(0,102,255,.12);padding:56px 48px;text-align:center;max-width:520px;}
.badge{display:inline-block;background:#E8F0FE;color:#0066FF;font-size:13px;padding:5px 14px;border-radius:20px;margin-bottom:18px;}
h1{font-size:30px;margin-bottom:12px;color:#1a1a1a;}
p{color:#666;font-size:15px;line-height:1.7;margin-bottom:8px;}
.foot{margin-top:24px;font-size:13px;color:#999;}
a{color:#0066FF;text-decoration:none;}
</style>
</head>
<body>
<div class="card">
  <span class="badge">蓝天云托管</span>
  <h1>${name}</h1>
  <p>${description || '这是一个由蓝天云托管的网页。'}</p>
  <p>你可以通过编辑文件来修改此页面内容。</p>
  <div class="foot">© 2026 蓝天云 · Blue sky and clouds</div>
</div>
</body>
</html>`;
  db.prepare('INSERT INTO files (page_id, path, content) VALUES (?,?,?)')
    .run(info.lastInsertRowid, 'index.html', defaultHtml);
  fs.writeFileSync(path.join(pageDir, 'index.html'), defaultHtml, 'utf-8');

  return getPage(info.lastInsertRowid);
}

function getPage(id) {
  return db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
}

function getPageBySubdomain(subdomain) {
  return db.prepare('SELECT * FROM pages WHERE subdomain = ?').get(subdomain);
}

function listPages(ownerId) {
  if (ownerId) {
    return db.prepare('SELECT * FROM pages WHERE owner_id = ? ORDER BY id DESC').all(ownerId);
  }
  return db.prepare('SELECT * FROM pages ORDER BY id DESC').all();
}

function deletePage(id) {
  const page = getPage(id);
  if (!page) return false;
  db.prepare('DELETE FROM files WHERE page_id = ?').run(id);
  db.prepare('DELETE FROM pages WHERE id = ?').run(id);
  const pageDir = path.join(PAGES_DIR, page.subdomain);
  fs.rmSync(pageDir, { recursive: true, force: true });
  return true;
}

// 文件列表
function listFiles(pageId) {
  return db.prepare('SELECT id, path, updated_at FROM files WHERE page_id = ? ORDER BY path').all(pageId);
}

// 读取文件
function readFile(pageId, filePath) {
  return db.prepare('SELECT * FROM files WHERE page_id = ? AND path = ?').get(pageId, filePath);
}

// 写入文件
function writeFile(pageId, filePath, content) {
  const page = getPage(pageId);
  if (!page) throw new Error('网页不存在');
  const existing = readFile(pageId, filePath);
  if (existing) {
    db.prepare('UPDATE files SET content = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
      .run(content, existing.id);
  } else {
    db.prepare('INSERT INTO files (page_id, path, content) VALUES (?,?,?)')
      .run(pageId, filePath, content);
  }
  // 同步到磁盘
  const pageDir = path.join(PAGES_DIR, page.subdomain);
  fs.mkdirSync(path.join(pageDir, path.dirname(filePath)), { recursive: true });
  fs.writeFileSync(path.join(pageDir, filePath), content, 'utf-8');
  return true;
}

// 删除文件
function deleteFile(pageId, filePath) {
  const page = getPage(pageId);
  db.prepare('DELETE FROM files WHERE page_id = ? AND path = ?').run(pageId, filePath);
  if (page) {
    fs.rmSync(path.join(PAGES_DIR, page.subdomain, filePath), { force: true });
  }
  return true;
}

// 新建文件
function createFile(pageId, filePath, content = '') {
  return writeFile(pageId, filePath, content || '');
}

// 托管服务：根据 subdomain 和路径返回文件内容
function serveHosted(subdomain, urlPath) {
  const page = getPageBySubdomain(subdomain);
  if (!page) return null;
  let filePath = urlPath || 'index.html';
  if (filePath === '/' || filePath === '') filePath = 'index.html';
  filePath = filePath.replace(/^\/+/, '');
  const file = readFile(page.id, filePath);
  if (file) return file.content;
  // 尝试 index.html
  const index = readFile(page.id, 'index.html');
  return index ? index.content : null;
}

module.exports = {
  createPage, getPage, getPageBySubdomain, listPages, deletePage,
  listFiles, readFile, writeFile, deleteFile, createFile, serveHosted,
  PAGES_DIR
};
