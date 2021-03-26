import * as request from "request";

export default class RequestUtil {

    static get(uri: string, options: any): Promise<any> {
        return new Promise((resolve, reject) => {
            request.get(uri, options, (err, _, body) => {
                if (err) {
                    reject(err);
                }
                resolve(JSON.parse(body));
            });
        });
    }

    static download(token: string, appHostId: string, uri: string): Promise<Buffer> {
        const data: Buffer[] = [];
        return new Promise((resolve, reject) => {
            request.get(uri, {
                gzip: true,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + token,
                    "x-app-host-id": appHostId
                }
            }, (err: Error) => {
                if (err) {
                    reject(err);
                }
            }).on("data", (block: Buffer) => {
                data.push(block);
            }).on("end", () => {
                resolve(Buffer.concat(data));
            });
        });
    }
}