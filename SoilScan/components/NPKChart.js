import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

const NPKBar = ({ label, value, maxValue = 100, color, delay = 0 }) => {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const percentage = Math.min((value / maxValue) * 100, 100);

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(widthAnim, {
        toValue: percentage,
        friction: 8,
        tension: 40,
        useNativeDriver: false,
      }),
    ]).start();
  }, [value]);

  const width = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.barContainer}>
      <View style={styles.barHeader}>
        <View style={styles.labelContainer}>
          <View style={[styles.labelDot, { backgroundColor: color }]} />
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={[styles.value, { color }]}>{value} ppm</Text>
      </View>
      <View style={styles.barBackground}>
        <Animated.View
          style={[
            styles.barFill,
            {
              width,
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <View style={styles.barScale}>
        <Text style={styles.scaleText}>Low</Text>
        <Text style={styles.scaleText}>Optimal</Text>
        <Text style={styles.scaleText}>High</Text>
      </View>
    </View>
  );
};

const NPKChart = ({ nitrogen = 0, phosphorus = 0, potassium = 0 }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Soil Nutrient Levels</Text>
      <NPKBar
        label="Nitrogen (N)"
        value={nitrogen}
        color="#5D9C59"
        delay={0}
      />
      <NPKBar
        label="Phosphorus (P)"
        value={phosphorus}
        color="#FF6B35"
        delay={100}
      />
      <NPKBar
        label="Potassium (K)"
        value={potassium}
        color="#4ECDC4"
        delay={200}
      />
    </View>
  );
};

// Circular gauge variant
export const NPKGauge = ({ label, value, maxValue = 100, color, size = 80 }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const percentage = Math.min((value / maxValue) * 100, 100);

  useEffect(() => {
    Animated.spring(rotateAnim, {
      toValue: percentage,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [value]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={[styles.gaugeContainer, { width: size }]}>
      <View style={[styles.gauge, { width: size, height: size / 2 }]}>
        <View style={[styles.gaugeBackground, { borderColor: '#E9ECEF' }]} />
        <Animated.View
          style={[
            styles.gaugeFill,
            {
              borderColor: color,
              transform: [{ rotate }],
            },
          ]}
        />
        <View style={styles.gaugeCenter}>
          <Text style={[styles.gaugeValue, { color }]}>{value}</Text>
        </View>
      </View>
      <Text style={styles.gaugeLabel}>{label}</Text>
    </View>
  );
};

// Mini bar for compact display
export const NPKMiniBar = ({ nitrogen, phosphorus, potassium }) => {
  return (
    <View style={styles.miniContainer}>
      <View style={styles.miniBar}>
        <View style={[styles.miniFill, { flex: nitrogen, backgroundColor: '#5D9C59' }]} />
        <View style={[styles.miniFill, { flex: phosphorus, backgroundColor: '#FF6B35' }]} />
        <View style={[styles.miniFill, { flex: potassium, backgroundColor: '#4ECDC4' }]} />
      </View>
      <View style={styles.miniLegend}>
        <View style={styles.miniLegendItem}>
          <View style={[styles.miniDot, { backgroundColor: '#5D9C59' }]} />
          <Text style={styles.miniText}>N</Text>
        </View>
        <View style={styles.miniLegendItem}>
          <View style={[styles.miniDot, { backgroundColor: '#FF6B35' }]} />
          <Text style={styles.miniText}>P</Text>
        </View>
        <View style={styles.miniLegendItem}>
          <View style={[styles.miniDot, { backgroundColor: '#4ECDC4' }]} />
          <Text style={styles.miniText}>K</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 20,
    marginVertical: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A3C40',
    marginBottom: 20,
  },
  barContainer: {
    marginBottom: 20,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A3C40',
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
  },
  barBackground: {
    height: 12,
    backgroundColor: '#E9ECEF',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  barScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  scaleText: {
    fontSize: 10,
    color: '#6C757D',
  },
  // Gauge styles
  gaugeContainer: {
    alignItems: 'center',
  },
  gauge: {
    position: 'relative',
    overflow: 'hidden',
  },
  gaugeBackground: {
    position: 'absolute',
    width: '100%',
    height: '200%',
    borderWidth: 8,
    borderRadius: 1000,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  gaugeFill: {
    position: 'absolute',
    width: '100%',
    height: '200%',
    borderWidth: 8,
    borderRadius: 1000,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    transformOrigin: 'center bottom',
  },
  gaugeCenter: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    transform: [{ translateX: -20 }],
  },
  gaugeValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  gaugeLabel: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 4,
    fontWeight: '500',
  },
  // Mini bar styles
  miniContainer: {
    marginVertical: 8,
  },
  miniBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#E9ECEF',
  },
  miniFill: {
    height: '100%',
  },
  miniLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 16,
  },
  miniLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  miniText: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '500',
  },
});

export default NPKChart;
