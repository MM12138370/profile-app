/**
 * LangSmith is pulled in by @langchain/core for tracing.
 * Its ESM build has a Client circular import that Metro cannot evaluate.
 * This app talks to the LLM via fetch and does not use LangSmith.
 */

export const __version__ = '0.0.0-shim';

export class Client {
  constructor(_config) {}
}

export class RunTree {
  constructor(fields = {}) {
    Object.assign(this, fields);
    this.extra = this.extra ?? {};
    this.events = this.events ?? [];
    this.child_runs = this.child_runs ?? [];
  }

  async postRun() {}
  async patchRun() {}
}

export function isRunTree(value) {
  return value instanceof RunTree;
}

export function convertToDottedOrderFormat(epoch, runId = '') {
  const stamp = String(epoch ?? 0);
  return {
    dottedOrder: `${stamp}${runId}`,
    microsecondPrecisionDatestring: stamp,
  };
}

export function getDefaultProjectName() {
  return 'default';
}

export function getCurrentRunTree() {
  return undefined;
}

export function isTraceableFunction() {
  return false;
}

export function isTracingEnabled() {
  return false;
}

export function traceable(fn) {
  return fn;
}
