import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const GamesZone = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [board, setBoard] = useState(Array(9).fill(''));
    const [isXNext, setIsXNext] = useState(true);
    const [winner, setWinner] = useState(null);
    const [mySymbol, setMySymbol] = useState(null); // 'X' for creator, 'O' for partner
    const socketRef = useRef(null);

    useEffect(() => {
        if (!user) return;

        socketRef.current = io('http://localhost:3000');
        socketRef.current.emit('join-room', { roomId: user.currentRoomId, userId: user.id });

        // Set symbol based on room role (X for room creator, O for partner)
        const fetchRoom = async () => {
            try {
                const res = await fetch(`http://localhost:3000/api/rooms/${user.currentRoomId}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
                });
                const data = await res.json();
                if (data.success) {
                    setMySymbol(data.room.createdBy === user.id ? 'X' : 'O');
                }
            } catch (err) {
                console.error('Failed to fetch room info', err);
            }
        };
        fetchRoom();

        socketRef.current.on('move-made', ({ position, player }) => {
            setBoard(prev => {
                const newBoard = [...prev];
                newBoard[position] = player;
                return newBoard;
            });
            setIsXNext(player === 'O');
        });

        socketRef.current.on('game-reset', () => {
            setBoard(Array(9).fill(''));
            setIsXNext(true);
            setWinner(null);
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [user]);

    useEffect(() => {
        const calculateWinner = (squares) => {
            const lines = [
                [0, 1, 2], [3, 4, 5], [6, 7, 8],
                [0, 3, 6], [1, 4, 7], [2, 5, 8],
                [0, 4, 8], [2, 4, 6]
            ];
            for (let i = 0; i < lines.length; i++) {
                const [a, b, c] = lines[i];
                if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                    return squares[a];
                }
            }
            if (squares.every(s => s !== '')) return 'Draw';
            return null;
        };

        const result = calculateWinner(board);
        if (result) {
            setWinner(result);
            // Log to Memory Lane
            if (mySymbol === 'X') { // Only one user needs to log it
                fetch('http://localhost:3000/api/history/log', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    },
                    body: JSON.stringify({
                        zone: 'Games',
                        activity: result === 'Draw' ? 'Played Tic-Tac-Toe (Draw)' : `Played Tic-Tac-Toe (${result} won)`
                    })
                }).catch(err => console.error('Failed to log game', err));
            }
        }
    }, [board, mySymbol]);

    const handleMove = (index) => {
        if (board[index] !== '' || winner || (isXNext && mySymbol !== 'X') || (!isXNext && mySymbol !== 'O')) {
            return;
        }

        const newBoard = [...board];
        newBoard[index] = mySymbol;
        setBoard(newBoard);
        setIsXNext(!isXNext);

        socketRef.current.emit('make-move', {
            roomId: user.currentRoomId,
            position: index,
            player: mySymbol
        });
    };

    const resetGame = () => {
        setBoard(Array(9).fill(''));
        setIsXNext(true);
        setWinner(null);
        socketRef.current.emit('game-reset', { roomId: user.currentRoomId });
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8 font-sans">
            <div className="max-w-md w-full space-y-8 text-center">
                <div className="flex justify-between items-center w-full mb-8">
                    <h1 className="text-3xl font-black uppercase tracking-tighter italic">Games Zone</h1>
                    <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-white/10 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-white/20 transition">Back</button>
                </div>

                <div className="bg-slate-800 p-8 rounded-[40px] shadow-2xl border border-white/5 space-y-8">
                    <div className="space-y-2">
                        <div className="text-xs font-black text-purple-400 uppercase tracking-[0.3em]">
                            {winner ? (winner === 'Draw' ? "IT'S A DRAW!" : `WINNER: ${winner}`) : `${isXNext ? 'X' : 'O'}'s TURN`}
                        </div>
                        <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest italic">
                            You are playing as <span className="text-white">{mySymbol}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        {board.map((cell, i) => (
                            <button
                                key={i}
                                onClick={() => handleMove(i)}
                                className={`h-24 bg-black/40 rounded-2xl border-2 border-white/5 text-4xl font-black transition-all flex items-center justify-center hover:bg-black/60
                                    ${cell === 'X' ? 'text-blue-400' : 'text-pink-400'}
                                    ${winner || (isXNext && mySymbol !== 'X') || (!isXNext && mySymbol !== 'O') ? 'cursor-not-allowed opacity-50' : 'hover:border-purple-500/50'}
                                `}
                            >
                                {cell}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={resetGame}
                        className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition"
                    >
                        Reset Board
                    </button>
                </div>

                <div className="text-[10px] text-white/20 font-black uppercase tracking-[0.5em] italic">
                    Vintage Games • Est. 2024
                </div>
            </div>
        </div>
    );
};

export default GamesZone;
