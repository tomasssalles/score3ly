// Making a project, created from a PDF or imported from a project file, and opening it (docs/project-view.md, "New
// project"). Opening it leaves the project shown, so while this device runs one of its stages the user is asked first,
// before anything is made (decided, review dec. 43): on Cancel no project exists that nobody asked for. And it is
// opened only once the list of projects has it, which is where the app finds the project a URL names: before, the
// app would say for a moment that the project doesn't exist.

export type NewProjectFlow<T> = {
  // Asks first if leaving the project shown stops a run, then calls `then`; not at all if the user stays.
  whenLeaving: (then: () => void) => void;
  make: () => Promise<T>;
  refresh: () => Promise<void>;
  open: (made: T) => void;
  failed: (err: unknown) => void | Promise<void>;
};

export function makeAndOpen<T>({ whenLeaving, make, refresh, open, failed }: NewProjectFlow<T>): void {
  whenLeaving(async () => {
    let made: T;
    try {
      made = await make();
    } catch (err) {
      await failed(err);
      return;
    }
    await refresh();
    open(made);
  });
}
