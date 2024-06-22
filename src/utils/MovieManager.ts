import dotenv from "dotenv";

dotenv.config();

interface GetMoviesAsyncOptions {
  page?: number;
  genre?: number[];
  path: string;
}

interface Movie {
  adult: boolean;
  backdrop_path: string;
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  release_date: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}

export class MovieManager {
  private TMDB_API_KEY: string;

  constructor(env: string) {
    this.TMDB_API_KEY = env;
  }

  private url(path: string, page = 1) {
    return `https://api.themoviedb.org/3${path}?api_key=${this.TMDB_API_KEY}&language=en-US&page=${page}&sort_by=popularity.desc&include_adult=true&without_keywords=Anime,Talk&region=PL&with_watch_monetization_types=flatrate,free,ads,rent,purchase`;
  }

  private async query<T>(path: string): Promise<T> {
    const repsonse = await fetch(path, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${this.TMDB_API_KEY}`,
      },
    });

    if (!repsonse.ok) {
      throw new Error("Failed to fetch movies");
    }

    return repsonse.json() as T;
  }

  async getLandingPageMovies() {
    try {
      let url = `https://api.themoviedb.org/3/trending/all/day?language=en-US`;

      const data = await this.query<{
        results: Movie[];
      }>(url);

      return data;
    } catch (error) {
      return { results: [] };
    }
  }

  async getMoviesAsync<T>(options: GetMoviesAsyncOptions): Promise<T | null> {
    if (!this.TMDB_API_KEY)
      throw new Error("TMDB_API_KEY is not set in .env file");

    const { page = 1, genre, path } = options;

    let url = this.url(path, page || 1);

    if (genre && genre.length > 0 && genre[0] !== 0) {
      url += "&with_genres=" + genre?.join("|");
    }

    try {
      const data = await this.query(url);

      return data as T;
    } catch (error) {
      return null;
    }
  }

  async getMovieDetailsAsync<T>(id: number): Promise<T | null> {
    if (!this.TMDB_API_KEY)
      throw new Error("TMDB_API_KEY is not set in .env file");

    const url = `https://api.themoviedb.org/3/movie/${id}?api_key=${this.TMDB_API_KEY}&language=en-US`;

    try {
      const data = await this.query(url);

      return data as T;
    } catch (error) {
      return null;
    }
  }

  async getSerieDetailsAsync<T>(id: number): Promise<T | null> {
    if (!this.TMDB_API_KEY)
      throw new Error("TMDB_API_KEY is not set in .env file");

    const url = `https://api.themoviedb.org/3/tv/${id}?api_key=${this.TMDB_API_KEY}&language=en-US`;

    try {
      const data = await this.query(url);

      return data as T;
    } catch (error) {
      return null;
    }
  }

  async getImagesAsync(id: number, type: "movie" | "tv") {
    if (!this.TMDB_API_KEY)
      throw new Error("TMDB_API_KEY is not set in .env file");

    const url = `https://api.themoviedb.org/3/${type}/${id}/images`;

    const data = await this.query(url);

    return data;
  }

  async getMovieProvider(id: number, locale: string, type: "movie" | "tv") {
    let url = "";

    if (type === "tv") {
      url = `https://api.themoviedb.org/3/tv/${id}/watch/providers`;
    } else {
      url = `https://api.themoviedb.org/3/movie/${id}/watch/providers`;
    }

    try {
      const data = await this.query<{
        results: {
          [key: string]: {
            link: string;
            rent: {
              link: string;
              flatrate: {
                link: string;
              }[];
            };
            buy: {
              link: string;
              flatrate: {
                link: string;
              }[];
            };
          };
        };
      }>(url);

      return data?.["results"]?.[locale.toUpperCase()];
    } catch (error) {
      return [];
    }
  }
}
