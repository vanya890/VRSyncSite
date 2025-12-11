import express from 'express';
import https from 'https';
import fs from 'fs';
import crypto from 'crypto';
import forge from 'node-forge';
import ip from 'ip';
import { constants } from 'crypto';
import { spawn, exec } from 'child_process';

const HTTP_PORT = 8080;
const HTTPS_PORT = 8443;
const STATIC_FOLDER = './public/';

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

const server = app.listen(HTTP_PORT, () => {
    const localUrl = `http://${ip.address()}:${HTTP_PORT}`;
    console.log(`HTTP Server running at: \x1b[36m${localUrl}\x1b[0m`);
    console.log(`Portal URL: \x1b[36m${localUrl}/portal.html\x1b[0m`);

    // Запуск localtunnel
    const lt = spawn('lt', ['--port', HTTP_PORT.toString()], { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });

    lt.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('LocalTunnel:', output.trim());

        // Ищем URL в выводе
        const urlMatch = output.match(/https:\/\/[a-z0-9\-]+\.loca\.lt/);
        if (urlMatch) {
            const tunnelUrl = urlMatch[0];
            console.log(`Tunnel URL: \x1b[36m${tunnelUrl}\x1b[0m`);
            console.log(`Portal Tunnel URL: \x1b[36m${tunnelUrl}/portal.html\x1b[0m`);

            // Открываем браузер
            exec(`start ${tunnelUrl}/portal.html`);
        }
    });

    lt.stderr.on('data', (data) => {
        console.error('LocalTunnel Error:', data.toString());
    });

    lt.on('close', (code) => {
        console.log(`LocalTunnel exited with code ${code}`);
    });

    // Запуск HTTPS сервера
    const sslOptions = {
        ...generateSelfSignedCert(),
        secureOptions: constants.SSL_OP_NO_TLSv1 | constants.SSL_OP_NO_TLSv1_1,
        ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA'
    };
    const httpsServer = https.createServer(sslOptions, app);

    httpsServer.listen(HTTPS_PORT, () => {
        const httpsUrl = `https://${ip.address()}:${HTTPS_PORT}`;
        console.log(`HTTPS Server running at: \x1b[36m${httpsUrl}\x1b[0m`);
        console.log(`Portal HTTPS URL: \x1b[36m${httpsUrl}/portal.html\x1b[0m`);
    });

    // Обработка завершения
    process.on('SIGINT', () => {
        console.log('Shutting down...');
        server.close();
        httpsServer.close();
        process.exit(0);
    });
});
