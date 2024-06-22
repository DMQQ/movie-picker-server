import { Router } from "express";
import { MovieManager } from "../utils/MovieManager";
import path from "path";
import dotenv from "dotenv";

import { validationResult } from "express-validator";
import {
  getAllMoviesValidation,
  getGenresValidation,
  getMaxiumumCountValidation,
} from "../utils/validators";

const options = {
  method: "GET",
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
  },
};

dotenv.config({
  path: path.join(__dirname, ".env"),
});

const returnErrorOnValidationFailMiddleware = (
  req: any,
  res: any,
  next: any
) => {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    return res.status(400).json({ errors: result.array() });
  } else {
    next();
  }
};

const moviesRouter = Router();

const movieManager = new MovieManager(process.env.TMDB_API_KEY!);

moviesRouter.get("/landing", async (req, res) => {
  try {
    const trending = await movieManager.getLandingPageMovies();

    res.json(
      trending.results.map((movie: any) => ({
        id: movie.id,
        poster_path: movie.poster_path,
        title: movie.title,
        type: movie.media_type,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch landing page movies" });
  }
});

moviesRouter.get(
  "/movies",
  ...getAllMoviesValidation,
  returnErrorOnValidationFailMiddleware,
  async (req, res) => {
    const data = await movieManager.getMoviesAsync<any>({
      page: Number(req.query!.page),
      path: req.query!.searchType as string,
      genre: [],
    });

    const movies = data?.results;

    res.json(movies);
  }
);

moviesRouter.get(
  "/movie/genres/:type",
  ...getGenresValidation,
  returnErrorOnValidationFailMiddleware,
  async (req, res) => {
    const type = req.params!.type;
    const url = `https://api.themoviedb.org/3/genre/${type}/list?language=en-US`;

    try {
      const response = await fetch(url, options);

      if (!response.ok) throw new Error("Failed to fetch genres");

      const data = (await response.json()) as any;

      res.json(data.genres);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch genres" });
    }
  }
);

moviesRouter.get(
  "/movie/max-count",
  // ...getMaxiumumCountValidation,
  // returnErrorOnValidationFailMiddleware,
  async (req: any, res) => {
    const type = req.query.type as string;
    const page = req.query.page as string;

    try {
      const genres = (req.query.genres || "").toString().split(",").map(Number);

      const response = await movieManager.getMoviesAsync<any>({
        path: type,
        genre: genres,
        page: Number(page),
      });

      res.json({
        maxCount: response.total_pages >= 500 ? 500 : response.total_pages,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch max count" });
    }
  }
);

moviesRouter.get("/movie/providers/:id", async (req, res) => {
  const id = req.params.id;

  if (!id) return res.status(400).json({ message: "id is required" });

  req.query.type = req.query.type || "movie";

  try {
    const response = await movieManager.getMovieProvider(
      Number(id),
      "PL",
      req.query.type as "tv" | "movie"
    );

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch providers" });
  }
});

moviesRouter.get("/movie/:id", async (req, res) => {
  const id = req.params.id;
  const type = req.query.type as string;

  if (!id) return res.status(400).json({ message: "id is required" });
  if (!type) return res.status(400).json({ message: "type is required" });

  if (type.includes("movie")) {
    const data = await movieManager.getMovieDetailsAsync(Number(id));

    res.json(data);
  } else {
    const data = await movieManager.getSerieDetailsAsync(Number(id));

    res.json(data);
  }
});

export { moviesRouter };
