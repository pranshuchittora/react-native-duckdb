import { ConfigPlugin } from '@expo/config-plugins';
import { IOSConfig } from '@expo/config-plugins';
import type { DuckDBPluginProps } from './types';

export const withIosExtensions: ConfigPlugin<DuckDBPluginProps> = (
  config,
  props
) => {
  const withPodfileProps =
    IOSConfig.BuildProperties.createBuildPodfilePropsConfigPlugin(
      [
        {
          propName: 'react-native-duckdb.extensions',
          propValueGetter: () =>
            props.extensions && props.extensions.length > 0
              ? props.extensions.join(',')
              : undefined,
        },
      ],
      'withDuckDBIosBuildProperties'
    );

  return withPodfileProps(config);
};
