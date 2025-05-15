import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { SparseMerkleTree } from '@unicitylabs/commons/lib/smt/SparseMerkleTree.js';

import { DirectAddress } from '../../src/address/DirectAddress.js';
import { ISerializable } from '../../src/ISerializable.js';
import { MaskedPredicate } from '../../src/predicate/MaskedPredicate.js';
import { UnmaskedPredicate } from '../../src/predicate/UnmaskedPredicate.js';
import { StateTransitionClient } from '../../src/StateTransitionClient.js';
import { FungibleTokenData } from '../../src/token/fungible/FungibleTokenData.js';
import { FungibleTokenFactory } from '../../src/token/fungible/FungibleTokenFactory.js';
import { FungibleTokenId } from '../../src/token/fungible/FungibleTokenId.js';
import { Token } from '../../src/token/Token.js';
import { TokenId } from '../../src/token/TokenId.js';
import { TokenState } from '../../src/token/TokenState.js';
import { TokenType } from '../../src/token/TokenType.js';
import { Commitment } from '../../src/transaction/Commitment.js';
import { MintTransactionData } from '../../src/transaction/MintTransactionData.js';
import { TransactionData } from '../../src/transaction/TransactionData.js';
import { TestAggregatorClient } from '../TestAggregatorClient.js';

const textEncoder = new TextEncoder();

interface IMintTokenData {
  tokenId: TokenId;
  tokenType: TokenType;
  tokenData: FungibleTokenData;
  data: Uint8Array;
  salt: Uint8Array;
  nonce: Uint8Array;
  predicate: MaskedPredicate;
}

function waitInclusionProof(
  client: StateTransitionClient,
  commitment: Commitment<TransactionData | MintTransactionData<ISerializable | null>>,
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

  const tokenData = new FungibleTokenData([
    [new FungibleTokenId(textEncoder.encode('eek')), 500n],
    [new FungibleTokenId(textEncoder.encode('eur')), 10n],
  ]);
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
      await new DataHasher(HashAlgorithm.SHA256).update(mintTokenData.data).digest(),
      null,
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

    const nonce = crypto.getRandomValues(new Uint8Array(32));
    const recipientPredicate = await MaskedPredicate.create(
      token.id,
      token.type,
      await SigningService.createFromSecret(new TextEncoder().encode('tere'), nonce),
      HashAlgorithm.SHA256,
      nonce,
    );
    const recipient = await DirectAddress.create(recipientPredicate.reference.imprint);

    const transactionData = await TransactionData.create(
      token.state,
      recipient.toDto(),
      crypto.getRandomValues(new Uint8Array(32)),
      await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode('my custom data')).digest(),
      textEncoder.encode('my message'),
      token.nametagTokens,
    );

    const commitment = await client.submitTransaction(
      transactionData,
      await SigningService.createFromSecret(secret, token.state.unlockPredicate.nonce),
    );
    const transaction = await client.createTransaction(commitment, await waitInclusionProof(client, commitment));

    const updateToken = await client.finishTransaction(
      token,
      await TokenState.create(recipientPredicate, textEncoder.encode('my custom data')),
      transaction,
    );

    console.log(JSON.stringify(updateToken.toDto()));
  }, 15000);

  it('should import token and be able to send it', async () => {
    const client = new StateTransitionClient(
      new TestAggregatorClient(await SparseMerkleTree.create(HashAlgorithm.SHA256)),
    );
    const secret = new TextEncoder().encode('tere');

    let token = await new FungibleTokenFactory().create(
      JSON.parse(
        '{"data":"8282663635363536621901f482663635373537320a","id":"9cf238dc754c556024ad7b391826f080fa430b49b848ab7fd57b38a2436f69cb","nametagTokens":[],"state":{"data":"6d7920637573746f6d2064617461","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"fa78f11b790cd350b446e18be9a8d78cd97791ea9f38729a27cb3f6dbda153da","publicKey":"02f3f75f1e4d91b984ee9ddf4836b476b314f226b4d3b51354c5f33bf2732b069d","type":"MASKED"}},"transactions":[{"data":{"dataHash":"00008d01773f5ade74659e56293d24dbc798b34ae339c33a6676de12660185df3f8c","reason":null,"recipient":"DIRECT://00008b73718ab4c27ea8beb913e5eeee4f5fbecb5f6e4ac03102cb4fb314079e0af3e4a85e83","salt":"d342381c1ff038c7e94e6659ead79b54d2898b10a585c05cccc206343e371249"},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"02d57702fa1972b4a544a4f94d5483a18361e44065a35113b136fd7545ac8b263b","signature":"4f12a5ff5260667dcc3019000a859b0d7a4cb5ead01ab9f165de6c089beb95a05460f1a31666e709cce8513d77a3c8cef0142f38c90f8f97abe65c61c08cfef900","stateHash":"0000f6cc8d3e6de041f268b9fab84828cc832e94b42e87b8261a766bf099808779c3"},"merkleTreePath":{"root":"0000493db687d05cc7436af66328fd7dbe5810e203432f08f0eb6b8ffa5bd78aefb6","steps":[{"path":"7588563511889657514561093981173428001444021446474236730515388545153034039253937714","value":"0000730372a7b56b43736a3d5fb82cc9d823b5c114c90fd68c410917277cfedf95cc"}]},"transactionHash":"000025842c7fec0d87b14f539951ac96ac4df0702ab50201ddc17aaf73d6d143e30f"}},{"data":{"dataHash":"0000371dd350eb385a9eb4ccf52c532b9f2fb5b24834ea634f4c27739b604cb08102","message":"6d79206d657373616765","nameTags":[],"recipient":"DIRECT://0000e7e3dac63b5115f39265decacd1b87294e3ddb019f928dbd494eec61c8352fc32ab41e64","salt":"c254a704868e4149cdf735ba8994b51a31faf6d089631bca837f4da7820cf5c9","sourceState":{"data":"68bde33f9e651a7d6addd0960dab26e79a848d56c7f6f1e0bb7bcbb066fe0296","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"13814ac2293150550e7acaed86f4b18684550de9df220d9566a6d13adace05b7","publicKey":"03946227c9082b64428fd415c3a64576cfa55bd6d2ed2664a5fc252eedd6035867","type":"MASKED"}}},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"03946227c9082b64428fd415c3a64576cfa55bd6d2ed2664a5fc252eedd6035867","signature":"04d9ab5987b0c315e27e19766d7fd8b5ffc0ce71ce5ec24780d6e8e1a7d3ee584729fc7a4cd2a2a21952c8daacf43cb65ae36c53d43dd40ddfacd96474548ee100","stateHash":"00006f29b45e80d18accfaa140501464dc44f9711935f62844d78e6202826b6e79f2"},"merkleTreePath":{"root":"0000869e59d308051faf645330720d95b63994e6366fdef2ad42dd2ebcc007291eb9","steps":[{"path":"7588643891841088573183397231728991467132111183916733170066325338800411728546396281","sibling":"0000bc81073c7ff702f9321615adaa0de4ea941edf1182be80a609d755481ac73ca8","value":"00009ef45e724266e79e481609c9cde2a166bebeed6b0bdbdb362ebc0ab3bb5f5cf9"}]},"transactionHash":"0000a2edf6f306eb8993da6bac710efd90769a35cf828d6734716e9f85ca918156dc"}}],"type":"449744c3eb7d88ea592c8ec9d4fc118539493ca526f0bf000b1a85df65e14ba1","version":"2.0"}',
      ),
    );

    const salt = crypto.getRandomValues(new Uint8Array(32));
    const recipientPredicate = await UnmaskedPredicate.create(
      token.id,
      token.type,
      await SigningService.createFromSecret(textEncoder.encode('nextuser')),
      HashAlgorithm.SHA256,
      salt,
    );
    const recipient = await DirectAddress.create(recipientPredicate.reference.imprint);

    const transactionData = await TransactionData.create(
      token.state,
      recipient.toDto(),
      crypto.getRandomValues(new Uint8Array(32)),
      await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode('new custom data')).digest(),
      textEncoder.encode('sending via public address'),
      token.nametagTokens,
    );

    const commitment = await client.submitTransaction(
      transactionData,
      await SigningService.createFromSecret(secret, token.state.unlockPredicate.nonce),
    );

    const transaction = await client.createTransaction(commitment, await client.getInclusionProof(commitment));

    token = await client.finishTransaction(
      token,
      await TokenState.create(recipientPredicate, textEncoder.encode('new custom data')),
      transaction,
    );

    console.log(token.toString());
  }, 15000);
});
