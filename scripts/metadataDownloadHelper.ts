import * as dotenv from "dotenv";
import * as fs from "fs/promises";
import { Agent } from "https";
import RequestUtil from "../src/util/requestUtil";

dotenv.config();
const httpsAgent = new Agent({ rejectUnauthorized: false });

export default class MetadataDownloadHelper {

    static async readAllUrls() {
        await fs.readdir("./test/resources/annotations/inline", { encoding: "utf8" });
        const resultsObject = JSON.parse(await fs.readFile("./test/resources/allReleasedODataServices.json", { encoding: "utf8" }));
        return this.exractUrlsFromResponse(resultsObject);
    }

    static async fetchAllUrls(host: string) {
        const REQUEST_OPTIONS_JSON = {
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                'Cookie': process.env.cookie,
            },
            httpsAgent
        };
        const url = "/sap/bc/ui2/app_index?sap.fiori/cloudDevAdaptationStatus=released&fields=sap.app/id,sap.app/dataSources/OData/uri";
        const response = await RequestUtil.get(host + url, REQUEST_OPTIONS_JSON);
        const allUris = this.exractUrlsFromResponse(response);
        for (const [index, url] of allUris.entries()) {
            try {
                const metadataFile = await this.fetchMetadataFileByUri(host, url);
                if (typeof metadataFile === "object") {
                    console.error(`Received object instead of xml file with content: ${JSON.stringify(metadataFile)}`)
                    continue;
                }
                // @ts-ignore
                await fs.writeFile(`test/resources/metadata/download/${index}__${url.replaceAll("/", "_")}.xml`, metadataFile, { encoding: "utf8" });
            } catch (e: any) {
                console.error(`Error fetching metadata file with url ${url} with error \n\n ${e}`);
                continue;
            }
        }
    }

    private static exractUrlsFromResponse(resultsObject: any) {
        let allUrls: string[] = [];
        resultsObject.results.map((value: any) => {
            allUrls = allUrls.concat(value["sap.app/dataSources/OData/uri"]);
        });
        return allUrls;
    }

    static readMetadataFileByFilePath(filePath: string) {
        return fs.readFile(filePath, { encoding: "utf8" });
    }

    static fetchMetadataFileByUri(host: string, url: string) {
        const REQUEST_OPTIONS_XML = {
            headers: {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                'Cookie': process.env.cookie,
            },
            httpsAgent,
            timeout: 4000
        };
        url = url.endsWith("/") ? `${url}$metadata` : `${url}/$metadata`;
        return RequestUtil.get(host + url, REQUEST_OPTIONS_XML);
    }
}

// Get the command line arguments
const args = process.argv;

// Find the index of the `--host=` argument
const hostArgIndex = args.findIndex(arg => arg.startsWith('--host='));

// If the `--host=` argument is found
if (hostArgIndex !== -1) {
  // Extract the value of the `--host=` argument
  const hostArg = args[hostArgIndex];
  let host = hostArg.split('=')[1];
  host = host.endsWith("/") ? host.substring(0, host.lastIndexOf("/")) : host;

  // Use the `host` variable as needed
  MetadataDownloadHelper.fetchAllUrls(host);
} else {
    console.info("Please provide missing host parameter");
}