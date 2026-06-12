const mockTakePictureAsync = jest.fn(async () => ({ uri: 'file:///cache/captured.jpg' }));
let mockPermission: { granted: boolean; canAskAgain: boolean } | null = { granted: true, canAskAgain: true };
const mockRequestPermission = jest.fn(async () => mockPermission);

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    useCameraPermissions: () => [mockPermission, mockRequestPermission],
    CameraView: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePictureAsync }));
      return React.createElement(View, { testID: 'camera-view' }, props.children);
    }),
  };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { CameraCaptureScreen } from './CameraCaptureScreen';

beforeEach(() => {
  mockPermission = { granted: true, canAskAgain: true };
  mockTakePictureAsync.mockClear();
  mockRequestPermission.mockClear();
});

describe('CameraCaptureScreen', () => {
  it('captures a photo and fires onCaptured with the uri', async () => {
    const onCaptured = jest.fn();
    await render(<CameraCaptureScreen onCaptured={onCaptured} onCancel={() => {}} />);
    fireEvent.press(await screen.findByTestId('shutter'));
    await waitFor(() => expect(onCaptured).toHaveBeenCalledWith('file:///cache/captured.jpg'));
  });

  it('shows a message and allows cancel when permission is denied', async () => {
    mockPermission = { granted: false, canAskAgain: false };
    const onCancel = jest.fn();
    await render(<CameraCaptureScreen onCaptured={() => {}} onCancel={onCancel} />);
    fireEvent.press(await screen.findByText('Cerrar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
