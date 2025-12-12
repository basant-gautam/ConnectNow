# ConnectNow

Simple video meeting app with authentication, room-based video calls, and in-room chat. Built with Express, Socket.IO, MongoDB, and simple-peer for WebRTC.

## Features
- Email/password signup/login (JWT + cookies)
- Create or join rooms for WebRTC video calls
- In-room chat panel (per room)
- Status indicator and copyable room code
- MongoDB persistence via Mongoose

## Stack
- Node.js, Express
- Socket.IO
- WebRTC via simple-peer
- MongoDB Atlas (or local MongoDB)
- JWT auth, bcrypt password hashing

## Prerequisites
- Node.js 18+
- MongoDB Atlas cluster (recommended) or local MongoDB

## Setup
1) Install deps
```bash
npm install
```

2) Configure environment
- Copy `.env.example` to `.env` and set values:
```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/video-call-app?retryWrites=true&w=majority&appName=<app>
JWT_SECRET=replace_with_strong_secret
CLIENT_URL=http://localhost:3000
PORT=3002
NODE_ENV=development
```
- If using Atlas, allow your IP in **Network Access** and ensure the DB user/password match your URI. URL-encode special characters in the password (`@` -> `%40`, `#` -> `%23`, `:` -> `%3A`).
- For local MongoDB, use `mongodb://127.0.0.1:27017/video-call-app`.

3) Run the server
```bash
npm start
```
Server defaults to `http://localhost:3002`.

## Usage
- Open the app, sign up or log in.
- Click **Create Room** to get a room code (auto-joins); share the code.
- Click **Join Room** and enter a code to join an existing room.
- Video starts once permissions are granted; use the chat panel to exchange messages within the room.

## Scripts
- `npm start` — run server
- `npm run dev` — run with nodemon

## Troubleshooting
- **MongoDB auth/connection errors**: verify `.env` URI, DB user password, and Atlas IP allowlist.
- **Camera/mic blocked**: allow permissions in the browser and ensure only one tab is using the camera.
- **Ports**: server defaults to 3002. Client access via the same origin unless you change CORS/CLIENT_URL.

## Project structure
- `server.js` — Express app, Socket.IO, routes
- `public/` — frontend (HTML/CSS/JS)
- `middleware/auth.js` — JWT auth middleware
- `models/User.js` — Mongoose user schema
