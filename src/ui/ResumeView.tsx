import { StyleSheet, Text, View } from 'react-native';

import { INFO_FIELDS } from '../resumeFields';
import { colors, radius, space } from '../theme';
import type { Profile } from '../types';
import { EmptyState } from './EmptyState';
import { SectionTree } from './SectionTree';

export function ResumeView({ profile }: { profile: Profile }) {
  const info = profile.personalInfo;
  const rows = INFO_FIELDS.flatMap((field) => {
    const item = { key: field.key, label: field.label, value: info[field.key] };
    if (field.key === 'name') {
      return [item, { key: 'gender', label: '性别', value: info.gender }];
    }
    return [item];
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.section}>个人信息</Text>
      <View style={styles.card}>
        {rows.map((row, index) => (
          <InfoRow
            key={row.key}
            label={row.label}
            value={row.value}
            last={index === rows.length - 1}
          />
        ))}
      </View>

      <Text style={styles.section}>简历板块</Text>
      {profile.sections.length === 0 ? (
        <EmptyState title="还没有板块" hint="编辑简历时可以补充工作经历、项目等。" />
      ) : (
        <SectionTree nodes={profile.sections} onChange={() => undefined} readOnly />
      )}
    </View>
  );
}

function InfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const filled = value.trim();
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, !filled && styles.empty]}>{filled || '未填'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.md,
  },
  section: {
    marginTop: space.sm,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    paddingVertical: 4,
  },
  row: {
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  label: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },
  value: {
    fontSize: 16,
    color: colors.ink,
    lineHeight: 22,
  },
  empty: {
    color: colors.faint,
  },
});
