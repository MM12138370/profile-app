import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '../theme';
import { emptySection, type SectionItem } from '../types';
import { Field } from './Fields';

export function SectionTree({
  nodes,
  onChange,
  readOnly,
}: {
  nodes: SectionItem[];
  onChange?: (nodes: SectionItem[]) => void;
  readOnly?: boolean;
}) {
  function patch(index: number, next: SectionItem) {
    onChange?.(nodes.map((item, i) => (i === index ? next : item)));
  }

  return (
    <View style={styles.tree}>
      {nodes.map((item, index) =>
        readOnly ? (
          <View key={index} style={styles.card}>
            <Text style={styles.title}>{item.title.trim() || '未命名'}</Text>
            <Text style={styles.body}>{item.content.trim() || '暂无内容'}</Text>
          </View>
        ) : (
          <View key={index} style={styles.editor}>
            <View style={styles.head}>
              <Text style={styles.label}>标题</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="删除板块"
                hitSlop={8}
                onPress={() => onChange?.(nodes.filter((_, i) => i !== index))}
              >
                <Text style={styles.delete}>删除</Text>
              </Pressable>
            </View>
            <Field
              accessibilityLabel="标题"
              value={item.title}
              placeholder="如工作经历、项目经验"
              onChangeText={(title) => patch(index, { ...item, title })}
            />
            <Field
              label="内容"
              value={item.content}
              placeholder="填写真实经历，不要编造"
              multiline
              scrollEnabled={false}
              onChangeText={(content) => patch(index, { ...item, content })}
            />
          </View>
        ),
      )}
      {readOnly ? null : (
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange?.([...nodes, emptySection()])}
          style={styles.add}
        >
          <Text style={styles.addText}>添加条目</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tree: {
    gap: space.md,
  },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    gap: 8,
  },
  editor: {
    gap: 8,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  body: {
    fontSize: 15,
    color: colors.muted,
    lineHeight: 22,
  },
  delete: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  add: {
    alignSelf: 'flex-start',
    backgroundColor: colors.chip,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
});
