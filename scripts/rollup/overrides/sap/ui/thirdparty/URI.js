import { posix as path } from "path";

export default class URI {
    constructor(value) {
        this.value = value;
    }

    normalize() {
        this.value = path.normalize(this.value).replace(/\\/g, "/");
        return this;
    }

    path() {
        return this.value;
    }
}