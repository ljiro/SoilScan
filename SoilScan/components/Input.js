import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  icon,
  suffix,
  error,
  disabled = false,
  helperText,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const labelAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const borderAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(labelAnim, {
      toValue: isFocused || value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();

    Animated.timing(borderAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, value]);

  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [error]);

  const labelTop = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, -10],
  });

  const labelSize = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 12],
  });

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? '#FF6B6B' : '#E9ECEF', error ? '#FF6B6B' : '#5D9C59'],
  });

  const backgroundColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FAFAFA', '#FFFFFF'],
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: shakeAnim }] }]}>
      <Animated.View
        style={[
          styles.inputContainer,
          {
            borderColor,
            backgroundColor,
          },
          disabled && styles.disabled,
        ]}
      >
        {icon && (
          <View style={styles.iconContainer}>
            <Ionicons
              name={icon}
              size={20}
              color={isFocused ? '#5D9C59' : '#6C757D'}
            />
          </View>
        )}

        <View style={styles.inputWrapper}>
          <Animated.Text
            style={[
              styles.label,
              {
                top: labelTop,
                fontSize: labelSize,
                color: error ? '#FF6B6B' : (isFocused ? '#5D9C59' : '#6C757D'),
              },
            ]}
          >
            {label}
          </Animated.Text>

          <TextInput
            style={[styles.input, icon && styles.inputWithIcon]}
            value={value}
            onChangeText={onChangeText}
            placeholder={isFocused ? placeholder : ''}
            placeholderTextColor="#BDBDBD"
            keyboardType={keyboardType}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            editable={!disabled}
            {...props}
          />
        </View>

        {suffix && (
          <Text style={styles.suffix}>{suffix}</Text>
        )}
      </Animated.View>

      {(error || helperText) && (
        <View style={styles.helperContainer}>
          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color="#FF6B6B" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <Text style={styles.helperText}>{helperText}</Text>
          )}
        </View>
      )}
    </Animated.View>
  );
};

// Compact input for inline use
export const CompactInput = ({ label, value, onChangeText, suffix, keyboardType = 'numeric' }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.compactContainer}>
      <Text style={styles.compactLabel}>{label}</Text>
      <View style={[
        styles.compactInputWrapper,
        isFocused && styles.compactInputFocused,
      ]}>
        <TextInput
          style={styles.compactInput}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="0"
          placeholderTextColor="#BDBDBD"
        />
        {suffix && <Text style={styles.compactSuffix}>{suffix}</Text>}
      </View>
    </View>
  );
};

// Select-style input
export const SelectInput = ({ label, value, onPress, icon = 'chevron-down' }) => {
  return (
    <TouchableOpacity style={styles.selectContainer} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.selectLabel}>{label}</Text>
      <View style={styles.selectInputWrapper}>
        <Text style={[styles.selectValue, !value && styles.selectPlaceholder]}>
          {value || 'Select...'}
        </Text>
        <Ionicons name={icon} size={20} color="#6C757D" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  disabled: {
    opacity: 0.6,
  },
  iconContainer: {
    marginRight: 12,
  },
  inputWrapper: {
    flex: 1,
    position: 'relative',
    paddingVertical: 8,
  },
  label: {
    position: 'absolute',
    left: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    fontWeight: '500',
  },
  input: {
    fontSize: 16,
    color: '#1A3C40',
    paddingTop: 8,
    fontWeight: '500',
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
  suffix: {
    fontSize: 14,
    color: '#6C757D',
    fontWeight: '500',
    marginLeft: 8,
  },
  helperContainer: {
    marginTop: 6,
    paddingHorizontal: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginLeft: 4,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: '#6C757D',
  },
  // Compact styles
  compactContainer: {
    flex: 1,
    marginRight: 12,
  },
  compactLabel: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '600',
    marginBottom: 8,
  },
  compactInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E9ECEF',
    paddingHorizontal: 14,
    height: 48,
  },
  compactInputFocused: {
    borderColor: '#5D9C59',
    backgroundColor: '#FFFFFF',
  },
  compactInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A3C40',
    fontWeight: '600',
  },
  compactSuffix: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '500',
  },
  // Select styles
  selectContainer: {
    marginBottom: 16,
  },
  selectLabel: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '600',
    marginBottom: 8,
  },
  selectInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E9ECEF',
    paddingHorizontal: 16,
    height: 56,
  },
  selectValue: {
    fontSize: 16,
    color: '#1A3C40',
    fontWeight: '500',
  },
  selectPlaceholder: {
    color: '#BDBDBD',
  },
});

export default Input;
