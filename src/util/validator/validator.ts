import { IConfiguration, LandscapeType } from "../../model/configuration.js";

export default interface IValidator {
    type: LandscapeType;
    validateConfiguration(configuration: IConfiguration): void;
}

export function isOneOf<T extends readonly unknown[]>(values: T, value: unknown): value is T[number] {
    return (values as readonly unknown[]).includes(value);
}

export function validateAppId(id: string): void {
    if (!id) {
        throw new Error(`The application id must not be empty.`);
    }
    // https://help.sap.com/docs/bas/developing-sap-fiori-app-in-sap-business-application-studio/releasing-sap-fiori-application-to-be-extensible-in-adaptation-projects-on-sap-s-4hana-cloud
    // In the manifest.json file, make sure that the attribute
    // sap.app/id has at least 2 segments.
    if (id.split(".").filter(Boolean).length < 2) {
        throw new Error(`The application id '${id}' must have at least two parts, separated by a period.`);
    }
}
