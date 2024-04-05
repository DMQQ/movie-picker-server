import express from "express";
import { createServer } from "node:http";
import { Server, Socket } from "socket.io";
import { Room, Rooms, defaultMovies } from "./utils/Room";

const app = express();
const server = createServer(app);
const io = new Server(server);

const users = new Map<string, Socket>();
const rooms = new Rooms();

io.on("connection", (socket) => {
  users.set(socket.id, socket);

  // create room and join room
  socket.on("create-room", () => {
    const room = new Room("dmq", "movies");
    const roomId = room.getId();
    room.addUser({
      socket: socket,
      username: "host",
      picks: [],
    });

    socket.emit("room-created", roomId);
    rooms.createRoom(roomId, room);
  });

  // delete room and leave room
  socket.on("delete-room", (roomId: string) => {
    rooms.deleteRoom(roomId);
    socket.leave(roomId);
    io.to(roomId).emit("room-deleted", roomId);
  });

  // join room and get movies
  socket.on("join-room", (roomId: string) => {
    const room = rooms.getRoom(roomId);

    if (room) {
      socket.join(roomId);
      socket.emit("room-joined", room);
      room?.addUser({
        socket: socket,
        username: "guest",
        picks: [],
      });

      io.to(roomId).emit("active", Array.from(room.getUsers().keys()));

      io.to(roomId).emit("movies", {
        movies: room.getMovies(),
      });
    }
  });

  // reset room
  socket.on("reset-room", (roomId: string) => {
    const room = rooms.getRoom(roomId);

    if (room) {
      room.setMovies(defaultMovies);
      io.to(roomId).emit("movies", {
        movies: room.getMovies(),
      });
    }
  });

  socket.on("pick-movie", (roomId, movie) => {
    const room = rooms.getRoom(roomId);

    if (room) {
      const user = room.getUsers().get(socket.id);

      if (user) {
        user.picks.push(movie);

        const users = Array.from(room.getUsers().values());

        const usersPicks = users.map((u) => u.picks);

        for (let i = 0; i < usersPicks.length; i++) {
          // to be implemented
        }
      }
    }
  });

  socket.on("filter-movies", (roomId, index) => {
    const room = rooms.getRoom(roomId);

    if (room) {
      room.setMovies(room.getMovies().filter((c, i) => i !== index));
      io.to(roomId).emit("movies", {
        movies: room.getMovies(),
      });
    }
  });

  // remove user from room and leave room on disconnect
  socket.on("leave-room", (roomId: string) => {
    const room = rooms.getRoom(roomId);

    if (room) {
      room.removeUser(socket.id);
      socket.leave(roomId);
      io.emit("active", Array.from(room.getUsers().keys()));
    }
  });

  socket.on("disconnect", () => {
    users.delete(socket.id);
  });
});

server.listen(3000, "192.168.0.25", () => {
  console.log("server running at http://192.168.0.25:3000");
});
