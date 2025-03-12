import { StateTransitionClient } from "../../src/StateTransitionClient.js";
import { TokenId } from "../../src/token/TokenId.js";
import { TokenType } from "../../src/token/TokenType.js";

describe('Transition', function () {
  it('should verify the token latest state', async () => {
    const client = new StateTransitionClient();
    const token = await client.mint(
      TokenId.create(crypto.getRandomValues(new Uint8Array(32))), 
      TokenType.create(crypto.getRandomValues(new Uint8Array(32))),
      new Uint8Array(),
      new Uint8Array(),
      new TextEncoder().encode('secret'),
      crypto.getRandomValues(new Uint8Array(32)),
      crypto.getRandomValues(new Uint8Array(32))
    );

    console.log(token.toString());
  });
});
