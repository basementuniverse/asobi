export class ServerError extends Error {
  public status?: number;

  public constructor(message?: string, status: number = 400) {
    super(message);
    this.status = status;
  }
}
