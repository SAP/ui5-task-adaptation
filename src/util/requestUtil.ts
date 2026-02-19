import axios, { AxiosError, AxiosRequestConfig } from "axios";

import ServerError from "../model/serverError.js";

export default class RequestUtil {

    static async head(url: string): Promise<any> {
        return this.request(url, axios.head);
    }


    static async get(url: string, options: any, expectedStatus: number = 200): Promise<any> {
        return this.request(url, axios.get, {
            ...options,
            validateStatus: (status: number) => status === expectedStatus
        }).then(response => response.data);
    }


    static async request(url: string, method: (url: string, config?: AxiosRequestConfig) => any, options?: any): Promise<any> {
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
