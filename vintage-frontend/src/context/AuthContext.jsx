import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('auth_token'));

    useEffect(() => {
        if (token) {
            verifyToken();
        } else {
            setLoading(false);
        }
    }, [token]);

    const verifyToken = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/verify`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                setUser(data.user);
            } else {
                localStorage.removeItem('auth_token');
                setToken(null);
            }
        } catch (error) {
            console.error('Token verification failed:', error);
            localStorage.removeItem('auth_token');
            setToken(null);
        } finally {
            setLoading(false);
        }
    };

    const signup = async (email, password, username) => {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, username })
        });

        const data = await res.json();

        if (data.success) {
            localStorage.setItem('auth_token', data.token);
            setToken(data.token);
            setUser(data.user);
            return { success: true };
        }

        return { success: false, error: data.error };
    };

    const login = async (email, password) => {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (data.success) {
            localStorage.setItem('auth_token', data.token);
            setToken(data.token);
            setUser(data.user);
            return { success: true };
        }

        return { success: false, error: data.error };
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, signup, login, logout, token, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};
