export default class config {
    static get Type() {
        return {
            String: "string"
        }
    }
    static get({ name }) {
        return name === "sapUiLogLevel" ? "Error" : undefined;
    }
}
