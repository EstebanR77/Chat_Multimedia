async function loginUser(email, password) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        return response.ok ? { success: true, user: data.user } : { success: false, message: data.error };
    } catch {
        return { success: false, message: 'No se pudo conectar con el servidor.' };
    }
}

async function getUsers() {
    try {
        const res = await fetch('/api/users');
        return await res.json();
    } catch {
        return [];
    }
}
