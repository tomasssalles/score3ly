// fingerprints.test.ts on the Node host (testPlatform.ts): the desktop version's D1 and R2, with D1's limits enforced.
export {};
process.env.TEST_HOST = "node";
await import("./fingerprints.test.ts");
