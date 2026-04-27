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
import { nodeService } from '../services/nodeService';
import { Node } from '../types/database';
import type { StatusDefinition } from '../types/status';

type NodeStatus = Node['status'];
const BASE_STATUS_KEYS = new Set(['active', 'stuck', 'completed']);
const CONTENT_LEFT_INSET = 2;

type EditNodeModalProps = {
  node: Node | null;
  statuses: StatusDefinition[];
  onClose: () => void;
  onUpdated: (node: Node) => void;
  onDeleted: () => void;
};

export function EditNodeModal({
  node,
  statuses,
  onClose,
  onUpdated,
  onDeleted,
}: EditNodeModalProps) {
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<NodeStatus>(statuses[0]?.key ?? 'active');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!node) {
      setDeleting(false);
      setSubmitting(false);
      return;
    }
    setLabel(node.label);
    setStatus(node.status || statuses[0]?.key || 'active');
    setError(null);
    setConfirmDelete(false);
    setDeleting(false);
    setSubmitting(false);
  }, [node, statuses]);

  const handleSave = async () => {
    if (!node) return;
    if (!label.trim()) {
      setError('Label is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: Partial<Omit<Node, 'id' | 'project_id'>> = {
        label: label.trim(),
        status: (BASE_STATUS_KEYS.has(status) ? status : 'active') as NodeStatus,
      };
      const updated = await nodeService.updateNode(node.id, payload);
      onUpdated({ ...updated, status });
    } catch (e: any) {
      setError(e.message || 'Failed to save changes');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!node) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await nodeService.deleteNode(node.id);
      onDeleted();
    } catch (e: any) {
      setError(e.message || 'Failed to delete node');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleClose = () => {
    setConfirmDelete(false);
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={!!node}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <ThemedText style={[styles.fieldLabel, styles.sectionLabel]}>Node Name</ThemedText>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Planning"
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
                  style={[styles.chipText, status === s.key && styles.chipTextActive]}
                >
                  {s.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <View style={styles.actions}>
            <Pressable
              style={[
                styles.deleteButton,
                confirmDelete && styles.deleteButtonConfirm,
                deleting && { opacity: 0.6 },
              ]}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.deleteText}>
                  {confirmDelete ? 'Confirm Delete' : 'Delete'}
                </ThemedText>
              )}
            </Pressable>

            <View style={styles.rightActions}>
              <Pressable style={styles.cancelButton} onPress={handleClose}>
                <ThemedText style={styles.cancelText}>Cancel</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.saveButton, submitting && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.saveText}>Save</ThemedText>
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
    marginTop: 24,
    gap: 10,
  },
  rightActions: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    backgroundColor: '#450a0a',
  },
  deleteButtonConfirm: {
    borderColor: '#ef4444',
    backgroundColor: '#7f1d1d',
  },
  deleteText: {
    color: '#fca5a5',
    fontSize: 14,
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
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
