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

const DEFAULT_HOMEPAGE_SETTINGS = {
  metadata: {
    siteTitle: 'Natasya Okta Setiani — Legislative Drafter | Photographer',
    metaDescription: 'Portofolio pribadi: fotografi landscape & macro, serta pengalaman profesional di bidang pemerintahan dan kebijakan publik.'
  },
  nav: {
    home: 'Beranda',
    profile: 'Profil',
    works: 'Karya',
    experience: 'Pengalaman',
    contact: 'Kontak',
    cta: 'Contact Me'
  },
  hero: {
    eyebrow: 'Legislative Drafter · Photography',
    title: 'Natasya Okta Setiani',
    description: 'Saya adalah....',
    primaryCta: 'View Works →',
    secondaryCta: 'Career History'
  },
  about: {
    eyebrow: 'Educational Background',
    title: 'Building Solutions Through Law and Public Service • Where Creativity Meets Digital Innovation',
    description: 'Equipped with comprehensive legal knowledge and a passion for public service, I specialize in legislative drafting, policy development, and regulatory analysis. A strong foundation in multimedia production, visual design, photography, and digital media has nurtured both my technical expertise and artistic perspective, enabling me to bridge creativity with professional communication.'
  },
  featured: {
    eyebrow: 'Featured Project',
    title: 'Flagship Projects',
    description: 'A summary of the projects that best represent my visual and professional approach.'
  },
  portfolio: {
    eyebrow: 'Portofolio',
    title: 'Selected Works',
    description: 'A small part of my visual journey: zoom in on the details, broaden your horizons.'
  },
  experience: {
    eyebrow: 'Track Record',
    title: 'Professional Experience',
    description: 'A career in local government, policy and regulation.',
    orgEyebrow: 'Track Record',
    orgTitle: 'Organizational Experience',
    orgDescription: 'Organizational journey in the fields of creativity and visual collaboration.',
    publicationEyebrow: 'Track Record',
    publicationTitle: 'Publications',
    publicationDescription: 'Some of the scientific articles I have published since 2022.'
  },
  contact: {
    eyebrow: 'Let’s Connect',
    title: 'Interested in collaborating?',
    description: 'Whether it’s for creative projects, visual collaborations or public policy discussions — my inbox is always open.',
    email: 'natasyasetiani8@gmail.com',
    emailAlt: 'natasyaoktasetiani5@gmail.com'
  },
  footer: {
    brand: 'Natasya Okta Setiani',
    copyright: '© 2026 Natasya Okta Setiani. All rights reserved.'
  }
};

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

  const landingPage = await getSetting('landing_page');
  if (!landingPage) {
    await setSetting('landing_page', JSON.stringify(DEFAULT_HOMEPAGE_SETTINGS));
  }

  const legacyMapping = {
    hero_eyebrow: DEFAULT_HOMEPAGE_SETTINGS.hero.eyebrow,
    hero_title: DEFAULT_HOMEPAGE_SETTINGS.hero.title,
    hero_description: DEFAULT_HOMEPAGE_SETTINGS.hero.description,
    hero_primary_cta: DEFAULT_HOMEPAGE_SETTINGS.hero.primaryCta,
    hero_secondary_cta: DEFAULT_HOMEPAGE_SETTINGS.hero.secondaryCta,
    about_title: DEFAULT_HOMEPAGE_SETTINGS.about.title,
    about_description: DEFAULT_HOMEPAGE_SETTINGS.about.description,
    footer_brand: DEFAULT_HOMEPAGE_SETTINGS.footer.brand
  };

  for (const [key, value] of Object.entries(legacyMapping)) {
    const exists = await getSetting(key);
    if (exists === null) {
      await setSetting(key, value);
    }
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

async function getHomepageSettings() {
  const landingPageJson = await getSetting('landing_page');

  if (landingPageJson) {
    try {
      return { ...DEFAULT_HOMEPAGE_SETTINGS, ...JSON.parse(landingPageJson) };
    } catch (error) {
      console.warn('Landing page settings invalid, falling back to defaults.');
    }
  }

  const legacyKeys = [
    'hero_eyebrow',
    'hero_title',
    'hero_description',
    'hero_primary_cta',
    'hero_secondary_cta',
    'about_title',
    'about_description',
    'footer_brand'
  ];

  const rows = await all(`SELECT key, value FROM settings WHERE key IN (${legacyKeys.map(() => '?').join(', ')})`, legacyKeys);
  const result = {};
  rows.forEach((row) => {
    result[row.key] = row.value;
  });

  return {
    ...DEFAULT_HOMEPAGE_SETTINGS,
    hero: {
      ...DEFAULT_HOMEPAGE_SETTINGS.hero,
      eyebrow: result.hero_eyebrow || DEFAULT_HOMEPAGE_SETTINGS.hero.eyebrow,
      title: result.hero_title || DEFAULT_HOMEPAGE_SETTINGS.hero.title,
      description: result.hero_description || DEFAULT_HOMEPAGE_SETTINGS.hero.description,
      primaryCta: result.hero_primary_cta || DEFAULT_HOMEPAGE_SETTINGS.hero.primaryCta,
      secondaryCta: result.hero_secondary_cta || DEFAULT_HOMEPAGE_SETTINGS.hero.secondaryCta
    },
    about: {
      ...DEFAULT_HOMEPAGE_SETTINGS.about,
      title: result.about_title || DEFAULT_HOMEPAGE_SETTINGS.about.title,
      description: result.about_description || DEFAULT_HOMEPAGE_SETTINGS.about.description
    },
    footer: {
      ...DEFAULT_HOMEPAGE_SETTINGS.footer,
      brand: result.footer_brand || DEFAULT_HOMEPAGE_SETTINGS.footer.brand
    }
  };
}

async function saveHomepageSettings(payload = {}) {
  const merged = { ...DEFAULT_HOMEPAGE_SETTINGS, ...payload };
  await setSetting('landing_page', JSON.stringify(merged));

  if (payload.hero) {
    await setSetting('hero_eyebrow', payload.hero.eyebrow || DEFAULT_HOMEPAGE_SETTINGS.hero.eyebrow);
    await setSetting('hero_title', payload.hero.title || DEFAULT_HOMEPAGE_SETTINGS.hero.title);
    await setSetting('hero_description', payload.hero.description || DEFAULT_HOMEPAGE_SETTINGS.hero.description);
    await setSetting('hero_primary_cta', payload.hero.primaryCta || DEFAULT_HOMEPAGE_SETTINGS.hero.primaryCta);
    await setSetting('hero_secondary_cta', payload.hero.secondaryCta || DEFAULT_HOMEPAGE_SETTINGS.hero.secondaryCta);
  }

  if (payload.about) {
    await setSetting('about_title', payload.about.title || DEFAULT_HOMEPAGE_SETTINGS.about.title);
    await setSetting('about_description', payload.about.description || DEFAULT_HOMEPAGE_SETTINGS.about.description);
  }

  if (payload.footer) {
    await setSetting('footer_brand', payload.footer.brand || DEFAULT_HOMEPAGE_SETTINGS.footer.brand);
  }

  return getHomepageSettings();
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
  getStats,
  getHomepageSettings,
  saveHomepageSettings
};
