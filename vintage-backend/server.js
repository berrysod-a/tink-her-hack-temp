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

  try {
    const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%253D%253D`); // sp=EgIQAQ%253D%253D filters for videos
    const html = await response.text();

    // Extract ytInitialData from HTML
    const match = html.match(/var ytInitialData = ({.*?});/);
    if (!match) return res.status(500).json({ success: false, error: 'Failed to parse YouTube data' });

    const data = JSON.parse(match[1]);
    const results = [];

    // Navigate the complex YouTube JSON structure safely
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
        if (results.length >= 5) break;
      }
    }

    res.json({ success: true, results });
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

// SOCKET.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, userId }) => {
    socket.join(roomId);
    // Also join a personal room for direct messages/notifications
    if (userId) {
      socket.join(`user_${userId}`);
      socket.userId = userId;
    }
    socket.roomId = roomId;

    console.log(`Socket ${socket.id} joined room ${roomId}`);

    // Notify others in room
    socket.to(roomId).emit('partner-connected', { userId });
  });

  socket.on('zone-change', ({ roomId, zone, userId }) => {
    socket.to(roomId).emit('zone-changed', { zone, userId });
  });

  socket.on('playback-toggle', ({ roomId, isPlaying, userId }) => {
    socket.to(roomId).emit('playback-toggled', { isPlaying, userId });
  });

  socket.on('track-change', ({ roomId, track, userId }) => {
    socket.to(roomId).emit('track-changed', { track, userId });
  });

  // Phase 4: YouTube Sync Events
  socket.on('play-song', ({ roomId, videoId, currentTime, userId }) => {
    socket.to(roomId).emit('play-song', { videoId, currentTime, userId });
  });

  socket.on('pause-song', ({ roomId, currentTime, userId }) => {
    socket.to(roomId).emit('pause-song', { currentTime, userId });
  });

  // SIMPLE MUSIC ZONE SYNC (USER SPEC)
  socket.on('play-video', ({ roomId, videoId }) => {
    socket.to(roomId).emit('play-video', { videoId });
  });

  socket.on('pause-video', ({ roomId }) => {
    socket.to(roomId).emit('pause-video');
  });

  socket.on('add-to-queue', ({ roomId, song }) => {
    socket.to(roomId).emit('add-to-queue', { song });
  });

  // UNIFIED MUSIC SYNC
  socket.on('play-song', ({ roomId, videoId, currentTime, userId }) => {
    socket.to(roomId).emit('play-song', { videoId, currentTime, userId });
  });

  socket.on('pause-song', ({ roomId, currentTime, userId }) => {
    socket.to(roomId).emit('pause-song', { currentTime, userId });
  });

  socket.on('add-to-queue', ({ roomId, track, userId }) => {
    socket.to(roomId).emit('add-to-queue', { track, userId });
  });

  socket.on('skip-song', ({ roomId, userId }) => {
    socket.to(roomId).emit('skip-song', { userId });
  });

  socket.on('remove-from-queue', ({ roomId, index, userId }) => {
    socket.to(roomId).emit('remove-from-queue', { index, userId });
  });

  socket.on('make-move', ({ roomId, position, player }) => {
    socket.to(roomId).emit('move-made', { position, player });
  });

  socket.on('game-reset', ({ roomId }) => {
    socket.to(roomId).emit('game-reset');
  });

  socket.on('video-action', ({ roomId, action, timestamp, videoId }) => {
    socket.to(roomId).emit('video-action-received', { action, timestamp, videoId });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.roomId) {
      socket.to(socket.roomId).emit('partner-disconnected', { userId: socket.userId });
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
