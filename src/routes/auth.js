const { getUserByEmail } = require('../models/users');

const publicUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    rol: user.rol,
    img: user.img,
    provider: user.provider
});

function authRoutes(req, res) {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            res.status(400).json({ error: 'Correo y contrasena son obligatorios' });
            return;
        }

        const normalizedEmail = email.trim().toLowerCase();
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
