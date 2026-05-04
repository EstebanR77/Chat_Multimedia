const { getUsers } = require('../models/users');
const { sanitizeUser } = require('../utils/security');

function userRoutes(req, res) {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/api/users')) {
        const users = getUsers().map((user) => {
            const safeUser = sanitizeUser(user);
            return {
                id: safeUser.id,
                name: safeUser.name,
                email: safeUser.email,
                rol: safeUser.rol,
                img: safeUser.img,
                provider: safeUser.provider
            };
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(users));
    } else {
        res.writeHead(405);
        res.end();
    }
}

module.exports = userRoutes;
