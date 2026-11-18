import { FittedText } from "../FittedText";
import { when } from "../format";

// A project offered to be opened (the project picker, the dialog of a PDF already known): its name, over up to three
// lines (with the typed text marked), and when it was last opened.
export function ProjectOption({ name, lastOpenedAt, highlight }: { name: string; lastOpenedAt: string; highlight?: string }) {
  return (
    <>
      <FittedText className="option-name" text={name} lines={3} highlight={highlight} />
      <span className="option-time">{when(lastOpenedAt)}</span>
    </>
  );
}
