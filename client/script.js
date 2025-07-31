// URL сервера (автоматично визначається як поточний домен)
const serverUrl = window.location.origin;

// Підключення до Socket.IO сервера
const socket = io.connect(serverUrl);

// Об'єкт для збереження всіх підключених RTCPeerConnection (ключ – ID користувача)
const peers = {};

// Поточна кімната, в якій знаходиться користувач
let currentRoom = null;

// Функція для приєднання до кімнати
function joinRoom() {
  const room = document.getElementById('roomInput').value.trim();
  if (!room) return alert('Введіть назву кімнати');
  currentRoom = room;

  // Ховаємо екран входу, показуємо екран дзвінка
  document.getElementById('joinScreen').style.display = 'none';
  document.getElementById('callScreen').style.display = 'block';
  document.getElementById('roomName').innerText = 'Кімната: ' + room;

  // Отримуємо доступ до камери та мікрофона
  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    // Відображаємо локальне відео
    document.getElementById('localVideo').srcObject = stream;

    // Відправляємо подію на сервер про приєднання до кімнати
    socket.emit('join', room);

    // Коли інший користувач приєднався – створюємо з'єднання
    socket.on('user-joined', id => createPeer(id, stream, true));

    // Отримуємо сигнальні повідомлення (SDP/ICE)
    socket.on('signal', handleSignal);

    // Коли користувач покидає кімнату – закриваємо peer-з'єднання і видаляємо відео
    socket.on('user-left', id => {
      if (peers[id]) {
        peers[id].close();
        delete peers[id];
        document.getElementById(id)?.remove();
      }
    });
  });
}

// Створює RTCPeerConnection для нового користувача
function createPeer(id, stream, initiator) {
  const pc = new RTCPeerConnection(); // Створюємо WebRTC з'єднання

  // Додаємо всі медіа-треки (відео та аудіо) до з'єднання
  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  peers[id] = pc; // Зберігаємо підключення

  // Відправка ICE-кандидатів на сервер для іншого користувача
  pc.onicecandidate = e => {
    if (e.candidate) socket.emit('signal', { room: currentRoom, to: id, candidate: e.candidate });
  };

  // Коли приходить відео/аудіо від іншого користувача
  pc.ontrack = e => {
    let video = document.getElementById(id);
    if (!video) {
      video = document.createElement('video');
      video.id = id;
      video.autoplay = true;
      video.playsInline = true;
      video.style.width = '500px';
      document.getElementById('remoteVideos').appendChild(video);
    }
    video.srcObject = e.streams[0]; // Підключаємо отриманий потік до відео
  };

  // Якщо ми ініціатор з'єднання – створюємо Offer
  if (initiator) {
    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      socket.emit('signal', { room: currentRoom, to: id, sdp: offer });
    });
  }

  return pc;
}

// Обробка сигнальних повідомлень від інших користувачів
function handleSignal({ from, sdp, candidate }) {
  const localStream = document.getElementById('localVideo').srcObject;

  // Якщо немає підключення для цього користувача – створюємо нове
  const pc = peers[from] || createPeer(from, localStream, false);

  // Якщо отримали SDP – встановлюємо як RemoteDescription
  if (sdp) pc.setRemoteDescription(new RTCSessionDescription(sdp))
      .then(() => {
        // Якщо це Offer – створюємо Answer і відправляємо назад
        if (sdp.type === 'offer') {
          pc.createAnswer().then(answer => {
            pc.setLocalDescription(answer);
            socket.emit('signal', { room: currentRoom, to: from, sdp: answer });
          });
        }
      });

  // Якщо отримали ICE-кандидата – додаємо його
  if (candidate) pc.addIceCandidate(new RTCIceCandidate(candidate));
}
