import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { signup } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Validation
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            setLoading(false);
            return;
        }

        if (username.length < 3 || username.length > 20) {
            setError('Username must be 3-20 characters');
            setLoading(false);
            return;
        }

        const result = await signup(email, password, username);

        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20">
                <h1 className="text-4xl font-bold text-white mb-2 text-center">VintageHangout</h1>
                <p className="text-purple-300 text-center mb-8">Create your account</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-white text-sm mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400"
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-white text-sm mb-2">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400"
                            placeholder="cooluser123"
                            minLength={3}
                            maxLength={20}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-white text-sm mb-2">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400"
                                placeholder="••••••••"
                                minLength={8}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                            >
                                {showPassword ? '👁️' : '👁️🗨️'}
                            </button>
                        </div>
                        <p className="text-white/50 text-xs mt-1">Minimum 8 characters</p>
                    </div>

                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                <p className="text-white/60 text-center mt-6">
                    Already have an account?{' '}
                    <Link to="/login" className="text-purple-400 hover:text-purple-300">
                        Login
                    </Link>
                </p>
            </div>
        </div>
    );
}
