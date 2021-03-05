import * as path from "path";

export default class ResourceUtil {

    static filepathToResources(projectNamespace: string) {
        const newPath = [path.sep + "resources"];
        if (projectNamespace) {
            newPath.push(projectNamespace);
        }
        return newPath;
    }

}