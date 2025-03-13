// contract-abi.mjs
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadAbi(contractName) {
  const file = join(__dirname, `../build/contracts/${contractName}.json`);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  return json.abi;
}
