import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { ThemedText } from './themed-text';
import type { CreateIntent } from '../types/createIntent';
import type { Node } from '../types/database';
import type { StatusDefinition } from '../types/status';

type NodeStatus = Node['status'];
const CONTENT_LEFT_INSET = 2;

type CreateNodeModalProps = {
  intent: CreateIntent | null;
  defaultRootLabel: string;
  statuses: StatusDefinition[];
  onClose: () => void;
  onSubmit: (
    intent: CreateIntent,
    data: { label: string; status: NodeStatus }
  ) => Promise<void>;
};

export function CreateNodeModal({
  intent,
  defaultRootLabel,
  statuses,
  onClose,
  onSubmit,
}: CreateNodeModalProps) {
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<NodeStatus>(statuses[0]?.key ?? 'active');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (intent) {
      setLabel('');
      setStatus(statuses[0]?.key ?? 'active');
      setError(null);
    }
    setSubmitting(false);
  }, [intent, statuses]);

  const resetAndClose = () => {
    setLabel('');
    setStatus(statuses[0]?.key ?? 'active');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!intent) return;

    if (intent.kind === 'root') {
      const name = label.trim() || defaultRootLabel.trim();
      if (!name) {
        setError('Add a name or use the project title');
        return;
      }
    } else if (!label.trim()) {
      setError('Label is required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(intent, {
        label:
          intent.kind === 'root'
            ? label.trim() || defaultRootLabel.trim()
            : label.trim(),
        status,
      });
      resetAndClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={intent !== null}
      transparent
      animationType="fade"
      onRequestClose={resetAndClose}
    >
      <Pressable style={styles.backdrop} onPress={resetAndClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <ThemedText style={[styles.fieldLabel, styles.sectionLabel]}>Node Name</ThemedText>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder={intent?.kind === 'root' ? defaultRootLabel : 'e.g. Planning'}
            placeholderTextColor="#71717a"
          />

          <ThemedText style={[styles.fieldLabel, styles.sectionLabel]}>Status</ThemedText>
          <View style={styles.chipRow}>
            {statuses.map((s) => (
              <Pressable
                key={s.key}
                style={[styles.chip, status === s.key && styles.chipActive]}
                onPress={() => setStatus(s.key)}
              >
                <View style={[styles.statusSwatch, { backgroundColor: s.color }]} />
                <ThemedText
                  style={[
                    styles.chipText,
                    status === s.key && styles.chipTextActive,
                  ]}
                >
                  {s.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <View style={styles.actions}>
            <View />
            <View style={styles.rightActions}>
              <Pressable style={styles.cancelButton} onPress={resetAndClose}>
                <ThemedText style={styles.cancelText}>Cancel</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.submitButton, submitting && { opacity: 0.6 }]}
                onPress={() => void handleSubmit()}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.submitText}>Create</ThemedText>
                )}
              </Pressable>
            </View>
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
    width: 380,
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  fieldLabel: {
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 12,
    marginLeft: CONTENT_LEFT_INSET,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e4e4e7',
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#09090b',
  },
  chipActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a5f',
  },
  chipText: {
    color: '#a1a1aa',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#60a5fa',
  },
  statusSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  error: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
  },
  rightActions: {
    flexDirection: 'row',
    gap: 10,
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
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
