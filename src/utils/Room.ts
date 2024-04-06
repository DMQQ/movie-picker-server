import { Socket } from "socket.io";

export const defaultMovies = [
  "The Matrix",
  "The Matrix Reloaded",
  "The Matrix Revolutions",
  "The Matrix Resurrections",
  "Harry Potter and the Philosopher's Stone",
  "Harry Potter and the Chamber of Secrets",
  "Harry Potter and the Prisoner of Azkaban",
  "Harry Potter and the Goblet of Fire",
  "Harry Potter and the Order of the Phoenix",
];

export class Rooms {
  private rooms: Map<string, Room>;

  constructor() {
    this.rooms = new Map<string, Room>();
  }

  createRoom(roomId: string, room: Room) {
    this.rooms.set(roomId, room);
  }

  getRoom(roomId: string) {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId: string) {
    this.rooms.delete(roomId);
  }

  getRooms() {
    return this.rooms;
  }
}

type TUser = {
  socket: Socket;
  username: string;
  picks: number[];

  finished?: boolean;
};

export class Room {
  private id: string;
  public readonly host: string;
  public readonly type: string;
  private users: Map<string, TUser>;
  private matchedMovies: {
    id: number;
    title: string;
  }[] = [];

  page = 1;

  private movies: any[];

  constructor(host: string, type: string, initialPage: number = 1) {
    this.host = host;
    this.type = type;

    this.createId();
    this.users = new Map<string, TUser>();
    this.movies = [];

    this.page = initialPage;
  }

  nextPage() {
    this.page += 1;
  }

  getMatchedMovies() {
    return this.matchedMovies;
  }

  addMatchedMovies(matchedMovies: any) {
    this.matchedMovies.push(matchedMovies);
  }

  setMovies(movies: any[]) {
    this.movies = movies;
  }

  getMovies() {
    return this.movies;
  }

  shouldGetMoreMovies() {
    const users = Array.from(this.users.values());

    if (users.length === 0) return false;

    const allFinished = users.every((usr) => usr.finished);

    return allFinished;
  }

  createId() {
    this.id =
      Math.random().toString(36).substring(2, 8).toUpperCase() +
      "-" +
      Math.random().toString(36).substring(2, 8).toUpperCase() +
      "-ROOM";

    return this.id;
  }

  getId() {
    return this.id;
  }

  getUsers() {
    return this.users;
  }

  addUser(usr: TUser) {
    this.users.set(usr.socket.id, usr);
  }

  setUsers(usrs: TUser[]) {
    this.users = new Map<string, TUser>();
    usrs.forEach((usr) => {
      this.users.set(usr.socket.id, usr);
    });
  }

  removeUser(socketId: string) {
    this.users.delete(socketId);
  }

  getHost() {
    return this.host;
  }
}
