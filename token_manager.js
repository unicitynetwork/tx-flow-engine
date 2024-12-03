#!/usr/bin/env node
"use strict";
const { Command } = require('commander');
const crypto = require('crypto');
const { mint, importFlow, exportFlow, createTx, collectTokens } = require('./state_machine.js');
const { JSONRPCTransport } = require('./aggregators_net/client/http_client.js');
const { SignerEC } = require('./aggregators_net/signer/SignerEC.js');
const { SHA256Hasher } = require('./aggregators_net/hasher/sha256hasher.js');
const { UnicityProvider } = require('./aggregators_net/provider/UnicityProvider.js');
const { State } = require('./state.js');
const { ChallengePubkey } = require('./pubkey_challenge.js');
const { calculateStateHash, calculatePointer, getStdin, splitStdin } = require('./helper.js');

require('dotenv').config();

const program = new Command();
const provider_url = process.env.GATEWAY;
const secret = process.env.SECRET;

function isValid256BitHex(value) {
  const hexRegex = /^[0-9a-fA-F]{64}$/; // 64 hex chars = 256 bits
  return hexRegex.test(value);
}

function to256BitHex(value) {
  if (isValid256BitHex(value)) {
    return value.toLowerCase();
  } else if (typeof value === 'string') {
    return crypto.createHash('sha256').update(value).digest('hex');
  } else {
    throw new Error(`Invalid input: ${value}`);
  }
}

// Wrapper to validate/convert parameters
function validateOrConvert(paramName, value) {
  try {
    return to256BitHex(value);
  } catch (error) {
    throw new Error(`${paramName} must be a valid 256-bit hex or convertible string. Error: ${error.message}`);
  }
}

function generateRandom256BitHex() {
  // Generate 32 random bytes (256 bits)
  const randomBytes = crypto.randomBytes(32);
  // Convert the bytes to a hex string
  return randomBytes.toString('hex');
}

program
  .name('token-cli')
  .description('CLI app for managing tokens')
  .version('1.0.0');

// Mint command
program
  .command('mint')
  .description('Mint a new token')
  .requiredOption('--token_id <token_id>', 'ID of the token')
  .requiredOption('--token_class <token_class_id>', 'Class of the token')
  .requiredOption('--token_value <token_value>', 'Value of the token (any string)')
//  .requiredOption('--pubkey <pubkey>', 'Public key for the token')
  .requiredOption('--nonce <nonce>', 'Nonce value')
  .action(async (options) => {
//    try {
      const token_id = validateOrConvert('token_id', options.token_id);
      const token_class = validateOrConvert('token_class', options.token_class);
//      const pubkey = validateOrConvert('pubkey', options.pubkey);
      const nonce = validateOrConvert('nonce', options.nonce);
//      if(!isValid256BitHex(options.pubkey))
//	throw new Error("pubkey must be hex string of 64 digits");

/*      console.log('Minting token with parameters:');
      console.log({
        token_id,
        token_class,
        token_value: options.token_value, // Leave this as is, no hex conversion
        pubkey: options.pubkey,
        nonce,
      });*/
//      const pubkey = await (new SignerEC(crypto.createHash('sha256').update(secret).digest('hex'))).getPubKey(); // must change
      const token = await mint({ token_id, token_class_id: token_class, 
	token_value: options.token_value, secret, nonce,  
	mint_salt: generateRandom256BitHex(), sign_alg: 'secp256k1', hash_alg: 'sha256',
	transport: new JSONRPCTransport(provider_url)});
      console.log(exportFlow(token, null, true));
/*    } catch (error) {
      console.error(error.message);
    }*/
  });

// Send command
program
  .command('send')
  .description('Send a token')
  .requiredOption('--dest <dest_pointer>', 'Destination pointer for the token')
  .action(async (options) => {
//    console.log('Sending token to:', options.dest);
    const token = await importFlow(await getStdin());
    const destPointer = options.dest;
    const salt = generateRandom256BitHex();

    const hasher = new SHA256Hasher();
    const transport = new JSONRPCTransport(provider_url);
    const tx = await createTx(token, destPointer, salt, secret, transport);
    console.log(exportFlow(token, tx, true));
  });

// Pointer command
program
  .command('pointer')
  .description('Generate or retrieve a pointer')
  .requiredOption('--token_class <token_class>', 'Class of the token')
  .requiredOption('--nonce <nonce>', 'Nonce value')
  .action(async (options) => {
//    try {
      const token_class_id = validateOrConvert('token_class', options.token_class);
      const nonce = validateOrConvert('nonce', options.nonce);
//      const pubkey = await (new SignerEC(crypto.createHash('sha256').update(secret).digest('hex'))).getPubKey();

      console.log(await calculatePointer({token_class_id, sign_alg: 'secp256k1', hash_alg: 'sha256', secret, nonce}));
//      console.log('Retrieving pointer with parameters:');
//      console.log({ token_class, nonce });
//    } catch (error) {
//      console.error(error.message);
//    }
  });

// Receive command
program
  .command('receive')
  .description('Receive a token')
  .requiredOption('--nonce <nonce>', 'Nonce value')
  .action(async (options) => {
//    try {
      const nonce = validateOrConvert('nonce', options.nonce);
      const flowJson = await getStdin();
      const flow = JSON.parse(flowJson);
//      const destination = new State(new ChallengePubkey(flow.token.tokenClass, flow.token.tokenId, 'secp256k1', 'sha256', pubkey, nonce));

      const token = await importFlow(flowJson, secret, nonce);

      console.log(exportFlow(token, null, true));
//      console.log('Receiving token with parameters:');
//      console.log({ token_class, nonce });
//    } catch (error) {
//      console.error(error.message);
//    }
  });

// Summarize all owned tokens
program
  .command('summary')
  .description('Summarize all owned tokens')
  .requiredOption('--token_class <token_class>', 'Class of the token')
  .action(async (options) => {
//    try {
      const tokenClass = validateOrConvert('token_class', options.token_class);
      const flowJsons = splitStdin(await getStdin());
//      const destination = new State(new ChallengePubkey(flow.token.tokenClass, flow.token.tokenId, 'secp256k1', 'sha256', pubkey, nonce));

      let tokens = {}
      let tokenUrls = {}

      for(const name in flowJsons){
	tokenUrls[name] = flowJsons[name].url;
	tokens[name] = await importFlow(flowJsons[name].json);
      }

//    console.log(JSON.stringify(tokens, null, 4));

      const collection = await collectTokens(tokens, tokenClass, BigInt(0), secret, new JSONRPCTransport(provider_url));

      console.log(collection);
      for(const name in tokenUrls)
	if(collection.tokens[name])
	    console.log(name+": "+tokenUrls[name]);
  });


// Parse the CLI arguments
program.parse(process.argv);
