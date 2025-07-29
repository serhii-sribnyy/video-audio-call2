
const socket = io.connect('https://your-server-url.onrender.com');
const peers = {};

navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
  document.getElementById('localVideo').srcObject = stream;
  socket.emit('join', 'room1');

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

function createPeer(id, stream, initiator) {
  const pc = new RTCPeerConnection();
  stream.getTracks().forEach(track => pc.addTrack(track, stream));
  peers[id] = pc;

  pc.onicecandidate = e => {
    if (e.candidate) socket.emit('signal', { to: id, candidate: e.candidate });
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
      socket.emit('signal', { to: id, sdp: offer });
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
          socket.emit('signal', { to: from, sdp: answer });
        });
      }
    });
  if (candidate) pc.addIceCandidate(new RTCIceCandidate(candidate));
}
