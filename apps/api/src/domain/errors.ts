export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = this.constructor.name
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message)
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(403, message)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message)
  }
}
