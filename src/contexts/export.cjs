const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const content = cp.execSync("git show HEAD:src/context/DatabaseContext.tsx", {encoding: "utf8"});

function extractFunction(name) {
  const searchStr = "function " + name;
  const index = content.indexOf(searchStr);
  if (index === -1) throw new Error("Function " + name + " not found");
  
  let braceCount = 0;
  let started = false;
  let endIndex = index;
  
  for (let i = index; i < content.length; i++) {
    if (content[i] === "{") {
      braceCount++;
      started = true;
    } else if (content[i] === "}") {
      braceCount--;
    }
    
    if (started && braceCount === 0) {
      endIndex = i + 1;
      break;
    }
  }
  
  return content.slice(index, endIndex).replace("function " + name, "export function " + name);
}

const applyLegacyMigrationStr = extractFunction("applyLegacyMigration");
const demoSubjectLinesStr = extractFunction("demoSubjectLines");
const buildDemoSnapshotStr = extractFunction("buildDemoSnapshot");

const top = fs.readFileSync(path.resolve(__dirname, "utils-top.ts"), "utf8");

fs.writeFileSync(path.resolve(__dirname, "utils.ts"), top + "\\n" + applyLegacyMigrationStr + "\\n" + demoSubjectLinesStr + "\\n" + buildDemoSnapshotStr + "\\n");

console.log("utils.ts created.");
