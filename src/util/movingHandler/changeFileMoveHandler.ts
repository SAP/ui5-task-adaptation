import { isManifestChange } from "../commonUtil.js";

const EXT_DIR = "ext/";
const CHANGES_DIR = "changes/";
const nameSpaceRegex = new RegExp(`(?<=ControllerExtension.extend\\(")([^"]*)(?=")`);

/**
* 2p. We move to appVariantFolder (prefix) only files that go along the
* change files, like js or fragments. Changes are renamed in resources,
* packed in flexibility-bundle and removed.
* @param filename - The filename relative to the root
*/
function shouldMove(filename: string, content: string) {
    //TODO: is it more reliable to check change/fileType?
    if (isManifestChange(filename, content)) {
        return true;
    }
    return filename.startsWith(CHANGES_DIR) && [".change", ".variant", ".ctrl_variant", ".ctrl_variant_change", ".ctrl_variant_management_change"].every(ext => !filename.endsWith(ext))
        || filename.startsWith(EXT_DIR);
}

/**
 * For controller extension the namespace needs a prefix
 * The namespace needs to be unique for clear identification
 * If controller extension have the same namespace the last one will be used
 * @param filename  - The filename relative to the root
 * @returns 
 */
function shouldNamespaceRenamed(filename: string): boolean {
    return filename.startsWith(CHANGES_DIR) && filename.endsWith(".js");
}

/**
 * Returns path without first directory (which is usually "changes" or
 * "ext") and without file extension. For example, for
 * "changes/coding/FixingDay.js" it returns "coding/FixingDay", for
 * "changes/customer_app_variant5/fragments/hello_world_fixing_day.fragment.xml"
 * it returns
 * "changes/customer_app_variant5/fragments/hello_world_fixing_day". We
 * remove all extensions not to rename it with slashes instead of dots. And
 * we also exclude "changes" or "ext" include the prefix after them and then
 * the filename. Without 'changes' or 'ext' directory, we need to replace
 * only rest: coding/FixingDay.js to app_var_id1/coding/FixingDay.js
 * @param filename 
 * @returns 
 */
function getPathWithoutExtensions(filename: string): string {
    const [_dir, ...rest] = filename.split("/");
    const restWOExt = [...rest];
    restWOExt[restWOExt.length - 1] = restWOExt[restWOExt.length - 1].split(".")[0];
    return restWOExt.join("/");
}

export const moveFiles = (inputFiles: ReadonlyMap<string, string>, prefix: string, id: string) => {
    const files = new Map<string, string>();
    let renamingPaths = new Map<string, string>();

    inputFiles.forEach((content: string, filename: string) => {
        const { newFilename, renamingPath } = moveFile(filename, content, prefix, id);
        files.set(newFilename, content);
        renamingPaths = new Map([...renamingPaths, ...renamingPath]);
    });
    return { files, renamingPaths };
};

export const moveFile = (filename: string, content: string, prefix: string, id: string): { newFilename: string; renamingPath: Map<string, string> } => {
    let newFilename = filename;
    let renamingPath: Map<string, string> = new Map();

    if (shouldMove(filename, content)) {
        const [dir, ...rest] = filename.split("/");
        newFilename = [dir, prefix, ...rest].join("/");
        const restWOExtPath = getPathWithoutExtensions(filename);
        renamingPath.set(restWOExtPath, [prefix, restWOExtPath].join("/"));
    }

    if (shouldNamespaceRenamed(filename)) {
        const namespaceMatch = nameSpaceRegex.exec(content.trim());
        const controllerExtensionPath = namespaceMatch ? namespaceMatch[0] : "";
        const fileName = controllerExtensionPath.replace(id, "");
        renamingPath.set(controllerExtensionPath, `${id}.${prefix}${fileName}`);
    }
    return { newFilename, renamingPath };
};
