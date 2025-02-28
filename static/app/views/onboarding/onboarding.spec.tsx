import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import {PersistedStoreProvider} from 'sentry/stores/persistedStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import Onboarding from 'sentry/views/onboarding/onboarding';
import * as usePersistedOnboardingStateHook from 'sentry/views/onboarding/utils';

describe('Onboarding', function () {
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders the welcome page', function () {
    const routeParams = {
      step: 'welcome',
    };

    const {router, route, routerContext} = initializeOrg({
      ...initializeOrg(),
      router: {
        params: routeParams,
      },
    });

    render(
      <PersistedStoreProvider>
        <Onboarding
          router={router}
          location={router.location}
          params={routeParams}
          routes={router.routes}
          routeParams={router.params}
          route={route}
        />
      </PersistedStoreProvider>,
      {
        context: routerContext,
      }
    );

    expect(screen.getByLabelText('Start')).toBeInTheDocument();
    expect(screen.getByLabelText('Invite Team')).toBeInTheDocument();
  });

  it('renders the select platform step', async () => {
    const routeParams = {
      step: 'select-platform',
    };

    const {router, route, routerContext, organization} = initializeOrg({
      ...initializeOrg(),
      router: {
        params: routeParams,
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/client-state/`,
      body: {},
    });

    OrganizationStore.onUpdate(organization);

    render(
      <PersistedStoreProvider>
        <Onboarding
          router={router}
          location={router.location}
          params={routeParams}
          routes={router.routes}
          routeParams={router.params}
          route={route}
        />
      </PersistedStoreProvider>,
      {
        context: routerContext,
      }
    );

    expect(
      await screen.findByText('Select the platforms you want to monitor')
    ).toBeInTheDocument();
  });

  it('renders the setup docs step', async () => {
    const projects = [
      TestStubs.Project({
        platform: 'javascript-react',
        id: '4',
        slug: 'javascript-reactslug',
      }),
      TestStubs.Project({platform: 'ruby', id: '5', slug: 'ruby-slug'}),
      TestStubs.Project({
        platform: 'javascript-nextjs',
        id: '6',
        slug: 'javascript-nextslug',
      }),
    ];

    const routeParams = {
      step: 'setup-docs',
    };

    const {router, route, routerContext, organization} = initializeOrg({
      ...initializeOrg(),
      router: {
        params: routeParams,
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/client-state/`,
      body: {
        onboarding: {
          platformToProjectIdMap: {
            'javascript-react': projects[0].slug,
            ruby: projects[1].slug,
            'javascript-nextjs': projects[2].slug,
          },
          selectedPlatforms: [
            {key: 'ruby', type: 'language', language: 'ruby', category: 'server'},
            {
              key: 'javascript-nextjs',
              type: 'framework',
              language: 'javascript',
              category: 'browser',
            },
          ],
        },
      },
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/ruby-slug/`,
      body: {
        firstEvent: false,
      },
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/javascript-nextslug/docs/javascript-nextjs/`,
      body: null,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/ruby-slug/docs/ruby/`,
      body: null,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/ruby-slug/issues/`,
      body: [],
    });

    ProjectsStore.loadInitialData(projects);

    OrganizationStore.onUpdate(organization);

    render(
      <PersistedStoreProvider>
        <Onboarding
          router={router}
          location={router.location}
          params={routeParams}
          routes={router.routes}
          routeParams={router.params}
          route={route}
        />
      </PersistedStoreProvider>,
      {
        context: routerContext,
      }
    );

    expect(await screen.findAllByTestId('sidebar-error-indicator')).toHaveLength(2);
  });

  it('renders framework selection modal if vanilla js is selected', async function () {
    jest
      .spyOn(usePersistedOnboardingStateHook, 'usePersistedOnboardingState')
      .mockImplementation(() => [
        {
          platformToProjectIdMap: {
            javascript: 'javascript',
          },
          selectedPlatforms: [
            {
              key: 'javascript',
              type: 'language',
              language: 'javascript',
              category: 'browser',
            },
          ],
        },
        jest.fn(),
      ]);

    const routeParams = {
      step: 'select-platform',
    };

    const {router, route, routerContext, organization} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
        features: ['onboarding-remove-multiselect-platform', 'onboarding-sdk-selection'],
      },
      router: {
        params: routeParams,
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/client-state/`,
      body: {
        onboarding: {
          platformToProjectIdMap: {
            javascript: 'javascript',
          },
          selectedPlatforms: [
            {
              key: 'javascript',
              type: 'language',
              language: 'javascript',
              category: 'browser',
            },
          ],
        },
      },
    });

    render(
      <PersistedStoreProvider>
        <Onboarding
          router={router}
          location={router.location}
          params={routeParams}
          routes={router.routes}
          routeParams={router.params}
          route={route}
        />
      </PersistedStoreProvider>,
      {
        context: routerContext,
        organization,
      }
    );

    renderGlobalModal();

    // Select the JavaScript platform
    await userEvent.click(screen.getByTestId('platform-javascript'));

    // Click on create project button
    await userEvent.click(screen.getByRole('button', {name: 'Create Project'}));

    // Modal is open
    await screen.findByText('Do you use a framework?');

    // Close modal
    await userEvent.click(screen.getByRole('button', {name: 'Skip'}));
  });

  it('does not render framework selection modal if vanilla js is NOT selected', async function () {
    jest
      .spyOn(usePersistedOnboardingStateHook, 'usePersistedOnboardingState')
      .mockImplementation(() => [
        {
          platformToProjectIdMap: {
            'javascript-react': 'javascript-react',
          },
          selectedPlatforms: [
            {
              key: 'javascript-react',
              type: 'framework',
              language: 'javascript',
              category: 'browser',
            },
          ],
        },
        jest.fn(),
      ]);

    const routeParams = {
      step: 'select-platform',
    };

    const {router, route, routerContext, organization} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
        features: ['onboarding-remove-multiselect-platform', 'onboarding-sdk-selection'],
      },
      router: {
        params: routeParams,
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/client-state/`,
      body: {
        onboarding: {
          platformToProjectIdMap: {
            'javascript-react': 'javascript-react',
          },
          selectedPlatforms: [
            {
              key: 'javascript-react',
              type: 'framework',
              language: 'javascript',
              category: 'browser',
            },
          ],
        },
      },
    });

    render(
      <PersistedStoreProvider>
        <Onboarding
          router={router}
          location={router.location}
          params={routeParams}
          routes={router.routes}
          routeParams={router.params}
          route={route}
        />
      </PersistedStoreProvider>,
      {
        context: routerContext,
        organization,
      }
    );

    // Select the React platform
    await userEvent.click(screen.getByTestId('platform-javascript-react'));

    // Click on create project button
    await userEvent.click(screen.getByRole('button', {name: 'Create Project'}));

    // Modal shall not be open
    expect(screen.queryByText('Do you use a framework?')).not.toBeInTheDocument();
  });
});
