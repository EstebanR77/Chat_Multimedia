async function handleLogin() {
    clearError();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showError('Por favor completa todos los campos.');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('El correo no tiene un formato válido.');
        return;
    }

    const dominiosPermitidos = ['@lynx.com', '@lynxstartups.com', '@uniboyaca.edu.co', '@chat.com'];
    const dominioValido = dominiosPermitidos.some(d => email.endsWith(d));
    if (!dominioValido) {
        showError('Solo se permiten correos corporativos (@lynx.com, @uniboyaca.edu.co).');
        return;
    }

    setLoading(true);
    const result = await loginUser(email, password);
    setLoading(false);

    if (result.success) {
        localStorage.setItem('user', JSON.stringify(result.user));
        window.location.href = 'chat.html';
    } else {
        showError(result.message || 'Correo o contraseña incorrectos.');
    }
}

function togglePassword() {
    const input = document.getElementById('password');
    input.type = input.type === 'password' ? 'text' : 'password';
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
});
