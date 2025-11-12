export default class AuthenticationError extends Error {
    constructor(details?: string) {
        super(details);
        this.name = "AuthenticationError";
        this.message = "Authentication error. Use 'cf login' to authenticate in Cloud Foundry" + (details ? `: ${details}` : ".");
    }
}
