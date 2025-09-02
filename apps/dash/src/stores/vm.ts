import { WebContainer, type WebContainerProcess } from "@webcontainer/api";
import stripAnsi from "strip-ansi";
import { create } from "zustand";

type VMStore = {
  vm: WebContainer | null;
  vmStatus: "idle" | "booting" | "installing" | "running" | "stopped" | "error";
  logs: Array<{
    level: "log";
    message: string;
    timestamp: Date;
  }>;
  initVM: () => Promise<void>;
  shutdownVM: () => void;
  runCommand: (
    command: string,
    args?: string[]
  ) => Promise<WebContainerProcess>;
};
module;
export const useVMStore = create<VMStore>()((set, get) => ({
  vm: null,
  terminal: null,
  vmStatus: "idle",
  logs: [],
  initVM: async () => {
    const state = get();
    if (state.vm) {
      console.log("[VM] VM is already up");
      return;
    }
    set({ vmStatus: "booting" });
    console.log("[VM] Booting the vm...");
    try {
      const vmInstance = await WebContainer.boot();
      set({ vm: vmInstance, vmStatus: "running" });
      console.log("[VM] VM is running");
    } catch (error) {
      console.log("[VM] Error while booting the vm");
      console.log(error);
      set({ vmStatus: "error" });
    }
  },
  shutdownVM: () => {
    const state = get();
    if (state.vm) {
      state.vm.teardown();
      set({ vm: null, vmStatus: "stopped" });
      console.log("[VM] VM has been stopped");
    }
  },
  runCommand: async (command, args) => {
    const state = get();
    if (!state.vm) {
      throw new Error("VM is not initialized");
    }

    const process = await state.vm.spawn(command, args ?? []);
    process.output.pipeTo(
      new WritableStream({
        write(chunk) {
          if (!stripAnsi(chunk).trim()) {
            return;
          }
          console.log(stripAnsi(chunk));
          set({
            logs: get().logs.concat([
              {
                level: "log",
                message: stripAnsi(chunk),
                timestamp: new Date(),
              },
            ]),
          });
        },
      })
    );
    return process;
  },
}));
