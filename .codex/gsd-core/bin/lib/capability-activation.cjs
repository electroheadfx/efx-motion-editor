"use strict";
/**
 * Capability activation helpers.
 *
 * Shared by the Capability State Resolver and Loop Resolver so config-key
 * activation uses one precedence chain and one prototype-pollution guard.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const planningWorkspaceMod = require("./planning-workspace.cjs");
const { planningDir, planningRoot } = planningWorkspaceMod;
function _getNestedConfigValue(config, dotKey) {
    const segments = dotKey.split('.');
    let current = config;
    for (const seg of segments) {
        if (seg === '__proto__' || seg === 'constructor' || seg === 'prototype') {
            return { found: false, value: undefined };
        }
        if (typeof current !== 'object' || current === null) {
            return { found: false, value: undefined };
        }
        const cur = current;
        if (!Object.prototype.hasOwnProperty.call(cur, seg)) {
            return { found: false, value: undefined };
        }
        current = cur[seg];
    }
    return { found: true, value: current };
}
const _warnedRawConfigPaths = new Set();
function _readRawConfigKey(filePath, dotKey) {
    try {
        const raw = node_fs_1.default.readFileSync(filePath, 'utf8');
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            if (!_warnedRawConfigPaths.has(filePath)) {
                _warnedRawConfigPaths.add(filePath);
                try {
                    process.stderr.write(`gsd-tools: warning: failed to parse ${filePath} as JSON — skipping for activation resolution\n`);
                }
                catch { /* stderr might be closed */ }
            }
            return { found: false, value: undefined };
        }
        return _getNestedConfigValue(parsed, dotKey);
    }
    catch {
        return { found: false, value: undefined };
    }
}
function _resolveActivationValue(dotKey, config, cwd, registry) {
    const fromConfig = _getNestedConfigValue(config, dotKey);
    if (fromConfig.found)
        return Boolean(fromConfig.value);
    if (cwd) {
        const wsConfigPath = node_path_1.default.join(planningDir(cwd), 'config.json');
        const rootConfigPath = node_path_1.default.join(planningRoot(cwd), 'config.json');
        const fromWs = _readRawConfigKey(wsConfigPath, dotKey);
        if (fromWs.found)
            return Boolean(fromWs.value);
        if (wsConfigPath !== rootConfigPath) {
            const fromRoot = _readRawConfigKey(rootConfigPath, dotKey);
            if (fromRoot.found)
                return Boolean(fromRoot.value);
        }
    }
    const schemaEntry = registry['configSchema']?.[dotKey];
    if (schemaEntry && typeof schemaEntry === 'object' && schemaEntry !== null) {
        const def = schemaEntry['default'];
        if (def !== undefined)
            return Boolean(def);
    }
    return false;
}
module.exports = {
    _getNestedConfigValue,
    _readRawConfigKey,
    _resolveActivationValue,
};
