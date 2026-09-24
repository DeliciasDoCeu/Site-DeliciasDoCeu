import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
export function localEnvironment(directory = null) {
  if (directory) fs.mkdirSync(directory, { recursive: true });
  const database = new DatabaseSync(directory ? path.join(directory, "catalog.sqlite") : ":memory:");
  database.exec(fs.readFileSync(new URL("../worker/schema.sql", import.meta.url), "utf8"));
  const DB = {
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() { return database.prepare(sql).get(...values) || null; },
        async all() { return { results: database.prepare(sql).all(...values) }; },
        async run() { const result = database.prepare(sql).run(...values); return { meta: { changes: Number(result.changes) } }; }
      };
    }
  };
  const photos = new Map();
  const PHOTOS = {
    async put(id, bytes, { metadata }) {
      if (directory) {
        fs.writeFileSync(path.join(directory, `${id}.photo`), bytes);
        fs.writeFileSync(path.join(directory, `${id}.json`), JSON.stringify(metadata));
      } else photos.set(id, { value: new Uint8Array(bytes).buffer, metadata });
    },
    async getWithMetadata(id) {
      if (directory) {
        const image = path.join(directory, `${id}.photo`);
        if (!fs.existsSync(image)) return { value: null };
        const bytes = fs.readFileSync(image);
        return { value: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), metadata: JSON.parse(fs.readFileSync(path.join(directory, `${id}.json`), "utf8")) };
      }
      return photos.get(id) || { value: null };
    },
    async delete(id) {
      if (directory) {
        fs.rmSync(path.join(directory, `${id}.photo`), { force: true });
        fs.rmSync(path.join(directory, `${id}.json`), { force: true });
      } else photos.delete(id);
    }
  };
  return { DB, PHOTOS, close: () => database.close() };
}
