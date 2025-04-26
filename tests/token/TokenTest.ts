import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { SparseMerkleTree } from '@unicitylabs/commons/lib/smt/SparseMerkleTree.js';

import { DirectAddress } from '../../src/address/DirectAddress.js';
import { Commitment } from '../../src/Commitment.js';
import { MaskedPredicate } from '../../src/predicate/MaskedPredicate.js';
import { StateTransitionClient } from '../../src/StateTransitionClient.js';
import { Token } from '../../src/token/Token.js';
import { TokenId } from '../../src/token/TokenId.js';
import { TokenState } from '../../src/token/TokenState.js';
import { TokenType } from '../../src/token/TokenType.js';
import { MintTransactionData } from '../../src/transaction/MintTransactionData.js';
import { TransactionData } from '../../src/transaction/TransactionData.js';
import { TestAggregatorClient } from '../TestAggregatorClient.js';

const textEncoder = new TextEncoder();

interface IMintTokenData {
  tokenId: TokenId;
  tokenType: TokenType;
  tokenData: Uint8Array;
  data: Uint8Array;
  salt: Uint8Array;
  nonce: Uint8Array;
  predicate: MaskedPredicate;
}

function waitInclusionProof(
  client: StateTransitionClient,
  commitment: Commitment<TransactionData | MintTransactionData>,
  signal: AbortSignal = AbortSignal.timeout(10000),
  interval: number = 1000,
): Promise<InclusionProof> {
  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | number;
    const abortListener = (): void => {
      signal.removeEventListener('abort', abortListener);
      clearTimeout(timeoutId);
      reject(signal.reason);
    };

    signal.addEventListener('abort', abortListener);

    const fetchProof = (): void => {
      client
        .getInclusionProof(commitment)
        .then((proof) => {
          if (proof !== null) {
            signal.removeEventListener('abort', abortListener);
            clearTimeout(timeoutId);
            return resolve(proof);
          }

          timeoutId = setTimeout(fetchProof, interval);
        })
        .catch(() => {
          timeoutId = setTimeout(fetchProof, interval);
        });
    };

    fetchProof();
  });
}

async function createMintTokenData(secret: Uint8Array): Promise<IMintTokenData> {
  const tokenId = TokenId.create(crypto.getRandomValues(new Uint8Array(32)));
  const tokenType = TokenType.create(crypto.getRandomValues(new Uint8Array(32)));
  const tokenData = crypto.getRandomValues(new Uint8Array(32));
  const data = crypto.getRandomValues(new Uint8Array(32));
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const nonce = crypto.getRandomValues(new Uint8Array(32));

  const predicate = await MaskedPredicate.create(
    tokenId,
    tokenType,
    await SigningService.createFromSecret(secret, nonce),
    HashAlgorithm.SHA256,
    nonce,
  );

  return {
    data,
    nonce,
    predicate,
    salt,
    tokenData,
    tokenId,
    tokenType,
  };
}

describe('Transition', function () {
  it('should verify the token latest state', async () => {
    const client = new StateTransitionClient(
      new TestAggregatorClient(await SparseMerkleTree.create(HashAlgorithm.SHA256)),
    );
    const secret = new TextEncoder().encode('secret');
    const mintTokenData = await createMintTokenData(secret);
    const mintCommitment = await client.submitMintTransaction(
      await DirectAddress.create(mintTokenData.predicate.reference.imprint),
      mintTokenData.tokenId,
      mintTokenData.tokenType,
      mintTokenData.tokenData,
      mintTokenData.salt,
      mintTokenData.data,
    );

    const mintTransaction = await client.createTransaction(
      mintCommitment,
      await waitInclusionProof(client, mintCommitment),
    );

    const token = new Token(
      mintTokenData.tokenId,
      mintTokenData.tokenType,
      mintTokenData.tokenData,
      await TokenState.create(mintTokenData.predicate, mintTokenData.data),
      [mintTransaction],
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

    const commitment = await client.submitTransaction(transactionData, signingService);
    const transaction = await client.createTransaction(commitment, await waitInclusionProof(client, commitment));

    const updateToken = await client.finishTransaction(
      token,
      await TokenState.create(predicate, textEncoder.encode('my custom data')),
      transaction,
    );

    console.log(updateToken.toString());
  }, 15000);
});
