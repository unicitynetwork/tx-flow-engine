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
        '{"data":"7f3099150d89f93b8b25c0951881b0c4e8a9dd08da39fea11b8e2ef34aabc793","id":"a2c4dc4bf36699bee3a8ff37bd8a6a292c65338d493605e7639880571eebe1ad","nametagTokens":[],"state":{"data":"6d7920637573746f6d2064617461","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"54b3c3cbc49d0c322faf138d60d659d08e52c1f44686f598d74cafc9147cc354","publicKey":"02a863b6f89f8cef24e9910a9aac6d1e27318969a6eee9e1fe6272afa378012c93","type":"MASKED"}},"transactions":[{"data":{"dataHash":"0000fb5cdeda585351c475b0bd0e85c3978f8e794916ead58aa7687c5bd0f2821b9b","reason":null,"recipient":"DIRECT://0000427abac19d4cb576cce2fbd782c22c775e29820a451fdee4fc6edc4e4a76b1efea498242","salt":"c702662640e964c2864eaa03cd7c4d5fba7ed4770b8dfcb834927c97efb52199"},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"02a0f6da61ce4eb398fdfcdebad29994a2891c10ba463fd722377e4f92ff24c23f","signature":"d19a84c465d82b78ff47570bb23d79f06b88e2052d93c6368c17d69447ff02494744763aa285338b4077869378a6b43efc9b51cea4a552ffceee4f12b4c3662000","stateHash":"0000c332c993bff43fc34e7c5380d9dbebcb08b269bca6bf55b99b8196f982125f8e"},"merkleTreePath":{"root":"0000b92c3abc159dfa4ab44ef43da5207d5f0bf0fd223298f9bc2e49db94bec387fe","steps":[{"path":"7588661894122708642967925139232208206491363422498087548839649820803248668251878794","value":"00000dd47acdd4eef63003e8403ed85494b159f64dd7a3446a005b4255bb01ae64c5"}]},"transactionHash":"00008c05642d731255e647b18eb0b0e680745c9964a4f2e3a6ee61f883fe59bbfa96"}},{"data":{"dataHash":"0000371dd350eb385a9eb4ccf52c532b9f2fb5b24834ea634f4c27739b604cb08102","message":"6d79206d657373616765","nameTags":[],"recipient":"DIRECT://00004c0415c531b29ec2459d106f290077760a4dfa10185a12a12851b1c1c822c7efed41a60c","salt":"1c4d3d8b4c153263b383722a6f6089308cbeb38c8d64805c31e0aa1e752ae40c","sourceState":{"data":"7572904fe5785c6868ee2ba41738386e964e13e7faeff4394d4fa77baa411e28","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"2774b1afcfec73bcd228d183f599a4e5aa3517761d5f7f9dc9fedf61606385fa","publicKey":"02290864d4446a086496961ffdf20813963542fd6ec4591b3b7f5f90e521567903","type":"MASKED"}}},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"02290864d4446a086496961ffdf20813963542fd6ec4591b3b7f5f90e521567903","signature":"0f948f409fe8e672597d0abbc934eb105255236e2af178166a0cc58ff4618709350112c72f21100037610fa2cb75541b327c311fa367589fbee46ece2b030f1301","stateHash":"0000d40f9b86e55f22eb0315d6d4347d83307fed74a6e6caf26943b74a9c228a24ea"},"merkleTreePath":{"root":"0000414c4e86093b7581e37cd263fbe9311aa7e7e560ec8d3fbe5abbaf1b36ec50d9","steps":[{"path":"7588608733612298228419904068069136048808601154141461694753047928925070678197816725","sibling":"0000f5dfcd61d3709542a7bc314b198f72f6ab4dc662573351aff92b8a805316eda3","value":"00004f17057b0c9cbd26b79a270d450014fff0e4e8508ac90b185c7f9ff8878c89a4"}]},"transactionHash":"000004e39e7b7724c26ef26910e3fd9f4d7494841eeaa462c64baea51a65e7274ab8"}}],"type":"3352fa351f5feb711e06767e1b7bbacf6ca72944ed5aa65a6a34eab94cdcb060"}',
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
