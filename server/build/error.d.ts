export default class ServerError extends Error {
    status?: number;
    constructor(message?: string, status?: number);
}
