import * as fs from "fs";
import * as path from "path";

export default class TestUtil {
    static getResource(filename: string): string {
        return fs.readFileSync(path.join(process.cwd(), "test", "resources", filename), { encoding: "utf-8" });
    }
}