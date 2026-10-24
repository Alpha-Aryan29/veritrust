// CLI demo: node scripts/demo.js   (or: npm run demo)
const { startChain } = require('../src/chain');
const { runScenarios } = require('../src/scenarios');
(async () => {
  const ctx = await startChain();
  console.log(`\nTrustRegistry deployed at ${ctx.address}\n`);
  const { passed, total, results } = await runScenarios(ctx);
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.mandatory ? '[MVP]' : '     '} ${r.title}`);
    console.log(`        expected: ${r.expected}\n        actual:   ${r.actual}`);
  }
  console.log(`\n${passed}/${total} scenarios passed\n`);
  process.exit(passed === total ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
