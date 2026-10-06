import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { features as webFeaturesData } from 'web-features';
import YAML from 'yaml';
import { z } from 'zod';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Resolves the root directory of the `polyfill-patterns` package regardless of whether
 * code is running from `src/index.ts` (via tsx/vitest) or `dist/index.js` (compiled).
 */
export function getPackageRoot() {
    const parentDir = path.resolve(__dirname, '..');
    if (fs.existsSync(path.join(parentDir, 'rules.json'))) {
        return parentDir;
    }
    return path.resolve(__dirname, '../..');
}
/**
 * Returns the absolute directory path containing all `.yaml` AST-grep rule files.
 */
export function getRulesDir() {
    return path.join(getPackageRoot(), 'rules');
}
/**
 * Returns the absolute path to the built-in `rules.json` catalog manifest.
 */
export function getDefaultCatalogPath() {
    return path.join(getPackageRoot(), 'rules.json');
}
export const RuleEntrySchema = z
    .object({
    id: z.string(),
    name: z.string(),
    astGrepRulePath: z.string(),
    webFeatureId: z.string().regex(/^[a-z0-9-]+$/),
    bcdId: z.string().regex(/^[a-zA-Z0-9._-]+$/),
    baselineStatus: z.enum(['low', 'high', 'false']),
    baselineYear: z.number().int().nullable(),
    baselineLowDate: z.string().nullable().optional(),
    baselineHighDate: z.string().nullable().optional(),
    estimatedSizeBytes: z.number().int().positive().optional(),
    modernSuggestion: z.string(),
    bundlers: z.array(z.enum(['webpack', 'rollup', 'esbuild', 'swc'])).nonempty(),
    esSamplesId: z.string().optional(),
    webFeaturesId: z.string().optional(),
})
    .strict();
/**
 * Typical minified footprint in bytes (including implementation + direct core-js/Babel
 * helper dependencies) for each polyfill or syntax transform rule in the catalog.
 */
export const ESTIMATED_POLYFILL_WEIGHT_BYTES = {
    promise: 18500,
    'iterator-helpers': 9200,
    float16array: 8600,
    'set-methods': 6800,
    'async-generator': 6400,
    'async-iteration': 5200,
    'array-iterator': 4800,
    'array-change-by-copy': 4200,
    'promise-any': 3800,
    'string-match-all': 3600,
    'array-flat': 3400,
    'class-fields': 3200,
    'promise-all-settled': 2900,
    'string-replace-all': 2800,
    'string-padding': 2600,
    'array-includes': 2500,
    'string-trimming': 2400,
    'object-rest-spread': 2400,
    'array-filter': 2300,
    'promise-finally': 2200,
    'object-assign': 2100,
    'symbol-description': 2100,
    'object-entries': 1900,
    'object-values': 1900,
    'array-find-last': 1800,
    'object-from-entries': 1700,
    'array-at': 1600,
    'object-group-by': 1600,
    'promise-try': 1500,
    'promise-with-resolvers': 1400,
    'object-has-own': 1200,
    'global-this': 900,
    'class-static-initialization-blocks': 800,
    'optional-chaining': 700,
    'nullish-coalescing': 600,
};
/**
 * Call-site method and syntax patterns associated with each polyfill rule ID,
 * useful for 1:1 source-map correlation and native call-site inspection.
 */
export const FEATURE_CALL_PATTERNS = {
    'array-at': { method: 'at', syntaxRegex: /\.at\s*\(/ },
    'array-includes': { method: 'includes', syntaxRegex: /\.includes\s*\(/ },
    'array-filter': { method: 'filter', syntaxRegex: /\.filter\s*\(/ },
    'array-find-last': { method: 'findLast', syntaxRegex: /\.findLast\s*\(/ },
    'array-flat': { method: 'flat', syntaxRegex: /\.flat(?:Map)?\s*\(/ },
    'object-has-own': { method: 'hasOwn', syntaxRegex: /Object\.hasOwn\s*\(/ },
    'object-assign': { method: 'assign', syntaxRegex: /Object\.assign\s*\(/ },
    'object-entries': { method: 'entries', syntaxRegex: /Object\.entries\s*\(/ },
    'object-values': { method: 'values', syntaxRegex: /Object\.values\s*\(/ },
    'object-from-entries': { method: 'fromEntries', syntaxRegex: /Object\.fromEntries\s*\(/ },
    'promise-all-settled': { method: 'allSettled', syntaxRegex: /Promise\.allSettled\s*\(/ },
    'promise-any': { method: 'any', syntaxRegex: /Promise\.any\s*\(/ },
    'string-replace-all': { method: 'replaceAll', syntaxRegex: /\.replaceAll\s*\(/ },
    'class-fields': { syntaxRegex: /#\w+|^\s*(?:static\s+)?\w+\s*=\s*[^;]+;/ },
    'async-iteration': { syntaxRegex: /for\s+await\s*\(|async\s+function/ },
    'async-generator': { syntaxRegex: /async\s*\*\s*\w+|async\s+function\s*\*/ },
    'nullish-coalescing': { syntaxRegex: /\?\?/ },
    'optional-chaining': { syntaxRegex: /\?\./ },
};
export function getEstimatedPolyfillBytes(ruleId, snippetLength) {
    const catalogEstimate = ESTIMATED_POLYFILL_WEIGHT_BYTES[ruleId] ?? 1800;
    return snippetLength ? Math.max(catalogEstimate, snippetLength) : catalogEstimate;
}
const catalogCache = new Map();
export const ruleQueryCache = new Map();
/**
 * Dynamically resolves a rule's Baseline status ('high' = Baseline Widely available,
 * 'low' = Baseline Newly available, 'false' = Limited availability) and Baseline Year
 * directly from the installed `web-features` package (including per-BCD-key status
 * overrides in `status.by_compat_key[rule.bcdId]` and 30-month Widely available progression).
 */
export function resolveDynamicBaseline(rule) {
    const wfMap = webFeaturesData;
    const wfId = rule.webFeaturesId || rule.webFeatureId;
    const feat = wfMap[wfId] || wfMap[rule.webFeatureId];
    const fallbackLowDate = rule.baselineLowDate ?? (rule.baselineYear !== null ? `${rule.baselineYear}-12-31` : null);
    const fallbackHighDate = rule.baselineHighDate ?? null;
    if (!feat || !feat.status) {
        return {
            baselineStatus: rule.baselineStatus,
            baselineYear: rule.baselineYear,
            baselineLowDate: fallbackLowDate,
            baselineHighDate: fallbackHighDate,
        };
    }
    const byKey = feat.status.by_compat_key?.[rule.bcdId];
    const statusObj = byKey || feat.status;
    if (!statusObj || statusObj.baseline === undefined) {
        return {
            baselineStatus: rule.baselineStatus,
            baselineYear: rule.baselineYear,
            baselineLowDate: fallbackLowDate,
            baselineHighDate: fallbackHighDate,
        };
    }
    const rawLowDate = statusObj.baseline_low_date;
    const rawHighDate = statusObj.baseline_high_date;
    const cleanLowDate = typeof rawLowDate === 'string' ? rawLowDate.replace(/^≤/, '') : null;
    const cleanHighDate = typeof rawHighDate === 'string' ? rawHighDate.replace(/^≤/, '') : null;
    let baselineYear = rule.baselineYear;
    if (cleanLowDate) {
        const parsedYear = parseInt(cleanLowDate.slice(0, 4), 10);
        if (!Number.isNaN(parsedYear)) {
            baselineYear = parsedYear;
        }
    }
    let baselineStatus = statusObj.baseline === 'high'
        ? 'high'
        : statusObj.baseline === 'low'
            ? 'low'
            : 'false';
    if (baselineStatus === 'low' && cleanLowDate) {
        const lowTime = Date.parse(cleanLowDate);
        if (!Number.isNaN(lowTime)) {
            const highTime = cleanHighDate
                ? Date.parse(cleanHighDate)
                : new Date(lowTime).setMonth(new Date(lowTime).getMonth() + 30);
            if (!Number.isNaN(highTime) && Date.now() >= highTime) {
                baselineStatus = 'high';
            }
        }
    }
    if (baselineStatus === 'false') {
        baselineYear = null;
    }
    return {
        baselineStatus,
        baselineYear,
        baselineLowDate: baselineStatus === 'false' ? null : (cleanLowDate ?? fallbackLowDate),
        baselineHighDate: baselineStatus === 'false' ? null : cleanHighDate,
    };
}
const cacheClearCallbacks = new Set();
export function registerCacheClearCallback(callback) {
    cacheClearCallbacks.add(callback);
}
export function unregisterCacheClearCallback(callback) {
    return cacheClearCallbacks.delete(callback);
}
export function clearCatalogCache() {
    catalogCache.clear();
    ruleQueryCache.clear();
    for (const callback of Array.from(cacheClearCallbacks)) {
        try {
            callback();
        }
        catch (err) {
            console.error('Error in cache clear callback:', err);
        }
    }
}
/**
 * Resolves the filesystem path to the catalog JSON file.
 * If `catalogPath` is omitted, uses the built-in `polyfill-patterns/rules.json`.
 * If `catalogPath` is `'src/catalog/rules.json'` and does not exist in `process.cwd()`,
 * falls back to the built-in `polyfill-patterns/rules.json`.
 */
function resolveCatalogFilePath(catalogPath) {
    if (!catalogPath) {
        return getDefaultCatalogPath();
    }
    const cwdCandidate = path.resolve(process.cwd(), catalogPath);
    if (fs.existsSync(cwdCandidate)) {
        return cwdCandidate;
    }
    if (catalogPath.endsWith('src/catalog/rules.json') || catalogPath === 'rules.json') {
        return getDefaultCatalogPath();
    }
    return cwdCandidate;
}
/**
 * Resolves the absolute path to a YAML rule file given either a `RuleEntry`,
 * a rule `id` (e.g. `'array-at'`), or a relative path (e.g. `'rules/array-at.yaml'`
 * or `'src/catalog/rules/array-at.yaml'`).
 */
export function resolveRuleYamlPath(ruleOrIdOrPath) {
    const rawPath = typeof ruleOrIdOrPath === 'string'
        ? ruleOrIdOrPath.endsWith('.yaml') || ruleOrIdOrPath.endsWith('.yml')
            ? ruleOrIdOrPath
            : `rules/${ruleOrIdOrPath}.yaml`
        : ruleOrIdOrPath.astGrepRulePath;
    const cwdCandidate = path.resolve(process.cwd(), rawPath);
    if (fs.existsSync(cwdCandidate)) {
        return cwdCandidate;
    }
    const pkgCandidate = path.resolve(getPackageRoot(), rawPath);
    if (fs.existsSync(pkgCandidate)) {
        return pkgCandidate;
    }
    const basenameCandidate = path.join(getRulesDir(), path.basename(rawPath));
    if (fs.existsSync(basenameCandidate)) {
        return basenameCandidate;
    }
    return cwdCandidate;
}
/**
 * Parses an AST-grep YAML rule string into an `@ast-grep/napi`-compatible `{ rule }` query object.
 */
export function parseYamlRule(content) {
    const doc = YAML.parse(content);
    if (!doc) {
        throw new Error('Invalid YAML syntax or empty pattern list in rule definition');
    }
    const rule = doc.rule !== undefined ? doc.rule : doc;
    return { rule };
}
/**
 * Loads and validates the polyfill pattern catalog, hydrating live Baseline statuses
 * from `web-features` and byte weight estimates.
 */
export function loadCatalog(catalogPath) {
    const resolved = resolveCatalogFilePath(catalogPath);
    const cached = catalogCache.get(resolved);
    if (cached) {
        return cached;
    }
    const raw = fs.readFileSync(resolved, 'utf8');
    const parsed = JSON.parse(raw);
    const validated = z.object({ rules: z.array(RuleEntrySchema) }).parse(parsed);
    for (const rule of validated.rules) {
        const dynamic = resolveDynamicBaseline(rule);
        rule.baselineStatus = dynamic.baselineStatus;
        rule.baselineYear = dynamic.baselineYear;
        rule.baselineLowDate = dynamic.baselineLowDate;
        rule.baselineHighDate = dynamic.baselineHighDate;
        rule.estimatedSizeBytes = rule.estimatedSizeBytes ?? getEstimatedPolyfillBytes(rule.id);
    }
    catalogCache.set(resolved, validated);
    return validated;
}
export function getRuleById(id, catalogPath) {
    return loadCatalog(catalogPath).rules.find((r) => r.id === id);
}
export function getRuleByWebFeatureId(webFeatureId, catalogPath) {
    return loadCatalog(catalogPath).rules.find((r) => r.webFeatureId === webFeatureId || r.webFeaturesId === webFeatureId);
}
export function getRuleByBcdId(bcdId, catalogPath) {
    return loadCatalog(catalogPath).rules.find((r) => r.bcdId === bcdId);
}
export function getAllRules(catalogPath) {
    return loadCatalog(catalogPath).rules;
}
export function getRulesByBaselineStatus(status, catalogPath) {
    return loadCatalog(catalogPath).rules.filter((r) => r.baselineStatus === status);
}
/**
 * Returns the raw YAML string for a rule by its rule ID (e.g. `'array-at'`).
 */
export function getRuleYaml(id, catalogPath) {
    const rule = getRuleById(id, catalogPath);
    const yamlPath = resolveRuleYamlPath(rule ?? id);
    if (!fs.existsSync(yamlPath)) {
        return undefined;
    }
    return fs.readFileSync(yamlPath, 'utf8');
}
/**
 * Returns the parsed AST-grep YAML document (`{ id, message, severity, language, rule }`)
 * for a rule ID, ready for inspection or execution in `@ast-grep/napi`.
 */
export function getAstGrepRule(id, catalogPath) {
    const yamlContent = getRuleYaml(id, catalogPath);
    if (!yamlContent) {
        return undefined;
    }
    const doc = YAML.parse(yamlContent);
    if (!doc) {
        return undefined;
    }
    return doc;
}
/**
 * Returns all catalog entries paired with their pre-parsed `@ast-grep/napi` `{ rule }` query object.
 */
export function getAllAstGrepRules(catalogPath) {
    const catalog = loadCatalog(catalogPath);
    const results = [];
    for (const entry of catalog.rules) {
        const yamlPath = resolveRuleYamlPath(entry);
        if (!fs.existsSync(yamlPath)) {
            continue;
        }
        let query = ruleQueryCache.get(yamlPath);
        if (!query) {
            const yamlContent = fs.readFileSync(yamlPath, 'utf8');
            query = parseYamlRule(yamlContent);
            ruleQueryCache.set(yamlPath, query);
        }
        results.push({ entry, yamlPath, query });
    }
    return results;
}
export const catalog = [];
//# sourceMappingURL=index.js.map