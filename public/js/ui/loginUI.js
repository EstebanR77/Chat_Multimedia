function showError(msg) {
    const el = document.getElementById('errorMsg');
    el.textContent = msg;
}

function clearError() {
    document.getElementById('errorMsg').textContent = '';
}

function setLoading(on) {
    const btn = document.querySelector('.btn-ingresar');
    btn.textContent = on ? 'Verificando...' : 'Ingresar';
    btn.disabled = on;
}
