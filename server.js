const express = require('express');
const multer = require('multer');
const path = require('path');
const qr = require('qrcode');
const fs = require('fs');
const session = require('express-session');
const compression = require('compression');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const forge = require('node-forge');
const ip = require('ip');
const { constants } = require('crypto');

const app = express();
const port = 80;

// Development mode для отключения кэша
const isDevelopment = process.env.NODE_ENV !== 'production';

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Обслуживание favicon.ico
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'favicon.ico'));
});

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
const ADMIN_PASSWORD = 'KwSkaDD9'; // В продакшне использовать более безопасный метод

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
app.use('/alva', express.static('Alva/public', {
  maxAge: '1d'
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
app.get('/redirect.html', (req, res) => res.sendFile(path.join(__dirname, 'redirect.html')));

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

  const videoUrl = `${req.protocol}://${req.get('host')}/redirect.html?video=${req.file.filename}`;

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
      const parsed = JSON.parse(data);
      console.log('[ANALYTICS] Loaded analytics data:', parsed);
      return parsed;
    } else {
      console.log('[ANALYTICS] Analytics file does not exist, creating empty analytics');
      // Create empty analytics file
      const emptyAnalytics = {};
      fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(emptyAnalytics, null, 2));
      return emptyAnalytics;
    }
  } catch (error) {
    console.error('[ANALYTICS] Error loading analytics:', error);
    // Return empty object and try to create file
    try {
      const emptyAnalytics = {};
      fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(emptyAnalytics, null, 2));
      return emptyAnalytics;
    } catch (writeError) {
      console.error('[ANALYTICS] Error creating analytics file:', writeError);
    }
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

  // Отслеживаем просмотр при каждом запросе страницы
  try {
    const todayViews = trackVideoView(videoParam);
    console.log('[VIEWER] Tracked view for video:', videoParam, '- today views:', todayViews);
  } catch (error) {
    console.error('[VIEWER] Error tracking view for', videoParam, ':', error);
    // Продолжаем работу даже если отслеживание не удалось
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
  console.log('[ANALYTICS] Track view request for video:', videoFilename);

  if (!videoFilename) {
    console.error('[ANALYTICS] No video filename provided in track-view request');
    return res.status(400).json({ error: 'Video filename required' });
  }

  try {
    const todayViews = trackVideoView(videoFilename);
    console.log('[ANALYTICS] Successfully tracked view for', videoFilename, '- today views:', todayViews);
    res.json({ success: true, todayViews });
  } catch (error) {
    console.error('[ANALYTICS] Error tracking view for', videoFilename, ':', error);
    res.status(500).json({ error: 'Failed to track view' });
  }
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
  const videoUrl = `${req.protocol}://${req.get('host')}/redirect.html?video=${filename}`;

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

// Функция для генерации самоподписанного сертификата
function generateSelfSignedCert() {
    const sslDir = './ssl';
    const keyPath = `${sslDir}/key.pem`;
    const certPath = `${sslDir}/cert.pem`;

    // Проверяем, существуют ли файлы
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        return {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };
    }

    // Создаем директорию, если не существует
    if (!fs.existsSync(sslDir)) {
        fs.mkdirSync(sslDir);
    }

    // Генерируем ключи с помощью node-forge
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [
        { name: 'countryName', value: 'RU' },
        { shortName: 'ST', value: 'State' },
        { name: 'localityName', value: 'City' },
        { name: 'organizationName', value: 'AlvaAR' },
        { shortName: 'OU', value: 'OrgUnit' },
        { name: 'commonName', value: 'localhost' }
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([
        {
            name: 'basicConstraints',
            cA: true
        },
        {
            name: 'keyUsage',
            keyCertSign: true,
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: true,
            dataEncipherment: true
        },
        {
            name: 'extKeyUsage',
            serverAuth: true,
            clientAuth: true,
            codeSigning: true,
            emailProtection: true,
            timeStamping: true
        },
        {
            name: 'nsCertType',
            client: true,
            server: true,
            email: true,
            objsign: true,
            sslCA: true,
            emailCA: true,
            objCA: true
        },
        {
            name: 'subjectAltName',
            altNames: [
                {
                    type: 2, // DNS
                    value: 'localhost'
                },
                {
                    type: 7, // IP
                    ip: ip.address()
                },
                {
                    type: 7, // IP
                    ip: '127.0.0.1'
                }
            ]
        },
        {
            name: 'subjectKeyIdentifier'
        }
    ]);

    // Самоподписываем
    cert.sign(keys.privateKey);

    // Конвертируем в PEM
    const pemPrivate = forge.pki.privateKeyToPem(keys.privateKey);
    const pemCert = forge.pki.certificateToPem(cert);

    // Сохраняем файлы
    fs.writeFileSync(keyPath, pemPrivate);
    fs.writeFileSync(certPath, pemCert);

    console.log('SSL certificates generated and saved to ./ssl/');

    return {
        key: pemPrivate,
        cert: pemCert
    };
}

const httpsPort = 443;

app.listen(port, () => {
  console.log(`HTTP Server running at http://localhost:${port}`);

  // Запуск HTTPS сервера
  const sslOptions = {
      ...generateSelfSignedCert(),
      secureOptions: constants.SSL_OP_NO_TLSv1 | constants.SSL_OP_NO_TLSv1_1,
      ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA'
  };
  const httpsServer = https.createServer(sslOptions, app);

  httpsServer.listen(httpsPort, () => {
      console.log(`HTTPS Server running at https://localhost:${httpsPort}`);
  });
});
