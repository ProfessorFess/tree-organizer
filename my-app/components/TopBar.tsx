import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from './themed-text';

type TopBarProps = {
  projectName: string;
  onProjectNameCommit: (name: string) => Promise<void>;
};

export function TopBar({ projectName, onProjectNameCommit }: TopBarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(projectName);
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

  return (
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

        <Pressable style={styles.createButton}>
          <ThemedText style={styles.createButtonText}>Create Workspace</ThemedText>
        </Pressable>
      </View>
    </View>
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
    color: '#3b82f6',
    fontSize: 18,
    fontWeight: '700',
  },
  projectNameInput: {
    color: '#3b82f6',
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
    borderColor: '#3b82f6',
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
    paddingVertical: 10,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
