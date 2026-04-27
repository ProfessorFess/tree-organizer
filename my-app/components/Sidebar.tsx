import { useCallback, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from './themed-text';
import { Project } from '../types/database';

const MIN_SIDEBAR_WIDTH = 180;
const PROJECT_ROW_HEIGHT = 44;
const PROJECT_DRAG_MIN_DISTANCE = 6;

type SidebarProps = {
  projects: Project[];
  activeProjectId: string | null;
  onProjectSelect: (projectId: string) => void;
  onProjectDelete: (project: Project) => Promise<void>;
  onProjectRename: (projectId: string, name: string) => Promise<void>;
  onProjectReorder: (projectIds: string[]) => Promise<void> | void;
  sidebarWidth: number;
  maxSidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  isOpen: boolean;
  onToggle: () => void;
};

export function Sidebar({
  projects,
  activeProjectId,
  onProjectSelect,
  onProjectDelete,
  onProjectRename,
  onProjectReorder,
  sidebarWidth,
  maxSidebarWidth,
  onSidebarWidthChange,
  isOpen,
  onToggle,
}: SidebarProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [hoveredDeleteProjectId, setHoveredDeleteProjectId] = useState<string | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [dragPreviewIndex, setDragPreviewIndex] = useState<number | null>(null);
  const [projectPendingDelete, setProjectPendingDelete] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const orderedProjects = useMemo(() => projects, [projects]);

  const applySidebarWidth = useCallback(
    (width: number) => {
      const effectiveMin = Math.min(MIN_SIDEBAR_WIDTH, maxSidebarWidth);
      const clamped = Math.max(effectiveMin, Math.min(maxSidebarWidth, width));
      onSidebarWidthChange(clamped);
    },
    [maxSidebarWidth, onSidebarWidthChange]
  );

  const wrapperRef = useRef<View | null>(null);
  const wrapperWindowXRef = useRef(0);
  const refreshWrapperWindowX = useCallback(() => {
    wrapperRef.current?.measureInWindow((x) => {
      wrapperWindowXRef.current = x;
    });
  }, []);

  const resizeGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isOpen)
        .onBegin(() => {
          'worklet';
          runOnJS(setIsResizing)(true);
          runOnJS(refreshWrapperWindowX)();
        })
        .onUpdate((e) => {
          'worklet';
          runOnJS(applySidebarWidth)(e.absoluteX - wrapperWindowXRef.current);
        })
        .onFinalize(() => {
          'worklet';
          runOnJS(setIsResizing)(false);
        }),
    [applySidebarWidth, isOpen, refreshWrapperWindowX]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    width: isOpen
      ? isResizing
        ? sidebarWidth
        : withTiming(sidebarWidth, { duration: 250 })
      : withTiming(0, { duration: 250 }),
    overflow: 'hidden' as const,
  }));
  const toggleAnimatedStyle = useAnimatedStyle(() => ({
    left: isOpen
      ? isResizing
        ? sidebarWidth - 46
        : withTiming(sidebarWidth - 46, { duration: 250 })
      : withTiming(17, { duration: 250 }),
  }));

  const requestDeleteProject = useCallback(
    (project: Project) => {
      setProjectPendingDelete(project);
    },
    []
  );

  const startRenaming = useCallback((project: Project) => {
    setRenamingProjectId(project.id);
    setRenameDraft(project.name);
  }, []);

  const finishRenaming = useCallback(
    async (project: Project) => {
      const next = renameDraft.trim();
      setRenamingProjectId(null);
      if (!next || next === project.name) return;
      try {
        await onProjectRename(project.id, next);
      } catch {
        Alert.alert('Rename failed', 'Could not rename this project.');
      }
    },
    [onProjectRename, renameDraft]
  );

  const closeDeleteModal = useCallback(() => {
    if (deletingProject) return;
    setProjectPendingDelete(null);
  }, [deletingProject]);

  const confirmDeleteProject = useCallback(async () => {
    if (!projectPendingDelete || deletingProject) return;
    setDeletingProject(true);
    try {
      await onProjectDelete(projectPendingDelete);
      setProjectPendingDelete(null);
    } finally {
      setDeletingProject(false);
    }
  }, [deletingProject, onProjectDelete, projectPendingDelete]);

  const reorderGestureForProject = useCallback(
    (projectId: string) =>
      Gesture.Pan()
        .minDistance(PROJECT_DRAG_MIN_DISTANCE)
        .enabled(!renamingProjectId)
        .onStart(() => {
          'worklet';
          const startIndex = orderedProjects.findIndex((p) => p.id === projectId);
          if (startIndex < 0) return;
          runOnJS(setDraggingProjectId)(projectId);
          runOnJS(setDragPreviewIndex)(startIndex);
        })
        .onUpdate((e) => {
          'worklet';
          const startIndex = orderedProjects.findIndex((p) => p.id === projectId);
          if (startIndex < 0) return;
          const targetIndex = Math.max(
            0,
            Math.min(
              orderedProjects.length - 1,
              startIndex + Math.round(e.translationY / PROJECT_ROW_HEIGHT)
            )
          );
          let insertionIndex = targetIndex;
          if (targetIndex > startIndex) insertionIndex = targetIndex + 1;
          runOnJS(setDragPreviewIndex)(Math.max(0, Math.min(orderedProjects.length, insertionIndex)));
        })
        .onFinalize((e) => {
          'worklet';
          const startIndex = orderedProjects.findIndex((p) => p.id === projectId);
          if (startIndex < 0) {
            runOnJS(setDraggingProjectId)(null);
            runOnJS(setDragPreviewIndex)(null);
            return;
          }
          const targetIndex = Math.max(
            0,
            Math.min(
              orderedProjects.length - 1,
              startIndex + Math.round(e.translationY / PROJECT_ROW_HEIGHT)
            )
          );
          if (targetIndex !== startIndex) {
            const next = [...orderedProjects];
            const [moved] = next.splice(startIndex, 1);
            next.splice(targetIndex, 0, moved);
            runOnJS(onProjectReorder)(next.map((p) => p.id));
          }
          runOnJS(setDraggingProjectId)(null);
          runOnJS(setDragPreviewIndex)(null);
        }),
    [onProjectReorder, orderedProjects, renamingProjectId]
  );

  return (
    <View ref={wrapperRef} style={styles.wrapper}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          {dragPreviewIndex === 0 && <View style={styles.dropIndicator} />}
          {orderedProjects.map((project) => (
            <View key={project.id}>
              <GestureDetector gesture={reorderGestureForProject(project.id)}>
                <Pressable
                  onHoverIn={() => setHoveredProjectId(project.id)}
                  onHoverOut={() => setHoveredProjectId((prev) => (prev === project.id ? null : prev))}
                  style={[
                    styles.projectRow,
                    activeProjectId === project.id && styles.projectRowActive,
                    (hoveredProjectId === project.id || hoveredDeleteProjectId === project.id) &&
                      styles.projectRowHovered,
                    draggingProjectId === project.id && styles.projectRowDragging,
                  ]}
                >
                  <Pressable
                    onPress={(e) => {
                      if (renamingProjectId) return;
                      const clickCount = (e as any)?.nativeEvent?.detail ?? 1;
                      if (clickCount >= 2) {
                        startRenaming(project);
                        return;
                      }
                      onProjectSelect(project.id);
                    }}
                    onHoverIn={() => setHoveredProjectId(project.id)}
                    style={styles.projectLabelPressable}
                  >
                    {renamingProjectId === project.id ? (
                      <TextInput
                        value={renameDraft}
                        onChangeText={setRenameDraft}
                        onSubmitEditing={() => void finishRenaming(project)}
                        onBlur={() => void finishRenaming(project)}
                        autoFocus
                        selectTextOnFocus
                        style={styles.projectRenameInput}
                        placeholderTextColor="#71717a"
                      />
                    ) : (
                      <ThemedText style={[styles.projectLabel, styles.nonSelectableText]} numberOfLines={1}>
                        {project.name}
                      </ThemedText>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => requestDeleteProject(project)}
                    onHoverIn={() => {
                      setHoveredProjectId(project.id);
                      setHoveredDeleteProjectId(project.id);
                    }}
                    onHoverOut={() => {
                      setHoveredDeleteProjectId((prev) => (prev === project.id ? null : prev));
                    }}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      (hoveredProjectId === project.id || hoveredDeleteProjectId === project.id) &&
                        styles.deleteButtonVisible,
                      pressed && styles.deleteButtonHover,
                    ]}
                  >
                    <MaterialIcons name="delete-outline" size={15} color="#fca5a5" />
                  </Pressable>
                </Pressable>
              </GestureDetector>
              {dragPreviewIndex === orderedProjects.findIndex((p) => p.id === project.id) + 1 && (
                <View style={styles.dropIndicator} />
              )}
            </View>
          ))}
        </ScrollView>
      </Animated.View>
      <Modal
        visible={!!projectPendingDelete}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeDeleteModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <ThemedText style={styles.modalTitle}>Delete Project</ThemedText>
            <ThemedText style={styles.modalText}>
              {`This will permanently delete "${projectPendingDelete?.name ?? ''}" and all its data.`}
            </ThemedText>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={closeDeleteModal}
                disabled={deletingProject}
              >
                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalDeleteButton, deletingProject && styles.modalDeleteButtonDisabled]}
                onPress={() => void confirmDeleteProject()}
                disabled={deletingProject}
              >
                {deletingProject ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.modalDeleteText}>Delete</ThemedText>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {isOpen && (
        <GestureDetector gesture={resizeGesture}>
          <View style={styles.resizeHandle} />
        </GestureDetector>
      )}

      <Animated.View style={[styles.toggleButton, toggleAnimatedStyle]}>
        <Pressable style={styles.toggleButtonPressable} onPress={onToggle}>
          <MaterialIcons
            name={isOpen ? 'chevron-left' : 'chevron-right'}
            size={20}
            color="#e4e4e7"
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'flex-start',
    overflow: 'visible',
    zIndex: 10,
  },
  container: {
    backgroundColor: '#0a0a0a',
    borderRightWidth: 1,
    borderRightColor: '#27272a',
    height: '100%',
  },
  scrollArea: {
    flex: 1,
    paddingTop: 62,
    paddingHorizontal: 12,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 8,
    paddingRight: 32,
    borderRadius: 6,
    marginBottom: 2,
    position: 'relative',
  },
  projectRowActive: {
    backgroundColor: '#1f2937',
  },
  projectRowHovered: {
    backgroundColor: '#18181b',
  },
  projectRowDragging: {
    opacity: 0.85,
  },
  projectLabel: {
    color: '#e4e4e7',
    fontSize: 14,
    flex: 1,
  },
  nonSelectableText: {
    userSelect: 'none',
  } as any,
  projectLabelPressable: {
    flex: 1,
    minWidth: 0,
  },
  projectRenameInput: {
    color: '#e4e4e7',
    fontSize: 14,
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#3b82f6',
  },
  deleteButton: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -10 }],
    opacity: 0,
    borderRadius: 6,
    padding: 2,
  },
  deleteButtonVisible: {
    opacity: 1,
  },
  deleteButtonHover: {
    opacity: 1,
    backgroundColor: '#3f1d1d',
  },
  dropIndicator: {
    height: 2,
    backgroundColor: '#ffffff',
    borderRadius: 2,
    marginHorizontal: 8,
    marginVertical: 2,
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
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 20,
  },
  modalTitle: {
    color: '#e4e4e7',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  modalText: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 20,
  },
  modalActions: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
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
  modalDeleteButton: {
    minWidth: 96,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#7f1d1d',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  modalDeleteButtonDisabled: {
    opacity: 0.7,
  },
  modalDeleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleButton: {
    position: 'absolute',
    top: 10,
    width: 34,
    height: 34,
    zIndex: 20,
  },
  toggleButtonPressable: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resizeHandle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: -4,
    width: 10,
    zIndex: 15,
    cursor: 'col-resize',
  } as any,
});
