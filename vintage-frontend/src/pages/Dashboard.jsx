import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api } from '../utils/api';

// Debugging Checklist:
// - [x] Fix `Dashboard.jsx` null pointer on `room.partner`
// - [x] Add persistence to `server.js` (users, rooms, logs)
// - [x] Fix YouTube SDK race conditions in `App.jsx`
// - [x] Fix "Drop the Needle" playback logic in `Dashboard.jsx`

export default function Dashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [view, setView] = useState('initial'); // initial, creating, joining, room
    const [room, setRoom] = useState(null);
    const [inviteCode, setInviteCode] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [error, setError] = useState('');
    const [showExitModal, setShowExitModal] = useState(false);
    const [exitNote, setExitNote] = useState('');
    const [isExiting, setIsExiting] = useState(false);

    // Music State
    const [videoId, setVideoId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [queue, setQueue] = useState([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTrackTitle, setCurrentTrackTitle] = useState('No track selected');
    const [currentArtist, setCurrentArtist] = useState('VintageHangout');

    const socketRef = useRef(null);
    const playerRef = useRef(null);
    const timerRef = useRef(null);
    const playerReady = useRef(false);

    // Initialize Socket & Restore State
    useEffect(() => {
        if (!user) return;

        socketRef.current = io(VITE_BACKEND_URL);

        socketRef.current.on('connect', () => {
            console.log('✅ Socket connected:', socketRef.current.id);
            if (user.currentRoomId) {
                socketRef.current.emit('join-room', {
                    roomId: user.currentRoomId,
                    userId: user.id
                });
            }
        });

        socketRef.current.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error);
        });

        socketRef.current.on('disconnect', () => {
            console.log('❌ Socket disconnected');
        });

        socketRef.current.on('partner-joined', (data) => {
            console.log('👤 Partner joined:', data);
            setRoom(prev => ({
                ...prev,
                partner: { id: data.partnerId, username: data.partnerUsername }
            }));
            setView('room');
        });

        socketRef.current.on('partner-connected', (data) => {
            console.log('👤 Partner connected:', data);
            setRoom(prev => ({ ...prev, partnerId: data.userId, partnerUsername: data.username }));
        });

        socketRef.current.on('navigate-to', ({ zone }) => {
            console.log('🚀 Navigating to zone:', zone);
            navigate(zone);
        });

        socketRef.current.on('partner-disconnected', () => {
            setRoom(prev => ({ ...prev, partner: null }));
        });

        // Music Sync Listeners
        socketRef.current.on('play-song', ({ videoId: vid, currentTime: time }) => {
            setVideoId(vid);
            setIsPlaying(true);
            if (playerReady.current && playerRef.current) {
                if (playerRef.current.getVideoData?.().video_id !== vid) {
                    playerRef.current.loadVideoById(vid, time);
                } else {
                    playerRef.current.seekTo(time);
                    playerRef.current.playVideo();
                }
            }
        });

        socketRef.current.on('pause-song', ({ currentTime: time }) => {
            setIsPlaying(false);
            if (playerReady.current && playerRef.current) {
                playerRef.current.seekTo(time);
                playerRef.current.pauseVideo();
            }
        });

        socketRef.current.on('add-to-queue', ({ track }) => {
            setQueue(prev => [...prev, track]);
        });

        socketRef.current.on('skip-song', () => {
            handleNextInQueue();
        });

        socketRef.current.on('remove-from-queue', ({ index }) => {
            setQueue(prev => prev.filter((_, i) => i !== index));
        });

        // Use global loader from App.jsx
        if (window.loadYouTubeAPI) {
            window.loadYouTubeAPI().then(() => initializePlayer());
        }

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
            if (playerRef.current) {
                try { playerRef.current.destroy(); } catch (e) { }
            }
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [user]);

    // Check if user is already in a room on load
    useEffect(() => {
        if (user?.currentRoomId) {
            checkExistingRoom(user.currentRoomId);
        }
    }, [user]);

    const initializePlayer = () => {
        if (playerReady.current) return;

        playerRef.current = new window.YT.Player('dashboard-player', {
            height: '0',
            width: '0',
            videoId: videoId,
            playerVars: { 'autoplay': 0, 'controls': 0, 'enablejsapi': 1 },
            events: {
                'onReady': () => {
                    playerReady.current = true;
                    startTracking();
                },
                'onStateChange': (event) => {
                    if (event.data === window.YT.PlayerState.PLAYING) {
                        setIsPlaying(true);
                        const data = playerRef.current.getVideoData();
                        setCurrentTrackTitle(data.title || 'Unknown Track');
                        setCurrentArtist(data.author || 'YouTube Artist');
                        setDuration(playerRef.current.getDuration());
                    }
                    if (event.data === window.YT.PlayerState.PAUSED) setIsPlaying(false);
                    if (event.data === window.YT.PlayerState.ENDED) {
                        handleNextInQueue();
                    }
                }
            }
        });
    };

    const startTracking = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            if (playerReady.current && playerRef.current && playerRef.current.getCurrentTime) {
                setCurrentTime(playerRef.current.getCurrentTime());
            }
        }, 1000);
    };

    const checkExistingRoom = async (roomId) => {
        try {
            const data = await api.getRoom(roomId);
            if (data.success) {
                setRoom(data.room);
                if (data.room.partner) {
                    setView('room');
                } else if (data.room.createdBy === user.id) {
                    setInviteCode(data.room.inviteCode);
                    setView('creating');
                } else {
                    setView('room'); // Joined as partner
                }
            }
        } catch (err) {
            console.error('Failed to restore room', err);
        }
    };

    const handleCreateRoom = async () => {
        setError('');
        try {
            const data = await api.createRoom();
            if (data.success) {
                setRoom({ id: data.roomId, inviteCode: data.inviteCode, creator: user, partner: null });
                setInviteCode(data.inviteCode);
                setView('creating');
                if (socketRef.current) {
                    socketRef.current.emit('join-room', { roomId: data.roomId, userId: user.id });
                }
            }
        } catch (err) {
            setError('Failed to create room');
        }
    };

    const handleJoinRoom = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const data = await api.joinRoom(joinCode);
            if (data.success) {
                await checkExistingRoom(data.roomId);
                if (socketRef.current) {
                    socketRef.current.emit('join-room', { roomId: data.roomId, userId: user.id });
                }
            } else {
                setError(data.error || 'Failed to join room');
            }
        } catch (err) {
            setError(err.message || 'Failed to join room');
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKED_URL}/api/youtube/search?q=${encodeURIComponent(searchQuery)}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
            });
            const data = await res.json();
            if (data.success) setSearchResults(data.results);
        } catch (err) {
            console.error('Search failed', err);
        } finally {
            setSearching(false);
        }
    };

    const addToQueue = (track) => {
        setQueue(prev => [...prev, track]);
        if (socketRef.current) {
            socketRef.current.emit('add-to-queue', { roomId: user.currentRoomId, track, userId: user.id });
        }
        setSearchResults([]);
        setSearchQuery('');
    };

    const removeFromQueue = (index) => {
        setQueue(prev => prev.filter((_, i) => i !== index));
        if (socketRef.current) {
            socketRef.current.emit('remove-from-queue', { roomId: user.currentRoomId, index, userId: user.id });
        }
    };

    const handleNextInQueue = () => {
        if (queue.length > 0) {
            const nextTrack = queue[0];
            setVideoId(nextTrack.id);
            setCurrentTrackTitle(nextTrack.title);
            setCurrentArtist(nextTrack.author);
            setQueue(prev => prev.slice(1));
            setIsPlaying(true);
            if (playerReady.current && playerRef.current) {
                playerRef.current.loadVideoById(nextTrack.id);
            }
        } else {
            setIsPlaying(false);
        }
    };

    const selectSong = (track) => {
        // Instant play if nothing is playing, else add to queue
        if (!videoId || (!isPlaying && queue.length === 0)) {
            setVideoId(track.id);
            setCurrentTrackTitle(track.title);
            setCurrentArtist(track.author);
            setSearchResults([]);
            setSearchQuery('');
            setIsPlaying(false); // Wait for needle drop
        } else {
            addToQueue(track);
        }
    };

    const toggleVinylPlayback = () => {
        if (!videoId || !playerReady.current || !playerRef.current) return;
        const time = playerRef.current.getCurrentTime();

        if (isPlaying) {
            playerRef.current.pauseVideo();
            socketRef.current.emit('pause-song', { roomId: user.currentRoomId, currentTime: time, userId: user.id });
        } else {
            // CRITICAL FIX: Ensure the video is actually loaded before trying to play
            const loadedId = playerRef.current.getVideoData?.().video_id;
            if (loadedId !== videoId) {
                playerRef.current.loadVideoById(videoId, time);
            } else {
                playerRef.current.playVideo();
            }
            socketRef.current.emit('play-song', { roomId: user.currentRoomId, videoId, currentTime: time, userId: user.id });
        }
        setIsPlaying(!isPlaying);
    };

    const handleLogout = () => {
        setIsExiting(true);
        setTimeout(() => {
            logout();
            navigate('/login');
        }, 3000); // Show "The End" for 3s
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(inviteCode);
    };

    return (
        <div className="min-h-screen bg-[#050505] p-8 overflow-hidden relative font-sans">
            {/* The End Animation Overlay */}
            {isExiting && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in fade-in duration-1000">
                    <div className="text-white text-9xl font-black italic tracking-tighter animate-pulse drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">The End.</div>
                    <div className="mt-8 text-white/20 font-black uppercase tracking-[1em] text-xs">VintageHangout • 1994</div>
                </div>
            )}

            <div id="dashboard-player"></div>

            <div className="max-w-6xl mx-auto h-full flex flex-col relative z-10">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center space-x-6">
                        <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center font-black text-2xl shadow-2xl italic tracking-tighter hover:bg-white/10 transition-colors text-purple-400">ME</div>
                        <div>
                            <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Monroe Experience</h1>
                            <p className="text-purple-300 mt-2 font-bold">Welcome, {user?.username}!</p>
                        </div>
                    </div>

                    {/* Integrated Search Bar */}
                    {room && (
                        <div className="relative flex-1 max-w-sm mx-12">
                            <form onSubmit={handleSearch} className="flex items-center space-x-2 bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl group focus-within:border-purple-500/50 transition-all">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="FIND FREQUENCY..."
                                    className="bg-transparent px-6 py-2 w-full text-[10px] font-black focus:outline-none placeholder:text-white/10 text-white uppercase tracking-[0.3em]"
                                />
                                <button className="bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded-xl font-black text-[10px] tracking-widest transition shadow-lg shadow-purple-600/20 active:scale-95">SYNC</button>
                            </form>
                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-4 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-[32px] shadow-[0_30px_100px_-15px_rgba(0,0,0,0.8)] overflow-hidden z-[100] animate-in fade-in slide-in-from-top-4 duration-500">
                                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2">
                                        {searchResults.map((result) => (
                                            <div
                                                key={result.id}
                                                onClick={() => selectSong(result)}
                                                className="flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer transition-all border-b border-white/5 last:border-0 rounded-2xl group relative overflow-hidden"
                                            >
                                                <div className="relative w-20 aspect-video rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                                                    <img src={result.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                                                    <div className="absolute inset-0 bg-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <span className="text-xl">💿</span>
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-black text-white truncate italic tracking-tight">{result.title}</p>
                                                    <p className="text-[8px] text-purple-400 font-black uppercase tracking-[0.3em] mt-1.5 opacity-60">{result.author}</p>
                                                </div>
                                                <button className="opacity-0 group-hover:opacity-100 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-all">
                                                    <span className="text-xs">➕</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex items-center space-x-6">
                        <button onClick={() => navigate('/history')} className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 hover:text-white transition italic">Logs</button>
                        <button onClick={() => setShowExitModal(true)} className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition text-[10px] font-black uppercase tracking-widest shadow-xl">Logout</button>
                    </div>
                </div>

                {/* Exit Ritual Modal */}
                {showExitModal && (
                    <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
                        <div className="bg-[#0a0a0a] border border-white/10 rounded-[50px] p-12 max-w-sm w-full space-y-8 animate-in zoom-in duration-500 shadow-2xl">
                            <div className="text-center space-y-3">
                                <div className="text-6xl mb-4">📼</div>
                                <h2 className="text-3xl font-black italic tracking-tighter text-white">Final Note</h2>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Chronicle your frequency</p>
                            </div>
                            <textarea
                                value={exitNote}
                                onChange={(e) => setExitNote(e.target.value)}
                                placeholder="Write something before the tape ends..."
                                className="w-full bg-black/60 border border-white/5 rounded-3xl p-6 text-sm text-white focus:outline-none focus:border-purple-500/50 h-32 resize-none placeholder:text-white/10 font-bold italic"
                            ></textarea>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setShowExitModal(false)} className="py-4 bg-white/5 text-white/30 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-white/10 transition">BACK</button>
                                <button onClick={handleLogout} className="py-4 bg-purple-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-purple-500 transition shadow-2xl shadow-purple-600/30">END SPIN</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-1 flex flex-col items-center justify-center space-y-16">
                    {/* Top Status */}
                    <div className="w-full max-w-sm">
                        {!room ? (
                            <div className="bg-white/5 backdrop-blur-2xl rounded-[40px] p-8 border border-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] text-center space-y-6">
                                {view === 'initial' || view === 'creating' ? (
                                    <button onClick={handleCreateRoom} className="w-full py-5 bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-2xl font-black text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-2xl tracking-[0.2em] italic">START ROOM</button>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="space-y-1">
                                            <h2 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.4em]">Freq Code</h2>
                                            <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest italic">Share this with your partner</p>
                                        </div>
                                        <div onClick={copyToClipboard} className="bg-black/60 py-8 rounded-3xl border border-purple-500/20 cursor-pointer group hover:border-purple-500/50 transition-all relative overflow-hidden active:scale-98">
                                            <span className="relative z-10 text-5xl font-mono font-black text-white tracking-[0.3em] pl-4">{inviteCode}</span>
                                            <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        </div>
                                        <p className="text-[8px] text-white/10 font-black uppercase tracking-[0.5em] animate-pulse">Waiting for connection...</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center space-y-3">
                                {room.partnerId ? (
                                    <div className="inline-flex px-4 py-1.5 rounded-full border border-green-500/20 bg-green-500/5 text-green-400 font-black uppercase tracking-[0.3em] text-[8px] animate-pulse">
                                        Status: Connected
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="bg-black/60 py-6 rounded-3xl border border-purple-500/20 cursor-pointer">
                                            <span className="text-3xl font-mono font-black text-white tracking-[0.2em]">{inviteCode}</span>
                                        </div>
                                        <div className="inline-flex px-4 py-1.5 rounded-full border border-yellow-500/20 bg-yellow-500/5 text-yellow-400 font-black uppercase tracking-[0.3em] text-[8px]">
                                            Status: Waiting for Partner
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Center Vinyl */}
                    <div className="relative group perspective-1000">
                        <div className={`absolute inset-0 rounded-full blur-[100px] transition-all duration-1000 ${isPlaying ? 'bg-purple-600/30 animate-pulse scale-110' : 'bg-white/5 opacity-20'}`}></div>

                        <div
                            onClick={toggleVinylPlayback}
                            className={`relative w-[360px] h-[360px] md:w-[500px] md:h-[500px] rounded-full bg-[#030303] flex items-center justify-center shadow-[0_0_120px_rgba(0,0,0,1)] border-[15px] border-[#0a0a0a] cursor-pointer transition-all duration-1000 
                                ${room ? 'opacity-100 hover:scale-[1.03] active:scale-95' : 'opacity-10 grayscale pointer-events-none scale-95'}
                                ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}
                            `}
                        >
                            {[...Array(15)].map((_, i) => (
                                <div key={i} className="absolute rounded-full border border-white/5" style={{ inset: `${(i + 1) * 6}%` }}></div>
                            ))}
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent rounded-full rotate-45 pointer-events-none"></div>

                            <div className="relative w-[120px] h-[120px] md:w-[160px] md:h-[160px] bg-gradient-to-br from-[#c0c0c0] via-[#ffffff] to-[#a0a0a0] rounded-full border-[8px] border-black flex flex-col items-center justify-center shadow-2xl z-10 transition-transform duration-700">
                                <span className="text-black font-black text-[12px] md:text-sm tracking-tighter italic leading-none">HIGH FIDELITY</span>
                                <div className="w-3 h-3 bg-black rounded-full mt-3"></div>
                            </div>
                        </div>

                        {/* Drop the Needle Pointer */}
                        {videoId && !isPlaying && (
                            <div className="absolute -right-24 top-1/2 -translate-y-1/2 animate-bounce flex flex-col items-center opacity-80">
                                <span className="text-5xl drop-shadow-2xl">⚡</span>
                                <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] mt-4 italic bg-purple-600 px-4 py-2 rounded-full">Drop it</p>
                            </div>
                        )}
                    </div>

                    {/* Navigation Zone */}
                    <div className="w-full max-lg max-w-lg flex flex-col gap-6">
                        {!room ? (
                            <div className="pt-8">
                                {view === 'joining' ? (
                                    <form onSubmit={handleJoinRoom} className="space-y-6 animate-in slide-in-from-bottom-6 duration-700">
                                        <input
                                            type="text"
                                            value={joinCode}
                                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                            placeholder="XXXXXX"
                                            className="w-full bg-black/80 border-2 border-white/5 rounded-[30px] px-8 py-8 text-center text-5xl font-mono text-white tracking-[0.4em] font-black focus:outline-none focus:border-purple-500/50 shadow-2xl"
                                            maxLength={6}
                                        />
                                        <button className="w-full py-6 bg-white text-black rounded-[25px] font-black tracking-[0.3em] text-xs">CONNECT FREQUENCY</button>
                                        <button onClick={() => setView('initial')} type="button" className="w-full text-[9px] text-white/20 hover:text-white font-black uppercase tracking-[0.5em]">← Go Back</button>
                                    </form>
                                ) : (
                                    <button onClick={() => setView('joining')} className="w-full py-6 bg-white/5 border border-white/10 text-white rounded-[25px] font-black hover:bg-white/10 transition-all tracking-[0.3em] text-xs shadow-2xl uppercase italic">Join Existing Room</button>
                                )}
                            </div>
                        ) : (
                            <div className="bg-white/5 backdrop-blur-3xl p-8 rounded-[40px] border border-white/10 shadow-2xl space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => navigate('/music')}
                                        className="py-5 bg-purple-600 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-3xl hover:scale-[1.03] transition-all"
                                    >
                                        Music Zone
                                    </button>
                                    <button
                                        onClick={() => navigate('/games')}
                                        className="py-5 bg-white text-black font-black text-[11px] uppercase tracking-[0.2em] rounded-3xl hover:scale-[1.03] transition-all"
                                    >
                                        Games Zone
                                    </button>
                                </div>
                                <button
                                    onClick={() => navigate('/movies')}
                                    className="w-full py-5 bg-white/5 border border-white/10 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-3xl hover:bg-white/10 transition-all"
                                >
                                    Theater Mode
                                </button>
                                <div className="pt-4 flex justify-center">
                                    <button onClick={() => setView('initial')} className="text-[9px] font-black text-white/10 uppercase tracking-[0.4em] hover:text-purple-400">Emergency Reset</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mini Queue (Glassmorphic) */}
                {
                    queue.length > 0 && (
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
                            <div className="flex justify-between items-center mb-6 px-2">
                                <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] italic">Up Next</h3>
                                <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest bg-purple-400/10 px-3 py-1 rounded-full">{queue.length} Tracks</span>
                            </div>
                            <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                {queue.map((track, i) => (
                                    <div key={i} className="flex items-center gap-4 p-3 bg-white/5 border border-white/5 rounded-2xl group hover:border-white/20 transition-all">
                                        <div className="w-10 h-10 rounded-xl bg-black border border-white/10 flex items-center justify-center font-mono text-[10px] text-white/20 group-hover:text-purple-400 transition-colors">
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold text-white truncate italic">{track.title}</p>
                                            <p className="text-[8px] text-white/20 font-black uppercase tracking-[0.2em] mt-1">{track.author}</p>
                                        </div>
                                        <button onClick={() => removeFromQueue(i)} className="opacity-0 group-hover:opacity-100 text-[10px] hover:text-red-500 transition-all">✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                }
                <div className="mt-12 text-center opacity-10">
                    <p className="text-[10px] font-black uppercase tracking-[1em] italic">Vintage Reality Matrix • 94.1 FM</p>
                </div>
            </div>
        </div>
    );
}
