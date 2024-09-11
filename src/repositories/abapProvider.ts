import { AbapTarget, createAbapServiceProvider } from "@sap-ux/system-access";

import type { AbapServiceProvider } from "@sap-ux/axios-extension";
import BtpUtils from "@sap-ux/btp-utils";
import { IAbapTargetMeta } from "../model/configuration.js";
import { IConfiguration } from "../model/types.js";
import { getLogger } from "@ui5/logger";
import { validateObject } from "../util/commonUtil.js";

const log = getLogger("@ui5/task-adaptation::AbapProvider");

export default class AbapProvider {

    private provider: AbapServiceProvider | null = null;

    async get({ connections, destination }: IConfiguration): Promise<AbapServiceProvider> {
        if (!this.provider) {
            AbapProvider.validateConnectionConfiguration(connections, destination);
            // we try to detect is it either destination for BAS or url for IDE
            let targetConfiguration = AbapProvider.validateAndGetTargetConfiguration(connections);
            if (targetConfiguration) {
                this.provider = await this.createProvider(targetConfiguration);
            } else if (destination) {
                // still if no suitable connections found, we assume that it's
                // old config with destination
                this.provider = await this.createProvider({ destination });
            } else {
                // if no suitible configs found - throw error
                const environment = BtpUtils.isAppStudio() ? "SAP Business Application Studio" : "local IDE";
                throw new Error(`ABAP connection configuration for ${environment} is not provided`);
            }
        }
        return this.provider;
    }


    private static validateAndGetTargetConfiguration(connections: (AbapTarget & IAbapTargetMeta)[] | undefined) {
        // we're trying to detect is it destination for BAS or url for IDE
        const abapTargetProperties: Array<keyof AbapTarget> = BtpUtils.isAppStudio() ? ["destination"] : ["url"];
        if (connections) {
            for (const connection of connections) {
                try {
                    validateObject(connection, abapTargetProperties, "should be specified in ui5.yaml configuration/target");
                } catch (error) {
                    continue;
                }
                return connection;
            }
        }
    }


    private static validateConnectionConfiguration(
        connections: (AbapTarget & IAbapTargetMeta)[] | undefined,
        destination: string | undefined) {
        // then abap connection config either old destination propery, or new
        // connections/destination for BAS or connections/url for IDE
        if (!connections && !destination) {
            throw new Error("ABAP connections should be specified in ui5.yaml configuration");
        }
        if (destination) {
            log.warn("Deprecated, use connections/destination configuration instead, see README.md");
        }
        // if connections configuration appears, we validate that it should be
        // either connections/destination for BAS or connections/url for IDE
        if (connections && !AbapProvider.validateAndGetTargetConfiguration(connections)) {
            throw new Error("ABAP connection settings should be specified in ui5.yaml configuration");
        }
        // no connections and destination the same time to avoid ambiguity
        if (connections && destination) {
            throw new Error("Either destination or connections should be presented in configuration, not both");
        }
    }


    private createProvider(abapTarget: AbapTarget & IAbapTargetMeta) {
        // createAbapServiceProvider requires log.debug, which is not implemented in ui5 logger.
        log.debug = (message: string) => log.verbose(message);
        return createAbapServiceProvider(abapTarget, { ignoreCertErrors: abapTarget.ignoreCertErrors }, true, log);
    }

}
