const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'blueskycloud.db'));
db.pragma('journal_mode = WAL');

// 初始化数据表
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  nickname TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  content TEXT,
  is_binary INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (page_id) REFERENCES pages(id),
  UNIQUE(page_id, path)
);

CREATE TABLE IF NOT EXISTS email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  type TEXT,
  status TEXT,
  message TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
`);

// 创建默认管理员账号
function seedAdmin() {
  const admin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@blueskycloud.local');
  if (!admin) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (email, password, role, nickname) VALUES (?,?,?,?)')
      .run('admin@blueskycloud.local', hash, 'admin', '系统管理员');
    console.log('[DB] 默认管理员已创建: admin@blueskycloud.local / admin123');
  }
}

seedAdmin();

module.exports = db;
