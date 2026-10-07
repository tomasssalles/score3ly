import { DropdownMenu } from "./DropdownMenu";
import { MenuIcon } from "./icons";
import { hashForPage, type Page } from "./route";

// Groups of pages, separated by a line: what you look at, what you change, help about the app.
const GROUPS: { page: Page; label: string }[][] = [
  [{ page: "stats", label: "Statistics" }],
  [{ page: "settings", label: "Settings" }],
  [
    { page: "help", label: "Help" },
    { page: "about", label: "About" },
  ],
];

// The menu button at the right of the header, with links to the app's pages.
export function Menu({ current }: { current: Page | null }) {
  return (
    <DropdownMenu
      icon={<MenuIcon />}
      label="Menu"
      groups={GROUPS.map((group) =>
        group.map(({ page, label }) => ({ label, href: hashForPage(page), current: page === current })),
      )}
    />
  );
}
