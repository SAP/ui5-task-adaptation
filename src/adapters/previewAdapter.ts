import { IAdapter } from "./adapter.js";
import { PostCommandChain } from "./commands/command.js";
import CFAdapter from "./cfAdapter.js";


export default class PreviewAdapter extends CFAdapter implements IAdapter {
    createPostCommandChain(): PostCommandChain {
        return new PostCommandChain([]);
    }
}
