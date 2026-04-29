async function handleLogin() {
    clearError();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showError('Por favor completa todos los campos.');
        return;
    }

    setLoading(true);
    const result = await loginUser(email, password);
    setLoading(false);

    if (result.success) {
        localStorage.setItem('user', JSON.stringify(result.user));
        window.location.href = 'chat.html';
    } else {
        showError(result.message || 'Correo o contrasena incorrectos.');
    }
}

function togglePassword() {
    const input = document.getElementById('password');
    input.type = input.type === 'password' ? 'text' : 'password';
}

// Tambien permite presionar Enter para ingresar
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
});
