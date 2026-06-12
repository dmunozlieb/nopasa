import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { colors, fontSizes, radii, spacing } from '../theme';

interface CameraCaptureScreenProps {
  onCaptured: (uri: string) => void;
  onCancel: () => void;
}

/** Full-screen camera viewfinder; fires onCaptured with the photo URI on shutter press. */
export function CameraCaptureScreen({ onCaptured, onCancel }: CameraCaptureScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const submitting = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const onShutter = async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      const photo = await cameraRef.current?.takePictureAsync();
      if (photo?.uri) {
        onCaptured(photo.uri);
      }
    } finally {
      submitting.current = false;
    }
  };

  // Permission not yet resolved (null) or denied without ability to ask again
  if (!permission?.granted) {
    return (
      <View style={styles.denied}>
        <AppText weight="semibold" size={fontSizes.body} color={colors.textSecondary} style={styles.deniedText}>
          Necesitamos permiso para usar la cámara.
        </AppText>
        <Button label="Cerrar" onPress={onCancel} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <View style={styles.controls}>
        <Pressable testID="shutter" style={styles.shutter} onPress={onShutter} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },
  camera: { flex: 1 },
  controls: {
    position: 'absolute',
    bottom: spacing.xxxl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: 4,
    borderColor: colors.brandBlue,
  },
  denied: {
    flex: 1,
    backgroundColor: colors.screenBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  deniedText: { textAlign: 'center' },
});
