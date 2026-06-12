import { DeadlineForm } from '../components/DeadlineForm';

interface AddDeadlineScreenProps {
  onClose: () => void;
}

/** Manual add-a-deadline form (thin wrapper over the shared DeadlineForm). */
export function AddDeadlineScreen({ onClose }: AddDeadlineScreenProps) {
  return <DeadlineForm heading="Añadir un vencimiento" onClose={onClose} />;
}
