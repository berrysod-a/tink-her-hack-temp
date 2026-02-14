import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const MusicZone = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [currentSong, setCurrentSong] = useState(null);
    const [player, setPlayer] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [queue, setQueue] = useState([]);
    const [socket, setSocket] = useState(null);
    const [playerReady, setPlayerReady] = useState(false);

    // Initialize Socket & Listeners
    useEffect(() => {
        if (!user) return;
        const newSocket = io(import.meta.env.VITE_BACKED_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('✅ Music Zone Socket connected:', newSocket.id);
            newSocket.emit('join-room', { roomId: user.currentRoomId, userId: user.id });

            newSocket.emit('zone-change', {
                roomId: user.currentRoomId,
                zone: '/music',
                userId: user.id
            });
        });

        newSocket.on('search-update', ({ query, results }) => {
            console.log('🔍 Syncing search results');
            setSearchQuery(query);
            setSearchResults(results);
            setError(null);
        });

        newSocket.on('navigate-to', ({ zone }) => {
            navigate(zone);
        });

        // SYNC LISTENERS
        newSocket.on('play-video', ({ videoId }) => {
            console.log('🎵 Partner playing:', videoId);
            if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
                playerRef.current.loadVideoById(videoId);
                playerRef.current.playVideo();
            } else {
                console.warn('⏳ Player not ready for sync yet, retrying...');
                // One-time retry if not ready
                setTimeout(() => {
                    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
                        playerRef.current.loadVideoById(videoId);
                        playerRef.current.playVideo();
                    }
                }, 1000);
            }
        });

        newSocket.on('pause-video', () => {
            console.log('⏸️ Partner paused');
            if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
                playerRef.current.pauseVideo();
            }
        });

        newSocket.on('add-to-queue', ({ track }) => {
            setQueue(prev => [...prev, track]);
        });

        return () => newSocket.close();
    }, [user, navigate]);

    // Initialize YouTube API and Player
    useEffect(() => {
        const loadAPI = async () => {
            if (window.loadYouTubeAPI) {
                console.log('📡 Using global YouTube API loader');
                await window.loadYouTubeAPI();
                initializePlayer();
            } else {
                console.log('📡 Manual YouTube API loader fallback');
                if (!window.YT) {
                    const tag = document.createElement('script');
                    tag.id = 'youtube-iframe-api';
                    tag.src = 'https://www.youtube.com/iframe_api';
                    const firstScriptTag = document.getElementsByTagName('script')[0];
                    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                }

                window.onYouTubeIframeAPIReady = () => {
                    initializePlayer();
                };

                if (window.YT && window.YT.Player) {
                    initializePlayer();
                }
            }
        };

        loadAPI();
    }, []);

    const playerRef = useRef(null);

    const initializePlayer = () => {
        if (playerRef.current) return;

        const playerElement = document.getElementById('youtube-player');
        if (!playerElement) {
            console.log('⏳ Waiting for player element...');
            setTimeout(initializePlayer, 100);
            return;
        }

        try {
            playerRef.current = new window.YT.Player('youtube-player', {
                height: '360',
                width: '640',
                playerVars: {
                    autoplay: 0,
                    controls: 1,
                    modestbranding: 1,
                    rel: 0
                },
                events: {
                    onReady: (event) => {
                        console.log('✅ Player ready!');
                        setPlayer(event.target);
                        setPlayerReady(true);
                    },
                    onError: (event) => {
                        console.error('❌ YouTube player error:', event.data);
                    },
                    onStateChange: (event) => {
                        setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
                    }
                }
            });
        } catch (err) {
            console.error('❌ Failed to construct YT.Player:', err);
            // Retry once after a delay
            setTimeout(initializePlayer, 1000);
        }
    };

    const [error, setError] = useState(null);

    // Search Function using Backend Proxy
    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setSearchResults([]);
        setError(null);

        try {
            const authToken = localStorage.getItem('auth_token');
            console.log('Initiating search for:', searchQuery);

            const response = await fetch(
                `${import.meta.env.VITE_BACKED_URL}/api/youtube/search?q=${encodeURIComponent(searchQuery)}`,
                {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                }
            );

            const data = await response.json();
            console.log('Search response data:', data);

            if (data.success && Array.isArray(data.results)) {
                const musicResults = data.results.map(video => ({
                    videoId: video.id,
                    title: video.title,
                    author: video.author,
                    thumbnail: video.thumbnail,
                    duration: video.duration
                }));
                setSearchResults(musicResults);
                if (musicResults.length === 0) setError('No results found for this query.');

                // Sync search with partner
                if (socket) {
                    socket.emit('search-update', {
                        roomId: user.currentRoomId,
                        query: searchQuery,
                        results: musicResults
                    });
                }
            } else {
                setError(data.error || 'Failed to retrieve results. Please try again.');
            }
        } catch (error) {
            console.error('Search client error:', error);
            setError('Could not connect to the server. Please ensure the backend is running.');
        } finally {
            setIsSearching(false);
        }
    };

    const playSong = (song) => {
        if (!player || !playerReady) {
            console.error('❌ Player not ready yet');
            return;
        }

        console.log('🎬 Playing video:', song.videoId);
        setCurrentSong(song);
        player.loadVideoById(song.videoId);
        player.playVideo();

        // Tell partner to play same song
        if (socket) {
            socket.emit('play-video', {
                roomId: user.currentRoomId,
                videoId: song.videoId
            });
        }
    };

    const togglePlayPause = () => {
        if (!player || !playerReady) return;

        if (isPlaying) {
            player.pauseVideo();
            if (socket) {
                socket.emit('pause-video', { roomId: user.currentRoomId });
            }
        } else {
            player.playVideo();
            if (socket && currentSong) {
                socket.emit('play-video', {
                    roomId: user.currentRoomId,
                    videoId: currentSong.videoId
                });
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-4xl font-black italic tracking-tighter uppercase">🎵 Monroe Experience - Music Zone</h1>
                    <button
                        onClick={() => {
                            if (socket) socket.emit('zone-change', { roomId: user.currentRoomId, zone: '/dashboard', userId: user.id });
                            navigate('/dashboard');
                        }}
                        className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition shadow-xl"
                    >
                        Back
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* LEFT: Search & Results */}
                    <div className="space-y-8">
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search for frequency..."
                                className="flex-1 bg-white/5 border border-white/10 px-6 py-4 rounded-2xl focus:outline-none focus:border-purple-500 font-bold"
                            />
                            <button className="bg-purple-600 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-purple-500 transition disabled:opacity-50">
                                {isSearching ? 'Searching...' : 'Search'}
                            </button>
                        </form>

                        <div className="space-y-4">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Search Results</h2>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                {searchResults.map((song) => (
                                    <div key={song.videoId} className="bg-white/5 border border-white/5 p-4 rounded-3xl flex items-center justify-between group hover:border-white/10 transition">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <img src={song.thumbnail} className="w-20 h-12 object-cover rounded-xl shadow-lg" alt={song.title} />
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm truncate pr-4">{song.title}</p>
                                                <p className="text-[10px] text-white/30 uppercase font-black truncate">{song.author}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => playSong(song)} className="bg-white text-black text-[10px] font-black px-6 py-2 rounded-xl hover:scale-105 transition">Play</button>
                                    </div>
                                ))}
                                {error && (
                                    <div className="text-center py-12 px-6">
                                        <div className="text-purple-400 font-black uppercase tracking-[0.2em] text-[10px] mb-2">Search Logic Update</div>
                                        <div className="text-white/40 font-bold text-xs italic">{error}</div>
                                    </div>
                                )}
                                {!isSearching && searchResults.length === 0 && !error && (
                                    <div className="text-center py-12 text-white/10 font-bold uppercase tracking-widest text-xs italic">Frequency ready for transmission...</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Now Playing Area */}
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Now Playing</h2>
                            <div className="bg-black rounded-[50px] overflow-hidden border-8 border-white/5 shadow-2xl aspect-video flex items-center justify-center relative">
                                <div id="youtube-player" className="w-full h-full"></div>
                                {!currentSong && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 text-white/20">
                                        <span className="text-5xl">💿</span>
                                        <div className="font-black uppercase tracking-[0.5em] text-[10px]">Frequency Ready</div>
                                    </div>
                                )}
                            </div>
                            {currentSong && (
                                <div className="bg-white/5 p-10 rounded-[40px] border border-white/10 text-center space-y-6">
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black italic tracking-tight leading-tight">{currentSong.title}</h3>
                                        <p className="text-purple-400 font-black uppercase text-[10px] tracking-[0.5em] opacity-80">{currentSong.author}</p>
                                    </div>
                                    <div className="flex justify-center gap-4">
                                        <button
                                            onClick={togglePlayPause}
                                            className={`${isPlaying ? 'bg-white/10 text-white' : 'bg-white text-black'} px-12 py-5 rounded-3xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-2xl active:scale-95`}
                                        >
                                            {isPlaying ? 'Pause' : 'Play'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MusicZone;
