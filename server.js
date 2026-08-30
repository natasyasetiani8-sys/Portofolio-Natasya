const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const {
  initDatabase,
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  createMessage,
  getMessages,
  getSetting,
  setSetting,
  getStats
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const portfolioData = {
  profile: {
    name: 'Natasya Okta Setiani',
    role: 'Legislative Drafter · Photography',
    location: 'Indonesia'
  },
  publications: [
    {
      title: 'Jurnal Rechtsvinding',
      year: 2026,
      link: 'https://rechtsvinding.bphn.go.id/ejournal/index.php/jrv/article/view/2479'
    },
    {
      title: 'Pena Justisia',
      year: 2025,
      link: 'https://scholar.google.com/scholar?oi=bibs&cluster=14835256320228083156&btnI=1&hl=id'
    }
  ]
};

const adminTokenSecret = process.env.ADMIN_SECRET || 'portfolio-admin-secret';
const activeAdminTokens = new Set();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '.png');
    const uniqueName = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('Only image files are allowed.'));
      return;
    }
    cb(null, true);
  }
});

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadDir));

function generateToken() {
  const token = crypto.createHmac('sha256', adminTokenSecret).update(`${Date.now()}`).digest('hex');
  activeAdminTokens.add(token);
  return token;
}

function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token || !activeAdminTokens.has(token)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  return next();
}

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Portfolio backend is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/profile', (req, res) => {
  res.json({ success: true, data: portfolioData.profile });
});

app.get('/api/projects', async (req, res) => {
  try {
    const projects = await getProjects();
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/publications', (req, res) => {
  res.json({ success: true, data: portfolioData.publications });
});

app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, and message are required.'
    });
  }

  try {
    const newMessage = await createMessage({ name, email, message });
    return res.status(201).json({
      success: true,
      message: 'Message sent successfully.',
      data: newMessage
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin-login', async (req, res) => {
  const { username, password } = req.body || {};

  if (username !== 'admin') {
    return res.status(401).json({ success: false, message: 'Invalid username' });
  }

  const savedPassword = await getSetting('admin_password');

  if (!savedPassword || password !== savedPassword) {
    return res.status(401).json({ success: false, message: 'Invalid password' });
  }

  const token = generateToken();
  return res.json({ success: true, token });
});

app.get('/api/admin/dashboard', verifyAdmin, async (req, res) => {
  try {
    const stats = await getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/projects-admin', verifyAdmin, async (req, res) => {
  try {
    const projects = await getProjects();
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/projects-admin/:id', verifyAdmin, async (req, res) => {
  try {
    const project = await getProjectById(Number(req.params.id));
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    return res.json({ success: true, data: project });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/projects-admin', verifyAdmin, upload.single('image'), async (req, res) => {
  const { title, description, url, category, isFeatured } = req.body || {};

  if (!title || !description) {
    return res.status(400).json({ success: false, message: 'Title and description are required.' });
  }

  try {
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
    const result = await createProject({
      title,
      description,
      url: url || '',
      category: category || 'government',
      image_url: imageUrl,
      is_featured: isFeatured === 'true' || isFeatured === '1' || isFeatured === true ? 1 : 0
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/projects-admin/:id', verifyAdmin, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { title, description, url, category, isFeatured, keepExistingImage } = req.body || {};

  if (!title || !description) {
    return res.status(400).json({ success: false, message: 'Title and description are required.' });
  }

  try {
    const existingProject = await getProjectById(Number(id));
    let imageUrl = existingProject?.image_url || '';

    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    } else if (keepExistingImage === 'false') {
      imageUrl = '';
    }

    const result = await updateProject(Number(id), {
      title,
      description,
      url: url || '',
      category: category || 'government',
      image_url: imageUrl,
      is_featured: isFeatured === 'true' || isFeatured === '1' || isFeatured === true ? 1 : 0
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/projects-admin/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const project = await getProjectById(Number(id));
    if (project && project.image_url) {
      const filePath = path.join(__dirname, project.image_url.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    const result = await deleteProject(Number(id));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/contact-messages', verifyAdmin, async (req, res) => {
  try {
    const messages = await getMessages();
    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/password', verifyAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current and new password are required.' });
  }

  const savedPassword = await getSetting('admin_password');
  if (savedPassword !== currentPassword) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
  }

  await setSetting('admin_password', newPassword);
  return res.json({ success: true, message: 'Password updated successfully.' });
});

app.get('/admin-login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-login.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.use(express.static(path.join(__dirname)));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  return res.sendFile(path.join(__dirname, 'index.html'));
});

async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
