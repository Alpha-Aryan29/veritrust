'use strict';
// Compiles TrustRegistry.sol with solc-js, starts an in-memory Ethereum chain
// (Ganache), deploys the contract and seeds a demo trust network.
const fs = require('fs');
const path = require('path');
const solc = require('solc');
// Ganache prints a harmless native-module warning on some Node builds; keep the console clean.
const ganache = (() => {
  const write = process.stderr.write;
  process.stderr.write = () => true;
  try { return require('ganache'); } finally { process.stderr.write = write; }
})();
const { ethers } = require('ethers');

// Fixed mnemonic: demo addresses are identical on every run (synthetic keys only).
const DEMO_MNEMONIC = 'test test test test test test test test test test test junk';

function compile() {
  const file = path.join(__dirname, '..', 'contracts', 'TrustRegistry.sol');
  const input = {
    language: 'Solidity',
    sources: { 'TrustRegistry.sol': { content: fs.readFileSync(file, 'utf8') } },
    settings: {
      evmVersion: 'paris',
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors || []).filter((e) => e.severity === 'error');
  if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join('\n'));
  const c = out.contracts['TrustRegistry.sol'].TrustRegistry;
  return { abi: c.abi, bytecode: '0x' + c.evm.bytecode.object };
}

const idOf = (key) => ethers.encodeBytes32String(key);

async function startChain() {
  const { abi, bytecode } = compile();
  const raw = ganache.provider({
    wallet: { mnemonic: DEMO_MNEMONIC, totalAccounts: 10 },
    chain: { chainId: 1337, hardfork: 'shanghai' },
    logging: { quiet: true },
  });
  const provider = new ethers.BrowserProvider(raw, 1337);
  const wallet = (i) =>
    new ethers.NonceManager(
      new ethers.Wallet(ethers.HDNodeWallet.fromPhrase(DEMO_MNEMONIC, undefined, `m/44'/60'/0'/0/${i}`).privateKey, provider)
    );

  // Demo actors (all synthetic).
  const actors = {
    registrar:   { label: 'Trust registrar (consortium)', wallet: wallet(0) },
    sitAdmin:    { label: 'Sahyadri Institute of Technology: admin', wallet: wallet(1) },
    sitRegistry: { label: 'SIT Registrar Office (issuer)', wallet: wallet(2) },
    sitExam:     { label: 'SIT Exam Cell (issuer)', wallet: wallet(3) },
    ksuAdmin:    { label: 'Konkan State University: admin', wallet: wallet(4) },
    ksuRegistry: { label: 'KSU Registrar Office (issuer)', wallet: wallet(5) },
    rogue:       { label: 'Unregistered degree mill (attacker)', wallet: wallet(6) },
  };
  for (const a of Object.values(actors)) a.address = await a.wallet.getAddress();

  const factory = new ethers.ContractFactory(abi, bytecode, actors.registrar.wallet);
  const deployed = await factory.deploy();
  await deployed.waitForDeployment();
  const address = await deployed.getAddress();

  // Read-only handle: verifiers never need a key or a connection to an issuer.
  const reader = new ethers.Contract(address, abi, provider);
  const as = (actor) => new ethers.Contract(address, abi, actors[actor].wallet);

  // Seed the trust network.
  const institutions = {
    SIT: { name: 'Sahyadri Institute of Technology', admin: 'sitAdmin', issuers: ['sitRegistry', 'sitExam'] },
    KSU: { name: 'Konkan State University', admin: 'ksuAdmin', issuers: ['ksuRegistry'] },
  };
  for (const [key, inst] of Object.entries(institutions)) {
    await (await as('registrar').registerInstitution(idOf(key), inst.name, actors[inst.admin].address)).wait();
    for (const issuer of inst.issuers) {
      await (await as(inst.admin).addIssuer(idOf(key), actors[issuer].address)).wait();
    }
  }

  return { provider, abi, address, reader, as, actors, institutions, idOf, iface: new ethers.Interface(abi), raw };
}

module.exports = { startChain, compile, idOf, DEMO_MNEMONIC };
