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
const langsmithShim = require.resolve('./src/shims/langsmith.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'langsmith' || moduleName.startsWith('langsmith/')) {
    return { type: 'sourceFile', filePath: langsmithShim };
  }
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
