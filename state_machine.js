"use strict";
const objectHash = require("object-hash");
const { DEFAULT_LOCAL_GATEWAY, DEFAULT_TEST_GATEWAY } = require('./constants.js');
const { calculateStateHash, calculatePointer, calculateExpectedPointer, calculateGenesisStateHash, 
     calculateMintPayload, resolveReference, getMinterProvider, calculatePayload, calculatePubPointer, calculatePubAddr, calculatePubkey, 
    getTxSigner, getPubKey, isUnspent, confirmOwnership, validateOrConvert, generateRandom256BitHex } = require('./helper.js');
const { State } = require('./state.js');
const { ChallengePubkey } = require('./pubkey_challenge.js');
const { Token } = require('./token.js');
const { Transaction } = require('./transaction.js');
const { TxInput } = require('./tx_input.js');
const { hash } = require('./aggregators_net/hasher/sha256hasher.js').SHA256Hasher;
const { UnicityProvider } = require('./aggregators_net/provider/UnicityProvider.js');
const { JSONRPCTransport } = require('./aggregators_net/client/http_client.js');
const { TokenPool } = require('./tokenpool.js');

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
    return await _mint({
	token_id,
	token_class_id,
	token_value,
	token_data,
	signer: getTxSigner(secret, nonce),
	nonce,
	mint_salt,
	sign_alg,
	hash_alg,
	transport
    });
}

async function _mint({
    token_id,
    token_class_id,
    token_value,
    token_data,
    signer,
    nonce,
    mint_salt,
    sign_alg,
    hash_alg,
    transport
    }){
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

function generateRecipientPointerAddr(token_class_id, sign_alg, hash_alg, secret, nonce){
    return calculatePubPointer(calculatePointer({token_class_id, sign_alg, hash_alg, secret, nonce}));
}

function generateRecipientPubkeyAddr(secret){
    return calculatePubAddr(calculatePubkey(secret));
}

async function createTx(token, dest_ref, salt, secret, transport, dataHash){
    return await _createTx(token, dest_ref, salt, 
	getTxSigner(secret, token.state.aux?undefined:token.state.challenge.nonce), 
    transport, dataHash);
}

async function _createTx(token, dest_ref, salt, signer, transport, dataHash){
    const stateHash = await token.state.calculateStateHash();
    const payload = await calculatePayload(token.state, dest_ref, salt, dataHash);
    const provider = new UnicityProvider(transport, signer);
    const { requestId, result } = await provider.submitStateTransition(stateHash, payload);
    const { status, path } = await provider.extractProofs(requestId);
    const input = new TxInput(path, dest_ref, salt, dataHash);
    return new Transaction(token.tokenId, token.state, input, dest_ref);
}

function importTx(token, tx, destination){
    token.applyTx(tx, destination);
}

function exportFlow(token, transaction, pretify){
    const flow = {token, transaction}
    return pretify?JSON.stringify(flow, null, 4):JSON.stringify(flow);
}

async function importFlow(tokenTransitionFlow, secret, nonce, dataJson){
    return await _importFlow(tokenTransitionFlow, secret?getTxSigner(secret, nonce):undefined, nonce, dataJson);
}

async function _importFlow(tokenTransitionFlow, signer, nonce, dataJson){
    const flow = JSON.parse(tokenTransitionFlow);
    const data = dataJson?JSON.parse(dataJson):undefined;
    const token = new Token({token_id: flow.token.tokenId, token_class_id: flow.token.tokenClass, 
	token_value: flow.token.tokenValue, data: flow.token.genesis.data,  sign_alg: flow.token.genesis.challenge.sign_alg,
	hash_alg: flow.token.genesis.challenge.hash_alg,  mint_proofs: flow.token.mintProofs,
	mint_request: flow.token.mintRequest, mint_salt: flow.token.mintSalt, 
	pubkey: flow.token.genesis.challenge.pubkey,
	nonce: flow.token.genesis.challenge.nonce,
	transitions: flow.token.transitions});
    await token.init();
    if(flow.transaction && signer){
	const { pubkey } = resolveReference(flow.transaction.input.dest_ref);
	if(!nonce && !pubkey)
	    throw new Error("Cannot import flow with transaction: nonce of the state for the transaction is missing");
	const sigPubkey = signer.getPubKey();
	if(pubkey)
	    if(pubkey !== sigPubkey)
		throw new Error("Pubkeys do not match");
	const salt_sig = pubkey?signer.sign(flow.transaction.input.salt):undefined;
	const source = new State(new ChallengePubkey(flow.token.tokenClass, flow.token.tokenId, 'secp256k1', 'sha256', 
	    flow.transaction.source.challenge.pubkey, flow.transaction.source.challenge.nonce), flow.transaction.source.aux, 
	    flow.transaction.source.data);
	const destination = new State(new ChallengePubkey(flow.token.tokenClass, flow.token.tokenId, 'secp256k1', 'sha256', 
	    sigPubkey, salt_sig?hash(source.calculateStateHash()+salt_sig):nonce), salt_sig?{salt_sig}:undefined, data);
	await token.applyTx(flow.transaction, destination);
    }
    return token;
}

async function getTokenStatus(token, secret, transport){
    return await _getTokenStatus(token, 
	getTxSigner(secret, token.state.aux?undefined:token.state.challenge.nonce), 
	transport);
}

async function _getTokenStatus(token, signer, transport){
    const stateHash = await token.state.calculateStateHash();
    const provider = new UnicityProvider(transport, signer);
    const isLatestState = await isUnspent(provider, stateHash);
    const isOwner = await confirmOwnership(token, signer.getPubKey());
    const { id, classId, value, data } = token.getStats();
    return { id, classId, value, data, unspent: isLatestState, owned: isOwner }
}

async function collectTokens(tokens, tokenClass, targetValue, secretOrSigner, transport){
    let filteredTokens = [];
    let filteredTokenStats = [];
    let totalValue = BigInt(0);
    for(const name in tokens){
	const status = isSigner(secretOrSigner)?
	    await _getTokenStatus(tokens[name], getTxSigner(secretOrSigner), transport):
	    await getTokenStatus(tokens[name], secretOrSigner, transport);
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
}

function getTokenPool(){
    return new TokenPool();
}

async function createToken(secret, pool, tokenClass, tokenValue, tokenData){
    return await _createToken(getTxSigner(secret, nonce), pool, tokenClass, tokenValue, tokenData);
}

async function _createToken(signer, pool, tokenClass, tokenValue, tokenData){
    const token_id = generateRandom256BitHex();
    const nonce = generateRandom256BitHex();
    const token = await _mint({ token_id, token_class_id: tokenClass, 
	token_value: tokenValue, data: tokenData, signer, nonce,  
	mint_salt: generateRandom256BitHex(), sign_alg: 'secp256k1', hash_alg: 'sha256',
	transport: new JSONRPCTransport(defaultGateway())});
    return pool.addToken(signer.getPubKey(), exportFlow(token, null, true));
}

async function findTokens(secretOrSigner, pool, tokenClass, targetValue){
    const tokenJsons = pool.getTokens(isSigner(secretOrSigner)?secretOrSigner.getPubKey():
	getTxSigner(secretOrSigner).getPubKey());
    let tokens = {};
    for(let tokenId in tokenJsons){
	tokens[tokenId] = await importFlow(tokenJsons[tokenId]);
    }
    return await collectTokens(tokens, tokenClass, targetValue, secretOrSigner, new JSONRPCTransport(defaultGateway()));
}

async function sendTokens(secretOrSigner, pool, tokenClass, targetValue, dest_ref){
    const tokens = (await findTokens(secretOrSigner, pool, tokenClass, targetValue)).tokens;
    const flows = {};
    for(let tokenId in tokens){
	const token = tokens[tokenId];
	const salt = generateRandom256BitHex();
	const tx = isSigner(secretOrSigner)?
	    await _createTx(token, dest_ref, salt, secretOrSigner, new JSONRPCTransport(defaultGateway())):
	    await createTx(token, dest_ref, salt, secretOrSigner, new JSONRPCTransport(defaultGateway()));
	flows[tokenId] = exportFlow(token, tx, true);
    }
    return flows;
}

async function receiveTokens(secretOrSigner, pool, tokenFlows){
    for(let tokenId in tokenFlows){
	const txf = tokenFlows[tokenId];
	const tmpToken = JSON.parse(txf);
	const nonce = pool.getNonce(tmpToken.transaction.dest_ref);
	const token = isSigner(secretOrSigner)?
	    await _importFlow(txf, secretOrSigner, nonce):
	    await importFlow(txf, secretOrSigner, nonce);
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
    _mint,
    generateRecipientPointerAddr,
    generateRecipientPubkeyAddr,
    createTx,
    _createTx,
    importTx,
    exportFlow,
    importFlow,
    _importFlow,
    getTokenStatus,
    _getTokenStatus,
    collectTokens,
    getHTTPTransport,
    validateOrConvert, 
    generateRandom256BitHex,
    defaultGateway,
    calculatePointer,
    getTokenPool,
    createToken,
    _createToken,
    findTokens,
    sendTokens,
    receiveTokens,
    getHashOf
}
