import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/theme';

export interface SkeletonProps {
  width: number | string;
  height: number;
  radius?: number;
}

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

export function Skeleton({ width, height, radius = 8 }: SkeletonProps) {
  const progress = useSharedValue(0);
  const [measured, setMeasured] = useState(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const span = measured > 0 ? measured : 200;
    const translateX = -span + progress.value * (span * 2);
    return {
      transform: [{ translateX }],
    };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== measured) {
      setMeasured(w);
    }
  };

  const containerStyle: ViewStyle = {
    width: width as ViewStyle['width'],
    height,
    borderRadius: radius,
    backgroundColor: Colors.borderLight,
    overflow: 'hidden',
  };

  return (
    <View style={containerStyle} onLayout={onLayout}>
      <AnimatedGradient
        colors={['transparent', Colors.surfaceElevated, 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[
          styles.shimmer,
          { width: measured || 200, height },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
