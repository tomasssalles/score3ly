// What the desktop app asks when its page holds back from being left (docs/desktop.md, "Closing during a run"): the
// page asks before it is unloaded while a stage runs (`beforeunload`, apps/web/src/usePipelineRun.ts), and Electron,
// unlike a browser, shows no question then: it keeps the window open without a word. The main process asks instead,
// with these words: whether the window is closing ("Close": on macOS the app may stay in the dock, elsewhere it quits)
// or the page is being reloaded.

import { LEAVING_A_RUN } from "@score3ly/core";

export type LeaveQuestion = { message: string; detail: string; buttons: [string, string] };

export function leaveQuestion(closing: boolean): LeaveQuestion {
  return {
    message: closing ? "Close while a stage is running?" : "Reload while a stage is running?",
    detail: `${closing ? "Closing" : "Reloading"} stops the run. ${LEAVING_A_RUN}`,
    buttons: [closing ? "Close" : "Reload", "Cancel"],
  };
}
