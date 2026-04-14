import { IConfiguration, LandscapeType } from "../../model/configuration.js";

export default interface IValidator {
    type: LandscapeType;
    validateConfiguration(configuration: IConfiguration): void;
}

export function isOneOf<T extends readonly unknown[]>(values: T, value: unknown): value is T[number] {
    return (values as readonly unknown[]).includes(value);
}
