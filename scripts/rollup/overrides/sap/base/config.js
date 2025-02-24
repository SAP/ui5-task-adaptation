export default class config {
    config = new Map();
    static get Type() {
        return {
            String: "string"
        }
    }
    static get({ name }) {
        return name === "sapUiLogLevel" ? "Error" : undefined;
    }
    static getWritableInstance() {
        return {
            get(obj) {
                config.get(obj.name);
            },
            set(name, obj) {
                config.set(name, obj);
            }
        }
    }
}
