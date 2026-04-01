import React, { useState } from 'react';
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

type NodeType = Node['node_type'];
type NodeStatus = Node['status'];

const NODE_TYPES: NodeType[] = ['ROOT', 'TEAM', 'PERSON'];
const STATUSES: NodeStatus[] = ['active', 'stuck', 'completed'];

type CreateNodeModalProps = {
  visible: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: (node: Node) => void;
};

export function CreateNodeModal({
  visible,
  projectId,
  onClose,
  onCreated,
}: CreateNodeModalProps) {
  const [label, setLabel] = useState('');
  const [nodeType, setNodeType] = useState<NodeType>('PERSON');
  const [jobPosition, setJobPosition] = useState('');
  const [status, setStatus] = useState<NodeStatus>('active');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setLabel('');
    setNodeType('PERSON');
    setJobPosition('');
    setStatus('active');
    setError(null);
  };

  const handleSubmit = async () => {
    if (!label.trim()) {
      setError('Label is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const newNode = await nodeService.createNode({
        project_id: projectId,
        label: label.trim(),
        node_type: nodeType,
        status,
        job_position: jobPosition.trim() || undefined,
        parent_node_id: null,
      });
      resetForm();
      onCreated(newNode);
    } catch (e: any) {
      setError(e.message || 'Failed to create node');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <ThemedText style={styles.title}>Create New Node</ThemedText>

          <ThemedText style={styles.fieldLabel}>Label *</ThemedText>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. John Doe"
            placeholderTextColor="#71717a"
          />

          <ThemedText style={styles.fieldLabel}>Type</ThemedText>
          <View style={styles.chipRow}>
            {NODE_TYPES.map((t) => (
              <Pressable
                key={t}
                style={[styles.chip, nodeType === t && styles.chipActive]}
                onPress={() => setNodeType(t)}
              >
                <ThemedText
                  style={[
                    styles.chipText,
                    nodeType === t && styles.chipTextActive,
                  ]}
                >
                  {t}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText style={styles.fieldLabel}>Job Position</ThemedText>
          <TextInput
            style={styles.input}
            value={jobPosition}
            onChangeText={setJobPosition}
            placeholder="e.g. Engineer"
            placeholderTextColor="#71717a"
          />

          <ThemedText style={styles.fieldLabel}>Status</ThemedText>
          <View style={styles.chipRow}>
            {STATUSES.map((s) => (
              <Pressable
                key={s}
                style={[styles.chip, status === s && styles.chipActive]}
                onPress={() => setStatus(s)}
              >
                <ThemedText
                  style={[
                    styles.chipText,
                    status === s && styles.chipTextActive,
                  ]}
                >
                  {s}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={handleClose}>
              <ThemedText style={styles.cancelText}>Cancel</ThemedText>
            </Pressable>

            <Pressable
              style={[styles.submitButton, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.submitText}>Create</ThemedText>
              )}
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
    width: 380,
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  title: {
    color: '#e4e4e7',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  fieldLabel: {
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 12,
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
    gap: 8,
  },
  chip: {
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
  error: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 24,
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
