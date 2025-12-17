const socket = io('/');
const localVideo = document.getElementById('localVideo');
const remoteVideosContainer = document.getElementById('remoteVideos');
const createRoomBtn = document.getElementById('createRoomBtn');
const showJoinBtn = document.getElementById('showJoinBtn');
const joinBtn = document.getElementById('joinBtn');
const roomIdInput = document.getElementById('roomIdInput');
const roomInfo = document.getElementById('roomInfo');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const copyBtn = document.getElementById('copyBtn');
const joinControls = document.getElementById('joinControls');
const statusIndicator = document.querySelector('.status-indicator');
const statusText = statusIndicator.querySelector('span');
const statusDot = document.querySelector('.status-dot');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const chatRoomLabel = document.getElementById('chatRoomLabel');
const usernameEl = document.getElementById('username');

let localStream;
let peers = {}; // map of socketId -> SimplePeer
let currentRoom;
let myVideoStream;
let chatLastTimestamp = null;

function appendChatMessage({ sender, message, timestamp, isOwn }) {
    const container = document.createElement('div');
    container.className = `chat-message${isOwn ? ' self' : ''}`;

    const meta = document.createElement('div');
    meta.className = 'chat-meta';
    const time = new Date(timestamp || Date.now());
    meta.innerHTML = `<span>${sender || 'Guest'}</span><span>${time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;

    const body = document.createElement('div');
    body.className = 'chat-body';
    body.textContent = message;

    container.appendChild(meta);
    container.appendChild(body);
    chatMessages.appendChild(container);

    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatLastTimestamp = timestamp;
}

function clearChat() {
    chatMessages.innerHTML = '';
    chatLastTimestamp = null;
}

// Update status indicator
function updateStatus(status, success = true) {
    statusText.textContent = status;
    statusDot.style.background = success ? '#4caf50' : '#f44336';
    statusIndicator.style.color = success ? '#4caf50' : '#f44336';
}

// Get user's camera and microphone
async function getMedia() {
    try {
        updateStatus('Accessing camera...');
        localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1080 },
                height: { ideal: 1920 }
            },
            audio: true
        });
        localVideo.srcObject = localStream;
        updateStatus('Camera connected');
        return true;
    } catch (err) {
        console.error('Error accessing media devices:', err);
        updateStatus('Camera access denied', false);
        alert('Failed to access camera and microphone. Please make sure they are connected and you have granted permission.');
        return false;
    }
}

// Initialize media on page load
getMedia();

// Generate a random room ID
function generateRoomId() {
    return Math.random().toString(36).substring(2, 12);
}

// Create Room Button Click Handler
createRoomBtn.addEventListener('click', async () => {
    const hasMedia = localStream || await getMedia();
    if (!hasMedia) return;
    
    const roomId = generateRoomId();
    
    // Clear any existing room info
    roomIdInput.value = '';
    joinControls.classList.remove('show');
    
    // Show and set the new room ID
    roomIdDisplay.value = roomId;
    roomInfo.classList.add('show');
    
    // Join the room automatically as the creator
    joinRoom(roomId);
    updateStatus('Room created, waiting for others...');
});

// Show Join Controls Button Click Handler
showJoinBtn.addEventListener('click', () => {
    roomInfo.classList.remove('show');
    roomIdDisplay.value = '';
    joinControls.classList.add('show');
    updateStatus('Ready to join');
});

// Copy Button Click Handler
copyBtn.addEventListener('click', () => {
    roomIdDisplay.select();
    document.execCommand('copy');
    
    // Visual feedback for copy
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
        </svg>
        Copied!
    `;
    
    setTimeout(() => {
        copyBtn.innerHTML = originalText;
    }, 2000);
});

// Join Button Click Handler
joinBtn.addEventListener('click', async () => {
    const hasMedia = localStream || await getMedia();
    if (!hasMedia) return;
    
    const roomId = roomIdInput.value.trim();
    if (!roomId) {
        alert('Please enter a room ID');
        return;
    }
    joinRoom(roomId);
    joinControls.classList.remove('show');
    updateStatus('Joining room...');
});

function joinRoom(roomId) {
    if (currentRoom === roomId) return; // Prevent joining same room multiple times
    
    // Clean up any existing peer connection
    // Destroy any existing peer connections
    for (const id in peers) {
        try { peers[id].destroy(); } catch (e) {}
        removeRemoteVideo(id);
        delete peers[id];
    }
    
    currentRoom = roomId;
    chatRoomLabel.textContent = `Room: ${roomId}`;
    clearChat();
    console.log('Joining room:', roomId);
    
    // Join the room
    socket.emit('join-room', roomId, socket.id);
}

// Handle when a new user connects to our room
socket.on('user-connected', (userId) => {
    console.log('New user connected to room:', userId);
    updateStatus('User joined, establishing connection...');
    connectToNewUser(userId);
});

function connectToNewUser(userId) {
    if (!localStream) return;
    if (peers[userId]) return;

    const peer = new SimplePeer({
        initiator: true,
        trickle: false,
        stream: localStream,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        }
    });

    peer.on('signal', (data) => {
        console.log('Emitting send-signal to', userId);
        socket.emit('send-signal', {
            userToSignal: userId,
            callerID: socket.id,
            signal: data
        });
    });

    peer.on('stream', (stream) => {
        console.log('Received remote stream from', userId, stream);
        addRemoteVideo(stream, userId);
        updateStatus('Connected to remote user');
    });

    peer.on('error', (err) => {
        console.error('Peer error for', userId, err);
    });

    peer.on('close', () => {
        removeRemoteVideo(userId);
        delete peers[userId];
    });

    peers[userId] = peer;
}

// Handle incoming calls
socket.on('user-joined', ({ signal, callerID }) => {
    console.log('Received join signal from:', callerID);
    updateStatus('Incoming connection...');
    if (peers[callerID]) return;

    const peer = new SimplePeer({
        initiator: false,
        trickle: false,
        stream: localStream,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        }
    });

    peer.on('signal', (data) => {
        console.log('Emitting return-signal to', callerID);
        socket.emit('return-signal', {
            signal: data,
            callerID: callerID
        });
    });

    peer.on('stream', (stream) => {
        console.log('Received remote stream from', callerID, stream);
        addRemoteVideo(stream, callerID);
        updateStatus('Connected to remote user');
    });

    peer.on('close', () => {
        removeRemoteVideo(callerID);
        delete peers[callerID];
    });

    peer.on('error', err => console.error('Peer error', err));

    peer.signal(signal);
    peers[callerID] = peer;
});

// Handle receiving returned signal
socket.on('receiving-returned-signal', ({ signal, id }) => {
    console.log('Received returned signal from', id);
    if (peers[id]) {
        peers[id].signal(signal);
    } else {
        console.warn('No peer found for id', id);
    }
});

// Handle user disconnect
socket.on('user-disconnected', (userId) => {
    console.log('User disconnected:', userId);
    updateStatus('Remote user disconnected', false);
    if (peers[userId]) {
        try { peers[userId].destroy(); } catch (e) {}
        delete peers[userId];
    }
    removeRemoteVideo(userId);
});

// Handle socket disconnection
socket.on('disconnect', () => {
    console.log('Socket disconnected');
    updateStatus('Disconnected from server', false);
    // Destroy all peers and clear remote videos
    for (const id in peers) {
        try { peers[id].destroy(); } catch (e) {}
        delete peers[id];
    }
    remoteVideosContainer.innerHTML = '';
});

// Handle socket connection
socket.on('connect', () => {
    updateStatus('Connected to server');
});

// Chat message handling
if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text || !currentRoom) return;

        const senderName = (usernameEl && usernameEl.textContent) ? usernameEl.textContent : 'You';
        appendChatMessage({ sender: 'You', message: text, timestamp: Date.now(), isOwn: true });
        socket.emit('chat-message', { roomId: currentRoom, message: text, sender: senderName });
        chatInput.value = '';
    });
}

socket.on('chat-message', ({ sender, message, timestamp, socketId }) => {
    const isOwn = socketId === socket.id;
    if (isOwn) return; // Already appended locally
    appendChatMessage({ sender: sender || 'Guest', message, timestamp, isOwn: false });
});

// If server sends list of current users when we join
socket.on('all-users', (users) => {
    console.log('all-users list received:', users);
    users.forEach(userId => connectToNewUser(userId));
});

// Function to add video stream to video element
function addVideoStream(video, stream) {
    try {
        video.srcObject = stream;
        video.addEventListener('loadedmetadata', () => {
            video.play().catch(e => console.error('Error playing video:', e));
        });
    } catch (error) {
        console.error('Error adding video stream:', error);
    }
}

function addRemoteVideo(stream, id) {
    // Avoid duplicate
    if (document.getElementById(`remote-${id}`)) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'video-wrapper';
    wrapper.id = `remote-${id}`;

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => video.play().catch(e => console.error(e)));

    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = id;

    wrapper.appendChild(video);
    wrapper.appendChild(label);
    remoteVideosContainer.appendChild(wrapper);
}

function removeRemoteVideo(id) {
    const el = document.getElementById(`remote-${id}`);
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

// (duplicate handler removed) receiving-returned-signal is handled above.

// Initialize room controls visibility
document.addEventListener('DOMContentLoaded', () => {
    roomInfo.classList.remove('show');
    joinControls.classList.remove('show');
    // Initialize local media stream for quick preview
    getMedia();
}); 