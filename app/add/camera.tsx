import { useRouter } from 'expo-router';
import { CameraCaptureScreen } from '../../src/ui/screens/CameraCaptureScreen';

export default function AddCameraRoute() {
  const router = useRouter();
  return (
    <CameraCaptureScreen
      onCaptured={(uri) => router.push(`/add/confirm?photoUri=${encodeURIComponent(uri)}`)}
      onCancel={() => router.back()}
    />
  );
}
