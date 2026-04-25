import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { ThemedText } from './themed-text';
import { Node } from '../types/database';

export const NODE_CIRCLE_SIZE = 80;
const TAP_MOVE_THRESHOLD = 6;

function getStatusColor(status: Node['status']): string {
  switch (status) {
    case 'stuck':
      return '#ef4444';
    case 'completed':
      return '#10b981';
    case 'active':
    default:
      return '#3b82f6';
  }
}

type Bounds = { width: number; height: number };

type NodeCircleProps = {
  node: Node;
  displayLabel?: string;
  initialX: number;
  initialY: number;
  bounds: Bounds;
  draggable?: boolean;
  onPress: () => void;
};

export function NodeCircle({
  node,
  displayLabel,
  initialX,
  initialY,
  bounds,
  draggable = true,
  onPress,
}: NodeCircleProps) {
  const borderColor = getStatusColor(node.status);
  const label = displayLabel ?? node.label;

  const translateX = useSharedValue(initialX);
  const translateY = useSharedValue(initialY);
  const startX = useSharedValue(initialX);
  const startY = useSharedValue(initialY);
  const didMove = useSharedValue(false);

  const boundsWidth = useSharedValue(bounds.width);
  const boundsHeight = useSharedValue(bounds.height);

  useEffect(() => {
    boundsWidth.value = bounds.width;
    boundsHeight.value = bounds.height;
  }, [bounds.width, bounds.height, boundsWidth, boundsHeight]);

  useEffect(() => {
    translateX.value = initialX;
    translateY.value = initialY;
  }, [initialX, initialY, translateX, translateY]);

  const pan = Gesture.Pan()
    // onBegin fires on pointer-down before the gesture activates (works for clicks too)
    .onBegin(() => {
      'worklet';
      startX.value = translateX.value;
      startY.value = translateY.value;
      didMove.value = false;
    })
    .onUpdate((e) => {
      'worklet';
      const dist = Math.sqrt(e.translationX * e.translationX + e.translationY * e.translationY);
      if (dist > TAP_MOVE_THRESHOLD) {
        didMove.value = true;
      }
      const maxX = boundsWidth.value - NODE_CIRCLE_SIZE;
      const maxY = boundsHeight.value - NODE_CIRCLE_SIZE;
      translateX.value = Math.max(0, Math.min(startX.value + e.translationX, maxX));
      translateY.value = Math.max(0, Math.min(startY.value + e.translationY, maxY));
    })
    // onFinalize fires on pointer-up regardless of whether the gesture ever activated
    .onFinalize(() => {
      'worklet';
      if (!didMove.value) {
        runOnJS(onPress)();
      }
    });

  const tap = Gesture.Tap().onEnd(() => {
    'worklet';
    runOnJS(onPress)();
  });

  const gesture = draggable ? pan : tap;

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: translateX.value,
    top: translateY.value,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.circle,
          { borderColor },
          animatedStyle,
          !draggable && styles.circleFixed,
        ]}
      >
        <ThemedText style={styles.label} numberOfLines={2}>
          {label}
        </ThemedText>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: NODE_CIRCLE_SIZE,
    height: NODE_CIRCLE_SIZE,
    borderRadius: NODE_CIRCLE_SIZE / 2,
    borderWidth: 2,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    cursor: 'grab',
  } as any,
  circleFixed: {
    cursor: 'default',
  } as any,
  label: {
    color: '#e4e4e7',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
