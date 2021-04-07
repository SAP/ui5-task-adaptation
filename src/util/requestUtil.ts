import fetch from "node-fetch";

export default class RequestUtil {

    static get(uri: string, options: any): Promise<any> {
        return fetch(uri, options).then(res => res.json());
    }

    static async download(token: string, appHostId: string, uri: string): Promise<Buffer> {
        if (!token) {
            throw new Error("HTML5 token is undefined");
        }
        const response = await fetch(uri, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token,
                "x-app-host-id": appHostId
            }
        });
        return new Promise((resolve, reject) => {
            const data: Buffer[] = [];
            response.body.on("error", err => reject(err));
            response.body.on("data", block => data.push(block));
            response.body.on("end", () => resolve(Buffer.concat(data)));
        })
    }
}