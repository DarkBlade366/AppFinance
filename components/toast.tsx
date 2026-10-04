import { createContext, PropsWithChildren, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

type ToastType = 'success' | 'error' | 'info';

type ToastContextValue = {
  show: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('success');
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(-24));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (msg: string, toastType: ToastType = 'success') => {
      setMessage(msg);
      setType(toastType);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
      ]).start();
      hideTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -12, duration: 200, useNativeDriver: true }),
        ]).start();
      }, 2400);
    },
    [opacity, translateY]
  );

  const bgColor =
    type === 'success' ? '#123524' : type === 'error' ? '#3A1420' : '#152334';
  const borderColor =
    type === 'success' ? Colors.success : type === 'error' ? Colors.danger : Colors.tint;
  const icon = type === 'success' ? 'check' : type === 'error' ? 'close' : 'info';
  const iconColor =
    type === 'success' ? Colors.success : type === 'error' ? Colors.danger : Colors.tint;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          {
            top: insets.top + 8,
            backgroundColor: bgColor,
            borderColor,
            opacity,
            transform: [{ translateY }],
          },
        ]}>
        <IconSymbol name={icon} size={18} color={iconColor} />
        <Text style={styles.message}>{message}</Text>
      </Animated.View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 1000,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});