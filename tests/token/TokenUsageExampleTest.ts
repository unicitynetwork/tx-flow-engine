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
      recipient.toDto(),
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

    console.log(JSON.stringify(updateToken.toDto()));
  }, 15000);

  it('should import token and be able to send it', async () => {
    const client = new StateTransitionClient(new TestAggregatorClient(new SparseMerkleTree(HashAlgorithm.SHA256)));
    const secret = new TextEncoder().encode('tere');

    let token = await new TestTokenFactory().create(
      JSON.parse(
        '{"coins":"8282784065666538393365313563643239613565626236383363383133333232376531643162383465396435356438613465376463373566396437363265646539333761184a827840376665366664326661373437373736363037336630613735363934313833646533356336333232396362613736363632366135616265393938333239366663351849","data":"55a2039369747e513ec52fc785e4332466e99d7895e8b93ef60b2b7a6c5ebb60","id":"8f051698bc608b4212799af8d4101e4ecdc3c4a79875e26e0f8a96314b742fc0","nametagTokens":[],"state":{"data":"6d7920637573746f6d2064617461","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"06fd8259729b5ceff83a243cc7004cbb9c7299aac7903109efc3b320df7ea46a","publicKey":"024fd11e5a1601aa0e3b44e3c38378789b4889d3b0edeaa108f5374bbea97c1880","type":"MASKED"}},"transactions":[{"data":{"dataHash":"0000cd798106e367051de52c58c2570654c08457db5ea88372d88c0667ec5ba1ee2b","reason":null,"recipient":"DIRECT://0000e06706e005ae77af03e68337498180d426fd10a0962903bf30778695019cc268a039fa80","salt":"581147be23e6db30675b34e32e8b9f83c42f3dd9438857795a7793d236019ebd"},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"034734c06faabf0fd4678a2385507647f1c5de059c459dfeaf12bad1e4e7777f88","signature":"b719243cd1c20c21a738a06ddf337f38b1ac8b1dbf5686abd8039e75de91d7cc4c127a794067dfc3c8e332fa849ce095056aad25bc6e751b653e32974e0299af01","stateHash":"0000b907450f3aea55a489f89e591191e23be1fa0a3fc8c38593d530bc528449384f"},"merkleTreePath":{"root":"00007c7bd5749a48c5196815ade3bb5b4ba2ad4e552fd1e9f316c08a4b7bbe3df11d","steps":[{"path":"7588583787075137615614200187279234761188054928514090795834318452222291284236768822","value":"0000d8b9d10a3e1b6794fa8731f931105cea60c9b02b944ac260d39eb8703d51d9a1"}]},"transactionHash":"0000ea0d167db407b34e4a0a7f3ef19e84efa62c86a100556783658a4ce7a368ff28"}},{"data":{"dataHash":"0000371dd350eb385a9eb4ccf52c532b9f2fb5b24834ea634f4c27739b604cb08102","message":"6d79206d657373616765","nameTags":[],"recipient":"DIRECT://00005000623ab227763ee71c0e2cee4793b4ed103d07a62b7d3f0b2e40177a1536a34f65756a","salt":"bfdff35cb7cf6bb9e9048e1f39fa07cd6d0fa18af0250dca9119705bda8cf87b","sourceState":{"data":"b6eba5e1ffca19abc1167bf44989d0e007a178bb822f4ee62a617aed29023fac","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"899567b1fc3b8db30032a1c0a7121ed05fa3e0321c6f5d4371f1cb2b4541e3c0","publicKey":"031a038b3b256cee466ce9a761f04522384aa1d5becb67e0dc2ede717a1e05e0d2","type":"MASKED"}}},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"031a038b3b256cee466ce9a761f04522384aa1d5becb67e0dc2ede717a1e05e0d2","signature":"bfa35d1e5389af7f5fec1b2199582de1a32ad04f8332f3375768092e2bdd895b009bf21748f02dda28b670ee427aaa98f71335c631b5d6afff6b5d3750190cc701","stateHash":"0000721c65078cf73f750004db64b8ac5041d2b5cc221e2c853ce082b3faf4d26638"},"merkleTreePath":{"root":"0000475f90b5296710ec788a8a333f7ac5df9cc7d0965c5b4145c520de3d738a3935","steps":[{"path":"7588569218088438164672559934214159214370139797979814927050276356134513515792040107","sibling":"00002dcec6f7ea94cfe638a188fb92959bb6bf3128507e0eab7412b75186ee27d7b6","value":"00006836b376aa8b668eed4149afb4819c1536080559ab0bf713502e9b8a8a49c893"}]},"transactionHash":"00004a01e29ed90ca54a65c36c5ed1c125d88090c2b2e31fca26647569583182601b"}}],"type":"477e128b5cc280f5f8b957260678cb7d457396ff55e4e6c823d22a70c5e4ea37","version":"2.0"}',
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

  public static decode(data: Uint8Array): Promise<TestTokenData> {
    return Promise.resolve(new TestTokenData(data));
  }

  public encode(): Uint8Array {
    return this.data;
  }

  public toString(): string {
    return dedent`
      TestTokenData: ${HexConverter.encode(this.data)}`;
  }
}

class TestTokenFactory extends TokenFactory<TestTokenData> {
  public constructor() {
    super(new PredicateFactory());
  }

  public createData(data: Uint8Array): Promise<TestTokenData> {
    return Promise.resolve(new TestTokenData(data));
  }
}
