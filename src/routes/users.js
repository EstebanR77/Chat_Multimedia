const { getUsers } = require('../models/users');
const { sanitizeUser } = require('../utils/security');

function userRoutes(req, res) {
    if (req.method === 'GET') {
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
        res.json(users);
    } else {
        res.status(405).end();
    }
}

module.exports = userRoutes;
