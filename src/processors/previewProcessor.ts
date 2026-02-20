import { IAdapter } from "../adapters/adapter.js";
import PreviewAdapter from "../adapters/previewAdapter.js";
import { IConfiguration } from "../model/types.js";
import CFProcessor from "./cfProcessor.js";
import IProcessor from "./processor.js";

export default class PreviewProcessor extends CFProcessor implements IProcessor {
    constructor(configuration: IConfiguration) {
        super(configuration);
    }

    getAdapter(): IAdapter {
        return new PreviewAdapter(this.configuration);
    }
}
