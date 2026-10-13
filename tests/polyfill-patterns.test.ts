import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';
import { parse, Lang } from '@ast-grep/napi';
import {
  getPackageRoot,
  getRulesDir,
  getDefaultCatalogPath,
  resolveRuleYamlPath,
  loadCatalog,
  getAllRules,
  getRuleById,
  getRuleByWebFeatureId,
  getRuleByBcdId,
  getRulesByBaselineStatus,
  getRuleYaml,
  getAstGrepRule,
  getAllAstGrepRules,
  parseYamlRule,
  resolveDynamicBaseline,
  getEstimatedPolyfillBytes,
  ESTIMATED_POLYFILL_WEIGHT_BYTES,
  FEATURE_CALL_PATTERNS,
  clearCatalogCache,
  registerCacheClearCallback,
  unregisterCacheClearCallback,
} from '../src/index.js';

describe('polyfill-patterns: Direct YAML & Filesystem Consumption', () => {
  it('resolves package root, rules directory, and rules.json path', () => {
    const root = getPackageRoot();
    const rulesDir = getRulesDir();
    const catalogPath = getDefaultCatalogPath();

    expect(fs.existsSync(root)).toBe(true);
    expect(fs.existsSync(rulesDir)).toBe(true);
    expect(fs.existsSync(catalogPath)).toBe(true);
    expect(path.basename(rulesDir)).toBe('rules');
    expect(path.basename(catalogPath)).toBe('rules.json');
  });

  it('includes a valid sgconfig.yml for standalone ast-grep CLI usage', () => {
    const sgConfigPath = path.join(getPackageRoot(), 'sgconfig.yml');
    expect(fs.existsSync(sgConfigPath)).toBe(true);

    const sgConfig = YAML.parse(fs.readFileSync(sgConfigPath, 'utf-8')) as {
      ruleDirs?: string[];
    };
    expect(sgConfig.ruleDirs).toContain('./rules');
  });

  it('exposes every rule as a valid standalone YAML file in rules/', () => {
    const rulesDir = getRulesDir();
    const yamlFiles = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.yaml'));
    expect(yamlFiles.length).toBe(35);

    for (const file of yamlFiles) {
      const fullPath = path.join(rulesDir, file);
      const rawContent = fs.readFileSync(fullPath, 'utf-8');
      const parsed = YAML.parse(rawContent) as Record<string, unknown>;

      expect(parsed).toBeDefined();
      expect(typeof parsed.id).toBe('string');
      expect(String(parsed.language).toLowerCase()).toBe('javascript');
      expect(parsed.rule).toBeDefined();
      expect(typeof parsed.rule).toBe('object');
    }
  });

  it('resolves rule YAML paths from ID, rules/<id>.yaml, and legacy src/catalog/rules/<id>.yaml', () => {
    const byIdPath = resolveRuleYamlPath('array-at');
    const directPath = resolveRuleYamlPath('rules/array-at.yaml');
    const legacyPath = resolveRuleYamlPath('src/catalog/rules/array-at.yaml');

    expect(fs.existsSync(byIdPath)).toBe(true);
    expect(byIdPath).toBe(directPath);
    expect(directPath).toBe(legacyPath);
  });
});

describe('polyfill-patterns: JS/TS Catalog & Rule API', () => {
  beforeEach(() => {
    clearCatalogCache();
  });

  it('loads all 35 rules and hydrates Baseline status from web-features', () => {
    const rules = getAllRules();
    expect(rules.length).toBe(35);

    const arrayAt = getRuleById('array-at');
    expect(arrayAt).toBeDefined();
    expect(arrayAt?.name).toContain('Array.prototype.at');
    expect(arrayAt?.webFeatureId).toBe('array-at');
    expect(arrayAt?.baselineStatus).toBe('high');
    expect(arrayAt?.baselineYear).toBe(2022);
    expect(arrayAt?.baselineLowDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(arrayAt?.estimatedSizeBytes).toBe(1600);
  });

  it('looks up rules by webFeatureId, bcdId, and baselineStatus', () => {
    const byWebFeature = getRuleByWebFeatureId('promise-all-settled');
    expect(byWebFeature?.id).toBe('promise-all-settled');

    const byBcd = getRuleByBcdId('javascript.builtins.Array.at');
    expect(byBcd?.id).toBe('array-at');

    const widelyAvailable = getRulesByBaselineStatus('high');
    expect(widelyAvailable.length).toBeGreaterThan(25);
  });

  it('returns raw YAML and parsed AST-grep rules via JS API', () => {
    const rawYaml = getRuleYaml('array-at');
    expect(rawYaml).toBeDefined();
    expect(rawYaml).toContain('id: array-at');

    const astRule = getAstGrepRule('array-at');
    expect(astRule).toBeDefined();
    expect(astRule?.id).toBe('array-at');
    expect(astRule?.language).toBe('javascript');
    expect(astRule?.rule).toBeDefined();

    const allAstRules = getAllAstGrepRules();
    expect(allAstRules.length).toBe(35);
    expect(allAstRules[0].entry).toBeDefined();
    expect(allAstRules[0].query.rule).toBeDefined();
  });

  it('validates custom YAML rules with parseYamlRule', () => {
    const parsed = parseYamlRule(`
id: custom-rule
language: javascript
rule:
  pattern: Array.prototype.at = $FN
`);
    expect(parsed.rule).toEqual({ pattern: 'Array.prototype.at = $FN' });

    expect(() => parseYamlRule('')).toThrow(/Invalid YAML syntax/);
  });

  it('exposes size estimates and native feature call patterns', () => {
    expect(getEstimatedPolyfillBytes('promise')).toBe(ESTIMATED_POLYFILL_WEIGHT_BYTES['promise']);
    expect(getEstimatedPolyfillBytes('unknown-id')).toBe(1800);
    expect(FEATURE_CALL_PATTERNS['object-has-own'].method).toBe('hasOwn');
    expect(FEATURE_CALL_PATTERNS['object-has-own'].syntaxRegex?.test('Object.hasOwn(a, b)')).toBe(
      true
    );
  });

  it('notifies registered callbacks when clearCatalogCache is called', () => {
    let clearedCount = 0;
    const cb = () => {
      clearedCount++;
    };
    registerCacheClearCallback(cb);
    loadCatalog();
    clearCatalogCache();
    expect(clearedCount).toBe(1);

    unregisterCacheClearCallback(cb);
    clearCatalogCache();
    expect(clearedCount).toBe(1);
  });

  it('resolves dynamic Baseline status from web-features for a RuleEntry', () => {
    const arrayAt = getRuleById('array-at')!;
    const resolved = resolveDynamicBaseline(arrayAt);
    expect(resolved.baselineStatus).toBe('high');
    expect(resolved.baselineYear).toBe(2022);
    expect(resolved.baselineLowDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const optionalChaining = getRuleById('optional-chaining')!;
    expect(optionalChaining.webFeatureId).toBe('optional-chaining');
    expect(optionalChaining.webFeaturesId).toBe('optional-chaining');
    expect(optionalChaining.baselineYear).toBe(2020);
  });
});

describe('polyfill-patterns: AST-Grep Rule Execution (@ast-grep/napi)', () => {
  function matchesRule(ruleId: string, code: string): boolean {
    const parsed = getAstGrepRule(ruleId);
    if (!parsed) throw new Error(`Rule not found: ${ruleId}`);
    const sgRoot = parse(Lang.JavaScript, code);
    const matches = sgRoot.root().findAll({
      rule: parsed.rule,
    });
    return matches.length > 0;
  }

  it('detects Array.prototype.at polyfill shims and core-js imports, but ignores native .at() calls', () => {
    expect(
      matchesRule(
        'array-at',
        `if (!Array.prototype.at) { Array.prototype.at = function(n) { return this[n]; }; }`
      )
    ).toBe(true);

    expect(matchesRule('array-at', `require("core-js/modules/es.array.at.js");`)).toBe(true);

    expect(matchesRule('array-at', `const last = items.at(-1);`)).toBe(false);
  });

  it('detects Object.hasOwn polyfill shims and core-js imports, but ignores native Object.hasOwn() calls', () => {
    expect(
      matchesRule(
        'object-has-own',
        `Object.hasOwn = function(obj, prop) { return Object.prototype.hasOwnProperty.call(obj, prop); };`
      )
    ).toBe(true);

    expect(matchesRule('object-has-own', `import "core-js/modules/es.object.has-own.js";`)).toBe(
      true
    );

    expect(matchesRule('object-has-own', `if (Object.hasOwn(user, 'id')) {}`)).toBe(false);
  });

  it('detects String.prototype.replaceAll polyfills, but ignores native .replaceAll() calls', () => {
    expect(
      matchesRule(
        'string-replace-all',
        `String.prototype.replaceAll = function(search, replacement) { return this.split(search).join(replacement); };`
      )
    ).toBe(true);

    expect(matchesRule('string-replace-all', `const slug = title.replaceAll(' ', '-');`)).toBe(
      false
    );
  });

  it('detects Babel/SWC nullish coalescing and optional chaining helper patterns', () => {
    expect(
      matchesRule(
        'nullish-coalescing',
        `function _nullishCoalescing(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }`
      )
    ).toBe(true);

    expect(matchesRule('nullish-coalescing', `const val = a ?? "default";`)).toBe(false);

    expect(
      matchesRule(
        'optional-chaining',
        `function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; return value; }`
      )
    ).toBe(true);

    expect(matchesRule('optional-chaining', `const name = user?.name;`)).toBe(false);
  });

  it('detects real class-fields helpers, but ignores generic Map .get() utilities and _defineProperty', () => {
    expect(
      matchesRule(
        'class-fields',
        `function _classPrivateFieldGet(receiver, privateMap) { return privateMap.get(receiver); }`
      )
    ).toBe(true);

    expect(
      matchesRule(
        'class-fields',
        `function _classExtractFieldDescriptor(e, t, n) { if (!t.has(e)) throw new TypeError("attempted to " + n + " private field on non-instance"); return t.get(e); }`
      )
    ).toBe(true);

    expect(matchesRule('class-fields', `function yg(e, t) { return e.get(gg(e, t)); }`)).toBe(
      false
    );

    expect(
      matchesRule(
        'class-fields',
        `function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }`
      )
    ).toBe(false);
  });

  it('detects Object.assign polyfills, but ignores tslib.__assign and Babel _extends inline syntax helpers', () => {
    expect(matchesRule('object-assign', `Object.assign = function(target) { return target; };`)).toBe(
      true
    );

    expect(
      matchesRule('object-assign', `_export({ target: "Object", stat: true }, { assign: assignImpl });`)
    ).toBe(true);

    expect(
      matchesRule(
        'object-assign',
        `var __assign = Object.assign || function(t) { for (var s, i = 1, n = arguments.length; i < n; i++) { s = arguments[i]; } return t; };`
      )
    ).toBe(false);

    expect(matchesRule('object-assign', `require("@babel/runtime/helpers/extends");`)).toBe(false);
  });

  it('detects async-iteration downlevel helpers, but ignores native Symbol.asyncIterator calls', () => {
    expect(
      matchesRule(
        'async-iteration',
        `function _asyncIterator(iterable) { var method = iterable[Symbol.asyncIterator]; return method.call(iterable); }`
      )
    ).toBe(true);

    expect(
      matchesRule(
        'async-iteration',
        `function __asyncValues(o) { if (!Symbol.asyncIterator) throw new TypeError(); return o[Symbol.asyncIterator](); }`
      )
    ).toBe(true);

    expect(matchesRule('async-iteration', `const iter = stream[Symbol.asyncIterator]();`)).toBe(
      false
    );
  });

  it('requires proto or stat in core-js $EXPORT patterns to avoid false positives on app functions', () => {
    expect(
      matchesRule('array-iterator', `_export({ target: "Array", proto: true }, { values: valuesImpl });`)
    ).toBe(true);

    expect(
      matchesRule('array-iterator', `trackEvent({ target: "Array", action: "click" }, { values: 1 });`)
    ).toBe(false);
  });
});
