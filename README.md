# Socket Server - Real-Time Collaboration Backend

A Node.js Socket.IO server that powers the real-time collaborative features of [CodeSync](https://github.com/prayag78/codesync) - a real-time collaborative code editor.

## 🚀 Overview

This socket server handles all real-time communication between users in CodeSync, including:

- **Real-time code collaboration** - Live code synchronization between users
- **Video calling** - WebRTC signaling for face-to-face collaboration
- **Room management** - User joining/leaving and room status tracking
- **Code execution** - Synchronized code running and output sharing

## 🛠️ Tech Stack

- **Node.js** - JavaScript runtime
- **Express.js** - Web server framework
- **Socket.IO** - Real-time WebSocket communication
- **TypeScript** - Type-safe JavaScript

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0.0 or higher

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/prayag78/socket-server
   cd socket-server
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

   The server will run on `http://localhost:8000`

## 🔗 Frontend Integration

This server is designed to work with the [CodeSync frontend](https://github.com/prayag78/codesync). The frontend connects to this server using Socket.IO client and expects the events documented above.

### Frontend Configuration

In your CodeSync frontend, set the socket server URL:

```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
```

## 🔗 Links

- **Frontend Repository:** [prayag78/codesync](https://github.com/prayag78/codesync)
- **Live Demo:** [https://codesync.vercel.app](https://codesync.vercel.app)
