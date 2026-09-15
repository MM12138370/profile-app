const { getDefaultConfig } = require('expo/metro-config');

const OPENSPEECH_PREFIX = '/__openspeech';
const OPENSPEECH_ORIGIN = 'https://openspeech.bytedance.com';
const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'content-encoding',
  'origin',
  'referer',
  'accept-encoding',
  'cookie',
]);

function headerMap(source) {
  const headers = {};
  const append = (key, value) => {
    if (value == null || HOP_BY_HOP.has(key.toLowerCase())) {
      return;
    }
    headers[key] = Array.isArray(value) ? value.join(',') : String(value);
  };
  if (typeof source.forEach === 'function') {
    source.forEach((value, key) => append(key, value));
  } else {
    for (const [key, value] of Object.entries(source)) {
      append(key, value);
    }
  }
  return headers;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function proxyOpenspeech(req, res) {
  const target = OPENSPEECH_ORIGIN + req.url.slice(OPENSPEECH_PREFIX.length);
  const method = req.method || 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req);
  const response = await fetch(target, {
    method,
    headers: headerMap(req.headers),
    body,
  });
  const payload = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, headerMap(response.headers));
  res.end(payload);
}

function openspeechProxy(req, res, next) {
  if (!(req.url || '').startsWith(`${OPENSPEECH_PREFIX}/api/v3/`)) {
    next();
    return;
  }
  proxyOpenspeech(req, res).catch((error) => {
    if (!res.headersSent) {
      res.statusCode = 502;
    }
    res.end(error instanceof Error ? error.message : String(error));
  });
}

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

const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const next = enhanceMiddleware ? enhanceMiddleware(middleware, server) : middleware;
  return (req, res, nxt) => {
    openspeechProxy(req, res, () => next(req, res, nxt));
  };
};

module.exports = config;
