import { useEffect, useState } from "react";

// The URL's hash ("#/..."), kept up to date when it changes (navigation, back button, edited by hand).
export function useHash(): string {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return hash;
}
