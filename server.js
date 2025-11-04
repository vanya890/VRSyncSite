const express = require('express');
const multer = require('multer');
const path = require('path');
const qr = require('qrcode');
const fs = require('fs');
const session = require('express-session');
const compression = require('compression');
const http = require('http');
const https = require('https');

const app = express();
const port = 3000;

// Development mode для отключения кэша
const isDevelopment = process.env.NODE_ENV !== 'production';

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'vr-video-secret',
  resave: false,
  saveUninitialized: true
}));

// Отключение кэша в разработке
if (isDevelopment) {
  app.use((req, res, next) => {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    next();
  });
}

// Disable WebVR polyfill logging in production
if (!isDevelopment) {
  console.warn = console.error = () => {};
}



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

// Дополнительная поддержка Range Requests для видео
app.get('/assets/videos/:filename', (req, res) => {
  const videoPath = path.join(__dirname, 'assets/videos', req.params.filename);
  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize-1;

    const chunksize = (end-start)+1;
    const file = fs.createReadStream(videoPath, {start, end});

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
      'Cache-Control': 'public, max-age=3600' // 1 hour cache
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Cache-Control': 'public, max-age=3600'
    });
    fs.createReadStream(videoPath).pipe(res);
  }
});
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Логин
app.get('/admin/login', (req, res) => {
  if (req.session.authenticated) {
    return res.redirect('/admin');
  }
  res.send(`
    <html>
      <head>
    <title>Вход в админку</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
          form { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
          input { width: 100%; padding: 12px; margin: 15px 0; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; }
          button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; transition: background 0.3s; }
          button:hover, button:focus { background: #0056b3; outline: none; }
          @media (max-width: 480px) {
            form { padding: 20px; }
            input, button { font-size: 16px; } /* Prevent zoom on iOS */
          }
        </style>
      </head>
      <body>
        <form method="post" action="/admin/login">
          <h2>Вход в админ панель</h2>
          <input type="password" name="password" placeholder="Введите пароль" required>
          <button type="submit">Войти</button>
          ${req.query.error ? '<p style="color: red;">Неверный пароль</p>' : ''}
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

// Аналитика просмотров по видео
const ANALYTICS_FILE = './analytics.json';

// Функции для работы с аналитикой
function loadAnalytics() {
  try {
    if (fs.existsSync(ANALYTICS_FILE)) {
      const data = fs.readFileSync(ANALYTICS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading analytics:', error);
  }
  return {};
}

function saveAnalytics(data) {
  try {
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving analytics:', error);
  }
}

function trackVideoView(videoFilename) {
  const analytics = loadAnalytics();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  if (!analytics[videoFilename]) {
    analytics[videoFilename] = {};
  }

  if (!analytics[videoFilename][today]) {
    analytics[videoFilename][today] = 0;
  }

  analytics[videoFilename][today]++;
  saveAnalytics(analytics);

  return analytics[videoFilename][today];
}

function getVideoAnalytics(videoFilename) {
  const analytics = loadAnalytics();
  return analytics[videoFilename] || {};
}

function getAllAnalytics() {
  return loadAnalytics();
}

// Страница просмотра
app.get('/viewer.html', (req, res) => {
  let videoParam = req.query.video;

  if (!videoParam) {
    return res.status(400).send('Video parameter is required');
  }

  // Прочитать index.html и заменить src видео
  let content = fs.readFileSync(__dirname + '/index.html', 'utf8');
  content = content.replace('src="assets/videos/sample.mp4"', `src="assets/videos/${videoParam}"`);
  res.send(content);
});

// API для получения общей аналитики
app.get('/analytics', (req, res) => {
  const analytics = getAllAnalytics();
  const summary = {};

  // Подсчитываем общее количество просмотров для каждого видео
  for (const [video, dates] of Object.entries(analytics)) {
    summary[video] = Object.values(dates).reduce((sum, count) => sum + count, 0);
  }

  const totalViews = Object.values(summary).reduce((sum, count) => sum + count, 0);

  res.json({
    totalViews,
    videos: summary
  });
});

// API для получения аналитики конкретного видео
app.get('/analytics/:video', (req, res) => {
  const videoAnalytics = getVideoAnalytics(req.params.video);
  const totalViews = Object.values(videoAnalytics).reduce((sum, count) => sum + count, 0);

  res.json({
    video: req.params.video,
    totalViews,
    dailyViews: videoAnalytics
  });
});

// API для отслеживания просмотров видео (анонимно, без хранения данных пользователя)
app.post('/track-view/:video', (req, res) => {
  const videoFilename = req.params.video;
  if (!videoFilename) {
    return res.status(400).json({ error: 'Video filename required' });
  }

  const todayViews = trackVideoView(videoFilename);
  res.json({ success: true, todayViews });
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

// Local DPDB response for WebVR polyfill (replaces external proxy)
app.get('/dpdb.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Return proper DPDB format with no devices - WebVR polyfill will use built-in fallbacks
  res.json({
    "version": 1,
    "devices": []
  });
});

// Removed invalid route - XMLHttpRequest patch handles blocking

// Handle blocked DPDB requests
app.get('/blocked-dpdb-request', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Return proper DPDB format - WebVR polyfill will use built-in fallbacks
  res.json({
    "version": 1,
    "devices": []
  });
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
