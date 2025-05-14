import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
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

    let token = await new TestTokenFactory().create(
      JSON.parse(
        '{"data":"fc438efab907b27c8146b653342ec10598d4d55f0d8a14c241c4cc250298aa32","id":"ecc9a0094f0875432a8e652550f9c29b434a3724b29061017cef6c78cb30327e","nametagTokens":[],"state":{"data":"6d7920637573746f6d2064617461","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"62b0bca6efa6872b51ac79811b222b57e91f582668ba61f8340644b5ddbcbaab","publicKey":"02a6561c985ed5cab72c8d0c80e6434d83371f9a39e157281892f1a4488f2fa500","type":"MASKED"}},"transactions":[{"data":{"dataHash":"0000a11c38b62787065c9648c891648a645c5d2690b79b3b0c2c5a3db8ce3337231b","reason":null,"recipient":"DIRECT://0000aac3caad2ed99b654469ffe5b047537d06ccd38391706962ad9ca0eae0d37dbe2ccb17b6","salt":"60808277cbd466e88d91ef3bf8bc48bcc64a3c55d13cb856f46a61ce23b54fb6"},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"03a0f76cf00b09800d46f9cdc8b7ac4990e6519ef81dc4556ab8c202ab321b624e","signature":"eef82bf25d9375a04492edcd8242a7bd55874e2d75b654dfc2a4ad69affa55ee5d7b896363acb7001fc38150865552256c6574631c70353033245fc18d6e46d300","stateHash":"0000623db8c5be4a236df770952b6e9bc570e51bf8e8821128ea1ea2ff930f23df31"},"merkleTreePath":{"root":"000022bafa6b4e0b503dd8cd9334f521266da5e86d85dcdd81a63c8e8a8b49134ad2","steps":[{"path":"7588661333844105021379028654855961873545231972049020382206326615825335001212773592","value":"00002de79e221adb901f714d062dbfa144450e521d6ddc2ba7d6bfdea07fc16ae5a6"}]},"transactionHash":"000011f01a4473bcc0eb2ea1ceceafd49bc4b89e9f765c26297bb45a056998f854cf"}},{"data":{"dataHash":"0000371dd350eb385a9eb4ccf52c532b9f2fb5b24834ea634f4c27739b604cb08102","message":"6d79206d657373616765","nameTags":[],"recipient":"DIRECT://0000e72cf8279eb50ec0b6e4d4ad52a81fc73bd9dfd4ef8d4aaafeb3c738b036f7a772b44d48","salt":"6594f66caa350656b2ef62345ccd9c48adb8e9ef859ec85d7803773fb867b50a","sourceState":{"data":"2cdf1c65dcc4e9ef0a4ee3e176f89129b5f6e94cad584d7f1c79ac791e9174b2","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"13323e52c4b5a1f2b324b55136d99ecabf034a41098dd3c21f681bdc969be654","publicKey":"02cb582e603976afc49b41d8464c8afa8529b44cc56063cd1531522c1c86b51590","type":"MASKED"}}},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"02cb582e603976afc49b41d8464c8afa8529b44cc56063cd1531522c1c86b51590","signature":"fd565db16316885f6671e1c00ed766a5b3fca22dca8ccd4a89a604953d82f54623831178fd0a5f83ca68c17303e9ccb8306f04f2238a301df86d9e8afc3a1c2b00","stateHash":"0000f28911e3b1002de39d367bf3b8606064eeff9a2924767cc82427fdcf3940a3c9"},"merkleTreePath":{"root":"0000ad435e3a3d56bb0d04ceb26d15ad38b19c788ba6ad315e51b8981d4129aa5fd9","steps":[{"path":"7588637402431177580079922535357851467622143557728004726696893813714198641978293083","sibling":"000014c520f81a95d1008e71bccd64ff893bd74c89c5ed2d2a4390c6c82e5804c7d8","value":"00004d72bc160d1aff1a956324074007c4efa5e6f08f5bda5914c47c04c5b268aaef"}]},"transactionHash":"0000e9be467f7ccd3b360053851fab1e76a6c5c8a742d9adef91540bbe6aaf595693"}}],"type":"1998216544bad5261af8888bafc6a899caa7c77eaffd9f61e132770dde08c9b7"}',
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

  protected createData(data: Uint8Array): Promise<TestTokenData> {
    return Promise.resolve(new TestTokenData(data));
  }

  protected createMintReason(): Promise<ISerializable | null> {
    return Promise.resolve(null);
  }
}
