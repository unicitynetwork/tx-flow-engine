import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { SparseMerkleTree } from '@unicitylabs/commons/lib/smt/SparseMerkleTree.js';

import { DirectAddress } from '../../src/address/DirectAddress.js';
import { Commitment } from '../../src/Commitment.js';
import { MaskedPredicate } from '../../src/predicate/MaskedPredicate.js';
import { PredicateFactory } from '../../src/predicate/PredicateFactory';
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

    console.log(JSON.stringify(updateToken.toDto()));
  }, 15000);

  it('should import token and be able to send it', async () => {
    const client = new StateTransitionClient(
      new TestAggregatorClient(await SparseMerkleTree.create(HashAlgorithm.SHA256)),
    );
    const secret = new TextEncoder().encode('tere');

    const token = await StateTransitionClient.importToken(
      JSON.parse(
        '{"data":"1b26afac8b97faafbfdf7d8ef87d5b896a68cf0e82f8ed7a8139f1334c2bbd7e","id":"60bc15c7ad68e95d36231d520790aa0bcdd1604b429407fdc1ffc7c3072be174","nametagTokens":[],"state":{"data":"6d7920637573746f6d2064617461","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"cca366f8438f88b6d54b5b141941fedd26594e9d07e3d32343acc49de3048a76","publicKey":"03a41835d01c52d745e3c83cf1275cb7b0179d5680eace852923d1d496fa4859b9","type":"MASKED"}},"transactions":[{"data":{"dataHash":"00005eeaefa9a7e23eba27a7fa7250a1277903c252ace1a59e1e60dfc6d440ba0fe6","recipient":"DIRECT://0000beabf36d7feb5efc106751ce122d758fbb31fe36a7e8047f0a1267928da5e4aed932fa43","salt":"b9d48215edbdbaab634381b1500b2bf0cdda35083ef96bbeb71e77083de156a4"},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"026a15646a38adae0e20d7672b82485c13cdadfe0f5b91c8098d2cc9a26395aa1d","signature":"3e5b189a6146dc473655c487107d8c3ce07745a565f449162cfd3cae86c675b473252d0819147d94ec2a86da5474ac8e9ca8c67efc83caf95737e701c2fb7b5a01","stateHash":"0000c47fdc04a2333744747ba66c72d5b28dace30e747da427881a14e1cea87bd2f4"},"merkleTreePath":{"root":"000079e52e983bcdb2d9c86a24ff7468f61302a8d6d22e1edf7fe61c55e1f2e884a6","steps":[{"path":"7588589860668301580890209657972889038524023144828636646636370474972828993155493839","value":"0000788a92fa0ab721da94f9ea241c94209741a471da3e401f5657572d4e4c2ea18d"}]},"transactionHash":"0000343a6233ac6d9afee5176da9cb2674479adc0fdc4c6b698a66e8955e45c06594"}},{"data":{"dataHash":"0000371dd350eb385a9eb4ccf52c532b9f2fb5b24834ea634f4c27739b604cb08102","message":"6d79206d657373616765","nameTags":[],"recipient":"DIRECT://00005c27c2648b711eae3b894425c123063d80dd741eecfe4c0a44d0a89b4637f55f26c1028b","salt":"21d6103cce2d4eaaa7b507c274d2df2665cc46b11a69b1cc417e504d4901d1de","sourceState":{"data":"1962dff3f1ff08ec262e609c2025f822d91cf88a9c03c2b2671b9db68b89e3f6","unlockPredicate":{"algorithm":"secp256k1","hashAlgorithm":0,"nonce":"c765b7558c381172370dd6e0dd287fe712227b5777baeb214cc605425a566a55","publicKey":"03a41835d01c52d745e3c83cf1275cb7b0179d5680eace852923d1d496fa4859b9","type":"MASKED"}}},"inclusionProof":{"authenticator":{"algorithm":"secp256k1","publicKey":"03a41835d01c52d745e3c83cf1275cb7b0179d5680eace852923d1d496fa4859b9","signature":"d5595730027124259ff2b51dac28a399dd21caaca8b4bed3f91a4c6eb2ef34163f27a86e0fc3672a4faca316c938d6cf0ed1692f0ed2bbeba9557199a4a57c5a01","stateHash":"000017eeec81c113a5b8618bc2a0449de8f268dd195aa4dc0e6cccded4a68d6dd323"},"merkleTreePath":{"root":"000089cb045ba186eadf8bb66218cb720a87baaf7c0bfdd577822046c40bc954cdfe","steps":[{"path":"7588606456554337646440020860704435119621163082000662007557151311354884248978187492","sibling":"0000cb9a56c3876de4d430a2357a46796f7eaf239ff6219707d29e3625872f684d4b","value":"0000b2b8bcf4e30a42dc03d879ddf42875688d0976e6425daa7e62cc5101eab81c71"}]},"transactionHash":"0000e26c08bf5c019095fc4009675fd2e2dbd2a434850b731e1eadeeac10c80349fa"}}],"type":"350ef26a09109fbc9f02d2e1ee660357814844699cb0478fb51cae4e276bc203"}',
      ),
      new PredicateFactory(),
    );

    console.log(token.toString());
  }, 15000);
});
