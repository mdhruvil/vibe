import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import ReactDOM from 'react-dom/client';
import Loader from './components/loader';
import { routeTree } from './routeTree.gen';
import { queryClient, trpc } from './utils/trpc';

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPendingComponent: () => <Loader />,
  context: { trpc, queryClient },
  Wrap({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  },
});

declare module '@tanstack/react-router' {
  // biome-ignore lint/nursery/useConsistentTypeDefinitions: <idk what is happening here if i do type it can't override the original one>
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('app');

if (!rootElement) {
  throw new Error('Root element not found');
}

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<RouterProvider router={router} />);
}
