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
    return getUsers().find(u => u.email === email);
};

// Guarda el arreglo completo
const saveUsers = (users) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
};

module.exports = { getUsers, getUserByEmail, saveUsers };
