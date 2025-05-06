import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { SparseMerkleTree } from '@unicitylabs/commons/lib/smt/SparseMerkleTree.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { DirectAddress } from '../../src/address/DirectAddress.js';
import { Commitment } from '../../src/Commitment.js';
import { MaskedPredicate } from '../../src/predicate/MaskedPredicate.js';
import { PredicateFactory } from '../../src/predicate/PredicateFactory.js';
import { UnmaskedPredicate } from '../../src/predicate/UnmaskedPredicate.js';
import { StateTransitionClient } from '../../src/StateTransitionClient.js';
import { ITokenData } from '../../src/token/ITokenData.js';
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
  tokenData: TestTokenData;
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
  const tokenData = new TestTokenData(crypto.getRandomValues(new Uint8Array(32)));
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
        .update(new TestTokenData(textEncoder.encode('my custom data')).encode())
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

    let token = await StateTransitionClient.importToken(
      JSON.parse(
        '{"data":"758407b15bfbc3c1ef7c6855d6ddbf393c7858a707f04afd222dab17a835930e","id":"d9d6d8f337e01540d83e494ec28a66557781f20d764d662e52bef7f01e19e2dc","nametagTokens":[],"state":{"data":"6d7920637573746f6d2064617461","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"33a5139b25197a4bcf12dee21da8f2e312cc0bcd35ec81a0a1857ba7dc57ba39","publicKey":"0298a0ac88710791ee4a4ff95469a702ddb9cba321931bf9f8f22486842fa31672","type":"MASKED"}},"transactions":[{"data":{"dataHash":"000034bc47021d1e73d1420de0f54ca29a8a760cc7aceb2158362190761b6e1981c6","recipient":"DIRECT://0000baea98cd6f64de3b2554466c7967923d82cfe51636778033d3f51d108a976ad59a6118b1","salt":"76a6f5a79c724eb6f7214ae1b5d6f729bc5ca6a1e62ce5394e0fadea3ce3d1e2"},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"032edca255a7cf75091e33493b3d3bf66c8a116e4f74b14a7a3f5a3372e831afea","signature":"47cd7394d590f8f3a1582c2054ff1c42c234cacbb69155c8a05bb09d29648d602e9c72588a7c20f9ce0d25b26f8e49bc7f3392bd80978ed35cb037ff32cf41e301","stateHash":"000004153ea8aa9f68ffbdcbb1ef7dd8a9e704426520f87480d9d497d03cf75be63c"},"merkleTreePath":{"root":"0000df2c809fd859fa223e2aef428e19edbd48a097ec4c7a6afa2b75c347a4904b14","steps":[{"path":"7588662032846288314219029533364373184854377708342567896816433383542796252199381888","value":"0000b5e2984150e3c338529a71f8c7b3d591f19c367c7e5a0e3c249a23d240ae20b4"}]},"transactionHash":"00007f088d29457c54c1e4ed08d1abb269013eb1d80b8c70c35c6bdb40c025ceb948"}},{"data":{"dataHash":"0000371dd350eb385a9eb4ccf52c532b9f2fb5b24834ea634f4c27739b604cb08102","message":"6d79206d657373616765","nameTags":[],"recipient":"DIRECT://0000e99c5b46e104b180e70a2706d307fc0d72f30324844aa6ee958a011b5ad55bbe159f66f5","salt":"ca0c452ba81d050cfeca33f513c193e2d516a2ec58d4109c4d288ecef5c13982","sourceState":{"data":"a57e73299ed3902758d78bd109d6feeca2bc1e2c9ffbb0360434f516ff7cc783","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"119424bd1f6f3b7e784411035da4485f9081684e9306502e890c3c5b8328a30d","publicKey":"03e7f6327091504c21581a17e79370b59330b1b032a25b20e1de92a5bb1339b73c","type":"MASKED"}}},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"03e7f6327091504c21581a17e79370b59330b1b032a25b20e1de92a5bb1339b73c","signature":"50c30c89c00d7a6692fb7e408705e0bcd2d37c54672f7674ac66147c519c331244f23ce3947fdf7c7a6d8d2fd86e158f876fdffcacac574be0a572075ddc3a7201","stateHash":"00004127d0f07a1e9a67376661fe2c366592deb0bd505a280e9e907b6ff68d82b247"},"merkleTreePath":{"root":"0000b2884165f724675a99cc8e5d99aa99fd098e7d50f436d4781c6094a2db546d8c","steps":[{"path":"7588555008597451979943879677176788876186012382758044848494265307990791809275607079","sibling":"00003595a2c496d136f5917640822f787340fb4b5e3f6ef211e4846676c9c9ce1b8e","value":"0000b40595ad8deaeb4c51becc99da9ea618292d4c447bdede8d51c5888ccbd97908"}]},"transactionHash":"0000a9773c709a57759cb1b12501c7d8b4065ab629e6835046ff15df7f368318670e"}}],"type":"506bc4bdf2217bac49129625873a80daf78ad0f4d2f53a0b7d1b6b7d3481dbeb"}',
      ),
      TestTokenData,
      new PredicateFactory(),
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
        .update(new TestTokenData(textEncoder.encode('new custom data')).encode())
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
      await TokenState.create(recipientPredicate, textEncoder.encode('new custom data')),
      transaction,
    );

    console.log(token.toString());
  }, 15000);
});

class TestTokenData implements ITokenData {
  public constructor(private readonly _data: Uint8Array) {
    this._data = new Uint8Array(_data);
  }

  public get data(): Uint8Array {
    return new Uint8Array(this._data);
  }

  public static decode(data: Uint8Array): TestTokenData {
    return new TestTokenData(data);
  }

  public encode(): Uint8Array {
    return this.data;
  }

  public toString(): string {
    return dedent`
      TestTokenData: ${HexConverter.encode(this.data)}`;
  }
}
