import { ConfigPlugin, withGradleProperties } from '@expo/config-plugins';
import type { DuckDBPluginProps } from './types';

export const withAndroidExtensions: ConfigPlugin<DuckDBPluginProps> = (
  config,
  props
) => {
  return withGradleProperties(config, (config) => {
    // Remove any existing RNDuckDB_extensions entries
    config.modResults = config.modResults.filter(
      (item) =>
        !(item.type === 'property' && item.key === 'RNDuckDB_extensions')
    );

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
