import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const GamesZone = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [socket, setSocket] = useState(null);
    const [board, setBoard] = useState(Array(9).fill(null));
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [mySymbol, setMySymbol] = useState('');
    const [winner, setWinner] = useState(null);
    const [gameStatus, setGameStatus] = useState('Waiting for connection...');

    // Initialize socket
    useEffect(() => {
        if (!user) return;
        const newSocket = io(import.meta.env.VITE_BACKED_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('✅ Games Socket connected:', newSocket.id);
            newSocket.emit('join-room', {
                roomId: user.currentRoomId,
                userId: user.id
            });

            // Tell partner we are in the games zone
            newSocket.emit('zone-change', {
                roomId: user.currentRoomId,
                zone: '/games',
                userId: user.id
            });
        });

        return () => newSocket.close();
    }, [user]);

    // Game Logic Listeners
    useEffect(() => {
        if (socket) {
            // First player is X, second is O
            socket.on('game-init', ({ firstPlayer, symbol }) => {
                console.log(`🎮 Game Init: You are ${symbol}, First move: ${firstPlayer === user.id ? 'You' : 'Partner'}`);
                setMySymbol(symbol);
                setIsMyTurn(firstPlayer === user.id);
                setGameStatus(firstPlayer === user.id ? 'YOUR TURN' : "PARTNER'S TURN");
                setBoard(Array(9).fill(null));
                setWinner(null);
            });

            socket.on('move-made', ({ index, symbol, nextTurn }) => {
                console.log(`🎮 Move received at ${index} by ${symbol}`);
                setBoard(prev => {
                    const newBoard = [...prev];
                    newBoard[index] = symbol;
                    checkWinner(newBoard);
                    return newBoard;
                });
                setIsMyTurn(nextTurn === user.id);
                setGameStatus(nextTurn === user.id ? 'YOUR TURN' : "PARTNER'S TURN");
            });

            socket.on('game-reset', () => {
                console.log('🎮 Game Reset');
                setBoard(Array(9).fill(null));
                setWinner(null);
                setGameStatus(mySymbol === 'X' ? 'YOUR TURN' : "PARTNER'S TURN");
                setIsMyTurn(mySymbol === 'X');
            });

            socket.on('navigate-to', ({ zone }) => {
                navigate(zone);
            });
        }
    }, [socket, mySymbol]);

    // Handle square click
    const handleClick = (index) => {
        if (!isMyTurn || board[index] || winner) {
            console.log('🚫 Invalid move ignored');
            return;
        }

        console.log(`🎯 Making move at ${index}`);
        socket.emit('make-move', {
            roomId: user.currentRoomId,
            index,
            symbol: mySymbol,
            userId: user.id
        });
    };

    // Check for winner
    const checkWinner = (currentBoard) => {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6] // Diagonals
        ];

        for (let line of lines) {
            const [a, b, c] = line;
            if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
                const gameWinner = currentBoard[a];
                setWinner(gameWinner);
                setGameStatus(gameWinner === mySymbol ? 'YOU WIN! 🎉' : 'PARTNER WINS!');
                return;
            }
        }

        if (currentBoard.every(square => square !== null)) {
            setWinner('draw');
            setGameStatus("IT'S A DRAW!");
        }
    };

    // Reset game
    const resetGame = () => {
        if (socket) {
            socket.emit('reset-game', { roomId: user.currentRoomId });
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8 font-sans selection:bg-purple-500/30">
            <div className="max-w-4xl mx-auto space-y-12">
                <div className="flex justify-between items-center bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-xl">
                    <div className="space-y-1">
                        <h1 className="text-4xl font-black italic tracking-tighter uppercase text-white">
                            🕹️ Monroe Experience - Games
                        </h1>
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">Frequency Competition</p>
                    </div>
                    <button
                        onClick={() => {
                            if (socket) socket.emit('zone-change', { roomId: user.currentRoomId, zone: '/dashboard', userId: user.id });
                            navigate('/dashboard');
                        }}
                        className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition shadow-xl"
                    >
                        Return
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_350px] gap-12">
                    {/* Game Board Section */}
                    <div className="bg-[#0a0a0a] rounded-[50px] border-8 border-white/5 p-12 shadow-2xl flex flex-col items-center justify-center space-y-12 min-h-[600px]">
                        <div className="text-center space-y-2">
                            <div className={`text-[10px] font-black uppercase tracking-[0.5em] ${winner ? 'text-green-400' : isMyTurn ? 'text-purple-400 animate-pulse' : 'text-white/20'}`}>
                                {gameStatus}
                            </div>
                            <div className="text-[9px] text-white/10 font-bold uppercase tracking-widest italic">
                                Session ID: {user.id.slice(0, 8)}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            {board.map((value, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleClick(index)}
                                    disabled={!isMyTurn || value || winner}
                                    className={`w-32 h-32 bg-white/5 border-2 rounded-[30px] flex items-center justify-center text-5xl font-black transition-all duration-300
                                        ${!value && isMyTurn && !winner ? 'hover:bg-white/10 hover:border-purple-500/50 cursor-pointer' : 'cursor-not-allowed'}
                                        ${value === 'X' ? 'text-purple-500 border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.1)]' : value === 'O' ? 'text-pink-500 border-pink-500/20 shadow-[0_0_30px_rgba(236,72,153,0.1)]' : 'border-white/5'}
                                        ${value ? 'scale-100' : 'scale-95'}
                                    `}
                                >
                                    {value}
                                </button>
                            ))}
                        </div>

                        {winner && (
                            <button
                                onClick={resetGame}
                                className="px-12 py-5 bg-white text-black rounded-[25px] font-black text-xs uppercase tracking-[0.2em] hover:scale-105 transition shadow-2xl active:scale-95"
                            >
                                Re-Link Connection
                            </button>
                        )}
                    </div>

                    {/* Sidebar / Info Section */}
                    <div className="space-y-8">
                        <div className="bg-white/5 p-8 rounded-[40px] border border-white/10 space-y-6">
                            <h2 className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">Player Profile</h2>
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-2xl border border-white/10 font-black italic">
                                    {mySymbol || '?'}
                                </div>
                                <div>
                                    <p className="font-black text-xl italic tracking-tight">{user.username}</p>
                                    <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">{mySymbol === 'X' ? 'First Sequence' : 'Second Sequence'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-8 rounded-[40px] border border-white/5 space-y-4">
                            <h2 className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">Historical Data</h2>
                            <div className="space-y-4">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-white/40">Status</span>
                                    <span className="text-green-400">Encrypted</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-white/40">Latency</span>
                                    <span className="text-white">Active</span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 text-center bg-transparent border-t border-white/5">
                            <p className="text-[9px] text-white/10 font-black uppercase tracking-[0.5em] italic">monroe games • v1.02.sync</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GamesZone;
