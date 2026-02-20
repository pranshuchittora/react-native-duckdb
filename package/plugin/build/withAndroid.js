"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withAndroidExtensions = void 0;
const config_plugins_1 = require("@expo/config-plugins");
const withAndroidExtensions = (config, props) => {
    return (0, config_plugins_1.withGradleProperties)(config, (config) => {
        // Remove any existing RNDuckDB_extensions entries
        config.modResults = config.modResults.filter((item) => !(item.type === 'property' && item.key === 'RNDuckDB_extensions'));
        // Add extensions property if extensions are configured
        if (props.extensions && props.extensions.length > 0) {
            config.modResults.push({
                type: 'property',
                key: 'RNDuckDB_extensions',
                value: props.extensions.join(','),
            });
        }
        return config;
    });
};
exports.withAndroidExtensions = withAndroidExtensions;
