export function replaceDots(value: string) {
    return value.replace(/\./g, "_");
}


export function validateObject<T extends Object>(options: T, properties: Array<keyof T>, message: string) {
    for (const property of properties) {
        if (!options[property]) {
            throw new Error(`'${property}' ${message}`);
        }
    }
}