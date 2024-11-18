
class Token {

    constructor({ token_id, token_class_id, token_value, mint_proofs, mint_request,
	    mint_salt, transitions }){
	this.tokenId = token_id;
	this.tokenClass = token_class_id;
	this.tokenValue = token_value;
	this.mintProofs = mint_proofs;
	this.mintRequest = mint_request;
	this.mintSalt = mint_salt;
	this.genesis = token_first_state;
	this.transitions = transitions;
	const genesisStatus = validateGenesis();
	if(genesisStatus != OK)
	    throw new Error(`Error in mint: ${status}`);
	this.state = this.genesis;
	for(let i=0; i<transitions.length; i++)
	    updateState(transitions[i]);
    }

    applyTx(tx, destination){
	if(tx.tokenId != this.tokenId)
	    throw new Error("Token ID in TX does not match this token ID");
	const transition = new Transition(tx.tokenId, tx.source, tx.input, destination);
/*	const status = transition.execute();
	if(status != OK)
	    throw new Error(`Transition execution error: ${status}`);*/
	updateState(transition);
    }

    private updateState(transition){
	if(transition.source.challenge.getHexDigest() != this.state.getHexDigets())
	    throw new Error(`Error executing transition ${transition.input.path.requestId}: source state does not match the token\s current state`);
	const status = transition.execute();
	if(status != OK)
	    throw new Error(`Error executing transition ${transition.input.path.requestId}: ${status}`);
	this.state = transition.destination;
    }

    private validateGenesis(){
	const status = UnicityProvider.verifyInclusionProofs(mintProofs.path);
	if(status != OK)return status;
	const genesisRequestId = calculateGenesisRequestId(this.tokenId);
	const l = input.path.length-1;
	if(mintProofs.path[l].requestId != genesisRequestId)return GENESIS_MISMATCH;
	const expectedDestPointer = calculateTokenStatePointer(this.tokenClass,
	    this.genesis.challenge.sign_alg,
	    this.genesis.challenge.hash_alg,
	    this.genesis.challenge.pubkey,
	    this.genesis.challenge.nonce
	);
	if(this.mintRequest.destPointer != expectedDestPointer)return DEST_MISMATCH;
	const expectedPayload = calculateMintPayload(this.tokenId, this.tokenClass,
	    this.tokenValue, this.mintRequest.destPointer, this.mintSalt);
	if(this.mintProofs.path[l].payload != expectedPayload)return PAYLOAD_MISMATCHED;
	return OK;
    }

}
