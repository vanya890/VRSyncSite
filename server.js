const express = require('express');
const multer = require('multer');
const path = require('path');
const qr = require('qrcode');
const fs = require('fs');
const session = require('express-session');
const compression = require('compression');

const app = express();
const port = 3000;

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'vr-video-secret',
  resave: false,
  saveUninitialized: true
}));



// Простая аутентификация
const ADMIN_PASSWORD = 'admin123'; // В продакшне использовать более безопасный метод

// Middleware для проверки аутентификации (для страниц)
function requireAuth(req, res, next) {
  if (req.session.authenticated) {
    return next();
  }
  res.redirect('/admin/login');
}

// Middleware для API аутентификации (возвращает JSON ошибку если не аутентифицирован)
function requireApiAuth(req, res, next) {
  if (req.session.authenticated) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

// Настройка хранения загруженных файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'assets/videos/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

app.use('/static', express.static('static', {
  maxAge: '1d'
}));
app.use('/assets', express.static('assets', {
  maxAge: '1h'  // Видео могут обновляться чаще
}));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Логин
app.get('/admin/login', (req, res) => {
  if (req.session.authenticated) {
    return res.redirect('/admin');
  }
  res.send(`
    <html>
      <head>
        <title>Admin Login</title>
        <style>
          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
          form { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 300px; text-align: center; }
          input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px; }
          button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
          button:hover { background: #0056b3; }
        </style>
      </head>
      <body>
        <form method="post" action="/admin/login">
          <h2>Admin Panel Login</h2>
          <input type="password" name="password" placeholder="Enter password" required>
          <button type="submit">Login</button>
          ${req.query.error ? '<p style="color: red;">Invalid password</p>' : ''}
        </form>
      </body>
    </html>
  `);
});

app.post('/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    res.redirect('/admin');
  } else {
    res.redirect('/admin/login?error=1');
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Маршрут для загрузки видео
app.post('/upload', requireApiAuth, upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const videoUrl = `${req.protocol}://${req.get('host')}/viewer.html?video=${req.file.filename}`;

  qr.toBuffer(videoUrl, { type: 'png' }, (err, buffer) => {
    if (err) return res.status(500).json({ error: 'Error generating QR code' });

    const base64 = buffer.toString('base64');
    const qrCodeData = `data:image/png;base64,${base64}`;
    res.json({ videoUrl, qrCode: qrCodeData });
  });
});

// Админ панель
app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(__dirname + '/admin/index.html');
});

// Базовая аналитика
let viewCount = 0;

// Страница просмотра
app.get('/viewer.html', (req, res) => {
  let videoParam = req.query.video;

  if (!videoParam) {
    return res.status(400).send('Video parameter is required');
  }

  viewCount++;

  // Прочитать index.html и заменить src видео
  let content = fs.readFileSync(__dirname + '/index.html', 'utf8');
  content = content.replace('src="assets/videos/sample.mp4"', `src="assets/videos/${videoParam}"`);
  res.send(content);
});

// API для получения аналитики
app.get('/analytics', requireApiAuth, (req, res) => {
  res.json({ totalViews: viewCount });
});

// API для админ panели
app.get('/admin/api/videos', requireApiAuth, (req, res) => {
  fs.readdir('./assets/videos', (err, files) => {
    if (err) return res.status(500).json({ error: 'Unable to read videos directory' });
    const videos = files.filter(file => file.endsWith('.mp4')).map(file => ({
      filename: file,
      url: `/assets/videos/${file}`,
      size: fs.statSync(`./assets/videos/${file}`).size
    }));
    res.json(videos);
  });
});

app.delete('/admin/api/videos/:filename', requireApiAuth, (req, res) => {
  const filename = req.params.filename;
  const filepath = `./assets/videos/${filename}`;
  fs.unlink(filepath, (err) => {
    if (err) return res.status(500).json({ error: 'Unable to delete video' });
    res.json({ success: true });
  });
});

// API для генерации QR кодов для видео
app.get('/admin/api/qr/:filename', requireApiAuth, (req, res) => {
  const filename = req.params.filename;
  const videoUrl = `${req.protocol}://${req.get('host')}/viewer.html?video=${filename}`;

  qr.toBuffer(videoUrl, { type: 'png' }, (err, buffer) => {
    if (err) return res.status(500).json({ error: 'Error generating QR code' });

    const base64 = buffer.toString('base64');
    const qrCodeData = `data:image/png;base64,${base64}`;
    res.json({ qrCode: qrCodeData });
  });
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
