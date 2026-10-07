import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Mirrors the hero entrance animation used on the Home page.
 * Returns { opacity, translateY } Animated.Values that animate
 * from (0, 24) → (1, 0) on mount.
 *
 * Usage:
 *   const { opacity, translateY } = usePageTransition();
 *   <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>
 *     {children}
 *   </Animated.View>
 */
export function usePageTransition(duration = 420, slideDistance = 24) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(slideDistance)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration, useNativeDriver: true }),
    ]).start();
  }, []);

  return { opacity, translateY };
}
