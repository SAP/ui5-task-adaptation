export function replaceDots(value: string) {
    return value.replace(/\./g, "_");
}


export function validateOptions<T extends Object>(options: T, properties: Array<keyof T>) {
    for (const property of properties) {
        if (!options[property]) {
            throw new Error(`${property} should be specified in ui5.yaml configuration`);
        }
    }
}