const fs   = require('fs');
const path = require('path');
const { sanitizeEmail, sanitizeText, sanitizeUrl } = require('../utils/security');

const DB_PATH = path.join(__dirname, '../data/users.json');

// Devuelve todos los usuarios
const getUsers = () => {
    const data = fs.readFileSync(DB_PATH);
    return JSON.parse(data);
};

// Busca un usuario por correo
const getUserByEmail = (email) => {
    const normalizedEmail = sanitizeEmail(email);
    return getUsers().find(u => u.email && u.email.trim().toLowerCase() === normalizedEmail);
};

// Guarda el arreglo completo
const saveUsers = (users) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
};

const getNextId = (users) => {
    const numericIds = users
        .map(user => Number(user.id))
        .filter(Number.isFinite);
    return numericIds.length ? Math.max(...numericIds) + 1 : 1;
};

const createUser = ({ name, email, password = '', rol = 'user', img = '', provider = 'local' }) => {
    const users = getUsers();
    const id = getNextId(users);
    const safeEmail = sanitizeEmail(email);
    const newUser = {
        id,
        name: sanitizeText(name, 80) || 'Usuario',
        password,
        email: safeEmail,
        rol: sanitizeText(rol, 40) || 'user',
        img: sanitizeUrl(img) || `https://i.pravatar.cc/150?u=${encodeURIComponent(safeEmail)}`,
        provider: sanitizeText(provider, 40) || 'local'
    };

    users.push(newUser);
    saveUsers(users);
    return newUser;
};

const upsertUser = (userData) => {
    const users = getUsers();
    const normalizedEmail = sanitizeEmail(userData.email);
    const index = users.findIndex(user => user.email && user.email.trim().toLowerCase() === normalizedEmail);

    if (index === -1) {
        return createUser({ ...userData, email: normalizedEmail });
    }

    users[index] = {
        ...users[index],
        ...userData,
        name: sanitizeText(userData.name ?? users[index].name, 80) || users[index].name,
        rol: sanitizeText(userData.rol ?? users[index].rol, 40) || users[index].rol,
        img: sanitizeUrl(userData.img ?? users[index].img),
        provider: sanitizeText(userData.provider ?? users[index].provider, 40) || users[index].provider,
        email: normalizedEmail,
        id: users[index].id,
        password: userData.password !== undefined ? userData.password : users[index].password
    };
    saveUsers(users);
    return users[index];
};

module.exports = { getUsers, getUserByEmail, saveUsers, createUser, upsertUser };
