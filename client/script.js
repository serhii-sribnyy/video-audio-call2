
const serverUrl = window.location.origin;
const socket = io.connect(serverUrl);
const peers = {};
let currentRoom = null;

function joinRoom() {
  const room = document.getElementById('roomInput').value.trim();
  if (!room) return alert('Enter room name');
  currentRoom = room;
  document.getElementById('joinScreen').style.display = 'none';
  document.getElementById('callScreen').style.display = 'block';
  document.getElementById('roomName').innerText = 'Room: ' + room;

  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    document.getElementById('localVideo').srcObject = stream;
    socket.emit('join', room);

    socket.on('user-joined', id => createPeer(id, stream, true));
    socket.on('signal', handleSignal);
    socket.on('user-left', id => {
      if (peers[id]) {
        peers[id].close();
        delete peers[id];
        document.getElementById(id)?.remove();
      }
    });
  });
}

function createPeer(id, stream, initiator) {
  const pc = new RTCPeerConnection();
  stream.getTracks().forEach(track => pc.addTrack(track, stream));
  peers[id] = pc;

  pc.onicecandidate = e => {
    if (e.candidate) socket.emit('signal', { room: currentRoom, to: id, candidate: e.candidate });
  };

  pc.ontrack = e => {
    let video = document.getElementById(id);
    if (!video) {
      video = document.createElement('video');
      video.id = id;
      video.autoplay = true;
      video.playsInline = true;
      video.style.width = '200px';
      document.getElementById('remoteVideos').appendChild(video);
    }
    video.srcObject = e.streams[0];
  };

  if (initiator) {
    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      socket.emit('signal', { room: currentRoom, to: id, sdp: offer });
    });
  }

  return pc;
}

function handleSignal({ from, sdp, candidate }) {
  const localStream = document.getElementById('localVideo').srcObject;
  const pc = peers[from] || createPeer(from, localStream, false);
  if (sdp) pc.setRemoteDescription(new RTCSessionDescription(sdp))
    .then(() => {
      if (sdp.type === 'offer') {
        pc.createAnswer().then(answer => {
          pc.setLocalDescription(answer);
          socket.emit('signal', { room: currentRoom, to: from, sdp: answer });
        });
      }
    });
  if (candidate) pc.addIceCandidate(new RTCIceCandidate(candidate));
}
