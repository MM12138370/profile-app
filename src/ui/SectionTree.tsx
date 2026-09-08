import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { appendAt, emptyGroup, emptyItem, updateAt } from '../sections';
import { colors, radius, space } from '../theme';
import type { SectionItem, SectionNode } from '../types';
import { isSectionItem } from '../types';

type Props = {
  nodes: SectionNode[];
  onChange: (nodes: SectionNode[]) => void;
  readOnly?: boolean;
};

export function SectionTree({ nodes, onChange, readOnly }: Props) {
  return (
    <View style={styles.tree}>
      {nodes.map((node, index) => (
        <NodeView
          key={`${index}-${Array.isArray(node) ? 'g' : 'i'}`}
          node={node}
          path={[index]}
          readOnly={readOnly}
          onChange={onChange}
          nodes={nodes}
        />
      ))}
      {readOnly ? null : (
        <View style={styles.actions}>
          <SmallAction
            label="添加条目"
            onPress={() => onChange(appendAt(nodes, [], emptyItem()))}
          />
          <SmallAction
            label="添加分组"
            onPress={() => onChange(appendAt(nodes, [], emptyGroup()))}
          />
        </View>
      )}
    </View>
  );
}

function NodeView({
  node,
  path,
  nodes,
  onChange,
  readOnly,
}: {
  node: SectionNode;
  path: number[];
  nodes: SectionNode[];
  onChange: (nodes: SectionNode[]) => void;
  readOnly?: boolean;
}) {
  if (isSectionItem(node)) {
    return (
      <ItemCard
        item={node}
        readOnly={readOnly}
        onChangeTitle={(title) =>
          onChange(updateAt(nodes, path, (n) => (isSectionItem(n) ? { ...n, title } : n)))
        }
        onChangeContent={(content) =>
          onChange(updateAt(nodes, path, (n) => (isSectionItem(n) ? { ...n, content } : n)))
        }
        onDelete={() => onChange(updateAt(nodes, path, () => null))}
      />
    );
  }

  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Text style={styles.groupTitle}>分组</Text>
        {readOnly ? null : (
          <Pressable onPress={() => onChange(updateAt(nodes, path, () => null))}>
            <Text style={styles.delete}>删除</Text>
          </Pressable>
        )}
      </View>
      {node.map((child, index) => (
        <NodeView
          key={`${path.join('.')}.${index}`}
          node={child}
          path={[...path, index]}
          nodes={nodes}
          onChange={onChange}
          readOnly={readOnly}
        />
      ))}
      {readOnly ? null : (
        <View style={styles.actions}>
          <SmallAction
            label="组内条目"
            onPress={() => onChange(appendAt(nodes, path, emptyItem()))}
          />
          <SmallAction
            label="组内分组"
            onPress={() => onChange(appendAt(nodes, path, emptyGroup()))}
          />
        </View>
      )}
    </View>
  );
}

function ItemCard({
  item,
  readOnly,
  onChangeTitle,
  onChangeContent,
  onDelete,
}: {
  item: SectionItem;
  readOnly?: boolean;
  onChangeTitle: (value: string) => void;
  onChangeContent: (value: string) => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.card}>
      {readOnly ? (
        <>
          <Text style={styles.title}>{item.title || '未命名'}</Text>
          <Text style={styles.body}>{item.content || '暂无内容'}</Text>
        </>
      ) : (
        <>
          <View style={styles.groupHead}>
            <TextInput
              value={item.title}
              onChangeText={onChangeTitle}
              placeholder="标题，如工作经历"
              placeholderTextColor={colors.faint}
              style={styles.titleInput}
            />
            <Pressable onPress={onDelete}>
              <Text style={styles.delete}>删除</Text>
            </Pressable>
          </View>
          <TextInput
            value={item.content}
            onChangeText={onChangeContent}
            placeholder="内容"
            placeholderTextColor={colors.faint}
            style={styles.bodyInput}
            multiline
          />
        </>
      )}
    </View>
  );
}

function SmallAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.small}>
      <Text style={styles.smallText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tree: {
    gap: space.sm,
  },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    gap: 8,
  },
  group: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accentSoft,
    paddingLeft: space.sm,
    gap: space.sm,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  groupTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
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
  titleInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    paddingVertical: 0,
  },
  bodyInput: {
    fontSize: 15,
    color: colors.ink,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  delete: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
  },
  small: {
    backgroundColor: colors.chip,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  smallText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
});
