import React from 'react';
import './Roundabout.css';

const Roundabout = ({
    activeZone,
    onZoneChange,
    isPlaying,
    onTogglePlayback,
    partnerZone,
    partnerIsPlaying
}) => {

    const zones = [
        { id: 'music', label: 'Music', icon: '🎵', className: 'zone-music' },
        { id: 'games', label: 'Games', icon: '🎮', className: 'zone-games' },
        { id: 'movies', label: 'Movies', icon: '🎬', className: 'zone-movies' },
    ];

    return (
        <div className="roundabout-container">
            {/* SVG Lines */}
            <svg className="roundabout-svg" viewBox="0 0 400 400">
                <circle cx="200" cy="200" r="140" fill="none" stroke="white" strokeWidth="1" strokeDasharray="4 8" opacity="0.1" />
            </svg>

            {/* Center Vinyl */}
            <div className="roundabout-center" onClick={onTogglePlayback}>
                <div className={`vinyl-record ${isPlaying || partnerIsPlaying ? 'playing' : ''}`}>
                    <div className="vinyl-label">
                        <div className="vinyl-hole"></div>
                    </div>
                </div>
            </div>

            {/* Zones */}
            {zones.map((zone) => {
                const isActive = activeZone === zone.id;
                const isPartnerActive = partnerZone === zone.id;

                return (
                    <div
                        key={zone.id}
                        className={`zone ${zone.className} ${isActive ? 'active' : ''}`}
                        onClick={() => onZoneChange(zone.id)}
                    >
                        <span className="zone-icon">{zone.icon}</span>
                        <span className="zone-label">{zone.label}</span>

                        {isPartnerActive && !isActive && (
                            <div className="absolute -top-2 -right-2 w-4 h-4 bg-pink-500 rounded-full border-2 border-white animate-pulse" title="Partner is here"></div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default Roundabout;
