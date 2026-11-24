// R2 over a folder of plain files (docs/desktop.md): the calls the Worker makes (`get`, `put`, `head`,
// `delete`, `list`). An object's key is its path under the folder ("content/<sha256>", "pdfs/<sha256>.pdf"); its
// content type, when it has one, is in a file next to it, "<key>.type". The upload time is the file's.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

const TYPE_SUFFIX = ".type";

type HttpMetadata = { contentType?: string };

export type NodeR2Object = {
  key: string;
  size: number;
  uploaded: Date;
  httpMetadata: HttpMetadata;
};

export type NodeR2ObjectBody = NodeR2Object & {
  body: ReadableStream<Uint8Array>;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
};

type PutOptions = { sha256?: string; httpMetadata?: HttpMetadata };
type Body = ArrayBuffer | ArrayBufferView | string | null;

export class NodeR2 {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
    mkdirSync(root, { recursive: true });
  }

  // Keys never leave the folder.
  private path(key: string): string {
    const path = join(this.root, key);
    if (key.endsWith(TYPE_SUFFIX) || relative(this.root, path).startsWith("..")) throw new Error(`bad key: ${key}`);
    return path;
  }

  private describe(key: string): NodeR2Object | null {
    const path = this.path(key);
    if (!existsSync(path)) return null;
    const stat = statSync(path);
    const contentType = existsSync(path + TYPE_SUFFIX) ? readFileSync(path + TYPE_SUFFIX, "utf8") : undefined;
    return { key, size: stat.size, uploaded: stat.mtime, httpMetadata: contentType ? { contentType } : {} };
  }

  async head(key: string): Promise<NodeR2Object | null> {
    return this.describe(key);
  }

  async get(key: string): Promise<NodeR2ObjectBody | null> {
    const object = this.describe(key);
    if (!object) return null;
    const bytes = readFileSync(this.path(key));
    const buffer = () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return {
      ...object,
      body: new Blob([buffer()]).stream(),
      arrayBuffer: async () => buffer(),
      text: async () => bytes.toString("utf8"),
      json: async <T,>() => JSON.parse(bytes.toString("utf8")) as T,
    };
  }

  // Like R2, refuses content that doesn't match a given SHA-256. Written to a temporary file first, so a reader never
  // sees half an object.
  async put(key: string, value: Body, options: PutOptions = {}): Promise<NodeR2Object> {
    const bytes =
      value === null
        ? Buffer.alloc(0)
        : typeof value === "string"
          ? Buffer.from(value, "utf8")
          : value instanceof ArrayBuffer
            ? Buffer.from(value)
            : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    if (options.sha256 && createHash("sha256").update(bytes).digest("hex") !== options.sha256.toLowerCase()) {
      throw new Error("put: the content doesn't match its SHA-256");
    }
    const path = this.path(key);
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.${process.pid}.${Date.now()}.partial`;
    writeFileSync(temporary, bytes);
    renameSync(temporary, path);
    const contentType = options.httpMetadata?.contentType;
    if (contentType) writeFileSync(path + TYPE_SUFFIX, contentType);
    else rmSync(path + TYPE_SUFFIX, { force: true });
    return this.describe(key)!;
  }

  async delete(keys: string | string[]): Promise<void> {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      const path = this.path(key);
      rmSync(path, { force: true });
      rmSync(path + TYPE_SUFFIX, { force: true });
    }
  }

  // The objects under a prefix, in key order, a page at a time (the cursor is the last key of the page before).
  async list(options: { prefix?: string; cursor?: string; limit?: number } = {}): Promise<{
    objects: NodeR2Object[];
    truncated: boolean;
    cursor?: string;
  }> {
    const prefix = options.prefix ?? "";
    const limit = options.limit ?? 1000;
    const keys = this.keys().filter((key) => key.startsWith(prefix) && (!options.cursor || key > options.cursor));
    const page = keys.slice(0, limit);
    const truncated = keys.length > limit;
    return { objects: page.map((key) => this.describe(key)!), truncated, ...(truncated ? { cursor: page.at(-1) } : {}) };
  }

  private keys(): string[] {
    const keys: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (!entry.name.endsWith(TYPE_SUFFIX) && !entry.name.endsWith(".partial")) keys.push(relative(this.root, path).split(sep).join("/"));
      }
    };
    walk(this.root);
    return keys.sort();
  }
}
