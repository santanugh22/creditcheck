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
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../theme/ThemeContext";
import { Radius, Spacing, Typography } from "../../theme/tokens";
import { ComputedLoanStatus } from "../../types/ledger";
import { AlertCircleIcon, CheckCircleIcon } from "../icons/LedgerIcons";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface TactilePressableProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hapticStyle?: "light" | "medium" | "none";
}

/**
 * Premium tactile touch micro-interaction adhering to Apple HIG & Material 3 guidelines.
 * Uses high-precision quad/cubic timing curves without bouncy or wobbly spring oscillations.
 */
export function TactilePressable({
  children,
  style,
  scaleTo = 0.975,
  hapticStyle = "light",
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: TactilePressableProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn: PressableProps["onPressIn"] = (e) => {
    scale.value = withTiming(scaleTo, {
      duration: 75,
      easing: Easing.out(Easing.quad),
    });
    opacity.value = withTiming(0.85, {
      duration: 75,
      easing: Easing.out(Easing.quad),
    });
    onPressIn?.(e);
  };

  const handlePressOut: PressableProps["onPressOut"] = (e) => {
    scale.value = withTiming(1, {
      duration: 130,
      easing: Easing.out(Easing.quad),
    });
    opacity.value = withTiming(1, {
      duration: 130,
      easing: Easing.out(Easing.quad),
    });
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

// Backward-compatible alias for existing imports
export const SpringPressable = TactilePressable;

/**
 * Breathing Overdue / Status Badge for Loan Entries with gentle opacity glow
 */
export function StatusBadge({
  status,
  label,
}: {
  status: ComputedLoanStatus;
  label: string;
}) {
  const { colors } = useTheme();
  const breathe = useSharedValue(1);

  useEffect(() => {
    if (status === "OVERDUE") {
      breathe.value = withRepeat(
        withSequence(
          withTiming(0.72, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
    } else {
      breathe.value = 1;
    }
  }, [status, breathe]);

  const animatedBadgeStyle = useAnimatedStyle(() => ({
    opacity: breathe.value,
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
