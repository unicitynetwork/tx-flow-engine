import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { JsonRpcNetworkError } from '@unicitylabs/commons/lib/json-rpc/JsonRpcNetworkError.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { SparseMerkleTree } from '@unicitylabs/commons/lib/smt/SparseMerkleTree.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { DirectAddress } from '../../src/address/DirectAddress.js';
import { ISerializable } from '../../src/ISerializable.js';
import { MaskedPredicate } from '../../src/predicate/MaskedPredicate.js';
import { PredicateFactory } from '../../src/predicate/PredicateFactory.js';
import { UnmaskedPredicate } from '../../src/predicate/UnmaskedPredicate.js';
import { StateTransitionClient } from '../../src/StateTransitionClient.js';
import { CoinId } from '../../src/token/fungible/CoinId.js';
import { TokenCoinData } from '../../src/token/fungible/TokenCoinData.js';
import { Token } from '../../src/token/Token.js';
import { TokenFactory } from '../../src/token/TokenFactory.js';
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
  tokenData: TestTokenData;
  coinData: TokenCoinData;
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
        .catch((err) => {
          if (err instanceof JsonRpcNetworkError && err.status === 404) {
            timeoutId = setTimeout(fetchProof, interval);
          } else {
            throw err;
          }
        });
    };

    fetchProof();
  });
}

async function createMintTokenData(secret: Uint8Array): Promise<IMintTokenData> {
  const tokenId = TokenId.create(crypto.getRandomValues(new Uint8Array(32)));
  const tokenType = TokenType.create(crypto.getRandomValues(new Uint8Array(32)));
  const tokenData = new TestTokenData(crypto.getRandomValues(new Uint8Array(32)));
  const coinData = new TokenCoinData([
    [new CoinId(crypto.getRandomValues(new Uint8Array(32))), BigInt(Math.round(Math.random() * 90)) + 10n],
    [new CoinId(crypto.getRandomValues(new Uint8Array(32))), BigInt(Math.round(Math.random() * 90)) + 10n],
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
    coinData,
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
    const client = new StateTransitionClient(new TestAggregatorClient(new SparseMerkleTree(HashAlgorithm.SHA256)));
    const secret = new TextEncoder().encode('secret');
    const mintTokenData = await createMintTokenData(secret);
    const mintCommitment = await client.submitMintTransaction(
      await DirectAddress.create(mintTokenData.predicate.reference.imprint),
      mintTokenData.tokenId,
      mintTokenData.tokenType,
      mintTokenData.tokenData,
      mintTokenData.coinData,
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
      mintTokenData.coinData,
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
      recipient.toJSON(),
      crypto.getRandomValues(new Uint8Array(32)),
      await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode('my custom data')).digest(),
      textEncoder.encode('my message'),
      token.nametagTokens,
    );

    const commitment = await client.submitTransaction(
      transactionData,
      await SigningService.createFromSecret(secret, mintTokenData.predicate.nonce),
    );
    const transaction = await client.createTransaction(commitment, await waitInclusionProof(client, commitment));

    const updateToken = await client.finishTransaction(
      token,
      await TokenState.create(recipientPredicate, textEncoder.encode('my custom data')),
      transaction,
    );

    console.log(JSON.stringify(updateToken.toJSON()));
  }, 15000);

  it('should import token and be able to send it', async () => {
    const client = new StateTransitionClient(new TestAggregatorClient(new SparseMerkleTree(HashAlgorithm.SHA256)));
    const secret = new TextEncoder().encode('tere');

    /*
    442865be053688cf7cd912eca2e5f3f460faf055e1dcc0eadb22054285b8b0a3
     */
    let token = await new TokenFactory(new PredicateFactory()).create(
      JSON.parse(
        '{"coins":[["e2307daa9446fe53a8de61f804269059a6ee8898f8d12c8fd3f6575225840fb7","99"],["bf7d3a0ddfc3022bec46c06a9cb26c88c97dd6e90210013ba078dd02c2f012aa","99"]],"data":"0ee640764ce7ca0449d6e1f263ca170bea43d7322e61c884a00b653a86e15f26","id":"006593e0f33b838ae569cfcf3f16d3b6a19e3330b302cb8b3788091b70c842a2","nametagTokens":[],"state":{"data":"6d7920637573746f6d2064617461","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"9cf0cfdc190d5eecd0b690a4f3d5d11e9fd0563c8dba297f84428c3f87143fd9","publicKey":"03eb95b7e2bd9d1f307770ec72cc6e07e3ccd067653f027af88facddc72d02cb1a","type":"MASKED"}},"transactions":[{"data":{"dataHash":"000081ebec414ff5647f08e6103389e130313935562814a854429fefd75740634680","reason":null,"recipient":"DIRECT://0000d72a98a14efb7b21fe037ac7e7aa6de7483c1125a242b0e816ff76660a0a65010b0e5742","salt":"774e0507692a5ada9dc6808d72a79be11684ac5ad2abd4f7924e3280d774f3ce"},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"02ce60096a468a51d44cea0116dbfd6640c46426d8283272c3bd0948ee547fc1db","signature":"19018d024437d3106a637b58ae39c135de765d419bb471248b3f7b4882f795ac1ed8cbe3cbc7aa7e9445982e5698b0ab76e5048230344159701dc5bdb80a34a301","stateHash":"0000385e1e9229b522c3a78656f45a32280a419ac64f2ae33fc202a5d39eabc63bd3"},"merkleTreePath":{"root":"0000d554429d5841708a1f1858d2f999acff55c767c4968f01a1aaa6632778b5ba4c","steps":[{"path":"7588661171320875577771111665064028906582598478126676189805465953542964960135651051","value":"0000557d36234e13f8c2c9c99c93184f98491d334685c7e570deb6ca8ca5461dc283"}]},"transactionHash":"0000d44ec9fd58fd5630d1a6e560eab5dc7abcb4fc15d5396053df38cb9cff88dd43"}},{"data":{"dataHash":"0000371dd350eb385a9eb4ccf52c532b9f2fb5b24834ea634f4c27739b604cb08102","message":"6d79206d657373616765","nameTags":[],"recipient":"DIRECT://0000862732d0a72e201ce7e26ccfafea129cf1edf94b4db9f8a1142625209cf978a9d61d4e77","salt":"88e70d932cec62540d078ceb37b5181d89ddbdb511377c8827c8f67cf2a7598a","sourceState":{"data":"a057f4c4fc762ece6032f360f4fb04e6009a6cce460dc6256d54355c2e7a3250","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"4406a2e5e0e5d347d669805f2c822dbfac9d906107d7a312758f8c35e543162d","publicKey":"03e54f6a020fd9d874ca90a2cf724fee48a7e099b5d8d5198629cfe073ce0cb4ac","type":"MASKED"}}},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"03e54f6a020fd9d874ca90a2cf724fee48a7e099b5d8d5198629cfe073ce0cb4ac","signature":"f1e865e286cfc98c97cd41236c2863c92dd2cc6a8e8e7916cb794295726ee61e0610fc46f27024da716b3a181a7c5b8ec3b1efe2c5b9f0cd4881ed127123c58c01","stateHash":"00008908d48dd35ff3c950a8a1a00034c0b54a395e2ff2ff572dd14894510eb04471"},"merkleTreePath":{"root":"0000711f201e385a105de49ad4faec9983f9232704181931c0b47996c2b0567a4b56","steps":[{"path":"7588618734238675657396070670133980874336249309727613592514860472607364681364566806","sibling":"0000fece98de3714f7f1f1dcf1d32da20d2bd3788bee7c9f3b4394c9a2570c003a5c","value":"000097e0f970194dfa5fd657f9c0493e973985fd4f2ec3c52573dc8946d51b9986b9"}]},"transactionHash":"000096402cd88b916f6c823d3dc4ae0da8324ebb3ae06b86c855ec9b74d2160c6281"}}],"type":"39171ef087bb5e1a4b360b9032998ec1b9b4cd626bcae7178f246fa7e212ad00","version":"2.0"}',
      ),
      TestTokenData.fromJSON,
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
      recipient.toJSON(),
      crypto.getRandomValues(new Uint8Array(32)),
      await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode('new custom data')).digest(),
      textEncoder.encode('sending via public address'),
      token.nametagTokens,
    );

    const tokenPredicate = token.state.unlockPredicate as MaskedPredicate;
    const commitment = await client.submitTransaction(
      transactionData,
      await SigningService.createFromSecret(secret, tokenPredicate.nonce),
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

class TestTokenData implements ISerializable {
  public constructor(private readonly _data: Uint8Array) {
    this._data = new Uint8Array(_data);
  }

  public get data(): Uint8Array {
    return new Uint8Array(this._data);
  }

  public static fromJSON(data: unknown): Promise<TestTokenData> {
    if (typeof data !== 'string') {
      throw new Error('Invalid test token data');
    }

    return Promise.resolve(new TestTokenData(HexConverter.decode(data)));
  }

  public toJSON(): string {
    return HexConverter.encode(this._data);
  }

  public toCBOR(): Uint8Array {
    return this.data;
  }

  public toString(): string {
    return dedent`
      TestTokenData: ${HexConverter.encode(this.data)}`;
  }
}
