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
        '{"data":"8282663635363536621901f482663635373537320a","id":"3e535b3d35f8e2b6b3915f54854d35e499df6b19df89f0b9e580163bbf43ef80","nametagTokens":[],"state":{"data":"6d7920637573746f6d2064617461","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"c1075fe0e7e1ae54eafbb7614e122c64185fba2571f24954630ea8ab57bd008b","publicKey":"02dac8c79b8135d1261e5a450fcfff18222e52b302a9bfef82d68caaac070b8f5a","type":"MASKED"}},"transactions":[{"data":{"dataHash":"00000c033492589eea554e56c11088d60ff158d0d2077e61c829cf3271132a872f86","reason":null,"recipient":"DIRECT://0000a43fd1d32c16c29a12024d22c9af938187fd14b53f42367891ee86b7f15c38f2f72da9ac","salt":"d0838ae829b4ede1a285e7be57029e042881bb38885915f6f3b20d5247ad2a0e"},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"025f8a8673332779692d6868b72763a322a9a9c681d6438e2f39cd96bed6a934ee","signature":"31aab6b9e7b1c3578a49fbeaad21077a7e339018522cc3ba188d345884da40eb52ce13bdcd55df1e66439a146dc1bea1fe1b1c010d0f22b69b39c695379fe68601","stateHash":"00001028ad32b65ef27ed14026145b184cd9c8376705e70703b0648e2f1aec7d2f9b"},"merkleTreePath":{"root":"0000d454dfa3c47091ff11f9eaae46463a98ff2c08adaa76c3ee004ba7897fbb0da1","steps":[{"path":"7588584527235268953552198145401369955789677562524053959012616983331757203180781280","value":"0000b4b946fe3a78605b91c491fafd95bee4286fb0cc4f00b997946e53df7b24547f"}]},"transactionHash":"0000e7fa738ffde67706f19e732bd62a2b782e8293776fc4561628658aef4204e4f3"}},{"data":{"dataHash":"0000371dd350eb385a9eb4ccf52c532b9f2fb5b24834ea634f4c27739b604cb08102","message":"6d79206d657373616765","nameTags":[],"recipient":"DIRECT://000000ace5c7d7e7ce05d7a38f15bc1db25a0f23ee6356d6a48f1e44c0fcedbb51d5e6468e2b","salt":"aeb5f407247c4dc9c236938e3deb56097e09a23051ce3c7c338596395b7e5576","sourceState":{"data":"be9c31ca6c33414bf991f756084ea75f15f016d1fc492208e841d8dd5b852a2c","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"35f552bb768c3391c4ba23fa96889366a53382f1bab1bd753461b9bf6058b991","publicKey":"03f80db014d0cc3523e8e0d9a72cc8dd46512387487d371daa655ae6db376e3a4a","type":"MASKED"}}},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"03f80db014d0cc3523e8e0d9a72cc8dd46512387487d371daa655ae6db376e3a4a","signature":"ee04fbefb1ffffbd139ec35334c97210a97f9c661c61298e9fe696d63d0b575a535136f67844b8cc08721190a4eb558c21c192512a5610ff10bf8368b0b5185900","stateHash":"0000d6ce3758dfd7bb456fd1285a6babd8f17d0a95d1e12ad0c2ba7a837e6acd6055"},"merkleTreePath":{"root":"00004a919a1fe38d9e9d5652c5154fb84f29c8e53c0ec07160c9879e2d4031cbb9b8","steps":[{"path":"7588626314569424892417130597639163719348160026245989349703529968076829853881889989","sibling":"000065a7865bd26afa85fd48e54e775cdc4ed300318671347dfa838c1dbbc9b4a593","value":"00009546768189cf90c4cc5eed6be5945a3bd541f4f9d53f95b6aeb513d9af868186"}]},"transactionHash":"0000692198efd7ea16d60253c3f389cfb416f8abbfe0d9ae360a5d1d84f0ec5c33e4"}}],"type":"08215236af953d81fc57b7ac0c7bcbc6d2103e580f7783b5bfb50cc61059dff1","version":"2.0"}',
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
