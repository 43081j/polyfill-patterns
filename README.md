# `polyfill-patterns`

A standalone catalog of **AST-grep YAML rules** and **Web Platform Baseline metadata** for detecting JavaScript polyfills (`core-js`, `es-shims`, inline prototype shims) and syntax downleveling helpers (Babel, SWC, TypeScript) in bundled or source JavaScript.

Designed to be consumed either **directly as raw AST-grep YAML files** (by the `ast-grep` CLI, editors, or any language binding) or **programmatically via a JavaScript / TypeScript API**.

---

## Package Structure

```text
polyfill-patterns/
├── rules/                  # 35 standalone AST-grep YAML rule files (<id>.yaml)
├── rules.json              # Rule catalog manifest (BCD keys, web-features IDs, suggestions)
├── sgconfig.yml            # Standalone ast-grep CLI project config pointing to ./rules
├── src/
│   └── index.ts            # TypeScript/JavaScript API & dynamic web-features Baseline hydration
└── dist/
    ├── index.js            # Compiled ESM bundle
    └── index.d.ts          # TypeScript type definitions
```

---

## 1. Consuming Rules Directly as YAML Files

Every polyfill and syntax-transform detection rule is stored as a standalone, standard [ast-grep](https://ast-grep.github.io/) YAML rule file under `rules/<id>.yaml`.

### A. With the `ast-grep` (`sg`) CLI

`polyfill-patterns` ships with an `sgconfig.yml` at the package root (`ruleDirs: ['./rules']`), so you can run `ast-grep scan` directly using its config or any individual YAML rule:

```bash
# Scan a bundle against all 35 polyfill rules using sgconfig.yml
npx ast-grep scan --config node_modules/polyfill-patterns/sgconfig.yml dist/bundle.js

# Scan against a single YAML rule file
npx ast-grep scan --rule node_modules/polyfill-patterns/rules/array-at.yaml dist/bundle.js
```

### B. Resolving YAML Paths in Node.js

The package exports `"./rules/*"`, `"./rules.json"`, and `"./sgconfig.yml"` in `package.json`, as well as filesystem path helpers:

```ts
import { getRulesDir, resolveRuleYamlPath, getDefaultCatalogPath } from 'polyfill-patterns';

// Absolute path to the directory containing all 35 .yaml files
const rulesDir = getRulesDir();

// Absolute path to a specific YAML rule file (by rule ID or relative path)
const arrayAtYamlPath = resolveRuleYamlPath('array-at');

// Absolute path to rules.json
const catalogJsonPath = getDefaultCatalogPath();
```

You can also resolve files via `import.meta.resolve`:

```ts
const yamlUrl = import.meta.resolve('polyfill-patterns/rules/array-at.yaml');
const sgConfigUrl = import.meta.resolve('polyfill-patterns/sgconfig.yml');
```

---

## 2. Consuming via the JavaScript / TypeScript API

### A. Scanning Code with `@ast-grep/napi` and Pre-Parsed Rules

Use `getAllAstGrepRules()` or `getAstGrepRule(id)` to get pre-parsed AST-grep rule objects alongside hydrated Web Platform Baseline metadata:

```ts
import { parse, Lang } from '@ast-grep/napi';
import { getAllAstGrepRules, getAstGrepRule } from 'polyfill-patterns';

const bundleCode = `
  if (!Array.prototype.at) {
    Array.prototype.at = function(n) { return this[n < 0 ? this.length + n : n]; };
  }
`;

const root = parse(Lang.JavaScript, bundleCode).root();

// Scan against all 35 rules in the catalog
for (const { entry, query } of getAllAstGrepRules()) {
  const matches = root.findAll(query);
  if (matches.length > 0) {
    console.log(
      `Detected ${entry.name} (${entry.id}) — Baseline: ${entry.baselineStatus} (${entry.baselineLowDate})`,
      `Estimated weight: ${entry.estimatedSizeBytes} B`
    );
  }
}

// Or inspect / run a single rule by ID
const arrayAtDoc = getAstGrepRule('array-at');
if (arrayAtDoc) {
  const matches = root.findAll({ rule: arrayAtDoc.rule });
  console.log(`Matches for ${arrayAtDoc.id}:`, matches.length);
}
```

### B. Querying Catalog Metadata & Live `web-features` Baseline Status

When `loadCatalog()` or `getAllRules()` is called, `polyfill-patterns` dynamically hydrates each rule's `baselineStatus` (`'high'` | `'low'` | `'false'`), `baselineYear`, `baselineLowDate`, `baselineHighDate`, and `estimatedSizeBytes` from the official W3C `web-features` dataset:

```ts
import {
  getAllRules,
  getRuleById,
  getRuleByWebFeatureId,
  getRuleByBcdId,
  getRulesByBaselineStatus,
  getRuleYaml,
  getEstimatedPolyfillBytes,
  ESTIMATED_POLYFILL_WEIGHT_BYTES,
  FEATURE_CALL_PATTERNS,
} from 'polyfill-patterns';

// 1. Get all 35 hydrated RuleEntry objects
const allRules = getAllRules();

// 2. Lookup by rule ID, web-features ID, or MDN BCD key
const ruleById = getRuleById('object-has-own');
const ruleByWf = getRuleByWebFeatureId('promise-all-settled');
const ruleByBcd = getRuleByBcdId('javascript.builtins.Array.at');

// 3. Filter rules by Baseline status ('high' = Widely available, 'low' = Newly available)
const widelyAvailableRules = getRulesByBaselineStatus('high');

// 4. Read raw YAML text for a rule ID
const rawYaml = getRuleYaml('array-at');

// 5. Get estimated minified byte weight for a polyfill rule
const bytes = getEstimatedPolyfillBytes('promise'); // 18500
```

---

## Included Rules (35)

| Rule ID | Feature Name | BCD Key |
| :--- | :--- | :--- |
| `array-at` | `Array.prototype.at` | `javascript.builtins.Array.at` |
| `array-change-by-copy` | `toSorted` / `toReversed` / `toSpliced` / `with` | `javascript.builtins.Array.toSorted` |
| `array-filter` | `Array.prototype.filter` | `javascript.builtins.Array.filter` |
| `array-find-last` | `findLast` / `findLastIndex` | `javascript.builtins.Array.findLast` |
| `array-flat` | `flat` / `flatMap` | `javascript.builtins.Array.flat` |
| `array-from` | `Array.from` | `javascript.builtins.Array.from` |
| `array-includes` | `Array.prototype.includes` | `javascript.builtins.Array.includes` |
| `array-iterator` | `Array.prototype[Symbol.iterator]` | `javascript.builtins.Array.entries` |
| `async-generator` | Async Generators (`_asyncGeneratorDelegate`, `_awaitAsyncGenerator`) | `javascript.functions.method_definitions.async_generator_methods` |
| `async-iteration` | Async Iteration / `_asyncToGenerator` | `javascript.statements.for_await_of` |
| `class-fields` | Class Fields (`_defineProperty`, private fields) | `javascript.classes.public_class_fields` |
| `class-static-initialization-blocks` | Class Static Initialization Blocks | `javascript.classes.static_initialization_blocks` |
| `error-cause` | `Error` `cause` option | `javascript.builtins.Error.Error.options_cause_parameter` |
| `float16array` | `Float16Array` | `javascript.builtins.Float16Array` |
| `global-this` | `globalThis` | `javascript.builtins.globalThis` |
| `iterator-helpers` | Iterator Helpers (`Iterator.prototype.map`, etc.) | `javascript.builtins.Iterator.map` |
| `nullish-coalescing` | Nullish Coalescing (`??`) helper | `javascript.operators.nullish_coalescing` |
| `object-assign` | `Object.assign` / `_extends` | `javascript.builtins.Object.assign` |
| `object-entries` | `Object.entries` | `javascript.builtins.Object.entries` |
| `object-from-entries` | `Object.fromEntries` | `javascript.builtins.Object.fromEntries` |
| `object-group-by` | `Object.groupBy` / `Map.groupBy` | `javascript.builtins.Object.groupBy` |
| `object-has-own` | `Object.hasOwn` | `javascript.builtins.Object.hasOwn` |
| `object-rest-spread` | Object Rest/Spread (`_objectSpread`, `_objectWithoutProperties`) | `javascript.operators.spread.spread_in_object_literals` |
| `object-values` | `Object.values` | `javascript.builtins.Object.values` |
| `optional-chaining` | Optional Chaining (`?.`) helper | `javascript.operators.optional_chaining` |
| `promise` | `Promise` | `javascript.builtins.Promise` |
| `promise-all-settled` | `Promise.allSettled` | `javascript.builtins.Promise.allSettled` |
| `promise-any` | `Promise.any` | `javascript.builtins.Promise.any` |
| `promise-finally` | `Promise.prototype.finally` | `javascript.builtins.Promise.finally` |
| `promise-try` | `Promise.try` | `javascript.builtins.Promise.try` |
| `promise-with-resolvers` | `Promise.withResolvers` | `javascript.builtins.Promise.withResolvers` |
| `set-methods` | `Set` methods (`union`, `intersection`, `difference`, etc.) | `javascript.builtins.Set.union` |
| `string-match-all` | `String.prototype.matchAll` | `javascript.builtins.String.matchAll` |
| `string-padding` | `String.prototype.padStart` / `padEnd` | `javascript.builtins.String.padStart` |
| `string-replace-all` | `String.prototype.replaceAll` | `javascript.builtins.String.replaceAll` |
| `string-trimming` | `String.prototype.trimStart` / `trimEnd` | `javascript.builtins.String.trimStart` |
| `structured-clone` | `structuredClone` | `api.structuredClone` |
| `symbol-description` | `Symbol.prototype.description` | `javascript.builtins.Symbol.description` |
