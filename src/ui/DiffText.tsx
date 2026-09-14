import { Text } from 'react-native';

import { colors } from '../theme';
import { diffMarks, type Mark } from '../textDiff';

export function DiffText({
  before,
  after,
  side,
}: {
  before: string;
  after: string;
  side: 'before' | 'after';
}) {
  const marks = diffMarks(before, after)[side];
  return (
    <Text style={{ fontSize: 15, lineHeight: 22, color: colors.ink }}>
      {marks.map((mark, index) => (
        <Text key={`${side}-${index}`} style={markStyle(mark, side)}>
          {mark.text}
        </Text>
      ))}
    </Text>
  );
}

function markStyle(mark: Mark, side: 'before' | 'after') {
  if (!mark.changed) {
    return undefined;
  }
  if (side === 'before') {
    return {
      color: colors.warn,
      backgroundColor: colors.warnSoft,
      textDecorationLine: 'line-through' as const,
    };
  }
  return {
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    fontWeight: '700' as const,
  };
}
