
class Transition {

    constructor(source, input, destination){
	this.source = source;
	this.input = input;
	this.destination = destination;
    }

    execute(){
	this.source.challenge.verify(input, destination);
    }

}
