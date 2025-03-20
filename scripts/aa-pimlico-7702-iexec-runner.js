require('dotenv').config();

console.log('Runner script: Starting iExec Account Abstraction with Alchemy');
console.log('Environment variables loaded');
console.log('ALCHEMY_API_KEY present:', !!process.env.ALCHEMY_API_KEY);
console.log('PRIVATE_KEY present:', !!process.env.PRIVATE_KEY);
console.log('POLICY_ID present:', !!process.env.POLICY_ID);
console.log('WORK_PK present:', !!process.env.WORK_PK);
console.log('RPC_URL present:', !!process.env.RPC_URL);

// Set a timeout to prevent hanging
const timeoutId = setTimeout(() => {
    console.error('Script execution timed out after 120 seconds!');
    process.exit(1);
}, 120000); // 2 minute timeout

// Import and run the ESM module
import('./aa-pimlico-7702-iexec.mjs')
    .then(() => {
        clearTimeout(timeoutId);
        console.log('Runner script: ESM execution completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        clearTimeout(timeoutId);
        console.error('Runner script: Error in ESM execution:', error);
        process.exit(1);
    });
