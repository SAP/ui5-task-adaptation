export default class ResourceUtil {

    static filepathToResources(projectNamespace?: string) {
        const newPath = ["/resources"];
        if (projectNamespace) {
            newPath.push(projectNamespace);
        }
        return newPath;
    }

}