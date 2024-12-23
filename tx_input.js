"use strict";

class TxInput{

    constructor(path, dest_ref, salt, data){
	this.path = path;
	this.dest_ref = dest_ref;
	this.salt = salt;
	this.data = data;
    }

}

module.exports = { TxInput }