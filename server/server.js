
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Створюємо HTTP-сервер та підключаємо Socket.IO
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } }); // Дозволяємо CORS для всіх клієнтів

// Віддаємо статичні файли з папки client
app.use(express.static(path.join(__dirname, '../client')));

// Обробник нових WebSocket підключень
io.on('connection', socket => {
  console.log('Нове підключення:', socket.id);

  // Коли користувач приєднується до кімнати
  socket.on('join', room => {
    socket.join(room);                            // Додаємо сокет у вказану кімнату
    socket.to(room).emit('user-joined', socket.id); // Сповіщаємо інших учасників кімнати
  });

  // Отримання сигнальних повідомлень (SDP/ICE)
  socket.on('signal', data => {
    // Пересилаємо сигнал конкретному користувачу
    io.to(data.to).emit('signal', {
      from: socket.id,
      sdp: data.sdp,
      candidate: data.candidate
    });
  });

  // Коли користувач відключається
  socket.on('disconnect', () => {
    console.log('Відключився:', socket.id);
    io.emit('user-left', socket.id); // Сповіщаємо всіх, що цей користувач покинув кімнату
  });
});

// Запуск сервера на порту Render або локальному 3000
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log('Сервер запущено на порту ' + PORT));
