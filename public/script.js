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

// Feature control buttons
const muteBtn = document.getElementById('muteBtn');
const videoBtn = document.getElementById('videoBtn');
const screenShareBtn = document.getElementById('screenShareBtn');
const settingsBtn = document.getElementById('settingsBtn');
const leaveBtn = document.getElementById('leaveBtn');
const featureControls = document.querySelector('.feature-controls');

let localStream;
let peers = {}; // map of socketId -> SimplePeer
let peerUsernames = {}; // map of socketId -> username
let currentRoom;
let myVideoStream;
let chatLastTimestamp = null;
let isAudioMuted = false;
let isVideoOff = false;
let isScreenSharing = false;

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
    statusDot.style.background = success ? '#00d4ff' : '#ff0064';
    statusIndicator.style.color = success ? '#00d4ff' : '#ff0064';
}

// Feature Control Functions
muteBtn.addEventListener('click', () => {
    if (!localStream) return;
    
    isAudioMuted = !isAudioMuted;
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !isAudioMuted;
    });
    
    if (isAudioMuted) {
        muteBtn.classList.remove('active');
        muteBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
        `;
        updateStatus('Microphone muted', false);
    } else {
        muteBtn.classList.add('active');
        muteBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
        `;
        updateStatus('Microphone active');
    }
});

videoBtn.addEventListener('click', () => {
    if (!localStream) return;
    
    isVideoOff = !isVideoOff;
    const localVideoEl = document.getElementById('localVideo');
    const localPlaceholder = document.getElementById('localPlaceholder');
    
    localStream.getVideoTracks().forEach(track => {
        track.enabled = !isVideoOff;
    });
    
    if (isVideoOff) {
        videoBtn.classList.remove('active');
        videoBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
        `;
        localVideoEl.style.display = 'none';
        localPlaceholder.style.display = 'flex';
        updateStatus('Camera off', false);
    } else {
        videoBtn.classList.add('active');
        videoBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="2" y="5" width="14" height="14" rx="2" ry="2"/>
            </svg>
        `;
        localVideoEl.style.display = 'block';
        localPlaceholder.style.display = 'none';
        updateStatus('Camera active');
    }
});

screenShareBtn.addEventListener('click', async () => {
    if (!isScreenSharing) {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always' },
                audio: false
            });
            
            const screenTrack = screenStream.getVideoTracks()[0];
            
            // Replace video track in all peer connections
            for (const id in peers) {
                const sender = peers[id].streams[0].getVideoTracks()[0];
                peers[id].replaceTrack(sender, screenTrack, localStream);
            }
            
            localVideo.srcObject = screenStream;
            isScreenSharing = true;
            screenShareBtn.classList.add('active');
            updateStatus('Screen sharing active');
            
            screenTrack.onended = () => {
                stopScreenShare();
            };
        } catch (err) {
            console.error('Error sharing screen:', err);
            updateStatus('Screen share failed', false);
        }
    } else {
        stopScreenShare();
    }
});

function stopScreenShare() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        
        // Replace back to camera in all peer connections
        for (const id in peers) {
            const sender = peers[id].streams[0].getVideoTracks()[0];
            peers[id].replaceTrack(sender, videoTrack, localStream);
        }
        
        localVideo.srcObject = localStream;
    }
    
    isScreenSharing = false;
    screenShareBtn.classList.remove('active');
    updateStatus('Screen sharing stopped');
}

settingsBtn.addEventListener('click', () => {
    alert('Settings feature coming soon!\\nYou can configure:\\n• Video quality\\n• Audio settings\\n• Notifications\\n• Privacy options');
});

leaveBtn.addEventListener('click', () => {
    if (currentRoom && confirm('Are you sure you want to leave the room?')) {
        // Destroy all peer connections
        for (const id in peers) {
            try { peers[id].destroy(); } catch (e) {}
            delete peers[id];
        }
        
        // Clear remote videos
        remoteVideosContainer.innerHTML = '';
        
        // Leave the room
        socket.emit('leave-room', currentRoom);
        currentRoom = null;
        
        // Reset UI
        roomInfo.classList.remove('show');
        joinControls.classList.remove('show');
        chatRoomLabel.textContent = 'Not in a room';
        clearChat();
        updateStatus('Left the room');
        
        // Hide feature controls when leaving
        if (featureControls) {
            featureControls.classList.remove('show');
        }
    }
});

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
    if (!localStream) {
        const success = await getMedia();
        if (!success) return;
    }
    
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
    if (!localStream) {
        const success = await getMedia();
        if (!success) return;
    }
    
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
    
    // Show feature controls when joining a room
    if (featureControls) {
        featureControls.classList.add('show');
    }
    
    // Get username from the page or localStorage
    let username = 'Guest';
    if (usernameEl && usernameEl.textContent && usernameEl.textContent.trim()) {
        username = usernameEl.textContent.trim();
    } else {
        // Try to get from localStorage
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user && user.username) {
                    username = user.username;
                }
            } catch (e) {
                console.error('Error parsing user from localStorage:', e);
            }
        }
    }
    
    console.log('Joining room with username:', username);
    
    // Join the room with username
    socket.emit('join-room', roomId, socket.id, username);
}

// Handle when a new user connects to our room
socket.on('user-connected', (data) => {
    const userId = data.socketId || data;
    const username = data.username || 'Guest';
    console.log('New user connected to room:', username, 'userId:', userId, 'full data:', data);
    peerUsernames[userId] = username;
    console.log('Stored username for', userId, ':', peerUsernames[userId]);
    updateStatus('User joined, establishing connection...');
    connectToNewUser(userId);
});

function connectToNewUser(userId) {
    if (!localStream) {
        console.error('connectToNewUser: No local stream available');
        return;
    }
    if (peers[userId]) {
        console.log('connectToNewUser: Peer already exists for', userId);
        return;
    }

    console.log('Creating new peer connection to', userId);
    const peer = new SimplePeer({
        initiator: true,
        trickle: false,
        stream: localStream,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        },
        offerOptions: {
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
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
        console.log('✅ Received remote stream from', userId, stream);
        addRemoteVideo(stream, userId);
        updateStatus('Connected to remote user');
    });

    peer.on('connect', () => {
        console.log('✅ Peer connected:', userId);
    });

    peer.on('error', (err) => {
        console.error('❌ Peer error for', userId, err);
        updateStatus('Connection error', false);
    });

    peer.on('close', () => {
        console.log('Peer closed:', userId);
        removeRemoteVideo(userId);
        delete peers[userId];
        delete peerUsernames[userId];
    });

    peers[userId] = peer;
}

// Handle incoming calls
socket.on('user-joined', ({ signal, callerID, username }) => {
    console.log('Received join signal from:', username || callerID, 'CallerID:', callerID);
    peerUsernames[callerID] = username || 'Guest';
    updateStatus('Incoming connection...');
    
    if (peers[callerID]) {
        console.log('Peer already exists for', callerID, 'destroying old one');
        peers[callerID].destroy();
        delete peers[callerID];
    }
    
    if (!localStream) {
        console.error('No local stream available for incoming connection');
        return;
    }

    console.log('Creating peer for incoming call from', callerID);
    const peer = new SimplePeer({
        initiator: false,
        trickle: false,
        stream: localStream,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        },
        answerOptions: {
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
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
        console.log('✅ Received remote stream from', callerID, stream);
        addRemoteVideo(stream, callerID);
        updateStatus('Connected to remote user');
    });

    peer.on('connect', () => {
        console.log('✅ Peer connected:', callerID);
    });

    peer.on('close', () => {
        console.log('Peer closed:', callerID);
        removeRemoteVideo(callerID);
        delete peers[callerID];
        delete peerUsernames[callerID];
    });

    peer.on('error', err => {
        console.error('❌ Peer error from', callerID, err);
        updateStatus('Connection error', false);
    });

    console.log('Signaling incoming peer with signal');
    peer.signal(signal);
    peers[callerID] = peer;
});

// Handle receiving returned signal
socket.on('receiving-returned-signal', ({ signal, id, username }) => {
    console.log('Received returned signal from', username || id);
    peerUsernames[id] = username || 'Guest';
    if (peers[id]) {
        peers[id].signal(signal);
    } else {
        console.warn('No peer found for id', id);
    }
});

// Handle user disconnect
socket.on('user-disconnected', (userId) => {
    console.log('User disconnected:', peerUsernames[userId] || userId);
    updateStatus('Remote user disconnected', false);
    if (peers[userId]) {
        try { peers[userId].destroy(); } catch (e) {}
        delete peers[userId];
    }
    delete peerUsernames[userId];
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
    users.forEach(user => {
        const userId = user.socketId || user;
        const username = user.username || 'Guest';
        console.log('Processing user from all-users:', userId, 'username:', username);
        peerUsernames[userId] = username;
        connectToNewUser(userId);
    });
    console.log('All stored usernames:', peerUsernames);
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

    const username = peerUsernames[id] || 'Guest';
    console.log('Adding remote video for', id, 'with username:', username, 'All usernames:', peerUsernames);

    const wrapper = document.createElement('div');
    wrapper.className = 'video-wrapper';
    wrapper.id = `remote-${id}`;
    wrapper.setAttribute('data-user-id', id);

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => video.play().catch(e => console.error(e)));

    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = peerUsernames[id] || 'Guest';

    // Add camera-off placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'video-placeholder';
    placeholder.innerHTML = `
        <div class="placeholder-content">
            <div class="user-avatar">${(peerUsernames[id] || 'Guest').charAt(0).toUpperCase()}</div>
            <div class="user-name">${peerUsernames[id] || 'Guest'}</div>
        </div>
    `;
    placeholder.style.display = 'none';

    // Monitor video track status
    stream.getVideoTracks().forEach(track => {
        const checkTrack = () => {
            if (!track.enabled) {
                video.style.display = 'none';
                placeholder.style.display = 'flex';
            } else {
                video.style.display = 'block';
                placeholder.style.display = 'none';
            }
        };
        track.addEventListener('ended', checkTrack);
        track.addEventListener('mute', checkTrack);
        track.addEventListener('unmute', checkTrack);
        setInterval(checkTrack, 1000); // Check every second
    });

    // Make video clickable to enlarge
    wrapper.addEventListener('click', () => enlargeVideo(wrapper, id));
    wrapper.style.cursor = 'pointer';

    wrapper.appendChild(video);
    wrapper.appendChild(placeholder);
    wrapper.appendChild(label);
    remoteVideosContainer.appendChild(wrapper);
}

function removeRemoteVideo(id) {
    const el = document.getElementById(`remote-${id}`);
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

// Enlarge video function
function enlargeVideo(wrapper, userId) {
    const container = document.getElementById('videoGrid');
    
    // Check if already enlarged
    if (container.classList.contains('enlarged-mode')) {
        returnToGrid();
        return;
    }
    
    // Add enlarged mode
    container.classList.add('enlarged-mode');
    wrapper.classList.add('enlarged-video');
    
    // Hide other videos
    const allWrappers = document.querySelectorAll('.video-wrapper');
    allWrappers.forEach(w => {
        if (w !== wrapper) {
            w.style.display = 'none';
        }
    });
    
    // Show return to grid button
    let returnBtn = document.getElementById('returnToGridBtn');
    if (!returnBtn) {
        returnBtn = document.createElement('button');
        returnBtn.id = 'returnToGridBtn';
        returnBtn.className = 'return-grid-btn';
        returnBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
            </svg>
            <span>Grid View</span>
        `;
        returnBtn.addEventListener('click', returnToGrid);
        container.appendChild(returnBtn);
    }
    returnBtn.style.display = 'flex';
}

function returnToGrid() {
    const container = document.getElementById('videoGrid');
    container.classList.remove('enlarged-mode');
    
    // Show all videos
    const allWrappers = document.querySelectorAll('.video-wrapper');
    allWrappers.forEach(w => {
        w.style.display = 'block';
        w.classList.remove('enlarged-video');
    });
    
    // Hide return button
    const returnBtn = document.getElementById('returnToGridBtn');
    if (returnBtn) {
        returnBtn.style.display = 'none';
    }
}

// (duplicate handler removed) receiving-returned-signal is handled above.

// Initialize room controls visibility
document.addEventListener('DOMContentLoaded', () => {
    roomInfo.classList.remove('show');
    joinControls.classList.remove('show');
    // Initialize local media stream for quick preview
    getMedia();
}); 