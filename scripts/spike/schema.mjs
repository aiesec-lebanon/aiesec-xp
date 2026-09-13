import { writeFileSync, mkdirSync } from "node:fs";
import { gis } from "./gis-client.mjs";

const INTROSPECTION = `
query {
  __schema {
    queryType { name }
    types {
      name kind
      fields { name args { name type { kind name ofType { kind name ofType { kind name } } } } type { kind name ofType { kind name ofType { kind name } } } }
      inputFields { name type { kind name ofType { kind name ofType { kind name } } } }
      enumValues { name }
    }
  }
}`;

export function typeName(type) {
  if (!type) return "?";
  if (type.name) return type.kind === "LIST" ? `[${type.name}]` : type.name;
  const inner = typeName(type.ofType);
  if (type.kind === "LIST") return `[${inner}]`;
  if (type.kind === "NON_NULL") return `${inner}!`;
  return inner;
}

export async function loadSchema(outDir) {
  const result = await gis(INTROSPECTION);
  if (!result.ok) {
    return { ok: false, errors: result.errors, status: result.status };
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/introspection.json`, JSON.stringify(result.data, null, 2));

  const types = new Map(result.data.__schema.types.map((t) => [t.name, t]));
  const queryTypeName = result.data.__schema.queryType.name;

  // Root query fields are spread across interfaces the query type implements,
  // so collect every field on every type that looks like a query surface.
  const rootFields = new Map();
  for (const type of result.data.__schema.types) {
    if (type.kind !== "OBJECT" && type.kind !== "INTERFACE") continue;
    if (type.name !== queryTypeName && !/Query$/.test(type.name)) continue;
    for (const field of type.fields ?? []) {
      if (!rootFields.has(field.name)) rootFields.set(field.name, field);
    }
  }

  return { ok: true, types, rootFields, queryTypeName };
}

export function describeRootField(schema, name) {
  const field = schema.rootFields.get(name);
  if (!field) return { present: false };
  return {
    present: true,
    args: field.args.map((a) => `${a.name}: ${typeName(a.type)}`),
    returns: typeName(field.type),
  };
}

export function describeInput(schema, name, only) {
  const type = schema.types.get(name);
  if (!type?.inputFields) return { present: false };
  const fields = type.inputFields
    .filter((f) => !only || only.includes(f.name))
    .map((f) => `${f.name}: ${typeName(f.type)}`);
  return { present: true, fields };
}

export function describeObject(schema, name, only) {
  const type = schema.types.get(name);
  if (!type?.fields) return { present: false };
  const fields = type.fields
    .filter((f) => !only || only.includes(f.name))
    .map((f) => `${f.name}: ${typeName(f.type)}`);
  return { present: true, fields };
}

export function enumValues(schema, name) {
  return schema.types.get(name)?.enumValues?.map((v) => v.name) ?? null;
}
