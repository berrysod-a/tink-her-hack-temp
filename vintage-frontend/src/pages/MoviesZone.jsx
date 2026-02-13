import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const MoviesZone = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [urlInput, setUrlInput] = useState('');
    const [videoId, setVideoId] = useState('');
    const [player, setPlayer] = useState(null);
    const socketRef = useRef(null);
    const playerReady = useRef(false);

    const getYouTubeVideoId = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    useEffect(() => {
        if (!user) return;

        socketRef.current = io('http://localhost:3000');
        socketRef.current.emit('join-room', { roomId: user.currentRoomId, userId: user.id });

        socketRef.current.on('video-action-received', ({ action, timestamp, videoId: vid }) => {
            if (vid && vid !== videoId) setVideoId(vid);
            if (playerReady.current && player) {
                if (action === 'play') {
                    player.seekTo(timestamp);
                    player.playVideo();
                } else if (action === 'pause') {
                    player.pauseVideo();
                }
            }
        });

        // Use global loader from App.jsx
        if (window.loadYouTubeAPI) {
            window.loadYouTubeAPI().then(() => initializePlayer());
        }

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
            if (player) {
                try { player.destroy(); } catch (e) { }
            }
        };
    }, [user, videoId]);

    const initializePlayer = () => {
        if (playerReady.current) return;

        new window.YT.Player('movie-player', {
            height: '360',
            width: '640',
            videoId: videoId,
            events: {
                onReady: (e) => {
                    setPlayer(e.target);
                    playerReady.current = true;
                }
            }
        });
    };

    const handleLoadVideo = (e) => {
        e.preventDefault();
        const id = getYouTubeVideoId(urlInput);
        if (id) {
            setVideoId(id);
            if (playerReady.current && player) player.loadVideoById(id);
            socketRef.current.emit('video-action', { roomId: user.currentRoomId, action: 'load', videoId: id, timestamp: 0 });

            // Log to Memory Lane
            fetch('http://localhost:3000/api/history/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({ zone: 'Movies', activity: `Watched YouTube video ${id}` })
            }).catch(err => console.error('Failed to log movie', err));
        }
    };

    const sendAction = (action) => {
        if (!playerReady.current || !player) return;
        const time = player.getCurrentTime();
        socketRef.current.emit('video-action', {
            roomId: user.currentRoomId,
            action,
            timestamp: time,
            videoId: videoId
        });
        if (action === 'play') player.playVideo();
        if (action === 'pause') player.pauseVideo();
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white p-8 flex flex-col items-center space-y-8 font-sans">
            <div className="w-full max-w-4xl flex justify-between items-center border-b border-white/10 pb-6">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter italic">Cinema Zone</h1>
                    <p className="text-red-500 text-[10px] font-black uppercase tracking-[0.4em] mt-1 opacity-60">Synced Watch Party</p>
                </div>
                <button onClick={() => navigate('/dashboard')} className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition shadow-xl">Exit Theater</button>
            </div>

            <form onSubmit={handleLoadVideo} className="w-full max-w-4xl flex gap-3 bg-white/5 p-2 rounded-[30px] border border-white/5 backdrop-blur-md shadow-2xl">
                <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="PASTE YOUTUBE URL HERE..."
                    className="flex-1 bg-transparent px-8 py-4 text-sm font-bold focus:outline-none placeholder:text-white/10 uppercase tracking-widest"
                />
                <button className="bg-red-600 hover:bg-red-500 px-10 py-4 rounded-[22px] font-black text-xs uppercase tracking-widest transition shadow-lg shadow-red-600/20">LOAD</button>
            </form>

            <div className="relative group w-full max-w-4xl flex justify-center">
                <div className="bg-black rounded-[50px] overflow-hidden border-[12px] border-white/5 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] relative aspect-video w-full max-w-3xl flex items-center justify-center">
                    <div id="movie-player" className="w-full h-full"></div>

                    {!videoId && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-center p-12">
                            <div className="text-8xl mb-8 animate-pulse">🍿</div>
                            <h2 className="text-2xl font-black italic uppercase tracking-[0.2em] text-white/20">The Screen is Dark</h2>
                            <p className="text-[10px] text-white/10 font-black uppercase tracking-[0.5em] mt-4">Load a frequency to begin the projection</p>
                        </div>
                    )}
                </div>
            </div>

            {videoId && (
                <div className="flex gap-4 animate-in slide-in-from-bottom-4 duration-500">
                    <button onClick={() => sendAction('play')} className="px-12 py-5 bg-white text-black rounded-3xl font-black text-xs uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-2xl">PLAY SYNC</button>
                    <button onClick={() => sendAction('pause')} className="px-12 py-5 bg-white/5 border border-white/10 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] hover:bg-white/10 transition-all active:scale-95">PAUSE SYNC</button>
                </div>
            )}

            <div className="text-[9px] text-white/10 font-black uppercase tracking-[1em] py-12 italic opacity-40">
                LUMIERE-SYNC TECHNOLOGY • EST. 1994
            </div>
        </div>
    );
};

export default MoviesZone;
