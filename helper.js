"use strict";
const { NOT_INCLUDED } = require("./aggregators_net/constants.js");
const crypto = require("crypto");
const { SHA256Hasher } = require("./aggregators_net/hasher/sha256hasher.js");
const { SignerEC } = require("./aggregators_net/signer/SignerEC.js");
const { UnicityProvider } = require('./aggregators_net/provider/UnicityProvider.js');

const MINT_SUFFIX_HEX = crypto.createHash('sha256').update('TOKENID').digest('hex');
const MINTER_SECRET = 'I_AM_UNIVERSAL_MINTER_FOR_';

function calculateGenesisStateHash(tokenId){
    const hasher = new SHA256Hasher();
    return hasher.hash(tokenId+MINT_SUFFIX_HEX);
}

function calculateStateHash({token_class_id, token_id, sign_alg, hash_alg, pubkey, nonce}){
    const hasher = new SHA256Hasher();
    const signAlgCode = crypto.createHash('sha256').update(sign_alg).digest('hex');
    const hashAlgCode = crypto.createHash('sha256').update(hash_alg).digest('hex');
    return hasher.hash(token_class_id+signAlgCode+token_id+hashAlgCode+pubkey+nonce);
}

function calculatePointer({token_class_id, sign_alg, hash_alg, secret, nonce}){
    const signer = getTxSigner(secret, nonce);
    const pubkey = signer.publicKey;
    const hasher = new SHA256Hasher();
    const signAlgCode = crypto.createHash('sha256').update(sign_alg).digest('hex');
    const hashAlgCode = crypto.createHash('sha256').update(hash_alg).digest('hex');
    return hasher.hash(token_class_id+signAlgCode+hashAlgCode+pubkey+nonce);
}

function calculateExpectedPointer({token_class_id, sign_alg, hash_alg, pubkey, nonce}){
    const hasher = new SHA256Hasher();
    const signAlgCode = crypto.createHash('sha256').update(sign_alg).digest('hex');
    const hashAlgCode = crypto.createHash('sha256').update(hash_alg).digest('hex');
    return hasher.hash(token_class_id+signAlgCode+hashAlgCode+pubkey+nonce);
}

async function calculateGenesisRequestId(tokenId){
    const hasher = new SHA256Hasher();
    const minterSigner = getMinterSigner(tokenId);
    const minterPubkey = await minterSigner.getPubKey();
    const genesisState = calculateGenesisStateHash(tokenId);
    return await UnicityProvider.calculateRequestId(minterPubkey, genesisState, hasher);
}

function calculateMintPayload(tokenId, tokenClass, tokenValue, destPointer, salt){
    const hasher = new SHA256Hasher();
    const value = `${tokenValue.toString(16).slice(2).padStart(64, "0")}`;
    return hasher.hash(tokenId+tokenClass+value+destPointer+salt);
}

async function calculatePayload(source, destPointer, salt){
    const hasher = new SHA256Hasher();
    return hasher.hash((await source.challenge.getHexDigest())+destPointer+salt);
}

function getMinterSigner(tokenId){
    return new SignerEC(crypto.createHash('sha256').update(MINTER_SECRET+tokenId).digest('hex'));
}

function getMinterProvider(transport, tokenId){
    const hasher = new SHA256Hasher();
    const signer = getMinterSigner(tokenId);
    return new UnicityProvider(transport, signer, hasher);
}

function getTxSigner(secret, nonce){ // Changed
    return new SignerEC(crypto.createHash('sha256').update(secret+nonce).digest('hex'));
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
	const jsonId = crypto.createHash('sha256').update(tokenFileName).digest('hex');

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
