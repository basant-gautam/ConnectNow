const socket = io('/');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
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

let localStream;
let peer;
let currentRoom;
let myVideoStream;

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
    if (peer) {
        peer.destroy();
        peer = null;
    }
    
    currentRoom = roomId;
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
    console.log('Initiating connection to:', userId);
    
    // Create a new peer connection
    peer = new SimplePeer({
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
        console.log('Sending signal to:', userId);
        socket.emit('send-signal', {
            userToSignal: userId,
            callerID: socket.id,
            signal: data
        });
    });

    peer.on('stream', (stream) => {
        console.log('Received stream from peer');
        remoteVideo.srcObject = stream;
        updateStatus('Connected to remote user');
    });

    peer.on('error', (err) => {
        console.error('Peer connection error:', err);
        updateStatus('Connection error', false);
        alert('Connection error. Please try rejoining the room.');
    });

    peer.on('close', () => {
        console.log('Peer connection closed');
        remoteVideo.srcObject = null;
        updateStatus('Connection closed', false);
    });
}

// Handle incoming calls
socket.on('user-joined', ({ signal, callerID }) => {
    console.log('Received join signal from:', callerID);
    updateStatus('Incoming connection...');
    
    if (peer) {
        console.log('Destroying existing peer connection');
        peer.destroy();
    }
    
    peer = new SimplePeer({
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
        console.log('Sending return signal to:', callerID);
        socket.emit('return-signal', {
            signal: data,
            callerID: callerID
        });
    });

    peer.on('stream', (stream) => {
        console.log('Received stream from peer');
        remoteVideo.srcObject = stream;
        updateStatus('Connected to remote user');
    });

    peer.on('error', (err) => {
        console.error('Peer connection error:', err);
        updateStatus('Connection error', false);
        alert('Connection error. Please try rejoining the room.');
    });

    peer.on('close', () => {
        console.log('Peer connection closed');
        remoteVideo.srcObject = null;
        updateStatus('Connection closed', false);
    });

    peer.signal(signal);
});

// Handle receiving returned signal
socket.on('receiving-returned-signal', ({ signal, id }) => {
    console.log('Received returned signal from:', id);
    if (peer) {
        peer.signal(signal);
    }
});

// Handle user disconnect
socket.on('user-disconnected', (userId) => {
    console.log('User disconnected:', userId);
    updateStatus('Remote user disconnected', false);
    if (peer) {
        peer.destroy();
        peer = null;
    }
    remoteVideo.srcObject = null;
});

// Handle socket disconnection
socket.on('disconnect', () => {
    console.log('Socket disconnected');
    updateStatus('Disconnected from server', false);
    if (peer) {
        peer.destroy();
        peer = null;
    }
    remoteVideo.srcObject = null;
});

// Handle socket connection
socket.on('connect', () => {
    updateStatus('Connected to server');
});

// Function to handle video stream
async function setupVideoStream() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        myVideoStream = stream;
        addVideoStream(localVideo, stream);
        
        // Handle incoming calls
        socket.on('user-connected', userId => {
            console.log('User connected:', userId);
            connectToNewUser(userId, stream);
            updateStatus(true);
        });

        // Handle user disconnection
        socket.on('user-disconnected', userId => {
            console.log('User disconnected:', userId);
            if (peers[userId]) {
                peers[userId].close();
                delete peers[userId];
            }
            updateStatus(false);
        });

    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Unable to access camera or microphone. Please check your permissions.');
    }
}

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

// Handle receiving returned signal
socket.on('receiving-returned-signal', payload => {
    const peer = new SimplePeer({
        initiator: false,
        trickle: false,
        stream: myVideoStream
    });

    peer.on('signal', signal => {
        socket.emit('return-signal', {
            signal: signal,
            callerID: payload.id
        });
    });

    peer.on('stream', remoteStream => {
        addVideoStream(remoteVideo, remoteStream);
    });

    peer.signal(payload.signal);
    peers[payload.id] = peer;
});

// Initialize room controls visibility
document.addEventListener('DOMContentLoaded', () => {
    roomInfo.classList.remove('show');
    joinControls.classList.remove('show');
}); 