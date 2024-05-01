import { Router } from "express";
import { MovieManager } from "../utils/MovieManager";
import path from "path";
import dotenv from "dotenv";

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

const moviesRouter = Router();

const movieManager = new MovieManager(process.env.TMDB_API_KEY!);

moviesRouter.get("/movies", async (req, res) => {
  const page = req.query.page as string;
  const searchType = req.query.searchType as string;

  if (!searchType) return res.status(400).json({ message: "type is required" });
  if (!page) return res.status(400).json({ message: "page is required" });
  if (!paths.includes(searchType))
    return res.status(400).json({ message: "invalid type" });

  const data = await movieManager.getMoviesAsync<any>({
    page: Number(page),
    path: searchType,
    genre: [],
  });

  const movies = data?.results;

  res.json(movies);
});

moviesRouter.get("/movie/genres/:type", async (req, res) => {
  const type = req.params.type;

  if (!type) return res.status(400).json({ message: "type is required" });
  if (!type.includes("movie") && !type.includes("tv"))
    return res.status(400).json({ message: "invalid type" });

  const url = `https://api.themoviedb.org/3/genre/${type}/list?language=en-US`;

  try {
    const response = await fetch(url, options);

    if (!response.ok) throw new Error("Failed to fetch genres");

    const data = (await response.json()) as any;

    res.json(data.genres);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch genres" });
  }
});

moviesRouter.get("/movie/max-count", async (req, res) => {
  const type = req.query.type as string;
  const page = (req.query.page as string) || "1";

  if (!type) return res.status(400).json({ message: "type is required" });
  if (!type.includes("movie") && !type.includes("tv"))
    return res.status(400).json({ message: "invalid type" });

  try {
    const genres = (req.query.genres || "").toString().split(",") as string[];

    const response = await movieManager.getMoviesAsync<any>({
      path: type,
      genre: genres.map((g) => Number(g)),
      page: Number(page),
    });

    res.json({
      maxCount: response.total_pages >= 500 ? 500 : response.total_pages,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch max count" });
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
