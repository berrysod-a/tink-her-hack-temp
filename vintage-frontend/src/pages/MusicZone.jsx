import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const MusicZone = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [queue, setQueue] = useState([]);
    const [currentSong, setCurrentSong] = useState(null);
    const [player, setPlayer] = useState(null);
    const socketRef = useRef(null);
    const playerReady = useRef(false);

    // Part 1: Search YouTube (Invidious API)
    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        try {
            const response = await fetch(
                `https://invidious.io.lol/api/v1/search?q=${encodeURIComponent(searchQuery)}&type=video`
            );
            const data = await response.json();
            setSearchResults(data.slice(0, 5));
        } catch (error) {
            console.error('Search failed', error);
        }
    };

    // Part 2: YouTube Player Integration
    useEffect(() => {
        if (!user) return;

        socketRef.current = io('http://localhost:3000');
        socketRef.current.emit('join-room', { roomId: user.currentRoomId, userId: user.id });

        socketRef.current.on('play-video', ({ videoId }) => {
            if (playerReady.current && player) {
                player.loadVideoById(videoId);
                player.playVideo();
                // Find and set current song info from search results or queue if possible
                const songInfo = searchResults.find(s => s.videoId === videoId) || queue.find(s => s.videoId === videoId);
                if (songInfo) setCurrentSong(songInfo);
            }
        });

        socketRef.current.on('pause-video', () => {
            if (playerReady.current && player) player.pauseVideo();
        });

        socketRef.current.on('add-to-queue', ({ song }) => {
            setQueue(prev => [...prev, song]);
        });

        if (window.loadYouTubeAPI) {
            window.loadYouTubeAPI().then(() => initializePlayer());
        }

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
            if (player) {
                try { player.destroy(); } catch (e) { }
            }
        };
    }, [user, player, searchResults, queue]);

    const initializePlayer = () => {
        if (playerReady.current) return;
        new window.YT.Player('player', {
            height: '360',
            width: '640',
            events: {
                onReady: (e) => {
                    setPlayer(e.target);
                    playerReady.current = true;
                },
                onStateChange: (e) => {
                    if (e.data === 0) playNext(); // Video ended
                }
            }
        });
    };

    const playVideo = (song) => {
        setCurrentSong(song);
        if (playerReady.current && player) {
            player.loadVideoById(song.videoId);
            player.playVideo();
        }
        socketRef.current.emit('play-video', { roomId: user.currentRoomId, videoId: song.videoId });
    };

    const togglePause = () => {
        if (playerReady.current && player) {
            const state = player.getPlayerState();
            if (state === 1) { // playing
                player.pauseVideo();
                socketRef.current.emit('pause-video', { roomId: user.currentRoomId });
            } else {
                player.playVideo();
                socketRef.current.emit('play-video', { roomId: user.currentRoomId, videoId: currentSong?.videoId });
            }
        }
    };

    const addToQueue = (song) => {
        const songData = {
            videoId: song.videoId,
            title: song.title,
            author: song.author
        };
        setQueue(prev => [...prev, songData]);
        socketRef.current.emit('add-to-queue', { roomId: user.currentRoomId, song: songData });
    };

    const playNext = () => {
        if (queue.length > 0) {
            const next = queue[0];
            setQueue(prev => prev.slice(1));
            playVideo(next);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-4xl font-black italic tracking-tighter uppercase">Music Zone</h1>
                    <button onClick={() => navigate('/dashboard')} className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition shadow-xl">Back</button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* LEFT: Search & Results */}
                    <div className="space-y-8">
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search songs..."
                                className="flex-1 bg-white/5 border border-white/10 px-6 py-4 rounded-2xl focus:outline-none focus:border-purple-500 font-bold"
                            />
                            <button className="bg-purple-600 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-purple-500 transition">Search</button>
                        </form>

                        <div className="space-y-4">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Results</h2>
                            <div className="space-y-2">
                                {searchResults.map((result) => (
                                    <div key={result.videoId} className="bg-white/5 border border-white/5 p-4 rounded-3xl flex items-center justify-between group hover:border-white/10 transition">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <img src={result.videoThumbnails?.[0]?.url} className="w-16 h-10 object-cover rounded-lg" alt="" />
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm truncate pr-4">{result.title}</p>
                                                <p className="text-[10px] text-white/30 uppercase font-black truncate">{result.author}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => playVideo(result)} className="bg-white text-black text-[10px] font-black px-4 py-2 rounded-xl hover:scale-105 transition">Play</button>
                                            <button onClick={() => addToQueue(result)} className="bg-white/5 text-[10px] font-black px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 transition">+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Player & Queue */}
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Now Playing</h2>
                            <div className="bg-black rounded-[40px] overflow-hidden border-8 border-white/5 shadow-2xl aspect-video flex items-center justify-center relative">
                                <div id="player" className="w-full h-full"></div>
                                {!currentSong && (
                                    <div className="absolute inset-0 flex items-center justify-center text-white/10 font-black uppercase tracking-widest">Player Ready</div>
                                )}
                            </div>
                            {currentSong && (
                                <div className="text-center space-y-2">
                                    <h3 className="text-xl font-bold italic tracking-tight">{currentSong.title}</h3>
                                    <p className="text-purple-400 font-black uppercase text-[10px] tracking-widest">{currentSong.author}</p>
                                    <div className="flex justify-center gap-4 mt-6">
                                        <button onClick={togglePause} className="bg-white text-black px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition">Pause / Play</button>
                                        <button onClick={playNext} className="bg-white/5 border border-white/10 px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition">Skip</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Queue ({queue.length})</h2>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {queue.map((song, i) => (
                                    <div key={i} className="bg-white/5 p-4 rounded-2xl flex items-center justify-between border border-transparent hover:border-white/10 transition">
                                        <p className="text-xs font-bold italic truncate pr-4">{song.title}</p>
                                        <button onClick={() => setQueue(q => q.filter((_, idx) => idx !== i))} className="text-white/20 hover:text-red-500 font-black">✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MusicZone;
