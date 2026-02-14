import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

const __dirname = path.resolve();
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

const loadData = (file, defaultData = []) => {
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.error(`Error loading ${file}:`, e);
    }
  }
  return defaultData;
};

const saveData = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

// INITIAL LOAD
const usersData = loadData(USERS_FILE);
const roomsData = loadData(ROOMS_FILE);
const logsData = loadData(LOGS_FILE);

const users = new Map(Object.entries(usersData));
const rooms = new Map(Object.entries(roomsData));
const sessionLogs = new Map(Object.entries(logsData));
const gameStates = new Map(); // Track Tic-Tac-Toe state per room

const persistAll = () => {
  saveData(USERS_FILE, Object.fromEntries(users));
  saveData(ROOMS_FILE, Object.fromEntries(rooms));
  saveData(LOGS_FILE, Object.fromEntries(sessionLogs));
};

const JWT_SECRET = 'hackathon_secret_2024';

// HELPER: Get user by ID safely
const getUserById = (id) => Array.from(users.values()).find(u => u.id === id);

// AUTH ROUTES
app.post('/api/auth/signup', async (req, res) => {
  console.log('Signup request received:', req.body.email);
  const { email, password, username } = req.body;

  if (users.has(email)) {
    return res.status(400).json({ success: false, error: 'Email already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = Date.now().toString();

  const user = {
    id: userId,
    email,
    username,
    password: hashedPassword,
    spotifyConnected: false,
    currentRoomId: null
  };

  users.set(email, user);
  persistAll();

  const token = jwt.sign({ userId, email }, JWT_SECRET);

  res.json({
    success: true,
    token,
    user: {
      id: userId,
      email,
      username,
      spotifyConnected: false,
      currentRoomId: null
    }
  });
});

app.post('/api/auth/login', async (req, res) => {
  console.log('Login request received:', req.body.email);
  const { email, password } = req.body;

  const user = users.get(email);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.id, email }, JWT_SECRET);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email,
      username: user.username,
      spotifyConnected: user.spotifyConnected,
      currentRoomId: user.currentRoomId
    }
  });
});

app.get('/api/auth/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'No token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = getUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        spotifyConnected: user.spotifyConnected,
        currentRoomId: user.currentRoomId
      }
    });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

// ROOM ROUTES
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Middleware for auth
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = getUserById(decoded.userId);
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });
    req.user = user;
    next();
  } catch (e) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

app.post('/api/rooms/create', authenticate, (req, res) => {
  const user = req.user;

  // If user is already in a room, maybe remove them? For now, let's just create a new one.
  // Ideally we should check if they have an active room.

  const roomId = Date.now().toString();
  const inviteCode = generateCode();

  const room = {
    id: roomId,
    inviteCode,
    createdBy: user.id,
    partnerId: null,
    isActive: true,
    createdAt: new Date()
  };

  rooms.set(roomId, room);
  user.currentRoomId = roomId;
  persistAll();

  res.json({ success: true, roomId, inviteCode });
});

app.post('/api/rooms/join', authenticate, (req, res) => {
  const { inviteCode } = req.body;
  const user = req.user;

  const room = Array.from(rooms.values()).find(r => r.inviteCode === inviteCode);

  if (!room) {
    return res.status(404).json({ success: false, error: 'Invalid code' });
  }

  if (room.partnerId) {
    return res.status(400).json({ success: false, error: 'Room is full' });
  }

  if (room.createdBy === user.id) {
    // Re-joining own room? Just return success if they lost state
    return res.json({ success: true, roomId: room.id });
  }

  room.partnerId = user.id;
  user.currentRoomId = room.id;
  persistAll();

  // Notify creator via socket
  // We need to know the creator's socket ID.
  // Ideally we store socketId in user object on connection, or use room rooms.
  // Since we join `user_${userId}` room on connection, we can emit there.

  io.to(`user_${room.createdBy}`).emit('partner-joined', {
    partnerId: user.id,
    partnerUsername: user.username
  });

  // Also notify the joiner that they are connected (though response serves this)

  res.json({ success: true, roomId: room.id });
});

app.get('/api/rooms/:roomId', authenticate, (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);

  if (!room) {
    return res.status(404).json({ success: false, error: 'Room not found' });
  }

  // Security check: must be in the room
  if (room.createdBy !== req.user.id && room.partnerId !== req.user.id) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  const creator = getUserById(room.createdBy);
  const partner = room.partnerId ? getUserById(room.partnerId) : null;

  res.json({
    success: true,
    room: {
      id: room.id,
      inviteCode: room.inviteCode,
      creator: creator ? { id: creator.id, username: creator.username } : null,
      partner: partner ? { id: partner.id, username: partner.username } : null
    }
  });
});

// YOUTUBE SEARCH PROXY
app.get('/api/youtube/search', authenticate, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, error: 'Query required' });

  // List of Invidious instances for fallback
  const instances = [
    'https://invidious.flokinet.to',
    'https://invidious.projectsegfau.lt',
    'https://iv.ggtyler.dev',
    'https://inv.nadeko.net'
  ];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  };

  const tryInvidious = async (query) => {
    for (const instance of instances) {
      try {
        console.log(`Trying Invidious instance: ${instance}`);
        const response = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, { headers, signal: AbortSignal.timeout(5000) });
        if (!response.ok) continue;
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.slice(0, 10).map(video => ({
            id: video.videoId,
            title: video.title,
            thumbnail: video.videoThumbnails?.[0]?.url || '',
            author: video.author,
            duration: video.lengthSeconds ? `${Math.floor(video.lengthSeconds / 60)}:${(video.lengthSeconds % 60).toString().padStart(2, '0')}` : ''
          }));
        }
      } catch (err) {
        console.warn(`Invidious instance ${instance} failed:`, err.message);
      }
    }
    return null;
  };

  try {
    // Attempt 1: Direct Scrape (Fragile but fast)
    console.log(`Searching YouTube for: ${q}`);
    const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%253D%253D`, { headers, signal: AbortSignal.timeout(8000) });
    const html = await response.text();
    const match = html.match(/var ytInitialData = ({.*?});/);

    if (match) {
      const data = JSON.parse(match[1]);
      const results = [];
      const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;

      if (contents) {
        for (const item of contents) {
          if (item.videoRenderer) {
            const video = item.videoRenderer;
            results.push({
              id: video.videoId,
              title: video.title?.runs?.[0]?.text,
              thumbnail: video.thumbnail?.thumbnails?.[0]?.url,
              author: video.ownerText?.runs?.[0]?.text,
              duration: video.lengthText?.simpleText
            });
          }
          if (results.length >= 10) break;
        }
        if (results.length > 0) {
          console.log(`Found ${results.length} results via scrape`);
          return res.json({ success: true, results });
        }
      }
    }

    // Attempt 2: Fallback to Invidious
    console.log('YouTube scrape failed or returned no results, falling back to Invidious...');
    const invidiousResults = await tryInvidious(q);
    if (invidiousResults) {
      console.log(`Found ${invidiousResults.length} results via Invidious`);
      return res.json({ success: true, results: invidiousResults });
    }

    res.status(500).json({ success: false, error: 'All search methods failed. Please try a different query.' });
  } catch (error) {
    console.error('YouTube Search Error:', error);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

// HISTORY ROUTES
app.post('/api/history/log', authenticate, (req, res) => {
  const { zone, activity } = req.body;
  const userId = req.user.id;

  if (!sessionLogs.has(userId)) {
    sessionLogs.set(userId, []);
  }

  const logEntry = {
    id: Date.now().toString(),
    date: new Date(),
    zone,
    activity
  };

  sessionLogs.get(userId).push(logEntry);
  persistAll();
  res.json({ success: true, log: logEntry });
});

app.get('/api/history', authenticate, (req, res) => {
  const logs = sessionLogs.get(req.user.id) || [];
  res.json({ success: true, logs: logs.reverse() }); // Newest first
});

// DEBUG ENDPOINTS (Temporary)
app.get('/debug/users', (req, res) => {
  const userList = Array.from(users.values()).map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    currentRoomId: u.currentRoomId
  }));
  res.json(userList);
});

app.get('/debug/rooms', (req, res) => {
  const roomList = Array.from(rooms.values());
  res.json(roomList);
});

// SOCKET.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, userId }) => {
    console.log(`👤 User ${userId} joining room ${roomId} (Socket: ${socket.id})`);
    socket.join(roomId);
    // Also join a personal room for direct messages/notifications
    if (userId) {
      socket.join(`user_${userId}`);
      socket.userId = userId;
    }
    socket.roomId = roomId;

    // Initialize game for this room if not exists
    if (!gameStates.has(roomId)) {
      gameStates.set(roomId, {
        players: [],
        board: Array(9).fill(null),
        currentTurn: null
      });
    }

    const gameState = gameStates.get(roomId);
    if (!gameState.players.includes(userId)) {
      gameState.players.push(userId);
    }

    // Assign symbols and first turn when 2 players are present
    if (gameState.players.length === 2) {
      const firstPlayer = gameState.players[0];
      const secondPlayer = gameState.players[1];

      io.to(`user_${firstPlayer}`).emit('game-init', {
        firstPlayer: firstPlayer,
        symbol: 'X'
      });

      io.to(`user_${secondPlayer}`).emit('game-init', {
        firstPlayer: firstPlayer,
        symbol: 'O'
      });

      gameState.currentTurn = firstPlayer;
      console.log(`🎮 Game Initialized in room ${roomId}: ${firstPlayer} (X) vs ${secondPlayer} (O)`);
    }

    // Notify others in room
    socket.to(roomId).emit('partner-connected', { userId, username: user?.username });
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  socket.on('zone-change', ({ roomId, zone, userId }) => {
    console.log(`🚀 Zone Change: User ${userId} moving to ${zone} in room ${roomId}`);
    socket.to(roomId).emit('navigate-to', { zone });
  });

  socket.on('search-update', ({ roomId, query, results }) => {
    console.log(`🔍 Search Update in room ${roomId}: ${query}`);
    socket.to(roomId).emit('search-update', { query, results });
  });

  // PLAYBACK EVENTS (Supplementary as requested)
  socket.on('play-video', ({ roomId, videoId }) => {
    console.log(`User playing video: ${videoId} in room: ${roomId}`);
    socket.to(roomId).emit('play-video', { videoId });
  });

  socket.on('pause-video', ({ roomId }) => {
    console.log(`User pausing in room: ${roomId}`);
    socket.to(roomId).emit('pause-video');
  });

  // TIC-TAC-TOE EVENTS
  socket.on('make-move', ({ roomId, index, symbol, userId }) => {
    const gameState = gameStates.get(roomId);
    if (!gameState || gameState.currentTurn !== userId) return;

    gameState.board[index] = symbol;

    // Switch turn
    const nextPlayer = gameState.players.find(p => p !== userId);
    gameState.currentTurn = nextPlayer;

    console.log(`🎮 Move made in room ${roomId} by ${userId} at ${index}`);

    // Broadcast move to both players
    io.to(roomId).emit('move-made', {
      index,
      symbol,
      nextTurn: nextPlayer
    });
  });

  socket.on('reset-game', ({ roomId }) => {
    const gameState = gameStates.get(roomId);
    if (gameState) {
      gameState.board = Array(9).fill(null);
      gameState.currentTurn = gameState.players[0];
    }
    io.to(roomId).emit('game-reset');
    console.log(`🎮 Game Reset in room ${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.roomId) {
      socket.to(socket.roomId).emit('partner-disconnected', { userId: socket.userId });
    }
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
