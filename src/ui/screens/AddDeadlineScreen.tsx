import { DeadlineForm } from '../components/DeadlineForm';

interface AddDeadlineScreenProps {
  onSaved: () => void;
}

/** Manual add-a-deadline form (thin wrapper over the shared DeadlineForm). */
export function AddDeadlineScreen({ onSaved }: AddDeadlineScreenProps) {
  return <DeadlineForm heading="Añadir un vencimiento" onSaved={onSaved} />;
}
