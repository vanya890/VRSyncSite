import express from 'express';
import ip from 'ip';

const HTTP_PORT = 8080;
const STATIC_FOLDER = './public/';

const app = express();

// CORS middleware для видео и других ресурсов
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
    res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(express.static(STATIC_FOLDER));

app.listen(HTTP_PORT, () => {
    const url = `http://${ip.address()}:${HTTP_PORT}`;
    console.log(`HTTP Server running at: \x1b[36m${url}\x1b[0m`);
    console.log(`Portal URL: \x1b[36m${url}/portal.html\x1b[0m`);
});
