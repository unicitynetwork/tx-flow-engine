import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { SparseMerkleTree } from '@unicitylabs/commons/lib/smt/SparseMerkleTree.js';

import { DirectAddress } from '../../src/address/DirectAddress.js';
import { Commitment } from '../../src/Commitment.js';
import { MaskedPredicate } from '../../src/predicate/MaskedPredicate.js';
import { PredicateFactory } from '../../src/predicate/PredicateFactory.js';
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
      await new DataHasher(HashAlgorithm.SHA256).update(mintTokenData.data).digest(),
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
      await SigningService.createFromSecret(secret, nonce),
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

    const token = await StateTransitionClient.importToken(
      JSON.parse(
        '{"data":"012de71852476891d98352defdac8f828d80edb1dc00419e20f0a9f1e3e44167","id":"31c450d18cfc7d56b32fb0e38531af317775c3e711032615678e2dab91ee1cef","nametagTokens":[],"state":{"data":"6d7920637573746f6d2064617461","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"a515025f10270e9ad9a71bc1f4c28a0cdd686d33fc2aa038ac75dfa2fd1f7423","publicKey":"03f4f60495367d92f4030135eb3530ab18be92e97e812127032c24982144acea7d","type":"MASKED"}},"transactions":[{"data":{"dataHash":"00005ae8be02e1e299a2bfad71941005a81fe5b5828a1cc98cff4acfd01f04d5897d","recipient":"DIRECT://0000b86457d39d2b614b79483fc38a863792a35c8f4b81fc6deceafdb77c95e68251dbfa1346","salt":"9edee8cdfaf9dca2066df49edb68bc9350b95d01a44e11879c95edcbdcd05237"},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"02acc23408c6e21382a684803f94689f96a4f085b743e9e2c2be9767dbfeadde41","signature":"254b84ac1952ad2d3b3acc321f971df77e7baa0ba9bfa44d4e61ad3b9d15895d6b3e229e48798d7ffea1dcbf393872e385fbb75309e50b874361612a30cca62e01","stateHash":"0000b826cdf84c904d0ee35d79f56a9479a930c52b9959dabb045553d0d293f8d4aa"},"merkleTreePath":{"root":"000085e16f3374ef1653d04d8a28f5d027d0774167288dbabc1680fd9ae98c42f630","steps":[{"path":"7588659670344186629012858818095711749844454688708757440022984396986517177556193123","value":"0000b8569b7a239889d2488fdf20e792ad9216d451ac474be1da2c2e23e3db805844"}]},"transactionHash":"00006b092f3c0b08f4ba4884cf6ee8f54beac77bbd4a19aa61ed30802f5982a7d1c6"}},{"data":{"dataHash":"0000371dd350eb385a9eb4ccf52c532b9f2fb5b24834ea634f4c27739b604cb08102","message":"6d79206d657373616765","nameTags":[],"recipient":"DIRECT://0000fe4d3361dee2daf43a41caabc3ed1be6dad976da913c09ae489430ae16b3deaf76ca0f45","salt":"f435617e78668c43aef47b4a497bdfc92f5d4c07644f9a9b28257869ea9bb916","sourceState":{"data":"fbf13af78e4f055c28864de609306d63d2a3307ac39aba7eb7ab5f011723f3b3","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"59777d5f9f4e577e4299d2f6da4a238bf35ceed7f1fd77ca3c839d2eb40dfe76","publicKey":"034374f073554729f0a6097d9319184ab8b1febec01500090e9ba7e15b6abf66f1","type":"MASKED"}}},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"034374f073554729f0a6097d9319184ab8b1febec01500090e9ba7e15b6abf66f1","signature":"88a7a40caf951f2d7fbc32ee9ecf3e5534ad0e7edd6c9e797b09d4f220e6afaf0b5d1e9227a8db1b0f710f0a13fade93ec1648372360e48c29745e49d02025eb01","stateHash":"0000308864c16a98ccc0a3bb6150e431752c03ed95f487ea1da74cc03e338f8cb80f"},"merkleTreePath":{"root":"0000b87c1d477843d61e5d9bd201aa281c0638306ba923a58650f43608c60af243f9","steps":[{"path":"7588612394869685092847960266709834459879985770212066322495333453654897908457770446","sibling":"0000cad586fac3ab72d7337b710a9b91aabc3e3ebb74ffcf4beda80122aa1d0f555c","value":"000022dad25824223ae160e336baa3735250f19ef46156051798437f9f2da062c694"}]},"transactionHash":"0000eaaee757a201e43d3b21521d323db27ffe4640f771867900e771a22a76da9cff"}}],"type":"041f0edb0b2ba9993b813b4df90f12371d3687dfa96d24bc19f2d204e46489fe"}\n',
      ),
      new PredicateFactory(),
    );

    console.log(token.toString());
  }, 15000);
});
