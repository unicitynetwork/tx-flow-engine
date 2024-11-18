
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
	    (input.path[l].authenticator.state != getHexDigest()))return INP_MISMATCH;
	return OK;
    }

    getHexDigest(){
	return calculateStateHash({tokenId: this.tokenId, sign_alg: this.sign_alg, 
	    hash_alg: this.hash_alg, pubkey: this.pubkey, nonce: this.nonce});
    }

}