const { getUserByEmail } = require('../models/users');

function authRoutes(req, res) {
    if (req.method === 'POST' && req.url === '/api/login') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { email, password } = JSON.parse(body);
                const user = getUserByEmail(email);

                if (user && user.password === password) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        message: 'Login exitoso',
                        user: { id: user.id, name: user.name, email: user.email, rol: user.rol, img: user.img }
                    }));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Correo o contraseña incorrectos' }));
                }
            } catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Datos inválidos' }));
            }
        });
    } else {
        res.writeHead(405);
        res.end();
    }
}

module.exports = authRoutes;
