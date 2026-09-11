let startEmptyNext = false;

export function rememberDiscardDraft() {
  startEmptyNext = true;
}

export function rememberKeepDraft() {
  startEmptyNext = false;
}

export function shouldStartEmpty() {
  return startEmptyNext;
}
