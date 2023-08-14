import AdmZip = require("adm-zip");


export async function unzipZipEntries(zip: Buffer): Promise<Map<string, string>> {
    let admZip;
    try {
        admZip = new AdmZip(zip);
        const entries = admZip.getEntries();
        return mapEntries(entries);
    } catch (error: any) {
        throw new Error("Failed to parse zip content from HTML5 Repository: " + error.message);
    }
}


function mapEntries(entries: AdmZip.IZipEntry[]): Map<string, string> {
    return new Map(entries.filter(entry => !entry.isDirectory).map(entry => [entry.entryName, entry.getData().toString("utf8")]));
}