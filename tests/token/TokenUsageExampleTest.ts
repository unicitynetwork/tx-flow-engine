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
  const tokenData = new FungibleTokenData(
    new Map<string, bigint>([
      ['eek', 500n],
      ['eur', 10n],
    ]),
  );
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
      await new DataHasher(HashAlgorithm.SHA256)
        .update(
          new FungibleTokenData(
            new Map<string, bigint>([
              ['eur', 2n],
              ['usd', 1n],
            ]),
          ).encode(),
        )
        .digest(),
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
      await TokenState.create(
        recipientPredicate,
        new FungibleTokenData(
          new Map<string, bigint>([
            ['eur', 2n],
            ['usd', 1n],
          ]),
        ).encode(),
      ),
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
        '{"data":"82826365656b1901f482636575720a","id":"2e430cbd088916dc62bc57e65c92ab6f73731c33dfbff053fcfa50a5196787a2","nametagTokens":[],"state":{"data":"82826365757202826375736401","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"5df1b670322c0f10a49c554087596bfd3cd59a86de00814efc3c905765de67eb","publicKey":"0263e4987fd504f1a073209c6cf30d37172e2bfc7d81d58a9e92a3173973b68f62","type":"MASKED"}},"transactions":[{"data":{"dataHash":"00006554f2a75cced6c49d2ad5367dd732f95ab9d818d6d59c34b5b953fd40882689","reason":null,"recipient":"DIRECT://00004f986431e159e95ecce6f2fe252f80211fe0d773956f012fc15b6c7d23936e95f12c4605","salt":"bc08b2cd11525c9c551b60648728fffe16169214eb35db9e82d5acecd6c190cf"},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"034567b537ba9acb38437eaefffc5797c95edc0b95b5132e38d703a10ae5c93c6d","signature":"130eaead92954ba6b1ba86d2d0c0727941a3d955b2d2b412d6d36c1b424249a8122f101ad465879f765572bfcf9975ce03a129b17065b25c88a7068e6380f8a300","stateHash":"0000965ece5854258568ae320e7576485504e31b2c28d58f8d1fe425b81f9c0fb0f6"},"merkleTreePath":{"root":"00000fb023d49193eefa788f0544381c8a2e9daa33d4b786a4c5033d5f27e7639016","steps":[{"path":"7588629868121842173021423316218956952243178822756349597740422075004907794745651124","value":"00006a9cd1d2b2ab2a1908aae651bdb7a304264d282c8f0ec7b3eed22f89b9b9f90a"}]},"transactionHash":"0000102ed54cd4af9027bc76d047f48c817707699b00cd723de76c2e98f41e8ec4c1"}},{"data":{"dataHash":"0000c9a28a652cbed2dd15103ddc6d085b14a6ba04da769ffccc85bc4d0266cb88ae","message":"6d79206d657373616765","nameTags":[],"recipient":"DIRECT://00007e633cabd0db0a3be95d224f60e89014e55407224b82d1ea5203d622a8540c9f27272ee2","salt":"706cf426e2d9ac2f656a36d901b74b154ab7d9061a4c2a986cc936e99b854f30","sourceState":{"data":"1aafe4447b441db409dfcb5e7a029f9a5af47ec35938b67b221d4a6de5774b76","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"2db0fc521dbf74ce7a31ef44b8c8b1a625712fa8cee251514138a590de431c6f","publicKey":"039ffe440a0bfb66aff0155e34e39bc92633169371214a75b08015af76903cdeaa","type":"MASKED"}}},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"039ffe440a0bfb66aff0155e34e39bc92633169371214a75b08015af76903cdeaa","signature":"99e9b79c131f3e58fcf82d134aabe6e0e27d33457786c8593ff96c60c77217b739ea0f547feb643ef9ac6f8f7605b74736be848c79aaa6e216dcabd764a463c900","stateHash":"000056d43c38e2517ed727d550dd68da8853d3206716a4685b1e1ca33deca98b89cc"},"merkleTreePath":{"root":"00005dc97e7fef9ab3299e9a2a0c6f8da1ba044a5d296a34c1a3c392ae052197cdd2","steps":[{"path":"7588623464028811210861142444893060754642789550412092213324948429399910310300249525","sibling":"000082907c36cff88d3d129a0ec1e3f4c85cd25926e54eeeb8883644952c5e438899","value":"00009c4a72e98ddeb32e9641c51018400f19a351c131cce8af980972716b2ba4ac38"}]},"transactionHash":"000002085bddf395cc72b8720319bbaae82b8a73d183888fe88fcb4d5f96dda4f100"}}],"type":"4eaed499952d227ef00b1fb14cb5293c498c2876c17709a8648cdb0f33739d80"}',
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
      await new DataHasher(HashAlgorithm.SHA256)
        .update(new FungibleTokenData(new Map([['eur', 50n]])).encode())
        .digest(),
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
      await TokenState.create(recipientPredicate, new FungibleTokenData(new Map([['eur', 50n]])).encode()),
      transaction,
    );

    console.log(token.toString());
  }, 15000);
});
