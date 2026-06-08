import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { RepositoryProvider, useDeadlineRepository } from './repository-context';

function Probe() {
  const repo = useDeadlineRepository();
  return <Text>{repo ? 'has-repo' : 'no-repo'}</Text>;
}

describe('RepositoryProvider', () => {
  it('exposes an injected repository immediately', async () => {
    await render(
      <RepositoryProvider repository={new InMemoryDeadlineRepository()}>
        <Probe />
      </RepositoryProvider>,
    );
    expect(screen.getByText('has-repo')).toBeTruthy();
  });

  it('throws if the hook is used outside the provider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Probe />)).rejects.toThrow(/RepositoryProvider/);
    spy.mockRestore();
  });
});
