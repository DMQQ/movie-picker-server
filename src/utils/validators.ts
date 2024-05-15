import { param, query } from "express-validator";

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

export const getAllMoviesValidation = [
  query("searchType").isString().isIn(paths),
  query("page").isInt().toInt(),
  query("genre")
    .optional()
    .isString()
    .custom((value) => {
      if (!value) return false;

      const genres = value.split(",");

      for (const genre of genres) {
        if (isNaN(Number(genre))) {
          throw new Error("Invalid genre");
        }
      }
    }),
];

export const getGenresValidation = [
  param("type")
    .isString()
    .custom((value) => value.includes("movie") || value.includes("tv")),
];

export const getMaxiumumCountValidation = [
  query("type").isString().isIn(["movie", "tv"]),
  query("page").isInt().toInt(),
  query("genres")
    .optional()
    .custom((value) => {
      if (!value) return false;

      const genres = value.split(",");

      for (const genre of genres) {
        if (isNaN(Number(genre))) {
          throw new Error("Invalid genre");
        }
      }
    }),
];
