import { Server, Socket } from "socket.io";
import { Room, Rooms } from "../utils/Room";
import { MovieManager } from "../utils/MovieManager";
import { Express } from "express";
import { createServer } from "node:http";

interface ConnectedUser {
  socket: {
    id: Socket["id"];
  };
  roomId: string;
}

export const websocket = (app: Express) => {
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

  io.on("connection", (socket) => {
    // Create user id for identification through the app
    const userId = constructUserIdFromHeaders(socket);

    users.set(userId, {
      socket: socket,
      roomId: "",
    });

    // create room and join room
    socket.on("create-room", (data, ack) => {
      const { type, pageRange, genres, nickname } = data;
      if (!paths.includes(type)) return;

      const room = new Room()
        .setAdminUser({
          userId,
          socket,
          username: nickname,
        })
        .setType(type)
        .setPage(Math.floor(Math.random() * pageRange) + 1)
        .setGenres(genres);

      rooms.createRoom(room.getId(), room);

      ack({
        roomId: room.getId(),
        details: {
          ...room.getRoomDetails(),
          users: room.getUsersNicks(),
        },
      });

      //socket.emit("room-created", room.getId());
    });

    // Get all matches in room
    socket.on("get-overview", (roomId: string) => {
      const room = rooms.getRoom(roomId);

      if (room) {
        io.to(roomId).emit("overview", room.getMatchedMovies());
      }
    });

    // leave room and delete if host
    socket.on("delete-room", (roomId: string) => {
      if (rooms.getRoom(roomId)?.getHost() === userId) {
        rooms.deleteRoom(roomId);
        socket.leave(roomId);
        io.to(roomId).emit("room-deleted", roomId);
      }
    });

    // Check if all users in room have finished
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

    // Finish round and get new movies if all users have finished
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
            // reset users picks and finished status
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

    // Send movies to single user if requested
    socket.on("get-movies", async (roomId: string) => {
      const room = rooms.getRoom(roomId);

      if (room) {
        const movies = room.getMovies();

        io.to(socket.id).emit("movies", {
          movies: movies,
        });
      }
    });

    // Join room and get room details, fetch movies if room is empty
    socket.on("join-room", async (roomId: string, username = "guest", ack) => {
      const room = rooms.getRoom(roomId);

      ack?.({
        joined: !!room,
      });

      if (room) {
        socket.join(roomId);
        users.set(userId, {
          socket: socket,
          roomId: roomId,
        });

        room?.addUser({
          userId,
          socket: socket,
          username: username,
        });

        let movies = room.getMovies();

        if (movies.length === 0) {
          movies = (
            await movieManager.getMoviesAsync<any>({
              page: room.page,
              path: room.type,
              genre: room.genres,
            })
          ).results;

          room.setMovies(movies);
        }

        io.to(socket.id).emit("movies", {
          movies: movies,
        });

        io.to(socket.id).emit("room-details", {
          ...room.getRoomDetails(),
          users: room.getUsersNicks(),
        });

        io.to(socket.id).emit("room-joined", room);

        io.to(roomId).emit("active", room.getUsersNicks());
      }
    });

    // Pick movie and check if all users have picked the same movie if so emit matched event
    socket.on("pick-movie", async ({ roomId, movie, index }) => {
      const room = rooms.getRoom(roomId);

      if (room) {
        const user = room.getUsers().get(userId);

        if (user) {
          user.picks.push(movie);

          const users = Array.from(room.getUsers().values());

          if (movie === 0 || users.length === 1) return;

          let matched = 0;
          let allMatched = true;

          // check if all users have picked the same movie
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

        io.emit("active", room.getUsersNicks());

        if (room.getUsers().size === 0) {
          rooms.deleteRoom(roomId);
        }
      }
    });

    // Handle random disconnects, delete room if empty
    socket.on("disconnect", () => {
      const roomId = users.get(userId)?.roomId;

      if (roomId) {
        const room = rooms.getRoom(roomId);
        if (room) {
          room.removeUser(userId);
          io.to(roomId).emit("active", room.getUsersNicks());

          if (room.getUsers().size === 0) {
            rooms.deleteRoom(roomId);
          }
        }
      }
      users.delete(userId);
      socket.disconnect();
    });
  });

  io.engine.on("connection_error", (err) => {
    console.log(err);
  });

  return server;
};
