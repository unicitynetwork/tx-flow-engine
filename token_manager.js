#!/usr/bin/env node
"use strict";
const { Command } = require('commander');
//const crypto = require('crypto');
const { mint, importFlow, generateNametagTokenId, createNametag, exportFlow, createTx, collectTokens, generateRecipientPointerAddr, 
    generateRecipientPubkeyAddr, getHashOf } = require('./state_machine.js');
const { JSONRPCTransport } = require('@unicitylabs/shared/client/http_client.js');
const { SignerEC } = require('@unicitylabs/shared/signer/SignerEC.js');
const { hash } = require('@unicitylabs/shared/hasher/sha256hasher.js').SHA256Hasher;
const { UnicityProvider } = require('@unicitylabs/shared/provider/UnicityProvider.js');
const { State } = require('./state.js');
const { ChallengePubkey } = require('./pubkey_challenge.js');
const { calculateStateHash, calculatePointer, getStdin, splitStdin, validateOrConvert, 
    generateRandom256BitHex} = require('@unicitylabs/shared');

require('dotenv').config();

const program = new Command();
const provider_url = process.env.GATEWAY;
const secret = process.env.SECRET;

program
  .name('token_manager.js')
  .description('CLI app for managing tokens by processing TX flows')
  .version('1.0.0');

// Nametag token id command
program
  .command('nametag')
  .description('Generate a nametag address')
  .requiredOption('--name <name>', 'Nametag token name')
  .action(async (options) => {
//    try {
      console.log('nametag'+generateNametagTokenId(options.name));
//    } catch (error) {
//      console.error(error.message);
//    }
  });

program
  .command('register')
  .description('Registers a nametag token')
  .requiredOption('--name <name>', 'Any name. Note, you cannot take a name that have been registered already')
  .requiredOption('--nonce <nonce>', 'Nonce value')
  .option('--address <an_address>', 'Any address a token ownership can be set to')
  .option('--data <json_string>', 'A data object represented as JSON string')
  .option('-update', 'Enable update mode')
  .action(async (options) => {
//    try {
      const nonce = validateOrConvert('nonce', options.nonce);
      const token_data = options.data?options.data:options.address?`{"dest_ref": "${options.address}"}`:"";
      const token = await createNametag(options.name, token_data, secret, new JSONRPCTransport(provider_url));
      console.log(exportFlow(token, null, true));
//    } catch (error) {
//      console.error(error.message);
//    }
  });


// Mint command
program
  .command('mint')
  .description('Mint a new token')
  .requiredOption('--token_id <token_id>', 'ID of the token')
  .requiredOption('--token_class <token_class_id>', 'Class of the token')
  .requiredOption('--token_value <token_value>', 'Value of the token (any string)')
  .option('--immutable_data <json_string>', 'An immutable token data object represented as JSON string ')
  .option('--data <json_string>', 'A genesis state-only data object represented as JSON string')
  .requiredOption('--nonce <nonce>', 'Nonce value')
  .action(async (options) => {
//    try {
      const token_id = validateOrConvert('token_id', options.token_id);
      const token_class = validateOrConvert('token_class', options.token_class);
      const nonce = validateOrConvert('nonce', options.nonce);
      const token_data = options.data;
      const immutable_data = options.immutable_data;
      const token = await mint({ token_id, token_class_id: token_class, immutable_data,
	token_value: options.token_value, token_data, secret, nonce,  
	mint_salt: generateRandom256BitHex(), sign_alg: 'secp256k1', hash_alg: 'sha256',
	transport: new JSONRPCTransport(provider_url)});
      console.log(exportFlow(token, null, true));
//    } catch (error) {
//      console.error(error.message);
//    }
  });

// Send command
program
  .command('send')
  .description('Send a token')
  .requiredOption('--dest <dest_pointer>', 'Destination pointer for the token')
  .option('--datahash <dest_data_hash>', 'Hash of the data at the recipient state')
  .action(async (options) => {
    const token = await importFlow(await getStdin());
    const destPointer = options.dest;
    const destDataHash  = options.datahash;
    const salt = generateRandom256BitHex();

    const transport = new JSONRPCTransport(provider_url);
    const tx = await createTx(token, destPointer, salt, secret, transport, destDataHash);
    console.log(exportFlow(token, tx, true));
  });

// Pointer command
program
  .command('pointer')
  .description('Generate a pointer address')
  .requiredOption('--token_class <token_class>', 'Class of the token')
  .requiredOption('--nonce <nonce>', 'Nonce value')
  .action(async (options) => {
//    try {
      const token_class_id = validateOrConvert('token_class', options.token_class);
      const nonce = validateOrConvert('nonce', options.nonce);

      console.log(generateRecipientPointerAddr(token_class_id, 'secp256k1', 'sha256', secret, nonce));
//    } catch (error) {
//      console.error(error.message);
//    }
  });

// Pubkey command
program
  .command('pubkey')
  .description('Generate a pubkey address')
  .action(async (options) => {
//    try {
      console.log(generateRecipientPubkeyAddr(secret));
//    } catch (error) {
//      console.error(error.message);
//    }
  });

// Token data command
program
  .command('tokendata')
  .description('Generate token data hash')
  .requiredOption('--data <json_string>', 'A data object represented as JSON string')
  .action(async (options) => {
//    try {
      console.log(getHashOf(options.data));
//    } catch (error) {
//      console.error(error.message);
//    }
  });


// Receive command
/*program
  .command('receive')
  .description('Receive a token')
  .option('--data <json_string>', 'A data object for the recipient state, represented as JSON string')
  .option('--nonce <nonce>', 'Nonce value')
  .action(async (options) => {
//    try {
      const nonce = validateOrConvert('nonce', options.nonce);
      const flowJson = await getStdin();
      const flow = JSON.parse(flowJson);
      const token_data = options.data;

      const token = await importFlow(flowJson, secret, nonce, token_data);

      console.log(exportFlow(token, null, true));
//    } catch (error) {
//      console.error(error.message);
//    }
  });*/


// Receive command
program
  .command('receive')
  .description('Receive a token')
  .option('--data <json_string>', 'A data object for the recipient state, represented as JSON string')
  .option('--nonce <nonce>', 'Nonce value')
  .action(async (options) => {
//    try {
      const nonce = validateOrConvert('nonce', options.nonce);
//      const flowJson = await getStdin();
      const stdinStr = await getStdin();
      const delimeter = '### NAMETAG ###';
      const stdinstrs = stdinStr.includes(delimeter)?stdinStr.split(delimeter):stdinStr;
      const flowJson = Array.isArray(stdinstrs)?stdinstrs[0]:stdinstrs;
      const flowNametag = Array.isArray(stdinstrs)?stdinstrs[1]:undefined;
      const flow = JSON.parse(flowJson);
      const token_data = options.data;
      const nameTagId = flowNametag?JSON.parse(flowNametag).token?.tokenId:undefined;

      const token = await importFlow(flowJson, secret, nonce, token_data, nameTagId?{['nametag_'+nameTagId]:JSON.parse(flowNametag)}:undefined);

      console.log(exportFlow(token, null, true));
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

      let tokens = {}
      let tokenUrls = {}

      for(const name in flowJsons){
	tokenUrls[name] = flowJsons[name].url;
	tokens[name] = await importFlow(flowJsons[name].json);
      }

      const collection = await collectTokens(tokens, tokenClass, BigInt(0), secret, new JSONRPCTransport(provider_url));

      console.log("=============================");
      console.log("Tokens ready to be spent: ");
      console.log(collection);
      console.log();
      console.log("=============================");
      console.log("TXF files storing the tokens: ");
      for(const name in tokenUrls)
	if(collection.tokens[name])
	    console.log(name+": "+tokenUrls[name]);
//      } catch (error) {
//        console.error(error.message);
//    }
  });


// Parse the CLI arguments
program.parse(process.argv);
