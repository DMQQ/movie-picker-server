import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { moviesRouter } from "./controllers/movies.controller";
import { websocket } from "./controllers/websocket";

dotenv.config();

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(moviesRouter);
app.use((req, res, next) => {
  res.set("Connection", "keep-alive");
  next();
});

const server = websocket(app);

const PORT = Number(process.env.PORT) || 3000;

app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

server.on("error", (err) => {
  console.error(err);

  process.exit(1);
});

if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${
          res.statusCode
        } - ${duration}ms`
      );
    });
    next();
  });
}

function logRoutes(_app: typeof app) {
  _app._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      // Routes registered directly on the app
      const methods = Object.keys(middleware.route.methods)
        .join(", ")
        .toUpperCase();
      console.log(`${methods} ${middleware.route.path}`);
    } else if (middleware.name === "router") {
      // Routes added with the router middleware
      middleware.handle.stack.forEach((handler: any) => {
        const methods = Object.keys(handler.route.methods)
          .join(", ")
          .toUpperCase();
        console.log(`${methods} ${handler.route.path}`);
      });
    }
  });
}

if (process.env.NODE_ENV === "production") {
  server.listen(PORT, () => {
    console.log(`server running at http://localhost:${process.env.PORT}`);

    logRoutes(app);
  });
} else if (process.env.NODE_ENV === "development") {
  server.listen(3000, "192.168.0.25", () => {
    console.log("server running at http://192.168.0.25:3000");

    logRoutes(app);
  });
}
