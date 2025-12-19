// 🖥️ SCREEN SHARE FEATURE - CODE REFERENCE
// This file shows the actual implementation from script.js

// ============================================
// STEP 1: VARIABLES AND BUTTON REFERENCE
// ============================================

const screenShareBtn = document.getElementById('screenShareBtn');
let isScreenSharing = false;

// ============================================
// STEP 2: BUTTON CLICK HANDLER
// ============================================

screenShareBtn.addEventListener('click', async () => {
    if (!isScreenSharing) {
        // START SCREEN SHARING
        try {
            // Request screen share from browser
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { 
                    cursor: 'always'  // Show cursor in shared screen
                },
                audio: false          // No system audio (can be enabled)
            });
            
            // Get the video track from screen stream
            const screenTrack = screenStream.getVideoTracks()[0];
            
            // Replace camera track with screen track for ALL connected peers
            for (const id in peers) {
                const sender = peers[id].streams[0].getVideoTracks()[0];
                peers[id].replaceTrack(sender, screenTrack, localStream);
            }
            
            // Update local video to show screen
            localVideo.srcObject = screenStream;
            isScreenSharing = true;
            screenShareBtn.classList.add('active');
            updateStatus('Screen sharing active');
            
            // Handle when user stops sharing via browser button
            screenTrack.onended = () => {
                stopScreenShare();
            };
            
        } catch (err) {
            console.error('Error sharing screen:', err);
            updateStatus('Screen share failed', false);
        }
    } else {
        // STOP SCREEN SHARING
        stopScreenShare();
    }
});

// ============================================
// STEP 3: STOP SCREEN SHARE FUNCTION
// ============================================

function stopScreenShare() {
    if (localStream) {
        // Get original camera track
        const videoTrack = localStream.getVideoTracks()[0];
        
        // Replace screen track back to camera for ALL peers
        for (const id in peers) {
            const sender = peers[id].streams[0].getVideoTracks()[0];
            peers[id].replaceTrack(sender, videoTrack, localStream);
        }
        
        // Restore camera preview
        localVideo.srcObject = localStream;
    }
    
    isScreenSharing = false;
    screenShareBtn.classList.remove('active');
    updateStatus('Screen sharing stopped');
}

// ============================================
// HOW IT WORKS - DETAILED EXPLANATION
// ============================================

/*
1. USER CLICKS BUTTON
   ↓
2. BROWSER SHOWS SCREEN PICKER
   - User selects window/screen/tab
   - User clicks "Share"
   ↓
3. GET SCREEN STREAM
   - getDisplayMedia() returns MediaStream
   - Extract video track from stream
   ↓
4. REPLACE TRACKS
   - For each connected peer:
     * Get current video track (camera)
     * Replace with screen track
     * Uses WebRTC replaceTrack() API
   ↓
5. UPDATE UI
   - Show screen in local video
   - Mark button as active
   - Update status message
   ↓
6. REMOTE USERS SEE SCREEN
   - Automatically receive new track
   - No reconnection needed
   - Seamless transition
   ↓
7. STOP SHARING
   - Two ways to stop:
     a) Click button again
     b) Browser "Stop Sharing" button
   ↓
8. RESTORE CAMERA
   - Replace screen track with camera
   - Update local preview
   - Reset button state
*/

// ============================================
// KEY CONCEPTS
// ============================================

/*
CONCEPT 1: MediaStream vs MediaStreamTrack
- MediaStream: Container for tracks (video + audio)
- MediaStreamTrack: Individual track (one video OR one audio)
- We replace the TRACK, not the entire stream

CONCEPT 2: replaceTrack() Method
- Part of WebRTC RTCRtpSender API
- Replaces track without renegotiating connection
- Maintains existing peer connection
- Much faster than creating new connection

CONCEPT 3: Track States
- Camera Track: From getUserMedia()
- Screen Track: From getDisplayMedia()
- Only one can be active at a time per peer

CONCEPT 4: Peer Connection Structure
peers = {
    'socket-id-1': SimplePeer {
        streams: [MediaStream],
        replaceTrack: function()
    },
    'socket-id-2': SimplePeer { ... }
}
*/

// ============================================
// BROWSER API BREAKDOWN
// ============================================

/*
API: navigator.mediaDevices.getDisplayMedia()

PARAMETERS:
{
    video: {
        cursor: 'always' | 'motion' | 'never',
        // 'always' - Always show cursor
        // 'motion' - Show cursor when moving
        // 'never' - Never show cursor
        
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 30, max: 30 }
    },
    audio: false | {
        echoCancellation: false,
        noiseSuppression: false
    }
}

RETURNS: Promise<MediaStream>

THROWS:
- NotAllowedError: User denied permission
- NotFoundError: No screen to capture
- NotSupportedError: Browser doesn't support
- AbortError: User closed picker without selecting
*/

// ============================================
// TRACK REPLACEMENT PROCESS
// ============================================

/*
FOR EACH PEER CONNECTION:

1. Get Current Sender
   const sender = peer.streams[0].getVideoTracks()[0]
   
2. Get New Track
   const newTrack = screenStream.getVideoTracks()[0]
   
3. Replace
   peer.replaceTrack(sender, newTrack, localStream)
   
WHAT HAPPENS INTERNALLY:
- WebRTC renegotiates codec if needed
- Maintains RTP session
- Remote peer receives new track event
- Stream updates automatically
- No ICE renegotiation needed
*/

// ============================================
// ERROR HANDLING
// ============================================

function handleScreenShareError(error) {
    switch(error.name) {
        case 'NotAllowedError':
            console.log('User denied permission');
            updateStatus('Permission denied', false);
            break;
            
        case 'NotFoundError':
            console.log('No screen found');
            updateStatus('No screen available', false);
            break;
            
        case 'NotSupportedError':
            console.log('Browser not supported');
            updateStatus('Feature not supported', false);
            break;
            
        case 'AbortError':
            console.log('User cancelled');
            updateStatus('Screen share cancelled', false);
            break;
            
        default:
            console.error('Unknown error:', error);
            updateStatus('Screen share failed', false);
    }
}

// ============================================
// ADVANCED: WITH SYSTEM AUDIO
// ============================================

/*
To enable system audio sharing:

const screenStream = await navigator.mediaDevices.getDisplayMedia({
    video: { cursor: 'always' },
    audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
    }
});

// Now screenStream has both video and audio tracks
const audioTracks = screenStream.getAudioTracks();
if (audioTracks.length > 0) {
    // Mix system audio with microphone audio
    // Or replace microphone audio
}
*/

// ============================================
// TESTING & DEBUGGING
// ============================================

/*
HOW TO TEST:

1. Console Logs:
   console.log('Screen stream:', screenStream);
   console.log('Screen tracks:', screenStream.getTracks());
   console.log('Peers:', peers);

2. Check Track States:
   screenTrack.onended = () => console.log('Track ended');
   screenTrack.onmute = () => console.log('Track muted');

3. Monitor Remote Side:
   peer.on('stream', stream => {
       console.log('Received stream:', stream);
       console.log('Video tracks:', stream.getVideoTracks());
   });

4. Browser DevTools:
   - chrome://webrtc-internals (Chrome/Edge)
   - about:webrtc (Firefox)
   - Shows all peer connections and track stats
*/
