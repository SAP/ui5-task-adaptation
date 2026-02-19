
/**
 * Splits a dot-separated path or clones an array path.
 * @example
 * splitObjectPath("a.b.c"); // ["a", "b", "c"]
 * @example
 * splitObjectPath(["a", "b"]); // ["a", "b"]
 */
function splitObjectPath(pathValue: string | string[]) {
    return Array.isArray(pathValue) ? pathValue.slice() : pathValue.split(".");
}

/**
 * Ensures a nested object path exists and returns the last object in the chain.
 * Overwrites existing non-object segments with plain objects.
 * @example
 * const root: any = {};
 * createObjectPath(root, ["a", "b"]); // root.a.b is created
 */
function createObjectPath(obj: any, pathValue: string[]) {
    for (const segment of pathValue) {
        if (obj[segment] === null || (obj[segment] !== undefined && typeof obj[segment] !== "object" && typeof obj[segment] !== "function")) {
            obj[segment] = {};
        } else {
            obj[segment] = obj[segment] || {};
        }
        obj = obj[segment];
    }
    return obj;
}

/**
 * Sets a value at a dot-separated path, creating missing objects along the way.
 * @example
 * const root: any = {};
 * setObjectPath(root, "a.b.c", 5);
 * // root.a.b.c === 5
 * @example
 * setObjectPath(root, ["x", "y"], true);
 * // root.x.y === true
 */
export function set(obj: any, pathValue: string | string[], value: unknown) {
    const parts = splitObjectPath(pathValue);
    const lastSegment = parts.pop();
    const target = createObjectPath(obj, parts);
    target[lastSegment as any] = value;
}

/**
 * Ensures a default value is set at the path and returns the stored value.
 * @example
 * const root: any = { a: { b: { c: [1] } } };
 * get(root, "a.b.c", []).unshift(0);
 * // root.a.b.c === [0, 1]
 */
export function get<T>(obj: any, pathValue: string | string[], defaultValue: T): T {
    const parts = splitObjectPath(pathValue);
    const lastSegment = parts.pop();
    const target = createObjectPath(obj, parts);
    if (target[lastSegment as any] === undefined) {
        target[lastSegment as any] = defaultValue;
    }
    return target[lastSegment as any] as T;
}
