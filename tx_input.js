"use strict";

class TxInput{

    constructor(path, dest_ref, salt, dataHash, msg){
	this.path = path;
	this.dest_ref = dest_ref;
	this.salt = salt;
	this.dataHash = dataHash;
	this.msg = msg;
    }

}

module.exports = { TxInput }