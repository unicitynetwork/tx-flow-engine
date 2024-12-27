"use strict";

class TxInput{

    constructor(path, dest_ref, salt, dataHash){
	this.path = path;
	this.dest_ref = dest_ref;
	this.salt = salt;
	this.dataHash = dataHash;
    }

}

module.exports = { TxInput }