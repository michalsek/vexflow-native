import { useMemo, useRef, useState, type ElementRef } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useColorScheme } from '../../hooks/useColorScheme';
import { DROP_DOWN_DEFAULT_PLACEHOLDER } from './constants';
import { type DropDownProps } from './types';
import { getDropDownPalette, getSelectedLabel } from './utils';

export default function DropDown<TValue extends string = string>({
  options,
  value,
  onChange,
  placeholder = DROP_DOWN_DEFAULT_PLACEHOLDER,
}: DropDownProps<TValue>) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const palette = getDropDownPalette(isDark);
  const [isOpen, setIsOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const triggerRef = useRef<ElementRef<typeof View>>(null);

  const selectedLabel = useMemo(
    () => getSelectedLabel(options, value, placeholder),
    [options, placeholder, value]
  );

  const toggleMenu = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);

    if (!triggerRef.current?.measureInWindow) {
      setMenuAnchor({ x: 0, y: 0, width: 240, height: 0 });
      return;
    }

    triggerRef.current.measureInWindow(
      (x: number, y: number, width: number, height: number) => {
        setMenuAnchor({ x, y, width, height });
      }
    );
  };

  return (
    <View style={styles.container}>
      <View collapsable={false} ref={triggerRef}>
        <Pressable
          testID="dropDownTrigger"
          style={[
            styles.trigger,
            {
              borderColor: palette.triggerBorderColor,
              backgroundColor: palette.triggerBackgroundColor,
            },
          ]}
          onPress={toggleMenu}
        >
          <Text
            style={[styles.triggerText, { color: palette.triggerTextColor }]}
          >
            {selectedLabel}
          </Text>
          <Text style={[styles.caret, { color: palette.caretColor }]}>
            {isOpen ? '▲' : '▼'}
          </Text>
        </Pressable>
      </View>

      <Modal
        transparent
        visible={isOpen}
        animationType="none"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)} />
        <View
          style={[
            styles.menu,
            {
              top: menuAnchor.y + menuAnchor.height + 4,
              left: menuAnchor.x,
              width: menuAnchor.width,
              borderColor: palette.menuBorderColor,
              backgroundColor: palette.menuBackgroundColor,
            },
          ]}
        >
          <ScrollView nestedScrollEnabled style={styles.menuScroll}>
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  style={[
                    styles.option,
                    isSelected && {
                      backgroundColor: palette.selectedOptionBackgroundColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: palette.optionTextColor },
                      isSelected && {
                        color: palette.selectedOptionTextColor,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 6,
  },
  trigger: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  caret: {
    fontSize: 12,
  },
  menu: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 1000,
    elevation: 6,
  },
  menuScroll: {
    maxHeight: 240,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionText: {
    fontSize: 14,
  },
});
