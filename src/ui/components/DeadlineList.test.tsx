import { render, screen } from '@testing-library/react-native';
import { buildDeadline } from '../../test-support/build-deadline';
import { groupAndSort } from '../../domain/deadline/grouping';
import { DeadlineList } from './DeadlineList';

function makeGroups(today: Date) {
  const at = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d;
  };
  const list = [
    buildDeadline({ id: '1', title: 'ITV — Clio', dueDate: at(4), amountLabel: 'multa 200 €' }),
    buildDeadline({ id: '2', title: 'Seguro del coche', dueDate: at(6) }),
    buildDeadline({ id: '3', title: 'DNI — Marta', dueDate: at(9) }),
    buildDeadline({ id: '4', title: 'Netflix', dueDate: at(14), amountLabel: '12,99 €/mes' }),
  ];
  return groupAndSort(list, today);
}

describe('DeadlineList', () => {
  const today = new Date();

  it('renders title, summary and sections with counts and pills', async () => {
    await render(
      <DeadlineList groups={makeGroups(today)} today={today} onPressRow={() => {}} onAdd={() => {}} onOpenSettings={() => {}} />,
    );

    expect(screen.getByText('Mis vencimientos')).toBeTruthy();
    expect(screen.getByText('3 cosas requieren tu atención')).toBeTruthy();
    expect(screen.getByText('REQUIEREN ATENCIÓN')).toBeTruthy();
    expect(screen.getByText('PRÓXIMAS')).toBeTruthy();
    expect(screen.getByText('4 días')).toBeTruthy();
    expect(screen.getByText('multa 200 €')).toBeTruthy();
    expect(screen.getByText('12,99 €/mes')).toBeTruthy();
  });

  it('hides empty sections', async () => {
    await render(
      <DeadlineList groups={makeGroups(today)} today={today} onPressRow={() => {}} onAdd={() => {}} onOpenSettings={() => {}} />,
    );
    // No CALM items were added.
    expect(screen.queryByText('TRANQUILAS')).toBeNull();
  });
});
