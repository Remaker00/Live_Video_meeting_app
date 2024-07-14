const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const cors = require('cors');




// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());




// MongoDB connection
const mongoURI = 'mongodb+srv://nishant9:Nishant9@cluster3.13x5uc7.mongodb.net/Meeting_app';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', (err) => console.error('MongoDB connection error:', err));
db.once('open', () => console.log('Connected to MongoDB'));




// MeetingRoom model
const MeetingRoomSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: true,
    unique: true,
  },
  hostName: {
    type: String,
    required: true,
  },
  participants: [
    {
      name: {
        type: String,
        required: true,
      },
      video: {
        type: Boolean,
        default: false,
      },
      mic: {
        type: Boolean,
        default: false,
      },
    },
  ],
  date: {
    type: Date,
    default: Date.now,
  },
  startTime: {
    type: String,
    required: true,
  },
});
const MeetingRoom = mongoose.model('MeetingRoom', MeetingRoomSchema);




// MeetingRoom routes
app.post('/api/meetings/create', async (req, res) => {
  const { hostName, meetingId, startTime } = req.body;
  try {
    const newMeeting = new MeetingRoom({
      meetingId,
      hostName,
      participants: [{ name: hostName }],
      startTime,
      date: new Date(),
    });
    await newMeeting.save();
    res.status(201).json(newMeeting);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/meetings/:meetingId', async (req, res) => {
  const { meetingId } = req.params;
  try {
    const meeting = await MeetingRoom.findOne({ meetingId });
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    res.status(200).json(meeting);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/meetings/:meetingId', async (req, res) => {
  const { meetingId } = req.params;
  const { participants } = req.body;
  try {
    const meeting = await MeetingRoom.findOneAndUpdate(
      { meetingId },
      { participants },
      { new: true }
    );
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    res.status(200).json(meeting);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});




// Socket.IO setup
const users = {}; // To keep track of users and their socket IDs

io.on("connection", (socket) => {
  console.log(`Socket Connected: ${socket.id}`);

  socket.on("room:join", async ({ Name, room }) => {
    socket.join(room);
    users[socket.id] = { Name, room };

    try {
      const meeting = await MeetingRoom.findOne({ meetingId: room });
      if (!meeting) {
        console.error(`Meeting with ID ${room} not found.`);
        return;
      }

      const participantExists = meeting.participants.some(participant => participant.name === Name);
      if (!participantExists) {
        meeting.participants.push({ name: Name, video: false, mic: false });
        await meeting.save();
      }

      const allSocketIds = Object.keys(users).filter(id => users[id].room === room);
      io.to(room).emit("participants:update", meeting.participants);
      io.to(room).emit("sockets:update", allSocketIds); // Send all socket IDs

      socket.to(room).emit("user:joined", { Name, id: socket.id });
    } catch (error) {
      console.error('Error joining room:', error);
    }
  });

  socket.on("user:call", ({ to, offer }) => {
    io.to(to).emit("incoming:call", { from: socket.id, offer });
  });

  socket.on("call:accepted", ({ to, ans }) => {
    io.to(to).emit("call:accepted", { from: socket.id, ans });
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
  });

  socket.on("participant:kick", async ({ participantName, room }) => {
    try {
      const meeting = await MeetingRoom.findOne({ meetingId: room });
      if (!meeting) {
        console.error(`Meeting with ID ${room} not found.`);
        return;
      }

      meeting.participants = meeting.participants.filter(participant => participant.name !== participantName);
      await meeting.save();

      const kickedSocketId = Object.keys(users).find(id => users[id].Name === participantName && users[id].room === room);

      io.to(room).emit("participants:update", meeting.participants);

      if (kickedSocketId) {
        io.to(kickedSocketId).emit("kicked");
        io.sockets.sockets.get(kickedSocketId).leave(room);
        io.sockets.sockets.get(kickedSocketId).disconnect();
        delete users[kickedSocketId];
      }
    } catch (error) {
      console.error('Error kicking participant:', error);
    }
  });

  socket.on('participant:stream', ({ name, sdp, room }) => {
    socket.to(room).emit('participant:stream', { name, sdp });
  });

  socket.on('participant:answer', ({ name, sdp }) => {
    const user = users[socket.id];
    if (user) {
      socket.to(user.room).emit('participant:answer', { name, sdp });
    }
  });

  socket.on('ice-candidate', ({ candidate, name }) => {
    const user = users[socket.id];
    if (user) {
      socket.to(user.room).emit('ice-candidate', { candidate, name });
    }
  });

  socket.on("disconnect", () => {
    const { room } = users[socket.id] || {};
    delete users[socket.id];

    if (room) {
      const allSocketIds = Object.keys(users).filter(id => users[id].room === room);
      io.to(room).emit("sockets:update", allSocketIds); // Send updated socket IDs
    }

    console.log(`Socket Disconnected: ${socket.id}`);
  });
});




// Start the server
server.listen(5000, () => {
  console.log('Server is running on port 5000');
});
