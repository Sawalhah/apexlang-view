const fs = require('fs');
const path = require('path');
const { parseApxToGraph } = require('./parser');

const fixturesDir = path.join(__dirname, '..', 'fixtures');
const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.apx'));

for (const file of files) {
  const text = fs.readFileSync(path.join(fixturesDir, file), 'utf8');
  const { nodes, edges } = parseApxToGraph(text);
  console.log(`\n=== ${file} ===`);
  console.log(`nodes: ${nodes.length}, edges: ${edges.length}`);
  for (const n of nodes) {
    console.log(`  [${n.id}] ${n.typeName} "${n.label}"${n.identifier ? ` (id=${n.identifier})` : ''}`);
  }
}
