import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  TextInput,
  Alert,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from './themed-text';

type TopBarProps = {
  projectName: string;
  onProjectNameCommit: (name: string) => Promise<void>;
  onCreateWorkspace: (name: string) => Promise<void>;
};

export function TopBar({ projectName, onProjectNameCommit, onCreateWorkspace }: TopBarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(projectName);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const projectNameRef = useRef(projectName);
  projectNameRef.current = projectName;
  const finishingRef = useRef(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!editing) setDraft(projectName);
  }, [projectName, editing]);

  useEffect(() => {
    if (editing) {
      const t = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(t);
    }
  }, [editing]);

  const finishCommit = async () => {
    if (finishingRef.current) return;
    const next = draft.trim();
    const current = projectNameRef.current;
    if (next === '' || next === current) {
      setDraft(current);
      setEditing(false);
      return;
    }
    finishingRef.current = true;
    try {
      await onProjectNameCommit(next);
      setEditing(false);
    } catch {
      setDraft(projectNameRef.current);
      setEditing(false);
      Alert.alert('Update failed', 'Could not save the project name. Check your connection and database permissions.');
    } finally {
      finishingRef.current = false;
    }
  };

  const closeWorkspaceModal = () => {
    if (creatingWorkspace) return;
    setWorkspaceModalOpen(false);
    setWorkspaceNameDraft('');
  };

  const submitWorkspaceCreate = async () => {
    const name = workspaceNameDraft.trim();
    if (!name) {
      Alert.alert('Name required', 'Please enter a workspace name before confirming.');
      return;
    }
    setCreatingWorkspace(true);
    try {
      await onCreateWorkspace(name);
      setWorkspaceModalOpen(false);
      setWorkspaceNameDraft('');
    } catch {
      Alert.alert('Create failed', 'Could not create workspace. Check your connection and database permissions.');
    } finally {
      setCreatingWorkspace(false);
    }
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.left}>
          <MaterialIcons name="view-in-ar" size={28} color="#3b82f6" />
          {editing ? (
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              style={styles.projectNameInput}
              placeholderTextColor="#64748b"
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={() => void finishCommit()}
              onBlur={() => void finishCommit()}
              accessibilityLabel="Project name"
            />
          ) : (
            <Pressable
              onPress={() => setEditing(true)}
              style={({ pressed }) => [styles.namePressable, pressed && styles.namePressablePressed]}
              accessibilityRole="button"
              accessibilityLabel="Edit project name"
            >
              <ThemedText style={styles.projectName} numberOfLines={1}>
                {projectName}
              </ThemedText>
            </Pressable>
          )}
        </View>

        <View style={styles.right}>
          <Pressable style={styles.accountButton}>
            <MaterialIcons name="person-outline" size={20} color="#e4e4e7" />
            <ThemedText style={styles.accountText}>Account</ThemedText>
          </Pressable>

          <Pressable
            style={({ hovered, pressed }) => [
              styles.createButton,
              hovered && styles.createButtonHover,
              pressed && styles.createButtonPressed,
            ]}
            onPress={() => setWorkspaceModalOpen(true)}
          >
            <ThemedText style={styles.createButtonText}>Create Workspace</ThemedText>
          </Pressable>
        </View>
      </View>

      <Modal visible={workspaceModalOpen} transparent animationType="fade" onRequestClose={closeWorkspaceModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeWorkspaceModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <ThemedText style={styles.modalTitle}>Create Workspace</ThemedText>
            <TextInput
              value={workspaceNameDraft}
              onChangeText={setWorkspaceNameDraft}
              style={styles.modalInput}
              placeholder="Workspace name"
              placeholderTextColor="#71717a"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void submitWorkspaceCreate()}
              editable={!creatingWorkspace}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={closeWorkspaceModal} disabled={creatingWorkspace}>
                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmButton, creatingWorkspace && styles.modalConfirmButtonDisabled]}
                onPress={() => void submitWorkspaceCreate()}
                disabled={creatingWorkspace}
              >
                {creatingWorkspace ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.modalConfirmText}>Confirm</ThemedText>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    backgroundColor: '#0a0a0a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  namePressable: {
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginVertical: -4,
    marginHorizontal: -6,
    maxWidth: Platform.OS === 'web' ? 480 : '70%',
  },
  namePressablePressed: {
    backgroundColor: '#18181b',
  },
  projectName: {
    color: '#e4e4e7',
    fontSize: 18,
    fontWeight: '700',
  },
  projectNameInput: {
    color: '#e4e4e7',
    fontSize: 18,
    fontWeight: '700',
    minWidth: 120,
    flex: 1,
    maxWidth: Platform.OS === 'web' ? 480 : '70%',
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginVertical: -4,
    marginHorizontal: -6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#52525b',
    backgroundColor: '#18181b',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  accountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  accountText: {
    color: '#e4e4e7',
    fontSize: 14,
  },
  createButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 8,
  },
  createButtonHover: {
    backgroundColor: '#2563eb',
  },
  createButtonPressed: {
    backgroundColor: '#1d4ed8',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: 420,
    maxWidth: '92%',
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  modalTitle: {
    color: '#e4e4e7',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  modalInput: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e4e4e7',
    fontSize: 14,
  },
  modalActions: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3f3f46',
    backgroundColor: '#09090b',
  },
  modalCancelText: {
    color: '#a1a1aa',
    fontSize: 14,
  },
  modalConfirmButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    minWidth: 96,
    alignItems: 'center',
  },
  modalConfirmButtonDisabled: {
    opacity: 0.6,
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
