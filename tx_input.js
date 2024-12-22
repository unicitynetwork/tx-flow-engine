"use strict";

class TxInput{

    constructor(path, dest_ref, salt, meta){
	this.path = path;
	this.dest_ref = dest_ref;
	this.salt = salt;
	this.meta = meta;
    }

}

module.exports = { TxInput }