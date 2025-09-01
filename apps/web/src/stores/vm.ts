import { WebContainer, type WebContainerProcess } from '@webcontainer/api';
import { create } from 'zustand';

type VMStore = {
  vm: WebContainer | null;
  vmStatus: 'idle' | 'booting' | 'installing' | 'running' | 'stopped' | 'error';
  initVM: () => Promise<void>;
  shutdownVM: () => void;
  runCommand: (command: string) => Promise<WebContainerProcess>;
};

export const useVMStore = create<VMStore>()((set, get) => ({
  vm: null,
  vmStatus: 'idle',
  initVM: async () => {
    set({ vmStatus: 'booting' });
    console.log('[VM] Booting the vm...');
    try {
      const vmInstance = await WebContainer.boot();
      set({ vm: vmInstance, vmStatus: 'running' });
      console.log('[VM] VM is running');
    } catch (error) {
      console.log('[VM] Error while booting the vm');
      console.log(error);
      set({ vmStatus: 'error' });
    }
  },
  shutdownVM: () => {
    const state = get();
    if (state.vm) {
      state.vm.teardown();
      set({ vm: null, vmStatus: 'stopped' });
      console.log('[VM] VM has been stopped');
    }
  },
  runCommand: async (command: string) => {
    const state = get();
    if (!state.vm) {
      throw new Error('VM is not initialized');
    }

    const process = await state.vm.spawn(command);
    return process;
  },
}));
