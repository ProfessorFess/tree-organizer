import { StyleSheet, View, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from './themed-text';

export function TopBar() {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <MaterialIcons name="view-in-ar" size={28} color="#3b82f6" />
        <ThemedText style={styles.projectName}>Project Name</ThemedText>
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
  },
  projectName: {
    color: '#3b82f6',
    fontSize: 18,
    fontWeight: '700',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
