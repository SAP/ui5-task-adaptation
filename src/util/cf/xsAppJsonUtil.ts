import { getLogger } from "@ui5/logger";
import { ServiceCredentials } from "../../model/types.js";
const log = getLogger("@ui5/task-adaptation::XSAppJsonUtil");

type XsApp = {
    welcomeFile?: string;
    authenticationMethod: "none" | "route";
    routes: Route[];
}

type Route = {
    source: string;
    target: string;
    service?: string;
    destination?: string;
    authenticationType?: string;
    localDir?: string;
}

export const XSAPP_JSON_FILENAME = "xs-app.json";

/**
 * Merges multiple xs-app.json contents into one. AppVariant and Reuse Library
 * xs-app.json files come first, base app xs-app.json last. Routes from all
 * files are concatenated.
 * @param xsAppFiles Array of xs-app.json file contents as strings
 * @returns Merged xs-app.json content as a string, or undefined if no files
 * were provided
 */
export function merge(xsAppFiles: string[]): string | undefined {
    if (xsAppFiles.length === 0) {
        return;
    }

    if (xsAppFiles.length === 1) {
        return xsAppFiles[0];
    }

    // Start with empty xs-app.json
    const merged: XsApp = {
        authenticationMethod: "none",
        routes: []
    };

    for (const xsAppInfoContent of xsAppFiles) {
        let parsed;
        try {
            parsed = JSON.parse(xsAppInfoContent);
        } catch (error) {
            throw new Error(`Failed to parse xs-app.json content: ${error instanceof Error ? error.message : String(error)}`);
        }
        const { authenticationMethod, routes, welcomeFile } = parsed;
        if (merged.welcomeFile === undefined && welcomeFile) {
            merged.welcomeFile = welcomeFile;
        }
        if (merged.authenticationMethod === "none" && authenticationMethod) {
            merged.authenticationMethod = authenticationMethod;
        }
        if (Array.isArray(routes)) {
            merged.routes = merged.routes.concat(routes);
        }
    }

    return JSON.stringify(merged, null, 4);
}


export function enhanceRoutesWithEndpointAndService(xsAppJsonContent: string, serviceCredentials: ServiceCredentials): string {
    // Also skip if no routes or no routes with a destination property
    const xsAppJson = JSON.parse(xsAppJsonContent);
    if (!Array.isArray(xsAppJson.routes) || !xsAppJson.routes.some((route: any) => route.destination)) {
        log.verbose(`No routes with 'destination' found in xs-app.json. Skipping xs-app.json update.`);
        return xsAppJsonContent;
    }

    xsAppJson.routes = enhanceRoutes(serviceCredentials, xsAppJson.routes);
    return JSON.stringify(xsAppJson, null, 4);
}


export function enhanceRoutes(serviceCredentials: ServiceCredentials, baseRoutes: any) {
    const endpoints = serviceCredentials.endpoints;
    // Map destinations to endpoint names
    const destinationToEndpoint = Object.entries(endpoints).reduce((acc: Record<string, string>, [endpointName, obj]) => {
        if (obj && typeof obj === "object" && obj.destination) {
            acc[obj.destination] = endpointName;
        }
        return acc;
    }, {} as Record<string, string>);

    return baseRoutes.map((route: any) => {
        const endpointName = destinationToEndpoint[route.destination];
        if (endpointName) {
            // There is a matching endpoint: remove destination and add endpoint/service
            const { destination: _destination, ...rest } = route;
            return {
                ...rest,
                endpoint: endpointName,
                service: serviceCredentials["sap.cloud.service"],
            };
        } else {
            // No match: return route unchanged
            return route;
        }
    });
}
