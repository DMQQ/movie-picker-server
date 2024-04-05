import express from "express";
import { createServer } from "node:http";
import { Server, Socket } from "socket.io";
import { Room, Rooms } from "./utils/Room";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server);

const users = new Map<string, Socket>();
const rooms = new Rooms();

const url = (props: { page: number }) =>
  `https://api.themoviedb.org/3/discover/movie?include_adult=true&include_video=false&language=en-US&page=${props.page}&sort_by=popularity.desc`;
const options = {
  method: "GET",
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
  },
};

const fetchMovies = async (page = 1) => {
  if (!process.env.TMDB_API_KEY) throw new Error("TMDB_API_KEY not found");
  try {
    const response = await fetch(url({ page }), options);

    if (!response.ok) return [];

    const data = (await response.json()) as any;

    return data;
  } catch (error) {}
};

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

  socket.on("get-movies", async (roomId, page) => {
    const data = await fetchMovies(page);
    const movies = data.results;
    const room = rooms.getRoom(roomId);

    if (room) {
      room.setMovies(movies);

      console.log(room.getMovies().map((m) => m.title));

      io.to(roomId).emit("movies", {
        movies: room.getMovies(),
      });
    }
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

  socket.on("pick-movie", ({ roomId, movie }) => {
    const room = rooms.getRoom(roomId);

    if (room) {
      const user = room.getUsers().get(socket.id);

      if (user) {
        user.picks.push(movie);

        const users = Array.from(room.getUsers().values());

        const usersPicks = users.map((u) => u.picks);

        const movies = room.getMovies();

        const index = movies.findIndex((m) => m.title === movie);

        for (let i = 0; i < usersPicks.length - 1; i++) {
          for (let j = index; j < usersPicks[i].length; j++) {
            if (usersPicks[i][j] === usersPicks[i + 1][j]) {
              console.log("matched", usersPicks[i][j]);

              io.to(roomId).emit(
                "matched",
                movies.find((m) => m.title === usersPicks[i][j])
              );

              break;
            }
          }
        }
      }
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
