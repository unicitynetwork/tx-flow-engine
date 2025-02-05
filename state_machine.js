"use strict";
const { DEFAULT_LOCAL_GATEWAY, DEFAULT_TEST_GATEWAY, calculateStateHash, calculatePointer, calculateExpectedPointer, calculateGenesisStateHash, 
     calculateMintPayload, resolveReference, destRefFromNametag, getMinterProvider, calculatePayload, calculatePubPointer, calculatePubAddr, calculatePubkey, 
    generateRecipientPointerAddr, generateRecipientPubkeyAddr,
    getTxSigner, getPubKey, isUnspent, confirmOwnership, validateOrConvert, generateRandom256BitHex, stringToHex } = require('@unicitylabs/shared');
const { State } = require('./state.js');
const { ChallengePubkey } = require('./pubkey_challenge.js');
const { Token } = require('./token.js');
const { Transaction } = require('./transaction.js');
const { TxInput } = require('./tx_input.js');
const { hash, objectHash } = require('@unicitylabs/shared/hasher/sha256hasher.js').SHA256Hasher;
const { UnicityProvider } = require('@unicitylabs/shared/provider/UnicityProvider.js');
const { JSONRPCTransport } = require('@unicitylabs/shared/client/http_client.js');
const { TokenPool } = require('./tokenpool.js');

const NAMETAG_TOKEN_CLASS = hash(stringToHex("NAMETAG_TOKEN_CLASS"));

async function mint({
    token_id,
    token_class_id,
    token_value,
    token_data,
    secret,
    nonce,
    mint_salt,
    sign_alg,
    hash_alg,
    transport
    }){
    const signer = getTxSigner(secret, nonce);
    const pubkey = signer.getPubKey();
    const stateHash = await calculateGenesisStateHash(token_id);
    const destPointerAddr = calculatePubPointer(await calculateExpectedPointer({token_class_id, sign_alg,
	hash_alg, pubkey, nonce}));
    const data = token_data?JSON.parse(token_data):undefined;
    const payload = await calculateMintPayload(token_id, token_class_id, token_value, data?objectHash(data):'', destPointerAddr,
	mint_salt);
    const mintProvider = getMinterProvider(transport, token_id);
    const { requestId, result } = await mintProvider.submitStateTransition(stateHash, payload);
    const { status, path } = await mintProvider.extractProofs(requestId);

    const token = new Token({token_id, token_class_id, token_value, data, mint_proofs: { path },
	mint_request: { dest_ref: destPointerAddr }, mint_salt, transitions: [], sign_alg, hash_alg, pubkey, nonce });
    await token.init();
    return token;
}

async function createTx(token, dest_ref, salt, secret, transport, dataHash){
    const stateHash = await token.state.calculateStateHash();
    const payload = await calculatePayload(token.state, dest_ref, salt, dataHash);
    const signer = getTxSigner(secret, token.state.aux?.salt_sig?undefined:token.state.challenge.nonce);
    if(token.state?.challenge?.pubkey !== signer.getPubKey())
	throw new Error("Failed to unlock token "+token.tokenId+". Pubkey in state does not match the provider key");
    const provider = new UnicityProvider(transport, signer);
    const { requestId, result } = await provider.submitStateTransition(stateHash, payload);
    const { status, path } = await provider.extractProofs(requestId);
    const input = new TxInput(path, dest_ref, salt, dataHash);
    return new Transaction(token.tokenId, token.state, input, dest_ref);
}

function importTx(token, tx, destination){
    token.applyTx(tx, destination);
}

function generateNametagTokenId(name){
    return hash(stringToHex("NAMETAG_"+name));
}

async function createNametag(name, data, secret, transport){
    const token_id = generateNametagTokenId(name);
    const nonce = generateRandom256BitHex();
    return await mint({ token_id, token_class_id: NAMETAG_TOKEN_CLASS, 
    token_value: "0", token_data: data, secret, nonce,  
    mint_salt: generateRandom256BitHex(), sign_alg: 'secp256k1', hash_alg: 'sha256',
    transport });
}

function exportFlow(token, transaction, pretify){
    const flow = {token, transaction}
    return pretify?JSON.stringify(flow, null, 4):JSON.stringify(flow);
}

function importFlow(tokenTransitionFlow, secret, nonce, dataJson, nametagTokens){
    const flow = JSON.parse(tokenTransitionFlow);
    const data = dataJson?JSON.parse(dataJson):undefined;
    const token = new Token({token_id: flow.token.tokenId, token_class_id: flow.token.tokenClass, 
	token_value: flow.token.tokenValue, data: flow.token.genesis.data,  sign_alg: flow.token.genesis.challenge.sign_alg,
	hash_alg: flow.token.genesis.challenge.hash_alg,  mint_proofs: flow.token.mintProofs,
	mint_request: flow.token.mintRequest, mint_salt: flow.token.mintSalt, 
	pubkey: flow.token.genesis.challenge.pubkey,
	nonce: flow.token.genesis.challenge.nonce,
	transitions: flow.token.transitions, nametagVerifier: importNametag});
    token.init();
    if(flow.transaction && secret){
	const { nametag } = resolveReference(flow.transaction.input.dest_ref);
	const dest_ref = nametag?destRefFromNametag(nametag, 
	    Object.fromEntries(Object.entries(nametagTokens).map(([key, value]) => [key, importNametag(value)]))
	    ):flow.transaction.input.dest_ref;
	const { pubkey } = resolveReference(dest_ref);
	if(!nonce && !pubkey)
	    throw new Error("Cannot import flow with transaction: nonce of the state for the transaction is missing");
	const signer = getTxSigner(secret, nonce);
	const sigPubkey = signer.getPubKey();
	if(pubkey)
	    if(pubkey !== sigPubkey)
		throw new Error("Pubkeys do not match");
	const salt_sig = pubkey?signer.sign(flow.transaction.input.salt):undefined;
	const source = new State(new ChallengePubkey(flow.token.tokenClass, flow.token.tokenId, 'secp256k1', 'sha256', 
	    flow.transaction.source.challenge.pubkey, flow.transaction.source.challenge.nonce), flow.transaction.source.aux, 
	    flow.transaction.source.data);
	const destination = new State(new ChallengePubkey(flow.token.tokenClass, flow.token.tokenId, 'secp256k1', 'sha256', 
	    sigPubkey, salt_sig?hash(source.calculateStateHash()+salt_sig):nonce), {salt_sig: (salt_sig?salt_sig:undefined), nametags: nametagTokens}, data);
	token.applyTx(flow.transaction, destination);
    }
    return token;
}

function importNametag(nametagFlow){
//	console.log(JSON.parse(nametagFlowJson));
    return nametagFlow?importFlow(JSON.stringify(nametagFlow)):undefined;
}

async function getTokenStatus(token, secret, transport){
    const stateHash = await token.state.calculateStateHash();
    const signer = getTxSigner(secret, token.state.aux?.salt_sig?undefined:token.state.challenge.nonce);
    const provider = new UnicityProvider(transport, signer);
    const isLatestState = await isUnspent(provider, stateHash);
    const isOwner = await confirmOwnership(token, signer);
    const { id, classId, value, data } = token.getStats();
    return { id, classId, value, data, unspent: isLatestState, owned: isOwner }
}

async function collectTokens(tokens, tokenClass, targetValue, secret, transport){
    let filteredTokens = [];
    let filteredTokenStats = [];
    let totalValue = BigInt(0);
    for(const name in tokens){
	const status = await getTokenStatus(tokens[name], secret, transport);
	const { id, classId, value, data, unspent, owned } = status;
	if((classId == tokenClass) && unspent && owned){
	    filteredTokens[name] = tokens[name];
	    filteredTokenStats[name] = status;
	    totalValue+=BigInt(value);
	    if(targetValue!=0)
		if(targetValue<=totalValue)break;
	}
    }
    return { totalValue, tokens: filteredTokens, stats: filteredTokenStats }
}

function getHTTPTransport(url){
    return new JSONRPCTransport(url);
}

function defaultGateway(){
    return DEFAULT_TEST_GATEWAY;
//    return DEFAULT_LOCAL_GATEWAY;
}

function getTokenPool(){
    return new TokenPool();
}

async function createToken(secret, pool, tokenClass, tokenValue, tokenData){
    const token_id = generateRandom256BitHex();
    const nonce = generateRandom256BitHex();
    const token = await mint({ token_id, token_class_id: tokenClass, 
	token_value: tokenValue, data: tokenData, secret, nonce,  
	mint_salt: generateRandom256BitHex(), sign_alg: 'secp256k1', hash_alg: 'sha256',
	transport: new JSONRPCTransport(defaultGateway())});
    return pool.addToken(secret, exportFlow(token, null, true));
}

async function findTokens(secret, pool, tokenClass, targetValue){
    const tokenJsons = pool.getTokens(secret);
    let tokens = {};
    for(let tokenId in tokenJsons){
	tokens[tokenId] = await importFlow(tokenJsons[tokenId]);
    }
    return await collectTokens(tokens, tokenClass, targetValue, secret, new JSONRPCTransport(defaultGateway()));
}

async function sendTokens(secret, pool, tokenClass, targetValue, dest_ref){
    const tokens = (await findTokens(secret, pool, tokenClass, targetValue)).tokens;
    const flows = {};
    for(let tokenId in tokens){
	const token = tokens[tokenId];
	const salt = generateRandom256BitHex();
	const tx = await createTx(token, dest_ref, salt, secret, new JSONRPCTransport(defaultGateway()));
	flows[tokenId] = exportFlow(token, tx, true);
    }
    return flows;
}

async function receiveTokens(secret, pool, tokenFlows){
    for(let tokenId in tokenFlows){
	const txf = tokenFlows[tokenId];
	const tmpToken = JSON.parse(txf);
	const nonce = pool.getNonce(tmpToken.transaction.dest_ref);
	const token = await importFlow(txf, secret, nonce);
	const updatedJson = exportFlow(token, null, true);
	pool.addToken(secret, updatedJson);
    }
    return pool;
}

function getHashOf(jsonStr){
    return objectHash(JSON.parse(jsonStr));
}

module.exports = {
    mint,
    generateRecipientPointerAddr,
    generateRecipientPubkeyAddr,
    createTx,
    importTx,
    exportFlow,
    importFlow,
    generateNametagTokenId,
    createNametag,
    getTokenStatus,
    collectTokens,
    getHTTPTransport,
    validateOrConvert, 
    generateRandom256BitHex,
    defaultGateway,
    calculatePointer,
    getTokenPool,
    createToken,
    findTokens,
    sendTokens,
    receiveTokens,
    getHashOf
}
