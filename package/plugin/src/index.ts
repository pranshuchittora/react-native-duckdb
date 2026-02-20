import { ConfigPlugin, createRunOncePlugin } from '@expo/config-plugins';
import { withAndroidExtensions } from './withAndroid';
import { withIosExtensions } from './withIos';
import type { DuckDBPluginProps } from './types';

const withDuckDB: ConfigPlugin<DuckDBPluginProps> = (config, props = {}) => {
  config = withAndroidExtensions(config, props);
  config = withIosExtensions(config, props);
  return config;
};

const pkg = require('../../package.json');
export default createRunOncePlugin(withDuckDB, pkg.name, pkg.version);
