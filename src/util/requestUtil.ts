import axios from "axios";

export default class RequestUtil {

    static get(uri: string, options: any): Promise<any> {
        return axios.get(uri, options).then(response => response.data);
    }

    static async download(token: string, appHostId: string, uri: string): Promise<Buffer> {
        if (!token) {
            throw new Error("HTML5 token is undefined");
        }
        return axios.get(uri, {
            responseType: "arraybuffer",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token,
                "x-app-host-id": appHostId
            }
        }).then(response => response.data);
    }
}