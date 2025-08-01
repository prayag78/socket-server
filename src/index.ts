import express, { Request, Response } from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";

// Type definitions for socket events
interface JoinRoomData {
  roomId: string;
  userId: string;
  isCreating: boolean;
}

interface CodeChangedData {
  roomId: string;
  code: string;
}

interface InputChangedData {
  roomId: string;
  input: string;
}

interface LanguageChangedData {
  roomId: string;
  language: string;
}

interface RunCodeData {
  roomId: string;
  output: string;
  language: string;
  input: string;
  code: string;
}

interface ExecutionStatusData {
  roomId: string;
  isRunning: boolean;
}

interface CursorMoveData {
  roomId: string;
  position: { line: number; ch: number };
  userId: string;
  userInfo: { name: string; color: string };
}

interface CursorSelectionData {
  roomId: string;
  selection: {
    anchor: { line: number; ch: number };
    head: { line: number; ch: number };
  };
  userId: string;
  userInfo: { name: string; color: string };
}

interface CursorVisibilityData {
  roomId: string;
  isVisible: boolean;
  userId: string;
  userInfo: { name: string; color: string };
}

interface CallOfferData {
  roomId: string;
  offer: RTCSessionDescriptionInit;
  fromUserId: string;
}

interface CallAnswerData {
  roomId: string;
  answer: RTCSessionDescriptionInit;
  fromUserId: string;
}

interface IceCandidateData {
  roomId: string;
  candidate: RTCIceCandidateInit;
  fromUserId: string;
}

interface CallRequestData {
  roomId: string;
  fromUserId: string;
}

interface CallAcceptData {
  roomId: string;
  fromUserId: string;
}

interface CallRejectData {
  roomId: string;
  fromUserId: string;
}

interface CallEndData {
  roomId: string;
  fromUserId: string;
}

interface UserReadyForCallData {
  roomId: string;
  fromUserId: string;
}

interface CheckRoomData {
  roomId: string;
}

const app = express();
app.use(cors());

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Add a simple endpoint to check room status
app.get("/api/rooms/:roomId", (req: Request, res: Response) => {
  const { roomId } = req.params;
  const roomParticipants = activeRooms.get(roomId);
  const socketRoom = io.sockets.adapter.rooms.get(roomId);

  res.json({
    roomId,
    exists:
      (roomParticipants && roomParticipants.size > 0) ||
      (socketRoom && socketRoom.size > 0),
    participantCount: roomParticipants
      ? roomParticipants.size
      : socketRoom
      ? socketRoom.size
      : 0,
    activeRooms: Array.from(activeRooms.keys()),
    socketRooms: Array.from(io.sockets.adapter.rooms.keys()),
  });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  // Add connection options to prevent premature disconnections
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Track active rooms and their participants
const activeRooms = new Map<string, Set<string>>();
// Track socket to room mapping for better cleanup
const socketToRoom = new Map<string, string>();
// Track cursor positions for each room
const roomCursors = new Map<string, Map<string, any>>();

io.on("connection", (socket: Socket) => {
  console.log("User connected:", socket.id);

  // Handle room joining
  socket.on("join-room", ({ roomId, userId, isCreating }: JoinRoomData) => {
    console.log(`User ${userId} attempting to join room ${roomId}`);

    // Check if room exists or if user is creating it
    const roomExists = activeRooms.has(roomId);

    if (!roomExists && !isCreating) {
      socket.emit("room-not-available", "Room does not exist");
      return;
    }

    // Leave previous room if any
    const previousRoom = socketToRoom.get(socket.id);
    if (previousRoom) {
      socket.leave(previousRoom);
      const roomParticipants = activeRooms.get(previousRoom);
      if (roomParticipants) {
        roomParticipants.delete(socket.id);
        if (roomParticipants.size === 0) {
          activeRooms.delete(previousRoom);
          roomCursors.delete(previousRoom);
        }
      }
    }

    // Join new room
    socket.join(roomId);
    socketToRoom.set(socket.id, roomId);

    if (!activeRooms.has(roomId)) {
      activeRooms.set(roomId, new Set());
    }
    activeRooms.get(roomId)!.add(socket.id);

    // Initialize cursor tracking for this room
    if (!roomCursors.has(roomId)) {
      roomCursors.set(roomId, new Map());
    }

    socket.emit("room-joined", { roomId });

    // Notify other users in the room
    socket.to(roomId).emit("user-joined", { userId, socketId: socket.id });

    console.log(`User ${userId} joined room ${roomId}`);
  });

  // Handle room existence check
  socket.on("check-room", ({ roomId }: CheckRoomData) => {
    const exists = activeRooms.has(roomId);
    if (exists) {
      socket.emit("room-exists", { roomId });
    } else {
      socket.emit("room-not-exists", { roomId });
    }
  });

  // Handle code changes
  socket.on("code-changed", ({ roomId, code }: CodeChangedData) => {
    socket.to(roomId).emit("code-changed", { code });
  });

  // Handle input changes
  socket.on("input-changed", ({ roomId, input }: InputChangedData) => {
    socket.to(roomId).emit("input-changed", { input });
  });

  // Handle language changes
  socket.on("change-language", ({ roomId, language }: LanguageChangedData) => {
    socket.to(roomId).emit("language-changed", language);
  });

  // Handle code execution
  socket.on(
    "run-code",
    ({ roomId, output, language, input, code }: RunCodeData) => {
      socket.to(roomId).emit("code-run", { output, language, input, code });
    }
  );

  // Handle execution status
  socket.on(
    "execution-status",
    ({ roomId, isRunning }: ExecutionStatusData) => {
      socket.to(roomId).emit("execution-status", { isRunning });
    }
  );

  // Handle cursor position updates
  socket.on(
    "cursor-move",
    ({ roomId, position, userId, userInfo }: CursorMoveData) => {
      const roomCursorMap = roomCursors.get(roomId);
      if (roomCursorMap) {
        roomCursorMap.set(socket.id, {
          position,
          userId,
          userInfo,
          timestamp: Date.now(),
        });

        // Broadcast to other users in the room
        socket.to(roomId).emit("cursor-move", {
          socketId: socket.id,
          position,
          userId,
          userInfo,
        });
      }
    }
  );

  // Handle cursor selection updates
  socket.on(
    "cursor-selection",
    ({ roomId, selection, userId, userInfo }: CursorSelectionData) => {
      const roomCursorMap = roomCursors.get(roomId);
      if (roomCursorMap) {
        const currentCursor = roomCursorMap.get(socket.id);
        if (currentCursor) {
          currentCursor.selection = selection;
          currentCursor.timestamp = Date.now();
        }

        // Broadcast to other users in the room
        socket.to(roomId).emit("cursor-selection", {
          socketId: socket.id,
          selection,
          userId,
          userInfo,
        });
      }
    }
  );

  // Handle cursor visibility (when user starts/stops typing)
  socket.on(
    "cursor-visibility",
    ({ roomId, isVisible, userId, userInfo }: CursorVisibilityData) => {
      const roomCursorMap = roomCursors.get(roomId);
      if (roomCursorMap) {
        if (isVisible) {
          roomCursorMap.set(socket.id, {
            isVisible: true,
            userId,
            userInfo,
            timestamp: Date.now(),
          });
        } else {
          roomCursorMap.delete(socket.id);
        }

        // Broadcast to other users in the room
        socket.to(roomId).emit("cursor-visibility", {
          socketId: socket.id,
          isVisible,
          userId,
          userInfo,
        });
      }
    }
  );

  // WebRTC Signaling Events
  socket.on("call-offer", ({ roomId, offer, fromUserId }: CallOfferData) => {
    console.log(`Call offer from ${fromUserId} in room ${roomId}`);
    socket
      .to(roomId)
      .emit("call-offer", { offer, fromUserId, fromSocketId: socket.id });
  });

  socket.on("call-answer", ({ roomId, answer, fromUserId }: CallAnswerData) => {
    console.log(`Call answer from ${fromUserId} in room ${roomId}`);
    socket
      .to(roomId)
      .emit("call-answer", { answer, fromUserId, fromSocketId: socket.id });
  });

  socket.on(
    "ice-candidate",
    ({ roomId, candidate, fromUserId }: IceCandidateData) => {
      socket.to(roomId).emit("ice-candidate", {
        candidate,
        fromUserId,
        fromSocketId: socket.id,
      });
    }
  );

  socket.on("call-request", ({ roomId, fromUserId }: CallRequestData) => {
    console.log(`Call request from ${fromUserId} in room ${roomId}`);
    socket
      .to(roomId)
      .emit("call-request", { fromUserId, fromSocketId: socket.id });
  });

  socket.on("call-accept", ({ roomId, fromUserId }: CallAcceptData) => {
    console.log(`Call accepted by ${fromUserId} in room ${roomId}`);
    socket
      .to(roomId)
      .emit("call-accept", { fromUserId, fromSocketId: socket.id });
  });

  socket.on("call-reject", ({ roomId, fromUserId }: CallRejectData) => {
    console.log(`Call rejected by ${fromUserId} in room ${roomId}`);
    socket
      .to(roomId)
      .emit("call-reject", { fromUserId, fromSocketId: socket.id });
  });

  socket.on("call-end", ({ roomId, fromUserId }: CallEndData) => {
    console.log(`Call ended by ${fromUserId} in room ${roomId}`);
    socket.to(roomId).emit("call-end", { fromUserId, fromSocketId: socket.id });
  });

  socket.on(
    "user-ready-for-call",
    ({ roomId, fromUserId }: UserReadyForCallData) => {
      socket
        .to(roomId)
        .emit("user-ready-for-call", { fromUserId, fromSocketId: socket.id });
    }
  );

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      // Remove from room tracking
      const roomParticipants = activeRooms.get(roomId);
      if (roomParticipants) {
        roomParticipants.delete(socket.id);
        if (roomParticipants.size === 0) {
          activeRooms.delete(roomId);
          roomCursors.delete(roomId);
        }
      }

      // Remove cursor from room
      const roomCursorMap = roomCursors.get(roomId);
      if (roomCursorMap) {
        roomCursorMap.delete(socket.id);
      }

      // Notify other users
      socket.to(roomId).emit("user-left", { socketId: socket.id });

      socketToRoom.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
