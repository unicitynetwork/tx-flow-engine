"use strict";
const { NOT_INCLUDED } = require("./aggregators_net/constants.js");
//const CryptoJS = require('crypto-js');
const { hash } = require("./aggregators_net/hasher/sha256hasher.js").SHA256Hasher;
const { SignerEC } = require("./aggregators_net/signer/SignerEC.js");
const { UnicityProvider } = require('./aggregators_net/provider/UnicityProvider.js');

const MINT_SUFFIX_HEX = hash('TOKENID');
const MINTER_SECRET = 'I_AM_UNIVERSAL_MINTER_FOR_';

function calculateGenesisStateHash(tokenId){
    return hash(tokenId+MINT_SUFFIX_HEX);
}

function calculateStateHash({token_class_id, token_id, sign_alg, hash_alg, pubkey, nonce}){
    const signAlgCode = hash(sign_alg);
    const hashAlgCode = hash(hash_alg);
    return hash(token_class_id+signAlgCode+token_id+hashAlgCode+pubkey+nonce);
}

function calculatePointer({token_class_id, sign_alg, hash_alg, secret, nonce}){
    const signer = getTxSigner(secret, nonce);
    const pubkey = signer.publicKey;
    const signAlgCode = hash(sign_alg);
    const hashAlgCode = hash(hash_alg);
    return hash(token_class_id+signAlgCode+hashAlgCode+pubkey+nonce);
}

function calculateExpectedPointer({token_class_id, sign_alg, hash_alg, pubkey, nonce}){
    const signAlgCode = hash(sign_alg);
    const hashAlgCode = hash(hash_alg);
    return hash(token_class_id+signAlgCode+hashAlgCode+pubkey+nonce);
}

async function calculateGenesisRequestId(tokenId){
    const minterSigner = getMinterSigner(tokenId);
    const minterPubkey = await minterSigner.getPubKey();
    const genesisState = calculateGenesisStateHash(tokenId);
    return await UnicityProvider.calculateRequestId(minterPubkey, genesisState);
}

function calculateMintPayload(tokenId, tokenClass, tokenValue, destPointer, salt){
    const value = `${tokenValue.toString(16).slice(2).padStart(64, "0")}`;
    return hash(tokenId+tokenClass+value+destPointer+salt);
}

async function calculatePayload(source, destPointer, salt){
    return hash((await source.challenge.getHexDigest())+destPointer+salt);
}

function getMinterSigner(tokenId){
    return new SignerEC(hash(MINTER_SECRET+tokenId));
}

function getMinterProvider(transport, tokenId){
    const signer = getMinterSigner(tokenId);
    return new UnicityProvider(transport, signer, hash);
}

function getTxSigner(secret, nonce){ // Changed
    return new SignerEC(hash(secret+nonce));
}

async function isUnspent(provider, state){
    const { status, path } = await provider.extractProofs(await provider.getRequestId(state));
    return status == NOT_INCLUDED;
}

async function confirmOwnership(token, signer){
    return token.state.challenge.pubkey == signer.getPubKey();
}

function getStdin(){
  return new Promise((resolve, reject) => {
    let inputData = '';

    process.stdin.on('data', (chunk) => {
      inputData += chunk; // Accumulate the data
    });

    process.stdin.on('end', () => {
      resolve(inputData); // Resolve the promise with the input data
    });

    process.stdin.on('error', (err) => {
      reject(err); // Reject the promise if there's an error
    });
  });
}

function splitStdin(data){
    const result = {};
    const parts = data.split(/###TOKEN\s+/).filter(Boolean); // Split by '###TOKEN' and remove empty strings

    for (const part of parts) {
        const firstSpace = part.indexOf(' ');
        if (firstSpace === -1) {
            console.error(`Malformed token part: ${part}`);
            continue;
        }

        const tokenFileName = part.slice(0, firstSpace).trim();
        const jsonString = part.slice(firstSpace + 1).trim();
	const jsonId = hash(tokenFileName);

        try {
            result[jsonId] = {json: jsonString, url: tokenFileName};
        } catch (error) {
            console.error(`Invalid JSON for token file "${tokenFileName}":`, error);
        }
    }

    return result;
}

module.exports = {
    calculateGenesisStateHash,
    calculateStateHash,
    calculatePointer,
    calculateExpectedPointer,
    calculateGenesisRequestId,
    calculateMintPayload,
    calculatePayload,
    confirmOwnership,
    getMinterSigner,
    getMinterProvider,
    getTxSigner,
    isUnspent,
    getStdin,
    splitStdin
}
