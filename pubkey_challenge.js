
class ChallengePubkey {

    constructor(tokenId, sign_alg, hash_alg, pubkey, nonce) {
	this.tokenId = tokenId;
	this.sign_alg = sign_alg;
	this.hash_alg = hash_alg;
	this.pubkey = pubkey;
	this.nonce = nonce;
    }

    verify(input){
	const status = UnicityProvider.verifyInclusionProofs(input.path);
	if(status != OK)return status;
	const l = input.path.length-1;
	if((input.path[l].authenticator.pubkey != this.pubkey)||
	    (input.path[l].authenticator.state != getStateHash(
		this.tokenId,
		this.pubkey,
		this.nonce
	    )))return IP_MISMATCH;
	return OK;
    }

}