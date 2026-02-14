import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const MemoryLane = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_BACKED_URL}/api/history`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
                });
                const data = await res.json();
                if (data.success) {
                    setLogs(data.logs);
                }
            } catch (err) {
                console.error('Failed to fetch history', err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-8">
            <div className="max-w-4xl mx-auto space-y-12">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition"
                        >
                            <span className="text-lg">←</span>
                        </button>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight uppercase">Memory Lane</h1>
                            <p className="text-purple-400 text-xs font-bold uppercase tracking-widest">Chronicles of your vibes</p>
                        </div>
                    </div>
                </div>

                {/* Logs List */}
                <div className="space-y-6">
                    {loading ? (
                        <div className="text-center py-20 opacity-50">Loading memories...</div>
                    ) : logs.length === 0 ? (
                        <div className="bg-white/5 rounded-3xl p-20 text-center border border-white/5">
                            <div className="text-6xl mb-6 opacity-20">🎞️</div>
                            <h2 className="text-xl font-bold opacity-30">No memories recorded yet</h2>
                            <p className="text-xs opacity-20 mt-2 uppercase tracking-widest font-black">Go create some magic with your partner</p>
                        </div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className="group relative bg-white/5 backdrop-blur-sm p-6 rounded-3xl border border-white/10 hover:border-purple-500/30 transition flex items-center justify-between overflow-hidden">
                                <div className="absolute inset-y-0 left-0 w-1 bg-purple-500 opacity-0 group-hover:opacity-100 transition"></div>
                                <div className="flex items-center space-x-6">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg ${log.zone === 'Music' ? 'bg-purple-600/20 text-purple-400' : 'bg-red-600/20 text-red-400'
                                        }`}>
                                        {log.zone === 'Music' ? '🎵' : '🎬'}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold italic tracking-tight">{log.activity}</h3>
                                        <p className="text-xs font-black text-white/30 uppercase tracking-[0.2em] mt-1">
                                            {log.zone} Zone • {formatDate(log.date)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Quote */}
                <div className="text-center py-12 opacity-20 font-black text-[10px] uppercase tracking-[0.5em]">
                    VINTAGE HANGOUT • EST. 2024
                </div>
            </div>
        </div>
    );
};

export default MemoryLane;
