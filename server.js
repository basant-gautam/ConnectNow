const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIO = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const User = require('./models/User');
const auth = require('./middleware/auth');

const app = express();

// Updated CORS configuration to be more permissive in development
const isDevelopment = process.env.NODE_ENV !== 'production';
app.use(cors({
  origin: isDevelopment ? ['http://localhost:3000', 'http://localhost:3002', 'http://127.0.0.1:3000'] : process.env.CLIENT_URL,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Handle favicon.ico request
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // Return "No Content" status
});

// MongoDB Connection with better error handling
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/video-call-app';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.info('SIGTERM signal received.');
  shutdown();
});

process.on('SIGINT', () => {
  console.info('SIGINT signal received.');
  shutdown();
});

const shutdown = () => {
  server.close(() => {
    console.log('Server closed.');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    });
  });
};

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Auth Routes with better error handling
app.post('/api/signup', async (req, res) => {
    try {
        console.log('Signup request received:', req.body);
        
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Create new user
        const user = new User({ username, email, password });
        await user.save();
        console.log('User created successfully:', user._id);

        // Generate token
        const token = jwt.sign({ userId: user._id }, JWT_SECRET);
        
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.status(201).json({ 
            message: 'User created successfully',
            user: { id: user._id, username: user.username, email: user.email }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ 
      message: 'Logged in successfully',
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store connected users and their rooms
const users = new Map();
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId, userId) => {
    console.log(`User ${socket.id} joining room ${roomId}`);
    
    // Leave previous room if any
    const previousRoom = users.get(socket.id);
    if (previousRoom) {
      socket.leave(previousRoom);
      console.log(`User ${socket.id} left room ${previousRoom}`);
    }

    // Join new room
    socket.join(roomId);
    users.set(socket.id, roomId);
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);

    // Notify other users in the room
    socket.to(roomId).emit('user-connected', socket.id);
    
    console.log(`Room ${roomId} users:`, Array.from(rooms.get(roomId)));
  });

  socket.on('send-signal', ({ userToSignal, callerID, signal }) => {
    console.log(`Signal from ${callerID} to ${userToSignal}`);
    io.to(userToSignal).emit('user-joined', { signal, callerID });
  });

  socket.on('return-signal', ({ signal, callerID }) => {
    console.log(`Return signal from ${socket.id} to ${callerID}`);
    io.to(callerID).emit('receiving-returned-signal', { signal, id: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Clean up user's room
    const roomId = users.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) {
          rooms.delete(roomId);
        }
      }
      socket.to(roomId).emit('user-disconnected', socket.id);
      users.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 