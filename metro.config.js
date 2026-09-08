const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = [
  'react-native',
  'browser',
  'require',
  'import',
];

const emptyShim = require.resolve('./src/shims/empty.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'async_hooks' ||
    moduleName === 'node:async_hooks' ||
    moduleName === 'fs' ||
    moduleName === 'node:fs' ||
    moduleName === 'net' ||
    moduleName === 'tls' ||
    moduleName === 'http2' ||
    moduleName === 'child_process' ||
    moduleName === 'worker_threads'
  ) {
    return { type: 'sourceFile', filePath: emptyShim };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
