const { getUserByEmail } = require('../models/users');
const { sanitizeEmail, sanitizeUser } = require('../utils/security');

const publicUser = (user) => ({
    id: user.id,
    name: sanitizeUser(user).name,
    email: sanitizeEmail(user.email),
    rol: sanitizeUser(user).rol,
    img: sanitizeUser(user).img,
    provider: sanitizeUser(user).provider
});

function authRoutes(req, res) {
    try {
        const { email, password } = req.body || {};

        if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
            res.status(400).json({ error: 'Correo y contrasena son obligatorios' });
            return;
        }

        const normalizedEmail = sanitizeEmail(email);
        if (normalizedEmail.length > 120 || password.length > 128) {
            res.status(400).json({ error: 'Datos invalidos' });
            return;
        }
        const user = getUserByEmail(normalizedEmail);

        if (!user) {
            res.status(404).json({ error: 'Usuario no encontrado' });
            return;
        }

        if (!user.password || user.password !== password) {
            res.status(401).json({ error: 'La contrasena no corresponde' });
            return;
        }

        res.status(200).json({
            message: 'Login exitoso',
            user: publicUser(user)
        });
    } catch {
        res.status(400).json({ error: 'Datos invalidos' });
    }
}

module.exports = authRoutes;
