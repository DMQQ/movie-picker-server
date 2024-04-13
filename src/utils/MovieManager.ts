import dotenv from "dotenv";

dotenv.config();

interface GetMoviesAsyncOptions {
  page?: number;
  genre?: number[];
  path: string;
}

export class MovieManager {
  private TMDB_API_KEY: string;

  constructor(env: string) {
    this.TMDB_API_KEY = env;
  }

  private url(path: string, page = 1) {
    return `https://api.themoviedb.org/3${path}?api_key=${this.TMDB_API_KEY}&language=en-US&page=${page}&watch_region=Europe&sort_by=popularity.desc&include_adult=true&without_keywords=Anime`;
  }

  async getMoviesAsync<T>(options: GetMoviesAsyncOptions): Promise<T | null> {
    if (!this.TMDB_API_KEY)
      throw new Error("TMDB_API_KEY is not set in .env file");

    const { page = 1, genre, path } = options;

    let url = this.url(path, page);

    if (genre && genre.length > 0 && genre[0] !== 0) {
      url += "&with_genres=" + genre?.join("|");
    }

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${this.TMDB_API_KEY}`,
        },
      });

      if (!response.ok) {
        console.log(await response.json());
        throw new Error("Failed to fetch movies");
      }

      const data = await response.json();

      return data as T;
    } catch (error) {
      console.error(JSON.stringify(error, null, 2));
      return null;
    }
  }

  async getMovieDetailsAsync<T>(id: number): Promise<T | null> {
    if (!this.TMDB_API_KEY)
      throw new Error("TMDB_API_KEY is not set in .env file");

    const url = `https://api.themoviedb.org/3/movie/${id}?api_key=${this.TMDB_API_KEY}&language=en-US`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${this.TMDB_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch movie details");
      }

      const data = await response.json();

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
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${this.TMDB_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch serie details");
      }

      const data = await response.json();

      return data as T;
    } catch (error) {
      return null;
    }
  }
}
