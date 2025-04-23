import {HashAlgorithm} from "@unicitylabs/commons/lib/hash/HashAlgorithm.js";
import {StateTransitionClient} from "../../src/StateTransitionClient.js";
import {TokenId} from "../../src/token/TokenId.js";
import {TokenType} from "../../src/token/TokenType.js";
import {SparseMerkleTree} from "@unicitylabs/commons/lib/smt/SparseMerkleTree.js";
import {OneTimeAddress} from "../../src/address/OneTimeAddress.js";
import {SigningService} from "@unicitylabs/commons/lib/signing/SigningService.js";
import {DataHasher} from "@unicitylabs/commons/lib/hash/DataHasher.js";
import {TokenState} from "../../src/token/TokenState.js";
import {DefaultPredicate} from "../../src/predicate/DefaultPredicate.js";
import {TestAggregatorClient} from "../TestAggregatorClient";

const textEncoder = new TextEncoder();

describe('Transition', function () {
    it('should verify the token latest state', async () => {
        const client = new StateTransitionClient(new TestAggregatorClient(await SparseMerkleTree.create(HashAlgorithm.SHA256)));
        const secret = new TextEncoder().encode('secret');
        const token = await client.mint(
            TokenId.create(crypto.getRandomValues(new Uint8Array(32))),
            TokenType.create(crypto.getRandomValues(new Uint8Array(32))),
            new Uint8Array(),
            new Uint8Array(),
            secret,
            crypto.getRandomValues(new Uint8Array(32)),
            crypto.getRandomValues(new Uint8Array(32))
        );

        const signingService = await SigningService.createFromSecret(secret, token.state.unlockPredicate.nonce)

        const nonce = crypto.getRandomValues(new Uint8Array(32));
        const transaction = await client.createTransaction(
            token,
            await OneTimeAddress.create(token.type, secret, nonce, HashAlgorithm.SHA256),
            signingService,
            crypto.getRandomValues(new Uint8Array(32)),
            await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode('my custom data')).digest(),
            textEncoder.encode('my message'));

        const updateToken = await client.finishTransaction(
            token,
            await TokenState.create(
                await DefaultPredicate.createMaskedPredicate(
                    token.id,
                    token.type,
                    signingService,
                    transaction.inclusionProof.transactionHash.algorithm,
                    token.state.unlockPredicate.nonce
                ),
                textEncoder.encode('my custom data')
            ), transaction);

        console.log(updateToken.toString());
    });
});

