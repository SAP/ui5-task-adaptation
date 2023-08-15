export default class NoAuthorizationProvidedError extends Error {
    constructor(uri: string) {
        super(`Request requires authorization: '${uri}'`);
    }
}