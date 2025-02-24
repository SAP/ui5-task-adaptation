import axios, { AxiosError } from "axios";

import ServerError from "../model/serverError.js";

export default class RequestUtil {

    static async head(url: string): Promise<any> {
        return this.request(url, axios.head);
    }


    static async get(url: string, options?: any): Promise<any> {
        return this.request(url, axios.get, options).then(response => response.data);
    }


    static async request(url: string, method: Function, options?: any): Promise<any> {
        try {
            return await method(url, options);
        } catch (error: any) {
            this.handleError(error, url);
        }
    }


    private static handleError(error: AxiosError, uri: string) {
        if (error.response) {
            // HTTP Status Code > 2xx
            if (error.response.status >= 500) {
                throw new ServerError(uri, error);
            } else {
                throw new Error(`Unexpected response received from '${uri}': ${error.response.status} ${error.response.data ?? ""}`);
            }
        } else if (error.request) {
            throw new Error(`No response was received from '${uri}': ${error.code}`);
        } else {
            throw new Error(`Error sending request to '${uri}': ${error.code}`);
        }
    }
}
