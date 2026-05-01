require("dotenv").config();

const express        = require("express");
const session        = require("express-session");
const passport       = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const path           = require("path");
const WebSocket      = require("ws");
const authRoutes     = require("./routes/auth");
const userRoutes     = require("./routes/users");
const setupChat      = require("./web/chat");
const { upsertUser } = require("./models/users");

const app = express();

// ─────────────────────────────────────────────
// 0. CONFIANZA EN PROXY REVERSO (para ngrok)
// ─────────────────────────────────────────────
app.set('trust proxy', 1);

const toSessionUser = (user) => ({
    id:       user.id,
    name:     user.name,
    email:    user.email,
    img:      user.img,
    avatar:   user.avatar || user.img,
    rol:      user.rol,
    provider: user.provider,
});

const getGoogleCallbackURL = (req) => {
    if (process.env.GOOGLE_CALLBACK_URL) {
        return process.env.GOOGLE_CALLBACK_URL.trim();
    }

    const protocol = req.get("x-forwarded-proto") || req.protocol;
    const host = req.get("x-forwarded-host") || req.get("host");
    return `${protocol}://${host}/auth/google/callback`;
};

// ─────────────────────────────────────────────
// 1. CONFIGURACIÓN DE SESIÓN
// ─────────────────────────────────────────────
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 horas
        httpOnly: true,               // No accesible desde JS (seguridad)
        secure: 'auto',
        sameSite: 'lax',
    },
}));

// ─────────────────────────────────────────────
// 2. PASSPORT – serialización del usuario
// ─────────────────────────────────────────────
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ─────────────────────────────────────────────
// 3. ESTRATEGIA DE GOOGLE OAuth 2.0
// ─────────────────────────────────────────────
passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  "/auth/google/callback",
    passReqToCallback: true,
},
(req, accessToken, refreshToken, profile, done) => {
    const email = profile.emails[0].value.trim().toLowerCase();
    const img = profile.photos[0].value;
    const user = upsertUser({
        name:     profile.displayName,
        email,
        img,
        avatar:   img,
        rol:      "Usuario Google",
        provider: "google",
    });
    return done(null, toSessionUser(user));
}));

app.use(passport.initialize());
app.use(passport.session());

// ─────────────────────────────────────────────
// 4. ARCHIVOS ESTÁTICOS Y JSON
// ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.json());

// ─────────────────────────────────────────────
// 4.1 CORS – Permitir ngrok
// ─────────────────────────────────────────────
app.use((req, res, next) => {
    const origin = req.headers.origin;
    // Permitir localhost, 127.0.0.1 y cualquier subdominio de ngrok
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('.ngrok'))) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    next();
});

// ─────────────────────────────────────────────
// 5. RUTAS DE AUTENTICACIÓN GOOGLE
// ─────────────────────────────────────────────

// Inicia el flujo OAuth → redirige a Google
app.get("/auth/google", (req, res, next) => {
    const callbackURL = getGoogleCallbackURL(req);
    console.log(`Google OAuth callback: ${callbackURL}`);
    passport.authenticate("google", { scope: ["profile", "email"], callbackURL })(req, res, next);
});

// Google regresa aquí con el code
app.get("/auth/google/callback", (req, res, next) => {
    const callbackURL = getGoogleCallbackURL(req);
    passport.authenticate("google", { failureRedirect: "/login.html?error=auth_failed", callbackURL })(req, res, next);
},
    (req, res) => {
        // Login exitoso → redirige al chat
        res.redirect("/chat.html");
    }
);

// Cerrar sesión (servidor + cliente)
app.get("/auth/logout", (req, res) => {
    req.logout(() => {
        req.session.destroy(() => {
            res.redirect("/login.html");
        });
    });
});

// ─────────────────────────────────────────────
// 6. API – usuario actual (igual que el profe)
// ─────────────────────────────────────────────
app.get("/api/me", (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ authenticated: true, user: req.user });
    } else {
        res.json({ authenticated: false });
    }
});

// ─────────────────────────────────────────────
// 7. RUTAS API DEL CHAT (login normal + usuarios)
// ─────────────────────────────────────────────
app.post("/api/login", authRoutes);
app.use("/api/users",  userRoutes);

// Ruta raíz
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/login.html"));
});

// ─────────────────────────────────────────────
// 8. SERVIDOR HTTP + WEBSOCKET
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Rutas disponibles:`);
    console.log(`   GET  /                      → Login`);
    console.log(`   GET  /auth/google           → Inicia OAuth con Google`);
    console.log(`   GET  /auth/google/callback  → Callback de Google`);
    console.log(`   GET  /auth/logout           → Cierra sesión`);
    console.log(`   GET  /api/me               → Usuario autenticado`);
    console.log(`   POST /api/login            → Login normal`);
});

const wss = new WebSocket.Server({ server });
setupChat(wss);
