import { registerCommand, unregisterCommand, type Command } from "./commandRegistry";

export type CommandInput = Omit<Command, "id"> & { id?: string };

export function useCommands(commandsInput: MaybeRef<CommandInput[]>) {
  // The server has no keyboard, and a command registered there would outlive
  // its request: nothing unmounts on the server to unregister it.
  if (import.meta.server) return { unregister: () => {} };

  let registeredIds: string[] = [];
  let current: CommandInput[] = [];
  let suspended = false;

  const unregisterAll = () => {
    registeredIds.forEach(unregisterCommand);
    registeredIds = [];
  };

  const register = (cmds: CommandInput[]) => {
    current = cmds;
    // Unregister previous commands first
    unregisterAll();
    if (suspended) return;

    // Register new commands
    cmds.forEach((cmd, i) => {
      const id = cmd.id || `auto-${Date.now()}-${i}`;
      registerCommand({ ...cmd, id });
      registeredIds.push(id);
    });
  };

  // Handle reactive input
  if (isRef(commandsInput)) {
    watch(commandsInput, (newCmds) => register(newCmds), { immediate: true });
  } else {
    register(commandsInput);
  }

  // A page held in `<KeepAlive>` (`definePageMeta({ keepalive })`) is
  // deactivated rather than unmounted when the operator leaves it, so its
  // commands have to leave with it here: a parked page's `shift+n` firing on
  // the page in front of it is a shortcut nobody can see the source of. They
  // come back with the page. Neither hook fires outside a `<KeepAlive>`.
  onDeactivated(() => {
    suspended = true;
    unregisterAll();
  });
  onActivated(() => {
    if (!suspended) return;
    suspended = false;
    register(current);
  });

  onUnmounted(unregisterAll);

  return {
    unregister: unregisterAll,
  };
}
