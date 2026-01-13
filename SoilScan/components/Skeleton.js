import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

const Skeleton = ({ width, height, borderRadius = 8, style }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

// Pre-built skeleton layouts
export const SkeletonCard = () => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <Skeleton width={48} height={48} borderRadius={12} />
      <View style={styles.cardHeaderText}>
        <Skeleton width={120} height={18} />
        <Skeleton width={80} height={14} style={{ marginTop: 8 }} />
      </View>
    </View>
    <Skeleton width="100%" height={8} style={{ marginVertical: 16 }} />
    <Skeleton width="100%" height={60} borderRadius={12} />
    <View style={styles.cardTags}>
      <Skeleton width={70} height={28} borderRadius={14} />
      <Skeleton width={90} height={28} borderRadius={14} />
      <Skeleton width={60} height={28} borderRadius={14} />
    </View>
  </View>
);

export const SkeletonResultCard = () => (
  <View style={styles.resultCard}>
    <View style={styles.resultHeader}>
      <Skeleton width={60} height={60} borderRadius={16} />
      <View style={styles.resultHeaderText}>
        <Skeleton width={140} height={20} />
        <Skeleton width={100} height={16} style={{ marginTop: 8 }} />
      </View>
    </View>
    <Skeleton width="100%" height={10} borderRadius={5} style={{ marginVertical: 16 }} />
    <Skeleton width="100%" height={50} borderRadius={8} />
    <View style={styles.resultTags}>
      <Skeleton width={80} height={32} borderRadius={16} />
      <Skeleton width={100} height={32} borderRadius={16} />
      <Skeleton width={70} height={32} borderRadius={16} />
    </View>
    <Skeleton width="100%" height={50} borderRadius={12} style={{ marginTop: 16 }} />
  </View>
);

export const SkeletonInput = () => (
  <View style={styles.inputContainer}>
    <Skeleton width={80} height={12} style={{ marginBottom: 8 }} />
    <Skeleton width="100%" height={52} borderRadius={12} />
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E1E9EE',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    marginLeft: 16,
    flex: 1,
  },
  cardTags: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  resultCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultHeaderText: {
    marginLeft: 16,
    flex: 1,
  },
  resultTags: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  inputContainer: {
    marginBottom: 16,
  },
});

export default Skeleton;
