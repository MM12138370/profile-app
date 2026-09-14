export type Mark = {
  text: string;
  changed: boolean;
};

function tokenize(text: string): string[] {
  return text.split(/(\s+|[，。！？；：、,.!?;:])/).filter((part) => part.length > 0);
}

function lcs(a: string[], b: string[]): number[][] {
  const rows = a.length;
  const cols = b.length;
  const dp = Array.from({ length: rows + 1 }, () => Array<number>(cols + 1).fill(0));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

function merge(marks: Mark[]): Mark[] {
  const out: Mark[] = [];
  for (const mark of marks) {
    const last = out[out.length - 1];
    if (last && last.changed === mark.changed) {
      last.text += mark.text;
    } else {
      out.push({ ...mark });
    }
  }
  return out;
}

function isSpace(text: string): boolean {
  return /^\s+$/.test(text);
}

export function diffMarks(before: string, after: string): { before: Mark[]; after: Mark[] } {
  const left = tokenize(before);
  const right = tokenize(after);
  const dp = lcs(left, right);
  const beforeMarks: Mark[] = [];
  const afterMarks: Mark[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      beforeMarks.push({ text: left[i], changed: false });
      afterMarks.push({ text: right[j], changed: false });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      beforeMarks.push({ text: left[i], changed: !isSpace(left[i]) });
      i += 1;
    } else {
      afterMarks.push({ text: right[j], changed: !isSpace(right[j]) });
      j += 1;
    }
  }
  while (i < left.length) {
    beforeMarks.push({ text: left[i], changed: !isSpace(left[i]) });
    i += 1;
  }
  while (j < right.length) {
    afterMarks.push({ text: right[j], changed: !isSpace(right[j]) });
    j += 1;
  }
  return { before: merge(beforeMarks), after: merge(afterMarks) };
}
