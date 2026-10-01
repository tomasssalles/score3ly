import { useEffect, useState } from "react";

export function App() {
  const [health, setHealth] = useState("checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body: { status: string }) => setHealth(body.status))
      .catch((err) => setHealth(`error: ${err}`));
  }, []);

  return (
    <main>
      <h1>score3ly</h1>
      <p>API: {health}</p>
    </main>
  );
}
