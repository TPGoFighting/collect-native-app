import React, { useRef, useState } from 'react';
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import type { ViewerImage } from './SectionView';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function ZoomableImage({ uri }: { uri: string }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), 4);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
      }
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1.5 ? 1 : 2.5;
      scale.value = withTiming(next);
      savedScale.value = next;
    });
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, doubleTap)}>
      <Animated.View style={[styles.zoomWrap, style]}>
        <Image source={{ uri }} style={styles.fullImage} contentFit="contain" cachePolicy="disk" />
      </Animated.View>
    </GestureDetector>
  );
}

export function ImageViewer({
  visible,
  images,
  index,
  onClose,
  onIndexChange,
}: {
  visible: boolean;
  images: ViewerImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const listRef = useRef<FlatList>(null);
  const [current, setCurrent] = useState(index);
  const shown = current;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Text style={styles.counter}>
            {images.length > 1 ? `${shown + 1} / ${images.length}` : ''}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <X size={24} color="#FFFFFF" />
          </Pressable>
        </View>
        <FlatList
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            setCurrent(i);
            onIndexChange(i);
          }}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <View style={styles.page}>
              <ZoomableImage uri={item.url} />
              {item.caption ? <Text style={styles.caption}>{item.caption}</Text> : null}
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 2,
  },
  counter: { color: '#FFFFFF', fontSize: 14 },
  closeBtn: { padding: 8 },
  page: { width: SCREEN_W, height: SCREEN_H - 110, justifyContent: 'center' },
  zoomWrap: { width: SCREEN_W, height: SCREEN_H - 160, justifyContent: 'center' },
  fullImage: { width: '100%', height: '100%' },
  caption: { color: '#A1A1AA', fontSize: 13, textAlign: 'center', paddingHorizontal: 24, marginTop: 8 },
});
