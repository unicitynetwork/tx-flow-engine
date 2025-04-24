import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { SparseMerkleTree } from '@unicitylabs/commons/lib/smt/SparseMerkleTree.js';

import { DirectAddress } from '../../src/address/DirectAddress.js';
import { MaskedPredicate } from '../../src/predicate/MaskedPredicate.js';
import { StateTransitionClient } from '../../src/StateTransitionClient.js';
import { TokenId } from '../../src/token/TokenId.js';
import { TokenState } from '../../src/token/TokenState.js';
import { TokenType } from '../../src/token/TokenType.js';
import { TransactionData } from '../../src/transaction/TransactionData.js';
import { TestAggregatorClient } from '../TestAggregatorClient.js';

const textEncoder = new TextEncoder();

describe('Transition', function () {
  it('should verify the token latest state', async () => {
    const client = new StateTransitionClient(
      new TestAggregatorClient(await SparseMerkleTree.create(HashAlgorithm.SHA256)),
    );
    const secret = new TextEncoder().encode('secret');
    const token = await client.mint(
      TokenId.create(crypto.getRandomValues(new Uint8Array(32))),
      TokenType.create(crypto.getRandomValues(new Uint8Array(32))),
      new Uint8Array(),
      new Uint8Array(),
      secret,
      crypto.getRandomValues(new Uint8Array(32)),
      crypto.getRandomValues(new Uint8Array(32)),
    );

    const signingService = await SigningService.createFromSecret(secret, token.state.unlockPredicate.nonce);

    // Recipient info
    const nonce = crypto.getRandomValues(new Uint8Array(32));
    const predicate = await MaskedPredicate.create(token.id, token.type, signingService, HashAlgorithm.SHA256, nonce);
    const recipient = await DirectAddress.create(predicate.reference.imprint);

    const transactionData = await TransactionData.create(
      token.state,
      recipient.toDto(),
      crypto.getRandomValues(new Uint8Array(32)),
      await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode('my custom data')).digest(),
      textEncoder.encode('my message'),
      token.nametagTokens,
    );

    const transaction = await client.createTransaction(transactionData, signingService);

    const updateToken = await client.finishTransaction(
      token,
      await TokenState.create(predicate, textEncoder.encode('my custom data')),
      transaction,
    );

    console.log(updateToken.toString());
  });
});
