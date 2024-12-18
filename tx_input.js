"use strict";

class TxInput{

    constructor(path, dest_ref, salt){
	this.path = path;
	this.dest_ref = dest_ref;
	this.salt = salt;
    }

}

module.exports = { TxInput }