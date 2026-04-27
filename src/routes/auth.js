const { getUsers } = require('../models/users');

function authRoutes(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        try {
            const { email, password } = JSON.parse(body);
            const users = getUsers();
            const user  = users.find(u => u.email === email && u.password === password);
            if (!user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Credenciales inválidas' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                message: 'Login exitoso',
                user: { id: user.id, name: user.name, email: user.email, rol: user.rol, img: user.img }
            }));
        } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Datos inválidos' }));
        }
    });
}

module.exports = authRoutes;
