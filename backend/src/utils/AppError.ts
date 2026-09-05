export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const notFound = (entity: string) => new AppError(`${entity} not found`, 404);
export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(message, 403);
export const unauthorized = (message = 'Unauthorized') => new AppError(message, 401);
export const badRequest = (message: string, details?: unknown) => new AppError(message, 400, details);
export const conflict = (message: string) => new AppError(message, 409);
