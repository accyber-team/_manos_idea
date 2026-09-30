// Erros de aplicação, mapeados para HTTP em src/http/errors.js.
export class ValidationError extends Error {
  constructor(errors, message = 'Parâmetros inválidos') {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class SourceUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SourceUnavailableError';
  }
}
