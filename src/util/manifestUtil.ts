/**
 * Returns the SAPUI5 dependency ids (libs and components) declared under
 * "sap.ui5"/dependencies of a parsed manifest. These point at other apps and
 * must not be renamed, so callers add them to the renamer ignore list.
 */
export function getSAPUI5DependencyIds(manifest: any): string[] {
    const dependencies = manifest?.["sap.ui5"]?.dependencies;
    if (!dependencies) {
        return [];
    }
    const libs = dependencies.libs ? Object.keys(dependencies.libs) : [];
    const components = dependencies.components ? Object.keys(dependencies.components) : [];
    return [...libs, ...components];
}
