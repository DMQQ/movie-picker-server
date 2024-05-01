import express from "express";
import { createServer } from "node:http";
import { Server, Socket } from "socket.io";
import { Room, Rooms } from "./utils/Room";
import dotenv from "dotenv";
import cors from "cors";
import { MovieManager } from "./utils/MovieManager";
import axios from "axios";
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
});

app.use(express.urlencoded({ extended: true }));
app.use(cors());

const users = new Map<string, Socket>();
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
  const ipAddress =
    socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
  const userAgent = socket.handshake.headers["user-agent"];
  const constructedUserId = `${userId}-${ipAddress}-${userAgent}`;

  return constructedUserId;
}

(() => {
  io.on("connection", (socket) => {
    const userId = constructUserIdFromHeaders(socket);
    users.set(userId, socket);

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

    socket.on("get-room-details", (roomId) => {
      const room = rooms.getRoom(roomId);

      if (room) {
        io.to(roomId).emit("room-details", {
          ...room.getRoomDetails(),
          users: Array.from(room.getUsers().keys()),
        });
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

            room.setMovies(movies.map((movie: any) => movie.id));
            io.to(roomId).emit("movies", {
              movies: movies,
            });
          }
        }
      }
    });

    socket.on("get-movies", async (roomId) => {
      const room = rooms.getRoom(roomId);

      if (room) {
        const data = await movieManager.getMoviesAsync<any>({
          page: room.page,
          path: room.type,
          genre: room.genres,
        });
        const movies = data.results;

        room.setMovies([
          ...room.getMovies(),
          ...movies.map((movie: any) => movie.id),
        ]);

        io.to(roomId).emit("movies", {
          movies: movies,
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
          userId,
          socket: socket,
          username: "guest",
          picks: [],
          finished: false,
        });

        io.to(roomId).emit("active", Array.from(room.getUsers().keys()));
      }
    });

    socket.on("pick-movie", async ({ roomId, movie }) => {
      const room = rooms.getRoom(roomId);

      if (room) {
        const user = room.getUsers().get(userId);

        if (user) {
          user.picks.push(movie);

          const users = Array.from(room.getUsers().values());

          const usersPicks = users.map((u) => u.picks);

          const movies = room.getMovies();

          const index = movies.findIndex((m) => m === movie);

          let matched = 0;

          for (let i = 0; i < usersPicks.length - 1; i++) {
            for (let j = index; j < usersPicks[i].length; j++) {
              if (usersPicks[i][j] === usersPicks[i + 1][j]) {
                matched = usersPicks[i][j];

                break;
              }
            }
          }

          if (matched !== 0 && matched !== undefined) {
            let movie: { id: number; title?: string; name?: string };
            if (room.type.includes("movie")) {
              movie = await movieManager.getMovieDetailsAsync<any>(matched);
            } else {
              movie = await movieManager.getSerieDetailsAsync<any>(matched);
            }

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

app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
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
