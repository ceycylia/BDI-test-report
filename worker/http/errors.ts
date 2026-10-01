export class HttpError extends Error {
  readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 500;
  readonly code: string;

  constructor(
    status: HttpError["status"],
    code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}
