const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/users.json');

// Devuelve todos los usuarios
const getUsers = () => {
    const data = fs.readFileSync(DB_PATH);
    return JSON.parse(data);
};

// Busca un usuario por correo
const getUserByEmail = (email) => {
    const normalizedEmail = email.trim().toLowerCase();
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
    const newUser = {
        id,
        name,
        password,
        email,
        rol,
        img: img || `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`,
        provider
    };

    users.push(newUser);
    saveUsers(users);
    return newUser;
};

const upsertUser = (userData) => {
    const users = getUsers();
    const normalizedEmail = userData.email.trim().toLowerCase();
    const index = users.findIndex(user => user.email && user.email.trim().toLowerCase() === normalizedEmail);

    if (index === -1) {
        return createUser({ ...userData, email: normalizedEmail });
    }

    users[index] = {
        ...users[index],
        ...userData,
        email: normalizedEmail,
        id: users[index].id,
        password: userData.password !== undefined ? userData.password : users[index].password
    };
    saveUsers(users);
    return users[index];
};

module.exports = { getUsers, getUserByEmail, saveUsers, createUser, upsertUser };
