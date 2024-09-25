import { AbapTarget, createAbapServiceProvider } from "@sap-ux/system-access";

import type { AbapServiceProvider } from "@sap-ux/axios-extension";
import BtpUtils from "@sap-ux/btp-utils";
import { IAbapTargetMeta } from "../model/configuration.js";
import { IConfiguration } from "../model/types.js";
import { getLogger } from "@ui5/logger";
import { validateObject } from "../util/commonUtil.js";

const log = getLogger("@ui5/task-adaptation::AbapProvider");
log.debug = (message: string) => log.verbose(message);

export default class AbapProvider {

    private provider: AbapServiceProvider | null = null;

    async get({ target, destination }: IConfiguration): Promise<AbapServiceProvider> {
        if (!this.provider) {
            const abapTarget = AbapProvider.validateAndGetAbapTarget(target, destination);
            if (abapTarget) {
                this.provider = await createAbapServiceProvider(abapTarget, { ignoreCertErrors: abapTarget.ignoreCertErrors }, true, log);
            }
        }
        if (!this.provider) {
            throw new Error("Target should be specified in ui5.yaml configuration to connect the ABAP system");
        }
        return this.provider;
    }


    private static validateAndGetAbapTarget(target: AbapTarget & IAbapTargetMeta | undefined, destination: string | undefined) {
        if (target) {
            // if target configuration appears, we validate that it should be
            // either target/destination for BAS or target/url for IDE we're
            // trying to detect is it destination for BAS or url for IDE
            const abapTargetProperties: Array<keyof AbapTarget> = BtpUtils.isAppStudio() ? ["destination"] : ["url"];
            validateObject(target, abapTargetProperties, "should be specified in ui5.yaml configuration/target");
            return target;
        } else if (destination) {
            log.warn("Destination is deprecated, use target/destination configuration instead");
            return { destination };
        }
        throw new Error("Target should be specified in ui5.yaml configuration to connect the ABAP system");
    }
}
