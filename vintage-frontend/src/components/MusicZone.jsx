import React, { useState, useEffect, useRef } from 'react';

const MusicZone = ({ currentTrack, onTrackChange, isPlaying }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const audioRef = useRef(null);

    useEffect(() => {
        if (audioRef.current) {
            if (isPlaying && currentTrack?.previewUrl) {
                audioRef.current.play().catch(e => console.log('Audio play blocked', e));
            } else {
                audioRef.current.pause();
            }
        }
    }, [isPlaying, currentTrack]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setSearching(true);
        try {
            const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=5&entity=song`);
            const data = await res.json();
            setResults(data.results || []);
        } catch (err) {
            console.error('Search failed', err);
        } finally {
            setSearching(false);
        }
    };

    const selectTrack = (track) => {
        onTrackChange({
            id: track.trackId,
            name: track.trackName,
            artist: track.artistName,
            albumArt: track.artworkUrl100.replace('100x100', '400x400'),
            previewUrl: track.previewUrl
        });
        setResults([]);
        setQuery('');
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-between p-4 space-y-6">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="w-full relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search for a song..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 backdrop-blur-sm"
                />
                <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/60 hover:text-white"
                >
                    {searching ? '⌛' : '🔍'}
                </button>

                {/* Results Dropdown */}
                {results.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                        {results.map((track) => (
                            <div
                                key={track.trackId}
                                onClick={() => selectTrack(track)}
                                className="flex items-center space-x-3 p-3 hover:bg-white/5 cursor-pointer transition border-b border-white/5 last:border-0"
                            >
                                <img src={track.artworkUrl60} alt="" className="w-10 h-10 rounded-md" />
                                <div className="flex-1 overflow-hidden text-left">
                                    <div className="text-white text-sm font-medium truncate">{track.trackName}</div>
                                    <div className="text-white/40 text-xs truncate">{track.artistName}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </form>

            {/* Now Playing Display */}
            {currentTrack ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-500">
                    <audio ref={audioRef} src={currentTrack.previewUrl} loop />
                    <div className="relative group">
                        <img
                            src={currentTrack.albumArt}
                            alt={currentTrack.name}
                            className={`w-48 h-48 rounded-2xl shadow-2xl border-4 border-white/10 transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'}`}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>

                    <div className="text-center">
                        <h3 className="text-2xl font-bold text-white mb-1">{currentTrack.name}</h3>
                        <p className="text-purple-300 font-medium">{currentTrack.artist}</p>
                    </div>

                    {isPlaying && (
                        <div className="flex space-x-1">
                            {[1, 2, 3, 4].map((i) => (
                                <div
                                    key={i}
                                    className="w-1 bg-purple-500 rounded-full animate-bounce"
                                    style={{ animationDelay: `${i * 0.15}s`, height: '12px' }}
                                ></div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 text-white/20">
                    <div className="text-6xl">📻</div>
                    <p className="max-w-[200px]">Search for a track to share the vibe</p>
                </div>
            )}

            {/* Preview Hint (Simulated Sync) */}
            <div className="text-[10px] text-white/20 uppercase tracking-widest">
                Synced via VintageHangout
            </div>
        </div>
    );
};

export default MusicZone;
