# Lynx Startups Chat

Sistema de chat instantáneo desarrollado para **Lynx Startups Inc.**, una empresa tecnológica de trabajo remoto que necesita centralizar la comunicación de su equipo en canales temáticos, sin depender de Slack o WhatsApp.

---

## 1. Cómo inicializar el proyecto

### Requisitos previos
- Tener **Node.js** instalado ([descargar aquí](https://nodejs.org))

### Pasos

**1. Descomprimir y abrir el proyecto en Visual Studio Code**

**2. Desbloquear permisos de ejecución de scripts (solo Windows)**

Abrir la terminal de VS Code y ejecutar:
```
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
> Esto solo aplica a la ventana actual. No cerrar la terminal después de esto.

**3. Instalar dependencias**
```
npm install
```

**4. Configurar variables de entorno**

Duplicar el archivo `.env.example`, renombrarlo a `.env` y completar los valores requeridos.

**5. Levantar el servidor**
```
node src/server.js
```

**6. Abrir en el navegador**
```
http://localhost:3000
```

---

## 2. Cómo se organiza el proyecto

```
/
├── package.json          → Dependencias y scripts de Node
├── src/                  → Código del servidor (backend)
│   ├── server.js         → Servidor principal HTTP + WebSocket
│   ├── data/
│   │   ├── users.json            → Base de datos local de usuarios
│   │   └── deleted-items.json    → Registro de canales/proyectos eliminados
│   ├── models/
│   │   ├── users.js              → Funciones para leer y modificar users.json
│   │   └── deletedItems.js       → Funciones para manejar elementos eliminados
│   ├── routes/
│   │   ├── auth.js               → Ruta /api/login (autenticación)
│   │   └── users.js              → Ruta /api/users (lista de usuarios)
│   ├── utils/
│   │   ├── broadcast.js          → Función para enviar mensajes a todos los clientes
│   │   └── security.js           → Funciones de sanitización y seguridad
│   └── web/
│       └── chat.js               → Lógica del WebSocket en el servidor
└── public/               → Archivos del cliente (frontend)
    ├── login.html        → Pantalla de inicio de sesión
    ├── chat.html         → Pantalla principal del chat
    ├── css/
    │   ├── login.css     → Estilos de la pantalla de login
    │   └── chat.css      → Estilos del chat, sidebar, mensajes e input
    └── js/
        ├── login.js              → Lógica de interacción en el login
        ├── chat.js               → Lógica principal del chat en el navegador
        ├── services/
        │   └── api.js            → Llamadas a la API REST del servidor
        ├── ui/
        │   ├── chatUI.js         → Funciones para actualizar la interfaz del chat
        │   └── loginUI.js        → Funciones para actualizar la interfaz del login
        └── web/
            └── chatSocket.js     → Manejo del WebSocket desde el cliente
```

---

## 3. Flujo de la aplicación

```
Login → Seleccionar canal → Enviar/recibir mensajes en tiempo real
```

1. El usuario ingresa su correo y contraseña en `login.html`
2. El servidor valida las credenciales mediante `/api/login`
3. Si es exitoso, se redirige a `chat.html`
4. El chat se conecta al servidor vía **WebSocket**
5. El usuario puede navegar entre proyectos y canales
6. Los mensajes se envían al servidor y se retransmiten a todos los conectados en ese canal

---

## 4. Tecnologías usadas

| Tecnología | Uso |
|---|---|
| Node.js | Servidor backend |
| Express | Manejo de rutas HTTP |
| WebSocket (ws) | Comunicación en tiempo real |
| Passport.js | Autenticación con Google OAuth |
| HTML / CSS / JS | Interfaz del usuario |
