import { DeadlineForm } from '../components/DeadlineForm';

interface ConfirmDeadlineScreenProps {
  photoUri: string;
  onClose: () => void;
}

/** Confirm screen for the photo path (thin wrapper over the shared DeadlineForm). */
export function ConfirmDeadlineScreen({ photoUri, onClose }: ConfirmDeadlineScreenProps) {
  return <DeadlineForm heading="Confirma los datos" photoUri={photoUri} onClose={onClose} />;
}
