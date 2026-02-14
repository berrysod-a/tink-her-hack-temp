const API_URL = `${import.meta.env.VITE_BACKEND_URL}/api`;

const getHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

export const api = {
    // Auth
    login: async (email, password) => {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ email, password })
        });
        return res.json();
    },

    signup: async (email, password, username) => {
        const res = await fetch(`${API_URL}/auth/signup`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ email, password, username })
        });
        return res.json();
    },

    verify: async () => {
        const res = await fetch(`${API_URL}/auth/verify`, {
            headers: getHeaders()
        });
        return res.json();
    },

    // Rooms
    createRoom: async () => {
        const res = await fetch(`${API_URL}/rooms/create`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    },

    joinRoom: async (inviteCode) => {
        const res = await fetch(`${API_URL}/rooms/join`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ inviteCode })
        });
        return res.json();
    },

    getRoom: async (roomId) => {
        const res = await fetch(`${API_URL}/rooms/${roomId}`, {
            headers: getHeaders()
        });
        return res.json();
    }
};
