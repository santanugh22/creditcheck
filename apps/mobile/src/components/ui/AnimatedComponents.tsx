import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../theme/ThemeContext";
import { Radius, Spacing, Typography } from "../../theme/tokens";
import { ComputedLoanStatus } from "../../types/ledger";
import { AlertCircleIcon, CheckCircleIcon } from "../icons/LedgerIcons";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SpringPressableProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hapticStyle?: "light" | "medium" | "none";
}

/**
 * Tactile 60fps Reanimated button wrapper with spring physics and Haptic feedback.
 */
export function SpringPressable({
  children,
  style,
  scaleTo = 0.96,
  hapticStyle = "light",
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: SpringPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn: PressableProps["onPressIn"] = (e) => {
    scale.value = withSpring(scaleTo, { damping: 15, stiffness: 320 });
    onPressIn?.(e);
  };

  const handlePressOut: PressableProps["onPressOut"] = (e) => {
    scale.value = withSpring(1, { damping: 14, stiffness: 280 });
    onPressOut?.(e);
  };

  const handlePress: PressableProps["onPress"] = (e) => {
    if (hapticStyle === "light") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else if (hapticStyle === "medium") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onPress?.(e);
  };

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[animatedStyle, style, disabled && { opacity: 0.55 }]}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * Pulsing Overdue / Status Badge for Loan Entries
 */
export function StatusBadge({
  status,
  label,
}: {
  status: ComputedLoanStatus;
  label: string;
}) {
  const { colors } = useTheme();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (status === "OVERDUE") {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 750 }),
          withTiming(1, { duration: 750 }),
        ),
        -1,
        true,
      );
    } else {
      pulse.value = 1;
    }
  }, [status, pulse]);

  const animatedBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  let bgColor = colors.primaryLight;
  let textColor = colors.primary;

  if (status === "OVERDUE") {
    bgColor = colors.dangerSurface;
    textColor = colors.danger;
  } else if (status === "REPAID") {
    bgColor = colors.successSurface;
    textColor = colors.success;
  } else if (status === "PARTIAL") {
    bgColor = colors.accentLight;
    textColor = colors.accent;
  }

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          backgroundColor: bgColor,
          borderColor: status === "OVERDUE" ? colors.danger : "transparent",
          borderWidth: status === "OVERDUE" ? 1 : 0,
        },
        animatedBadgeStyle,
      ]}
    >
      {status === "OVERDUE" && <AlertCircleIcon size={13} color={textColor} />}
      {status === "REPAID" && <CheckCircleIcon size={13} color={textColor} />}
      <Text style={[styles.badgeText, { color: textColor }]}>{label}</Text>
    </Animated.View>
  );
}

/**
 * Animated Shimmer Skeleton Card while fetching loans from PostgreSQL
 */
export function SkeletonLoaderCard() {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 700 }),
        withTiming(0.45, { duration: 700 }),
      ),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeletonCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        animatedStyle,
      ]}
    >
      <View style={styles.skeletonRow}>
        <View
          style={[styles.skeletonAvatar, { backgroundColor: colors.border }]}
        />
        <View style={{ flex: 1, gap: 8 }}>
          <View
            style={[
              styles.skeletonLineWide,
              { backgroundColor: colors.border },
            ]}
          />
          <View
            style={[
              styles.skeletonLineShort,
              { backgroundColor: colors.border },
            ]}
          />
        </View>
        <View
          style={[styles.skeletonAmount, { backgroundColor: colors.border }]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  skeletonCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
  },
  skeletonLineWide: {
    height: 14,
    width: "65%",
    borderRadius: Radius.sm,
  },
  skeletonLineShort: {
    height: 11,
    width: "40%",
    borderRadius: Radius.sm,
  },
  skeletonAmount: {
    height: 20,
    width: 72,
    borderRadius: Radius.sm,
  },
});
