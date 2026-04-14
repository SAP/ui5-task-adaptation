import { IConfiguration, LandscapeType } from "../../model/configuration.js";
import { validateConfiguration } from "../commonUtil.js";
import IValidator from "./validator.js";


export default class CFValidator implements IValidator {
    public type: LandscapeType = "cf";

    validateConfiguration(configuration: IConfiguration) {
        validateConfiguration(configuration, ["appHostId", "appName", "appVersion"]);
    }
}
