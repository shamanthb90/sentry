import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import MemberListStore from 'sentry/stores/memberListStore';
import type {Actor, ParsedOwnershipRule} from 'sentry/types';

import {OwnershipRulesTable} from './ownshipRulesTable';

describe('OwnershipRulesTable', () => {
  const user1 = TestStubs.User();
  const user2 = TestStubs.User({id: '2', name: 'Jane Doe'});

  beforeEach(() => {
    ConfigStore.init();
    ConfigStore.set('user', user1);
    MemberListStore.init();
    MemberListStore.loadInitialData([user1, user2]);
  });

  it('should render empty state', () => {
    render(<OwnershipRulesTable projectRules={[]} codeowners={[]} />);
    expect(screen.getByText('No ownership rules found')).toBeInTheDocument();
  });

  it('should render project owners members', () => {
    const rules: ParsedOwnershipRule[] = [
      {
        matcher: {pattern: 'pattern', type: 'path'},
        owners: [{type: 'user', id: user1.id, name: user1.name}],
      },
    ];

    render(<OwnershipRulesTable projectRules={rules} codeowners={[]} />);

    expect(screen.getByText('path')).toBeInTheDocument();
    expect(screen.getByText('pattern')).toBeInTheDocument();
    expect(screen.getByText(user1.name)).toBeInTheDocument();
  });

  it('should filter codeowners rules without actor names', () => {
    const rules: ParsedOwnershipRule[] = [
      {
        matcher: {pattern: 'pattern', type: 'path'},
        // Name = undefined only seems to happen when adding a new codeowners file
        owners: [{type: 'user', id: user1.id, name: undefined as any}],
      },
      {
        matcher: {pattern: 'my/path', type: 'path'},
        owners: [{type: 'user', id: user2.id, name: user2.name}],
      },
    ];

    render(
      <OwnershipRulesTable
        projectRules={[]}
        codeowners={[TestStubs.CodeOwner({schema: {rules}})]}
      />
    );

    expect(screen.getByText('pattern')).toBeInTheDocument();
    expect(screen.getByText('my/path')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Everyone'})).toBeEnabled();
  });

  it('should render multiple project owners', () => {
    const rules: ParsedOwnershipRule[] = [
      {
        matcher: {pattern: 'pattern', type: 'path'},
        owners: [
          {type: 'user', id: user1.id, name: user1.name},
          {type: 'user', id: user2.id, name: user2.name},
        ],
      },
    ];

    render(<OwnershipRulesTable projectRules={rules} codeowners={[]} />);

    expect(screen.getByText('path')).toBeInTheDocument();
    expect(screen.getByText('pattern')).toBeInTheDocument();
    expect(screen.getByText(`${user1.name} and 1 other`)).toBeInTheDocument();
    expect(screen.queryByText(user2.name)).not.toBeInTheDocument();
  });

  it('should filter by rule type and pattern', async () => {
    const owners: Actor[] = [{type: 'user', id: user1.id, name: user1.name}];
    const rules: ParsedOwnershipRule[] = [
      {matcher: {pattern: 'filepath', type: 'path'}, owners},
      {matcher: {pattern: 'mytag', type: 'tag'}, owners},
    ];

    render(<OwnershipRulesTable projectRules={rules} codeowners={[]} />);

    const searchbar = screen.getByPlaceholderText('Search by type or rule');
    await userEvent.click(searchbar);
    await userEvent.paste('path');

    expect(screen.getByText('filepath')).toBeInTheDocument();
    expect(screen.queryByText('mytag')).not.toBeInTheDocument();

    // Change the filter to mytag
    await userEvent.clear(searchbar);
    await userEvent.paste('mytag');

    expect(screen.getByText('mytag')).toBeInTheDocument();
    expect(screen.queryByText('filepath')).not.toBeInTheDocument();
  });

  it('should filter by my teams by default', async () => {
    const rules: ParsedOwnershipRule[] = [
      {
        matcher: {pattern: 'filepath', type: 'path'},
        owners: [{type: 'user', id: user1.id, name: user1.name}],
      },
      {
        matcher: {pattern: 'mytag', type: 'tag'},
        owners: [{type: 'user', id: user2.id, name: user2.name}],
      },
    ];

    render(<OwnershipRulesTable projectRules={rules} codeowners={[]} />);

    expect(screen.getByText('filepath')).toBeInTheDocument();
    expect(screen.queryByText('mytag')).not.toBeInTheDocument();

    // Clear the filter
    await userEvent.click(screen.getByRole('button', {name: 'My Teams'}));
    await userEvent.click(screen.getByRole('button', {name: 'Clear'}));

    expect(screen.getByText('filepath')).toBeInTheDocument();
    expect(screen.queryByText('mytag')).toBeInTheDocument();
  });

  it('preserves selected teams when rules are updated', async () => {
    const rules: ParsedOwnershipRule[] = [
      {
        matcher: {pattern: 'filepath', type: 'path'},
        owners: [{type: 'user', id: user1.id, name: user1.name}],
      },
      {
        matcher: {pattern: 'anotherpath', type: 'path'},
        owners: [{type: 'user', id: user2.id, name: user2.name}],
      },
    ];

    const {rerender} = render(
      <OwnershipRulesTable projectRules={rules} codeowners={[]} />
    );

    // Clear the filter
    await userEvent.click(screen.getByRole('button', {name: 'My Teams'}));
    await userEvent.click(screen.getByRole('button', {name: 'Clear'}));
    expect(screen.getAllByText('path')).toHaveLength(2);

    const newRules: ParsedOwnershipRule[] = [
      ...rules,
      {
        matcher: {pattern: 'thirdpath', type: 'path'},
        owners: [{type: 'user', id: user2.id, name: user2.name}],
      },
    ];

    rerender(<OwnershipRulesTable projectRules={newRules} codeowners={[]} />);
    expect(screen.getAllByText('path')).toHaveLength(3);
    expect(screen.getByRole('button', {name: 'Everyone'})).toBeInTheDocument();
  });

  it('should paginate results', async () => {
    const owners: Actor[] = [{type: 'user', id: user1.id, name: user1.name}];
    const rules: ParsedOwnershipRule[] = Array(100)
      .fill(0)
      .map((_, i) => ({
        matcher: {pattern: `mytag${i}`, type: 'tag'},
        owners,
      }));

    render(<OwnershipRulesTable projectRules={rules} codeowners={[]} />);

    expect(screen.getByText('mytag1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Next page'}));
    expect(screen.getByText('mytag30')).toBeInTheDocument();
    expect(screen.queryByText('mytag1')).not.toBeInTheDocument();
  });
});
