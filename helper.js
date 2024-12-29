"use strict";
const objectHash = require("object-hash");
const { NOT_INCLUDED } = require("./aggregators_net/constants.js");
//const CryptoJS = require('crypto-js');
const { hash } = require("./aggregators_net/hasher/sha256hasher.js").SHA256Hasher;
const { SignerEC } = require("./aggregators_net/signer/SignerEC.js");
const { UnicityProvider } = require('./aggregators_net/provider/UnicityProvider.js');

const CryptoJS = require('crypto-js');

const MINT_SUFFIX_HEX = hash('TOKENID');
const MINTER_SECRET = 'I_AM_UNIVERSAL_MINTER_FOR_';

function calculateGenesisStateHash(tokenId){
    return hash(tokenId+MINT_SUFFIX_HEX);
}

function calculateStateHash({token_class_id, token_id, sign_alg, hash_alg, data, pubkey, nonce}){
    const signAlgCode = hash(sign_alg);
    const hashAlgCode = hash(hash_alg);
    return hash(token_class_id+signAlgCode+token_id+hashAlgCode+(data?hash(data):'')+pubkey+nonce);
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

function calculatePointerFromPubKey({token_class_id, sign_alg, hash_alg, secret, salt, sourceState}){
    const signer = getTxSigner(secret);
    const pubkey = signer.publicKey;
    const signAlgCode = hash(sign_alg);
    const hashAlgCode = hash(hash_alg);
    const signature = signer.sign(salt);
    const nonce=hash(sourceState+signature);
    return { pointer: hash(token_class_id+signAlgCode+hashAlgCode+pubkey+nonce), signature };
}

function calculateExpectedPointerFromPubAddr({token_class_id, sign_alg, hash_alg, pubkey, salt, signature, nonce, sourceState}){
    if(!SignerEC.verify(pubkey, salt, signature))
	throw new Error("Salt was not signed correctly");

    const signAlgCode = hash(sign_alg);
    const hashAlgCode = hash(hash_alg);
    if(hash(sourceState+signature) !== nonce)
	throw new Error("Nonce was not derived correctly");
    return hash(token_class_id+signAlgCode+hashAlgCode+pubkey+nonce);
}

function calculatePubkey(secret){
    const signer = getTxSigner(secret);
    return signer.publicKey;
}

function calculatePubAddr(pubkey){
    return 'pub'+pubkey;
}

function calculatePubPointer(pointer){
    return 'point'+pointer;
}

async function calculateGenesisRequestId(tokenId){
    const minterSigner = getMinterSigner(tokenId);
    const minterPubkey = await minterSigner.getPubKey();
    const genesisState = calculateGenesisStateHash(tokenId);
    return await UnicityProvider.calculateRequestId(minterPubkey, genesisState);
}

function calculateMintPayload(tokenId, tokenClass, tokenValue, dataHash, destPointer, salt){
    const value = `${tokenValue.toString(16).slice(2).padStart(64, "0")}`;
    return hash(tokenId+tokenClass+value+dataHash+destPointer+salt);
}

async function calculatePayload(source, destPointer, salt, dataHash){
    return hash(source.calculateStateHash()+destPointer+salt+(dataHash?dataHash:''));
}

function resolveReference(dest_ref) {
    let ext;
    if (dest_ref.includes('.')) {
        const [base, ...rest] = dest_ref.split('.');
        dest_ref = base;
        ext = rest.join('.');
    }

    if (dest_ref.startsWith('point')) {
        return { pointer: dest_ref.substring(5), ext };
    }

    if (dest_ref.startsWith('pub')) {
        return { pubkey: dest_ref.substring(3), ext };
    }

    return { ext };
}

function getMinterSigner(tokenId){
    return new SignerEC(hash(MINTER_SECRET+tokenId));
}

function getMinterProvider(transport, tokenId){
    const signer = getMinterSigner(tokenId);
    return new UnicityProvider(transport, signer, hash);
}

function getTxSigner(secret, nonce){ // Changed
    if(nonce)return new SignerEC(hash(secret+nonce));
    else
	return new SignerEC(hash(secret));
}

async function isUnspent(provider, state){
    const { status, path } = await provider.extractProofs(await provider.getRequestId(state));
    return status == NOT_INCLUDED;
}

async function confirmOwnership(token, pubkey){
    return token.state.challenge.pubkey == pubkey;
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

function getPubKey(secret){
    const signer = getTxSigner(secret);
    return signer.getPubKey();
}

function isSigner(obj){
    return (obj instanceof SignerEC);
}

function isValid256BitHex(value) {
  const hexRegex = /^[0-9a-fA-F]{64}$/; // 64 hex chars = 256 bits
  return hexRegex.test(value);
}

function to256BitHex(value) {
  if (isValid256BitHex(value)) {
    return value.toLowerCase();
  } else if (typeof value === 'string') {
    return hash(value);
  } else {
    throw new Error(`Invalid input: ${value}`);
  }
}

// Wrapper to validate/convert parameters
function validateOrConvert(paramName, value) {
  if(!value)return;
  if(value === '')return;
  try {
    return to256BitHex(value);
  } catch (error) {
    throw new Error(`${paramName} must be a valid 256-bit hex or convertible string. Error: ${error.message}`);
  }
}

function generateRandom256BitHex() {
    return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
}

module.exports = {
    calculateGenesisStateHash,
    calculateStateHash,
    calculatePointer,
    calculateExpectedPointer,
    calculateGenesisRequestId,
    calculateMintPayload,
    calculatePayload,
    calculateExpectedPointerFromPubAddr,
    calculatePubAddr,
    calculatePubPointer,
    calculatePubkey,
    resolveReference,
    confirmOwnership,
    getMinterSigner,
    getMinterProvider,
    getTxSigner,
    getPubKey,
    isSigner,
    isUnspent,
    getStdin,
    splitStdin,
    validateOrConvert,
    generateRandom256BitHex
}
