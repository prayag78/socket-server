import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-room", ({ roomId, userId }) => {
    socket.join(roomId);
    console.log(`User ${userId} joined room ${roomId}`);
  });

  socket.on("send-message", ({ roomId, message }) => {
    console.log(`Message in ${roomId}: ${message}`);
    socket.to(roomId).emit("receive-message", message);
  });

  socket.on("change-language", ({ roomId, language }) => {
    console.log(`Language changed in ${roomId} to ${language}`);
    io.to(roomId).emit("language-changed", language);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
