import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Reversible 120ms press feedback; no motion when the system asks for reduced effects. */
export function PressScale({ children, style, ...props }: PressableProps) {
  const pressed = useSharedValue(0);
  const reduced = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : 1 - pressed.value * 0.06 }],
    opacity: reduced ? 1 : 1 - pressed.value * 0.25,
  }));

  return (
    <AnimatedPressable
      {...props}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        pressed.value = withTiming(1, { duration: 120 });
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withTiming(0, { duration: 120 });
        props.onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
