import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const StepIndicator = ({ steps, currentStep, showLabels = true }) => {
  return (
    <View style={styles.container}>
      <View style={styles.stepsContainer}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={index}>
              <StepCircle
                step={step}
                index={index}
                isCompleted={isCompleted}
                isCurrent={isCurrent}
                showLabels={showLabels}
              />
              {!isLast && (
                <StepLine isCompleted={isCompleted} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

const StepCircle = ({ step, index, isCompleted, isCurrent, showLabels }) => {
  const scaleAnim = useRef(new Animated.Value(isCurrent ? 0.8 : 1)).current;
  const bgColorAnim = useRef(new Animated.Value(isCompleted || isCurrent ? 1 : 0)).current;

  useEffect(() => {
    if (isCurrent) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
    }

    Animated.spring(bgColorAnim, {
      toValue: isCompleted || isCurrent ? 1 : 0,
      useNativeDriver: false,
    }).start();
  }, [isCurrent, isCompleted]);

  const backgroundColor = bgColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E9ECEF', '#5D9C59'],
  });

  return (
    <View style={styles.stepItem}>
      <Animated.View
        style={[
          styles.stepCircle,
          {
            backgroundColor,
            transform: [{ scale: scaleAnim }],
            borderWidth: isCurrent ? 3 : 0,
            borderColor: isCurrent ? '#5D9C59' : 'transparent',
          },
          isCurrent && styles.currentStep,
        ]}
      >
        {isCompleted ? (
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
        ) : (
          <Text style={[
            styles.stepNumber,
            { color: isCompleted || isCurrent ? '#FFFFFF' : '#6C757D' }
          ]}>
            {index + 1}
          </Text>
        )}
      </Animated.View>
      {showLabels && (
        <Text style={[
          styles.stepLabel,
          (isCompleted || isCurrent) && styles.activeLabel
        ]}>
          {step.label}
        </Text>
      )}
    </View>
  );
};

const StepLine = ({ isCompleted }) => {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: isCompleted ? 100 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isCompleted]);

  const width = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.lineContainer}>
      <View style={styles.lineBackground} />
      <Animated.View style={[styles.lineFill, { width }]} />
    </View>
  );
};

// Compact horizontal step indicator
export const CompactStepIndicator = ({ total, current }) => {
  return (
    <View style={styles.compactContainer}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.compactDot,
            i <= current && styles.compactDotActive,
            i === current && styles.compactDotCurrent,
          ]}
        />
      ))}
    </View>
  );
};

// Progress bar variant
export const StepProgressBar = ({ current, total, label }) => {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const percentage = (current / total) * 100;

  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: percentage,
      friction: 8,
      useNativeDriver: false,
    }).start();
  }, [current]);

  const width = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressText}>{current}/{total}</Text>
      </View>
      <View style={styles.progressBackground}>
        <Animated.View style={[styles.progressFill, { width }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  stepItem: {
    alignItems: 'center',
    width: 70,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentStep: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#5D9C59',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepLabel: {
    fontSize: 11,
    color: '#6C757D',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  activeLabel: {
    color: '#1A3C40',
    fontWeight: '600',
  },
  lineContainer: {
    flex: 1,
    height: 3,
    marginTop: 14,
    marginHorizontal: -8,
    position: 'relative',
  },
  lineBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#E9ECEF',
    borderRadius: 2,
  },
  lineFill: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#5D9C59',
    borderRadius: 2,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  compactDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E9ECEF',
  },
  compactDotActive: {
    backgroundColor: '#5D9C59',
  },
  compactDotCurrent: {
    width: 24,
    borderRadius: 4,
  },
  // Progress bar styles
  progressContainer: {
    marginVertical: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A3C40',
  },
  progressText: {
    fontSize: 14,
    color: '#5D9C59',
    fontWeight: '600',
  },
  progressBackground: {
    height: 8,
    backgroundColor: '#E9ECEF',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#5D9C59',
    borderRadius: 4,
  },
});

export default StepIndicator;
