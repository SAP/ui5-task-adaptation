import * as path from "path";

export default class URI {
    constructor(value) {
        this.value = value;
    }

    normalize() {
        this.value = path.normalize(this.value);
        return this;
    }

    path() {
        return this.value;
    }
}