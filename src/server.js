const http      = require('http');
const fs        = require('fs');
const path      = require('path');
const WebSocket = require('ws');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const setupChat  = require('./web/chat');

const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/login')) return authRoutes(req, res);
    if (req.url.startsWith('/api/users')) return userRoutes(req, res);

    let url = req.url === '/' ? '/login.html' : req.url;
    let filePath = path.join(__dirname, '../public', url);

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Archivo no encontrado');
        } else {
            const mimeTypes = {
                '.html': 'text/html',
                '.css':  'text/css',
                '.js':   'application/javascript',
                '.json': 'application/json',
                '.png':  'image/png',
                '.jpg':  'image/jpeg',
            };
            const contentType = mimeTypes[path.extname(filePath)] || 'text/plain';
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

const wss = new WebSocket.Server({ server });
setupChat(wss);

server.listen(3000, () => {
    console.log('Servidor corriendo en http://localhost:3000');
});
