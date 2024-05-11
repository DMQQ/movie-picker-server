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
    console.log(path);
    return `https://api.themoviedb.org/3${path}?api_key=${this.TMDB_API_KEY}&language=en-US&page=${page}&sort_by=popularity.desc&include_adult=true&without_keywords=Anime,Talk&region=PL&with_watch_monetization_types=flatrate,free,ads,rent,purchase`;
  }

  async getLandingPageMovies() {
    try {
      let url = `https://api.themoviedb.org/3/trending/all/day?language=en-US`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${this.TMDB_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch movies");
      }

      const data = await response.json();

      return data;
    } catch (error) {
      return null;
    }
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

  async getImagesAsync(id: number, type: "movie" | "tv") {
    if (!this.TMDB_API_KEY)
      throw new Error("TMDB_API_KEY is not set in .env file");

    const url = `https://api.themoviedb.org/3/${type}/${id}/images`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${this.TMDB_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch images");
    }

    const data = await response.json();

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
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${this.TMDB_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch movie providers");
      }

      const data = await response.json();

      return data?.["results"]?.[locale.toUpperCase()];
    } catch (error) {
      return [];
    }
  }
}
