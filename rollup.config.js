const path = require("path");
const ConfigBuilder = require("./rollup/configBuilder");
module.exports = ConfigBuilder.build(path.resolve(__dirname, "..", "..", ".."));