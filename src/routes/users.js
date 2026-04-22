const { getUsers } = require('../models/users');

function userRoutes(req, res) {
    if (req.method === 'GET' && req.url === '/api/users') {
        const users = getUsers();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(users));
    } else {
        res.writeHead(405);
        res.end();
    }
}

module.exports = userRoutes;
