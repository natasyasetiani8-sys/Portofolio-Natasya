const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'portfolio.db'));

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }

      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows);
    });
  });
}

async function ensureColumn(tableName, columnName, columnDefinition) {
  const columns = await all(`PRAGMA table_info(${tableName})`);
  const exists = columns.some((column) => column.name === columnName);

  if (!exists) {
    await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      url TEXT,
      category TEXT,
      image_url TEXT,
      is_featured INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn('projects', 'image_url', 'TEXT');
  await ensureColumn('projects', 'is_featured', 'INTEGER DEFAULT 0');

  await run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  const existingProject = await get('SELECT COUNT(*) AS count FROM projects');
  if (!existingProject || existingProject.count === 0) {
    await run(
      `INSERT INTO projects (title, description, url, category, image_url, is_featured)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'SIPROPEMPERDA',
        'An integrated, transparent, accountable and easily accessible information system on the progress of the drafting of local regulations.',
        'https://siproperda-setwan-ntt.netlify.app/',
        'government',
        '',
        1
      ]
    );
  }

  const adminPassword = await get('SELECT value FROM settings WHERE key = ?', ['admin_password']);
  if (!adminPassword) {
    await run('INSERT INTO settings (key, value) VALUES (?, ?)', ['admin_password', 'admin123']);
  }
}

async function getProjects() {
  return all('SELECT * FROM projects ORDER BY created_at DESC');
}

async function getProjectById(id) {
  return get('SELECT * FROM projects WHERE id = ?', [id]);
}

async function createProject({ title, description, url, category, image_url, is_featured = 0 }) {
  return run(
    `INSERT INTO projects (title, description, url, category, image_url, is_featured)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [title, description, url || '', category || 'government', image_url || '', Number(is_featured)]
  );
}

async function updateProject(id, { title, description, url, category, image_url, is_featured = 0 }) {
  return run(
    `UPDATE projects
     SET title = ?, description = ?, url = ?, category = ?, image_url = ?, is_featured = ?
     WHERE id = ?`,
    [title, description, url || '', category || 'government', image_url || '', Number(is_featured), id]
  );
}

async function deleteProject(id) {
  return run('DELETE FROM projects WHERE id = ?', [id]);
}

async function getMessages() {
  return all('SELECT * FROM messages ORDER BY created_at DESC');
}

async function createMessage({ name, email, message }) {
  return run(
    `INSERT INTO messages (name, email, message)
     VALUES (?, ?, ?)`,
    [name, email, message]
  );
}

async function getSetting(key) {
  const row = await get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

async function setSetting(key, value) {
  return run(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

async function getStats() {
  const totalProjects = await get('SELECT COUNT(*) AS count FROM projects');
  const totalMessages = await get('SELECT COUNT(*) AS count FROM messages');
  const featuredProjects = await get('SELECT COUNT(*) AS count FROM projects WHERE is_featured = 1');
  const latestProject = await get('SELECT title FROM projects ORDER BY created_at DESC LIMIT 1');

  return {
    totalProjects: totalProjects?.count || 0,
    totalMessages: totalMessages?.count || 0,
    featuredProjects: featuredProjects?.count || 0,
    latestProject: latestProject?.title || 'Belum ada project'
  };
}

module.exports = {
  db,
  initDatabase,
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getMessages,
  createMessage,
  getSetting,
  setSetting,
  getStats
};
