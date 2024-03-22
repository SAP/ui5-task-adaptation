import axios, { AxiosError, AxiosResponse } from "axios";

import { IAuth } from "../model/types.js";
import NoAuthorizationProvidedError from "../model/noAuthorizationProvidedError.js";
import ServerError from "../model/serverError.js";

export default class RequestUtil {

    static async head(url: string, auth?: IAuth): Promise<any> {
        return this.request(url, axios.head, auth);
    }


    static async get(url: string, options?: any, auth?: IAuth): Promise<any> {
        return this.request(url, axios.get, auth, options);
    }


    static async request(url: string, method: Function, auth?: IAuth, options?: any): Promise<any> {
        try {
            return await method(url, { auth, ...options })
                .then((response: AxiosResponse) => response.data);
        } catch (error: any) {
            this.handleError(error, url);
        }
    }


    private static handleError(error: AxiosError, uri: string) {
        if (error.response) {
            // HTTP Status Code > 2xx
            if (error.response.status === 401) {
                throw new NoAuthorizationProvidedError(uri);
            } else if (error.response.status >= 500) {
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


    static async retryWithAuth<T>(requestWithoutAuth: Function, requestWithAuth: Function): Promise<T> {
        try {
            return await requestWithoutAuth();
        } catch (error) {
            if (error instanceof NoAuthorizationProvidedError) {
                return await requestWithAuth();
            } else {
                throw error;
            }
        }
    }
}