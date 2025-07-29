
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '../client')));

io.on('connection', socket => {
  socket.on('join', room => {
    socket.join(room);
    socket.to(room).emit('user-joined', socket.id);
  });

  socket.on('signal', data => {
    io.to(data.to).emit('signal', { from: socket.id, sdp: data.sdp, candidate: data.candidate });
  });

  socket.on('disconnect', () => {
    io.emit('user-left', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log('Server running on port ' + PORT));
