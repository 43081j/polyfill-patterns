import { z } from 'zod';
/**
 * Resolves the root directory of the `polyfill-patterns` package regardless of whether
 * code is running from `src/index.ts` (via tsx/vitest) or `dist/index.js` (compiled).
 */
export declare function getPackageRoot(): string;
/**
 * Returns the absolute directory path containing all `.yaml` AST-grep rule files.
 */
export declare function getRulesDir(): string;
/**
 * Returns the absolute path to the built-in `rules.json` catalog manifest.
 */
export declare function getDefaultCatalogPath(): string;
export declare const RuleEntrySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    astGrepRulePath: z.ZodString;
    webFeatureId: z.ZodString;
    bcdId: z.ZodString;
    baselineStatus: z.ZodEnum<["low", "high", "false"]>;
    baselineYear: z.ZodNullable<z.ZodNumber>;
    baselineLowDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    baselineHighDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    estimatedSizeBytes: z.ZodOptional<z.ZodNumber>;
    modernSuggestion: z.ZodString;
    bundlers: z.ZodArray<z.ZodEnum<["webpack", "rollup", "esbuild", "swc"]>, "atleastone">;
    esSamplesId: z.ZodOptional<z.ZodString>;
    webFeaturesId: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    id: string;
    name: string;
    astGrepRulePath: string;
    webFeatureId: string;
    bcdId: string;
    baselineStatus: "low" | "high" | "false";
    baselineYear: number | null;
    modernSuggestion: string;
    bundlers: ["webpack" | "rollup" | "esbuild" | "swc", ...("webpack" | "rollup" | "esbuild" | "swc")[]];
    baselineLowDate?: string | null | undefined;
    baselineHighDate?: string | null | undefined;
    estimatedSizeBytes?: number | undefined;
    esSamplesId?: string | undefined;
    webFeaturesId?: string | undefined;
}, {
    id: string;
    name: string;
    astGrepRulePath: string;
    webFeatureId: string;
    bcdId: string;
    baselineStatus: "low" | "high" | "false";
    baselineYear: number | null;
    modernSuggestion: string;
    bundlers: ["webpack" | "rollup" | "esbuild" | "swc", ...("webpack" | "rollup" | "esbuild" | "swc")[]];
    baselineLowDate?: string | null | undefined;
    baselineHighDate?: string | null | undefined;
    estimatedSizeBytes?: number | undefined;
    esSamplesId?: string | undefined;
    webFeaturesId?: string | undefined;
}>;
export type RuleEntry = z.infer<typeof RuleEntrySchema>;
export type FeatureRule = RuleEntry;
export type CatalogDatabase = {
    rules: RuleEntry[];
};
export interface AstGrepRuleDocument {
    id?: string;
    message?: string;
    severity?: string;
    language?: string;
    rule: Record<string, any>;
}
/**
 * Typical minified footprint in bytes (including implementation + direct core-js/Babel
 * helper dependencies) for each polyfill or syntax transform rule in the catalog.
 */
export declare const ESTIMATED_POLYFILL_WEIGHT_BYTES: Record<string, number>;
/**
 * Call-site method and syntax patterns associated with each polyfill rule ID,
 * useful for 1:1 source-map correlation and native call-site inspection.
 */
export declare const FEATURE_CALL_PATTERNS: Record<string, {
    method?: string;
    syntaxRegex?: RegExp;
}>;
export declare function getEstimatedPolyfillBytes(ruleId: string, snippetLength?: number): number;
export declare const ruleQueryCache: Map<string, {
    rule: any;
}>;
/**
 * Dynamically resolves a rule's Baseline status ('high' = Baseline Widely available,
 * 'low' = Baseline Newly available, 'false' = Limited availability) and Baseline Year
 * directly from the installed `web-features` package (including per-BCD-key status
 * overrides in `status.by_compat_key[rule.bcdId]` and 30-month Widely available progression).
 */
export declare function resolveDynamicBaseline(rule: RuleEntry): {
    baselineStatus: 'low' | 'high' | 'false';
    baselineYear: number | null;
    baselineLowDate: string | null;
    baselineHighDate: string | null;
};
type CacheClearCallback = () => void;
export declare function registerCacheClearCallback(callback: CacheClearCallback): void;
export declare function unregisterCacheClearCallback(callback: CacheClearCallback): boolean;
export declare function clearCatalogCache(): void;
/**
 * Resolves the absolute path to a YAML rule file given either a `RuleEntry`,
 * a rule `id` (e.g. `'array-at'`), or a relative path (e.g. `'rules/array-at.yaml'`
 * or `'src/catalog/rules/array-at.yaml'`).
 */
export declare function resolveRuleYamlPath(ruleOrIdOrPath: string | RuleEntry): string;
/**
 * Parses an AST-grep YAML rule string into an `@ast-grep/napi`-compatible `{ rule }` query object.
 */
export declare function parseYamlRule(content: string): {
    rule: any;
};
/**
 * Loads and validates the polyfill pattern catalog, hydrating live Baseline statuses
 * from `web-features` and byte weight estimates.
 */
export declare function loadCatalog(catalogPath?: string): CatalogDatabase;
export declare function getRuleById(id: string, catalogPath?: string): RuleEntry | undefined;
export declare function getRuleByWebFeatureId(webFeatureId: string, catalogPath?: string): RuleEntry | undefined;
export declare function getRuleByBcdId(bcdId: string, catalogPath?: string): RuleEntry | undefined;
export declare function getAllRules(catalogPath?: string): RuleEntry[];
export declare function getRulesByBaselineStatus(status: 'high' | 'low' | 'false', catalogPath?: string): RuleEntry[];
/**
 * Returns the raw YAML string for a rule by its rule ID (e.g. `'array-at'`).
 */
export declare function getRuleYaml(id: string, catalogPath?: string): string | undefined;
/**
 * Returns the parsed AST-grep YAML document (`{ id, message, severity, language, rule }`)
 * for a rule ID, ready for inspection or execution in `@ast-grep/napi`.
 */
export declare function getAstGrepRule(id: string, catalogPath?: string): AstGrepRuleDocument | undefined;
/**
 * Returns all catalog entries paired with their pre-parsed `@ast-grep/napi` `{ rule }` query object.
 */
export declare function getAllAstGrepRules(catalogPath?: string): Array<{
    entry: RuleEntry;
    yamlPath: string;
    query: {
        rule: any;
    };
}>;
export declare const catalog: RuleEntry[];
export {};
//# sourceMappingURL=index.d.ts.map