import * as fs from "fs";
import * as path from "path";

import { IConfiguration, IMetadata } from "../model/types.js";

import ResourceUtil from "../util/resourceUtil.js";
import tempFolder from "temp-dir";

export default abstract class CacheManager {

    protected configuration: IConfiguration;

    constructor(configuration: IConfiguration) {
        this.configuration = configuration;
    }


    protected abstract getMetadataFilename(): string;
    protected abstract getTempId(): string;


    protected getTempFolder(): string {
        return path.join(tempFolder, this.getTempId());
    }


    async getFiles(
        fetchMetadata: () => Promise<IMetadata>,
        fetchFiles: () => Promise<Map<string, string>>): Promise<Map<string, string>> {
        const tempMetadata = this.readTempMetadata();
        const metadata = await fetchMetadata();
        if (this.isMetadataSame(tempMetadata, metadata)) {
            return this.readTemp();
        } else {
            const files = await fetchFiles();
            if (files?.size > 0) {
                await this.writeTemp(files, metadata);
            }
            return files;
        }
    }


    isMetadataSame(tempMetadata: IMetadata, metadata: IMetadata) {
        // TODO: Implement correct metadata comparision.
        return tempMetadata && metadata && tempMetadata.changedOn === metadata.changedOn;
    }


    readTempMetadata(): any {
        const tempFolder = this.getTempFolder();
        const filename = this.getMetadataFilename();
        const metadataPath = path.resolve(tempFolder, filename);
        if (fs.existsSync(metadataPath)) {
            return JSON.parse(fs.readFileSync(metadataPath, { encoding: "utf-8" }));
        }
    }


    writeTemp(files: Map<string, string>, metadata: any): Promise<void[]> {
        this.deleteTemp();
        const filesToCache = this.getFilesToCache(files, metadata);
        return ResourceUtil.write(this.getTempFolder(), filesToCache);
    }


    async readTemp(): Promise<Map<string, string>> {
        const files = new Map<string, string>();
        const tempFolder = this.getTempFolder();
        if (fs.existsSync(tempFolder)) {
            ResourceUtil.read(tempFolder, tempFolder, files, [this.getMetadataFilename()]);
        }
        return files;
    }


    deleteTemp(): void {
        fs.rmSync(this.getTempFolder(), { recursive: true, force: true });
    }


    protected normalizeId(id: string) {
        return id.replace(/\/\\/g, "_");
    }


    private getFilesToCache(files: Map<string, string>, metadata: any) {
        const filename = this.getMetadataFilename();
        const filesClone = new Map([...files]);
        filesClone.set(filename, JSON.stringify(metadata));
        return filesClone;
    }

}