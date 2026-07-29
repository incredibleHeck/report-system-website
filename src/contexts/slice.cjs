const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../../backup_utf8.tsx');
const lines = fs.readFileSync(dbPath, 'utf8').split('\n');

const applyLegacyMigrationStr = lines.slice(228, 337).join('\n').replace('function applyLegacyMigration', 'export function applyLegacyMigration');
const demoSubjectLinesStr = lines.slice(360, 368).join('\n').replace('function demoSubjectLines', 'export function demoSubjectLines');
const buildDemoSnapshotStr = lines.slice(369, 899).join('\n').replace('function buildDemoSnapshot', 'export function buildDemoSnapshot');

const top = fs.readFileSync(path.resolve(__dirname, "utils-top.ts"), "utf8");

fs.writeFileSync(path.resolve(__dirname, "utils.ts"), top + "\n" + applyLegacyMigrationStr + "\n" + demoSubjectLinesStr + "\n" + buildDemoSnapshotStr + "\n");

console.log("utils.ts created perfectly from exact line indices!");
