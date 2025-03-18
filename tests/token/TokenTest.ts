import { HashAlgorithm } from "@unicitylabs/commons/lib/hash/HashAlgorithm.js";
import { OneTimeAddress } from "../../src/address/OneTimeAddress.js";
import { StateTransitionClient } from "../../src/StateTransitionClient.js";
import { TokenId } from "../../src/token/TokenId.js";
import { TokenType } from "../../src/token/TokenType.js";

const textEncoder = new TextEncoder();

describe('Transition', function () {
  it('should verify the token latest state', async () => {
    const client = new StateTransitionClient('https://gateway-test1.unicity.network:443');
    const secret = new TextEncoder().encode('secret');
    const token = await client.mint(
      TokenId.create(crypto.getRandomValues(new Uint8Array(32))), 
      TokenType.create(crypto.getRandomValues(new Uint8Array(32))),
      new Uint8Array(),
      new Uint8Array(),
      secret,
      crypto.getRandomValues(new Uint8Array(32)),
      crypto.getRandomValues(new Uint8Array(32))
    );

    await client.createTransaction(token, await OneTimeAddress.create(token.type, secret, crypto.getRandomValues(new Uint8Array(32)), HashAlgorithm.SHA256), secret, crypto.getRandomValues(new Uint8Array(32)), textEncoder.encode('my custom data'), 'my message');

    console.log(token.toString());
  });
});
