"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withIosExtensions = void 0;
const config_plugins_1 = require("@expo/config-plugins");
const withIosExtensions = (config, props) => {
    const withPodfileProps = config_plugins_1.IOSConfig.BuildProperties.createBuildPodfilePropsConfigPlugin([
        {
            propName: 'react-native-duckdb.extensions',
            propValueGetter: () => props.extensions && props.extensions.length > 0
                ? props.extensions.join(',')
                : undefined,
        },
    ], 'withDuckDBIosBuildProperties');
    return withPodfileProps(config);
};
exports.withIosExtensions = withIosExtensions;
