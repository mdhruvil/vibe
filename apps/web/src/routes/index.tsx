import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useVMStore } from '@/stores/vm';

export const Route = createFileRoute('/')({
  component: RouteComponent,
});

function RouteComponent() {
  const vmStatus = useVMStore((state) => state.vmStatus);
  const vm = useVMStore((state) => state.vm);
  const initVM = useVMStore((state) => state.initVM);
  const runCommand = useVMStore((state) => state.runCommand);

  useEffect(() => {
    (async () => {
      if (!vm) {
        console.log('No VM instance available');
        await initVM();
        return;
      }
      const process = await runCommand('pwd');

      const reader = process.output.getReader();
      try {
        // biome-ignore lint/nursery/noUnnecessaryConditions: <we manual break from loop>
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          console.log(`[pwd] ${value}`);
        }
      } finally {
        reader.releaseLock();
      }
    })();
  }, [vm, initVM, runCommand]);

  return <div>{vmStatus}</div>;
}
