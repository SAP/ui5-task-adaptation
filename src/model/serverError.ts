export default class ServerError extends Error {
    constructor(uri: string, error: any) {
        super(`Request ${uri} failed with Server error: ${error.response.status}${error.response.data ?? ""}`);
    }
}