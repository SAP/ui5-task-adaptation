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
