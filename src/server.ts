import express from "express";
import { createServer } from "node:http";
import { Server, Socket } from "socket.io";
import { Room, Rooms } from "./utils/Room";
import dotenv from "dotenv";
import cors from "cors";
import { MovieManager } from "./utils/MovieManager";
import { moviesRouter } from "./controllers/movies.controller";

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
  addTrailingSlash: true,

  transports: ["websocket", "polling"],

  connectionStateRecovery: {
    maxDisconnectionDuration: 10000,
  },

  pingInterval: 5000,
});

app.use(express.urlencoded({ extended: true }));
app.use(cors());

interface ConnectedUser {
  socket: {
    id: Socket["id"];
  };
  roomId: string;
}

const users = new Map<string, ConnectedUser>();
const rooms = new Rooms();

const paths = [
  "/discover/movie",
  "/movie/now_playing",
  "/movie/popular",
  "/movie/top_rated",
  "/movie/upcoming",
  "/discover/tv",
  "/tv/top_rated",
  "/tv/popular",
  "/tv/airing_today",
  "/tv/on_the_air",
];

const movieManager = new MovieManager(process.env.TMDB_API_KEY!);

function constructUserIdFromHeaders(socket: Socket) {
  const userId = socket.handshake.headers["user-id"];
  const constructedUserId = `${userId}-${socket.id}`;

  return constructedUserId;
}

(() => {
  io.on("connection", (socket) => {
    const userId = constructUserIdFromHeaders(socket);
    users.set(userId, {
      socket: socket,
      roomId: "",
    });

    // create room and join room
    socket.on("create-room", (type, pageRange = 1, genres: number[] = []) => {
      if (!paths.includes(type)) return;

      const room = new Room()
        .setAdminUser({
          userId,
          socket,
          username: "host",
        })
        .setType(type)
        .setPage(Math.floor(Math.random() * pageRange) + 1)
        .setGenres(genres);

      rooms.createRoom(room.getId(), room);
      socket.emit("room-created", room.getId());
    });

    socket.on("get-overview", (roomId: string) => {
      const room = rooms.getRoom(roomId);

      if (room) {
        io.to(roomId).emit("overview", room.getMatchedMovies());
      }
    });

    // delete room and leave room
    socket.on("delete-room", (roomId: string) => {
      if (rooms.getRoom(roomId)?.getHost() === userId) {
        rooms.deleteRoom(roomId);
        socket.leave(roomId);
        io.to(roomId).emit("room-deleted", roomId);
      }
    });

    socket.on("get-buddy-status", (roomId) => {
      const room = rooms.getRoom(roomId);
      if (room) {
        const users = Array.from(room.getUsers().values());

        const allFinished = users.every((u) => u.finished);

        io.to(roomId).emit("buddy-status", {
          finished: allFinished,
        });
      }
    });

    socket.on("finish", async (roomId: string) => {
      const room = rooms.getRoom(roomId);
      if (room) {
        const user = room.getUsers().get(userId);

        if (user) {
          user.finished = true;

          const users = Array.from(room.getUsers().values());
          const allFinished = users.every((u) => u.finished);

          if (allFinished) {
            room.nextPage();
            users.forEach((u) => {
              (u.finished = false), (u.picks = []);
            });

            const data = await movieManager.getMoviesAsync<any>({
              page: room.page,
              path: room.type,
              genre: room.genres,
            });
            const movies = data.results;

            room.setMovies(movies);
            io.to(roomId).emit("movies", {
              movies: movies,
            });
          }
        }
      }
    });

    socket.on("join-room", async (roomId: string) => {
      const room = rooms.getRoom(roomId);

      if (room) {
        socket.join(roomId);
        socket.emit("room-joined", room);
        users.set(userId, {
          socket: socket,
          roomId: roomId,
        });

        room?.addUser({
          userId,
          socket: socket,
          username: "guest",
        });

        let movies = [];

        if (room.getMovies().length === 0) {
          const data = await movieManager.getMoviesAsync<any>({
            page: room.page,
            path: room.type,
            genre: room.genres,
          });
          movies = data.results;
        }

        room.setMovies(movies);

        io.to(socket.id).emit("movies", {
          movies: movies,
        });

        io.to(socket.id).emit("room-details", {
          ...room.getRoomDetails(),
          users: Array.from(room.getUsers().keys()),
        });

        io.to(roomId).emit("active", Array.from(room.getUsers().keys()));
      }
    });

    socket.on("pick-movie", async ({ roomId, movie, index }) => {
      const room = rooms.getRoom(roomId);

      if (room) {
        const user = room.getUsers().get(userId);

        if (user) {
          user.picks.push(movie);

          const users = Array.from(room.getUsers().values());

          if (movie === 0 || users.length === 1) return;

          let matched = 0,
            allMatched = true;

          for (let i = 0; i < users.length; i++) {
            if (!users[i].picks.includes(movie)) {
              allMatched = false;
              break;
            }
          }

          if (allMatched) matched = movie;

          if (matched !== 0 && matched !== undefined) {
            let movie = room.getMovies().find((m) => m.id === matched) as any;

            room.addMatchedMovies({
              id: movie.id,
              title: movie.title ? movie.title : movie.name,
            });

            io.to(roomId).emit("matched", movie);
          }
        }
      }
    });

    // remove user from room and leave room on disconnect
    socket.on("leave-room", (roomId: string) => {
      const room = rooms.getRoom(roomId);

      if (room) {
        room.removeUser(userId);
        socket.leave(roomId);
        io.emit("active", Array.from(room.getUsers().keys()));
      }
    });

    socket.on("disconnect", () => {
      const roomId = users.get(userId)?.roomId;

      if (roomId) {
        const room = rooms.getRoom(roomId);
        if (room) {
          room.removeUser(userId);
          io.to(roomId).emit("active", Array.from(room.getUsers().keys()));
        }
      }
      users.delete(userId);
      socket.disconnect();
    });
  });

  io.engine.on("connection_error", (err) => {
    console.log(err);
  });
})();

app.use(moviesRouter);

const PORT = Number(process.env.PORT) || 3000;

app.use((req, res, next) => {
  res.set("Connection", "keep-alive");
  next();
});

app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

server.on("error", (err) => {
  console.error(err);

  process.exit(1);
});

if (process.env.NODE_ENV === "production") {
  server.listen(PORT, () => {
    console.log(`server running at http://localhost:${process.env.PORT}`);
  });
} else if (process.env.NODE_ENV === "development") {
  server.listen(3000, "192.168.0.25", () => {
    console.log("server running at http://192.168.0.25:3000");
  });
}
