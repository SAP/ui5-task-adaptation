import * as path from "path";

export default class ResourceUtil {

    static getRootFolder(projectNamespace?: string) {
        const newPath = ["/resources"];
        if (projectNamespace) {
            newPath.push(projectNamespace);
        }
        return path.join(...newPath);
    }

}