import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from './themed-text';
import type { StatusDefinition } from '../types/status';

type StatusManagerModalProps = {
  visible: boolean;
  statuses: StatusDefinition[];
  onClose: () => void;
  onCreate: (status: StatusDefinition) => void;
  onUpdate: (status: StatusDefinition) => void;
  onDelete: (statusKey: string) => void;
  undeletableStatusKeys?: string[];
};

const MAX_STATUS_LABEL_LENGTH = 30;
const DEFAULT_STATUS_KEY = 'active';
const COLOR_PRESETS = [
  '#3b82f6',
  '#2563eb',
  '#1d4ed8',
  '#10b981',
  '#059669',
  '#14b8a6',
  '#06b6d4',
  '#0891b2',
  '#8b5cf6',
  '#7c3aed',
  '#a855f7',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
];

function toKey(label: string): string {
  const cleaned = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'status';
}

export function StatusManagerModal({
  visible,
  statuses,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  undeletableStatusKeys = [],
}: StatusManagerModalProps) {
  const [draftLabel, setDraftLabel] = useState('');
  const [draftColor, setDraftColor] = useState(COLOR_PRESETS[0]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setDraftLabel('');
      setDraftColor(COLOR_PRESETS[0]);
      setEditingKey(null);
      setError(null);
    }
  }, [visible]);

  const editingStatus = useMemo(
    () => statuses.find((s) => s.key === editingKey) ?? null,
    [statuses, editingKey]
  );
  const orderedStatuses = useMemo(
    () => [
      ...statuses.filter((s) => s.key === DEFAULT_STATUS_KEY),
      ...statuses.filter((s) => s.key !== DEFAULT_STATUS_KEY),
    ],
    [statuses]
  );

  const submit = () => {
    const label = draftLabel.trim();
    if (!label) {
      setError('Status label is required');
      return;
    }
    if (label.length > MAX_STATUS_LABEL_LENGTH) {
      setError(`Status label must be ${MAX_STATUS_LABEL_LENGTH} characters or less`);
      return;
    }
    const key = editingStatus ? editingStatus.key : toKey(label);
    const duplicate = statuses.some((s) => s.key === key && s.key !== editingStatus?.key);
    if (duplicate) {
      setError('A status with this label already exists');
      return;
    }

    const status: StatusDefinition = { key, label, color: draftColor };
    if (editingStatus) {
      onUpdate(status);
    } else {
      onCreate(status);
    }
    setDraftLabel('');
    setDraftColor(COLOR_PRESETS[0]);
    setEditingKey(null);
    setError(null);
  };

  const startEdit = (status: StatusDefinition) => {
    setEditingKey(status.key);
    setDraftLabel(status.label);
    setDraftColor(status.color);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraftLabel('');
    setDraftColor(COLOR_PRESETS[0]);
    setError(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <ThemedText style={styles.title}>Manage Statuses</ThemedText>
          <View style={styles.legendWrap}>
            {orderedStatuses.map((status) => (
              <View key={status.key} style={styles.legendPill}>
                {(() => {
                  const isProtected = undeletableStatusKeys.includes(status.key);
                  return (
                    <>
                <View style={[styles.legendSwatch, { backgroundColor: status.color }]} />
                <ThemedText style={styles.legendText}>{status.label}</ThemedText>
                <Pressable
                  onPress={() => startEdit(status)}
                  style={({ pressed, hovered }) => [
                    styles.iconBtn,
                    styles.iconBtnEdit,
                    (pressed || hovered) && styles.iconBtnHover,
                  ]}
                >
                  <MaterialIcons name="edit" size={15} color="#a1a1aa" />
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!isProtected) onDelete(status.key);
                  }}
                  disabled={isProtected}
                  style={({ pressed, hovered }) => [
                    styles.iconBtn,
                    isProtected && styles.iconBtnDisabled,
                    (pressed || hovered) && styles.iconBtnDangerHover,
                  ]}
                >
                  <MaterialIcons name="delete-outline" size={15} color="#fca5a5" />
                </Pressable>
                    </>
                  );
                })()}
              </View>
            ))}
          </View>

          <ThemedText style={styles.fieldLabel}>{editingStatus ? 'Edit status' : 'New status'}</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Status name"
            placeholderTextColor="#71717a"
            value={draftLabel}
            onChangeText={setDraftLabel}
            maxLength={MAX_STATUS_LABEL_LENGTH}
          />
          <View style={styles.colorRow}>
            {COLOR_PRESETS.map((color) => (
              <Pressable
                key={color}
                onPress={() => setDraftColor(color)}
                style={[styles.colorChip, { backgroundColor: color }, draftColor === color && styles.colorChipActive]}
              />
            ))}
          </View>
          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <View style={styles.actions}>
            {editingStatus && (
              <Pressable style={styles.cancelEditButton} onPress={cancelEdit}>
                <ThemedText style={styles.cancelEditText}>Cancel Edit</ThemedText>
              </Pressable>
            )}
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <ThemedText style={styles.cancelText}>Close</ThemedText>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={submit}>
              <ThemedText style={styles.saveText}>{editingStatus ? 'Save' : 'Add'}</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 520,
    maxWidth: '92%',
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  title: {
    color: '#e4e4e7',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  legendWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    color: '#e4e4e7',
    fontSize: 14,
  },
  iconBtn: {
    padding: 1,
    borderRadius: 6,
  },
  iconBtnEdit: {
    marginLeft: 0,
  },
  iconBtnHover: {
    backgroundColor: '#1f2937',
  },
  iconBtnDangerHover: {
    backgroundColor: '#3f1d1d',
  },
  iconBtnDisabled: {
    opacity: 0.35,
  },
  fieldLabel: {
    color: '#a1a1aa',
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e4e4e7',
    fontSize: 14,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  colorChip: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  colorChipActive: {
    borderColor: '#e4e4e7',
  },
  error: {
    color: '#ef4444',
    marginTop: 10,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cancelText: {
    color: '#a1a1aa',
  },
  cancelEditButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3f3f46',
    backgroundColor: '#0f172a',
  },
  cancelEditText: {
    color: '#cbd5e1',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveText: {
    color: '#fff',
    fontWeight: '600',
  },
});

