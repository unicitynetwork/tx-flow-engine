# Transaction Flow Engine
This is offchain token transaction framework. It follows the paradigm, where toknes are being managed, stored and transferred offchain (on users' premises or in cloud, outside of the blockchain ledger) and single-spend proofs only are being generated on-chain. 
Here, token is a stand-alone entity containing all the info and cryptographic proofs attesting current token's state (like, ownership, value, etc.). Token's state change is accompanied by consulting with the blockchain infrastructure (Unicity) that should produce the proof of single spend of the token from its current 
 cryptographically verifiable statement that the given source state has been changed to a new given state and there were no other transitions from the source state before. Cryptographic commitments about the token spent contain no info about the token, its initial state and 
its destination state as well as no info about the nature of the transaction itself. I.e., when someone observes traffic between clients and Unicity infrastructure, it is not possible to say whether submited commitments refer to token transactions or to some 
completely other kinds of processes. All the transaction commitments are being aggregated into global distributed hash tree data structure rooted in the Unicity blockchain. In this manner, we have horizontally scalable on-demand blockchain infrastructure capable for
accomodating millions of transaction commitments per block.

## Web GUI interface
[Token GUI stand-alone page](https://unicitynetwork.github.io/tx-flow-engine/)
### Mint token:
 - Set the password to lock up the token to be minted (central panel, field `Secret`)
 - Set the token type (or leave default `unicity_test_coin`) in he field under button `New`, right pannel
 - Set the token value (or leave default 1000000000000000000) in the field below token type below button `New`, right pannel
 - Push button `New` and wait few seconds for getting the single-spend proof (unicity certificate) from the unicity gateway "https://gateway-test1.unicity.network:443". The central text field will be populated with the JSON document containing the token and the left pannel will get the token info extracted from the JSON document. You can push button `Check` in the left pannel to check current token status for the given token and given password ('Secret' field)

### Recipient pointer:
A recipient must generate the pointer to which the token ownership must be changed.
 - Set the password to lock up the token expected to be received (central panel, field `Secret`)
 - Push `Generate Pointer/Nonce` button. Share the pointer with the sender, keep the Nonce in order to "import" the token when received

### Send token:
 - Set the password to unlock the token for sending (central panel, field `Secret`)
 - Set the pointer obtained from the recipient in the field below `Send` button, right field
 - Push `Send` button
 - When the JSON document gets updated in few seconds after "talking" to the unicity gateway (check that the `transaction` field is non-empty), copy the JSON document and send it with whichever means to the recipient (a messenger, email, flash drive, etc.)

### Receive token:
When the recipient gets the JSON document containing the token, the transaction field in the document must be resolved into the transition, the ownership info gets updated and locked to the recipient password
 - Set the password to lock up the token received (central panel, field `Secret`)
 - Set the `Nonce` into the field below the `Import` button, right panel
 - Push `Import` button, wait till the token status on the left panel gets updated to "Spendable" in few seconds
 - Congrats! You have successfuly received the token!

## Setup instructions
 - Fetch the project: `git clone --recurse-submodules https://github.com/unicitynetwork/tx-flow-engine.git`
 - Make sure to have npm and node installed
 - go to `tx-flow-engine` project folder
 - run `npm install`
 - go to `aggregators_net` subfolder
 - run `npm install`

## Usage
 - use `state_machine.js` and `helper.js` for SDK
 - use `token_manager.js` as generic CLI tool
 - use bash scripts in `./cli` folder to mint, transfer and receive tokens stored in TXF files as JSON object

## Token
Token is an entity holding value and optionally some other application-specific data. Token is mined by a client within client's premises with the cryptographic proofs stating the valid reasons why the token could be mined. In a simple example, it is enough to
demonstrate the proof that a token with the given id has been mined just once. Token state represents encoding of the current owner as a challenge requesting to demonstrate knowledge of private key for the given public key (via digital signature).
Token state transition consists of a solution for the challenge encoded in the current state as well as new state (ownership) the token goes to. In ths manner, the token's current/latest state is demonstrated through a sequence of transitions from its genesis/minting
till the latest state. Each transition is supplied by a unicity proof generated by the Unicity infrastructure, proving that this was the only transition from its source state. Note, is is not possible to generate two transitions of the same token state 
with the unicity proofs.

In order to hide token's owner public key from the Unicity public infrastructure (and everyone else reading data streams to and from the Unicity) as well as from the previous token owner, the token state gets obfuscated with precalculated random nonce 
(hash of the recipient owner public key + noncem + some other data) and is shared with the sender as a pointer and with Unicity as the commitment id. It is done in such a way that it is not possible to learn from the pointer and from the commitment neither each 
other, nor the recipient's public key, nonce, token id and token class. Moreover, from the Unicity commitment alone, it is not possible to identify whether the commitment was generated for the token transition or for anything else.

As another measure to hide the owner's identity from observers, we enforce one-time use of public keys via calculation of the key pair based on the user's secret and one-time random nonce. In this manner, a user can access and send his/her/its tokens attached to 
seemingly different unrelated public keys.

### Token structure
 - tokenId: unique 256bit id of the token
 - tokenClass: unique 256bit code identifying the token class (for instance, unicity utility token, wrapped cryptocurrency or fiat token, some nft or app-specific utility token). An app developer is free to define the own token class with specific minting and transfer rules (by analogy with deploying own ERC20 or ERC721 contract).
 - tokenValue: numeric value of the token represented as big integer. One may follow same fraction denomination rules as in Ethereum framework (one monetary unit ca be devided at most into 10**18 atomic smallest monetary units)
 - Genesis: all minting-related proofs and data
 - transitions: sequence of state transitions from the genesis up to the latest state with all the necessary Unicity and other proofs
 - state: current token state containing public key, nonce, etc.

## Transition and transaction
A transition is a record defining what token state changes into what state, and proofs unlocking the challenge encoded in the source state, unicity proof and salt. Since a token sender does not know the recipient's state, but only the pointer, the sender cannot
create a valid transition. Hence, we say that the sender creates a `transaction`, a structure containing the source token state, the recipient's nonce and the salt. The salt is a random value needed to obfuscate the transaction digest so that any person with
the knowledge of the source state (sender's public key) and the recipient's pointer cannot guess from the Unicity commitment whether the token has been transfered to the given recipient or to someone/somewhere else. Only the recipient can resolve a transaction into the
relevant transition by substituting the pointer into the respective recipient's token state.

### Trnasaction structure
 - Source state: sender's public key, nonce, tokenId, tokenClass, etc.
 - Input: sender's proof of the ownership and Unicity (single-spend) proof
 - Destination pointer: the prointer refering the hidden expected token's destination state. Must be shared by the recipient with the sender
 - Salt: randomly generated value to obfuscate and make the transaction's digest unpredictable

### Transition structure
 - Source state: sender's public key, nonce, tokenId, tokenClass, etc.
 - Input: sender's proof of the ownership and Unicity (single-spend) proof
 - Destination state: sender's public key, nonce, tokenId, tokenClass, etc.
 - Salt: randomly generated value to obfuscate and make the transaction's digest unpredictable.

## State
Represents current token state. Encodes challenges needed to be solved in order to unlock the token. For instance, a challenge can be represneted by the owner's public key as the request to demonstrate the knowledge of the respective owner's private key.

## State structure
 - tokenId: unique 256bit id of the token
 - tokenClass: unique 256bit code identifying the token class (for instance, unicity utility token, wrapped cryptocurrency or fiat token, some nft or app-specific utility token). An app developer is free to define the own token class with specific minting and transfer rules (by analogy with deploying own ERC20 or ERC721 contract).
 - pubkey: the token owner's public key
 - nonce: randomly generated one-time use value (one time per public key-token pair)

## Unicity commit
In order to prove no double-spend of a token, when creating a token transaction, the user must submit the transaction commitment to the Unicity gateway, obtain the unicity proof/certificate for the commitment and include that into the transaction. The commitment
is a key-value pair, where the key is the commit requestId derived from the current token's state in such a way, that each unique state derive unique requestId and it is not possible to derive from the requestId the respective token state back. Clearly, since 
all tokens throughout all their life cycle will never incure same state, their requestIds will be unique. In this manner, if there is no double-spend intent, there will never be two different commits with the same requestId. Unicity cannot include and generate
certificates for two different commits with the same requestId. The value of the commit contains payload and the authenticator field. The payload is the digest of the transaction spending the given token state (since a transaction contains a random salt, the
payload cannot be predicted from the token source and destination pointer alone). The authenticator is needed for the commit's self-authentication. The authenticator contains the owner's public key, the payload signature and the obfuscated token state such that 
the requestId could be derived. This means, only the token owner should be able to register the transaction commit with the Unicity since no one else knows the owner's private key and cannot produce the valid authenticator corresponding to the requestId.

## Transaction flow
Structure containing token and optionally transaction data. Used for sharing and synchronizing the token state between the users.

## Tools
### SDK: state_machine.js, helper.js
It is a library of functions you can use to integrate you project with the transaction flow engine. You can use it to mint, send and receive tokens.
 - mint: creates a token structure, generates uniicity certificate for proving single mint for the given token id.
 - createTx: generates transaction structure and single-spend proof in Unicity certificate for the token, recipient's pointer, salt, sender's secret and transport object
 - exportFlow: used to export token and transaction as a JSON object flow
 - importFlow: used to import token and optionally transaction from the flow JSON object. If transaction is present, the recipient resolves it into the token state transition and derives the latest token state.
 - getTokenStatus: probes the current token state against the given user's secret (verifies the respective ownership) and spend proof (has the latest state been already spent, but not updated in the given token structure) via querieng the Unicity gateway
 - collectTokens: scans the set of given tokens and filters those unspent for the given user (derived from the user's secret)
 - helper.calculatePointer: derives pointer to be shared with the token sender. It is derived from tokenClass, secret and nonce

### CLI: token_manager.js
Command line tool for processing transaction flows and managing tokens. Uses state_machine.js and helper.js. Accepts input TX flow from stdin and outputs processed flow through stdout.
 - ./token_manager.js mint [options]: outputs tx flow with the newly minted token
 - ./token_manager.js pointer [options]: generates the recipient's pointer. Must be run by the recipient and the pointer to be shared with the sender. Note, keep the nonce in secret and do not share it!
 - ./token_manager.js send [options]: gets the token to be sent through the tx flow in stdin and outputs the tx flow with the transaction. Note, you must get the recipient's pointer first from the recipient
 - ./token_manager.js receive [options]: consumes TX flow with the token and transaction, resolves transaction into the transition, updates the token state and outputs the updated token as TX flow through stdout
 - ./token_manager.js summary [options]: from the stdin tx flows, filters unspent tokens owned by the user defined by his/her/its secret and outputs the summary (balance and owned tokens)

### CLI convenience tools
Scripts in ./cli. Manages TX flows stored in ./txf folder.

### Example flow:
#### On User1: Mint token to user1 with secret1: 
```bash
stf/cli$ ./mint.sh 
Enter Token ID (default: random 6-digit number): 
Enter Token Class (default: unicity_test_coin): 
Enter Token Value (default: 10000000000000000000): 
Enter Nonce (default: random 6-digit number): 
Enter User Secret: secret1
```

```json
{
    "token": {
        "tokenId": "bd666f6719089472630dcf9a5920fefcd2da759372ad65045f0f512a0e10490f",
        "tokenClass": "27c709573730bff1d404e6345157d5e789f79f6172cf6ae8da79638d2718a426",
        "tokenValue": "1000000000000000000",
        "mintProofs": {
            "path": [
                {
                    "leaf": true,
                    "payload": "8ed257fdfe785fb631e2dfc85b9510c9b2b726a8050d2d1a579cb800a342f249",
                    "authenticator": {
                        "state": "0bfb45dcbf1183cfa7398ec15e042f1fc842114e306581e05fbea4f7f0c70348",
                        "pubkey": "04e75a8079c561babb297e3822046cb17385cca72535a3b01cf9bf3a4bed80dff4a26919463f6dba680a1e5e0d9b86aa832210152ca221911158eaf539ea538283",
                        "signature": "3045022100fab45c82a17d7aa0e5ba53ba08ed739bfce756a23e27afed10b2acad856f6fcf0220729affed31dda7f9862bb17c4934bab57684f3a76cbdb9e2044466801b14f078",
                        "sign_alg": "secp256k1",
                        "hash_alg": "sha256"
                    }
                }
            ]
        },
        "mintRequest": {
            "destPointer": "9ec0defaae8c4e52beba7499a91a9584a0cd8d467e1285cf8d90b83024b5618c"
        },
        "mintSalt": "49912c41447c29fbf1ecc147ed24df910ee995e005b448c80b8dcd9738a7f5bb",
        "genesis": {
            "challenge": {
                "tokenClass": "27c709573730bff1d404e6345157d5e789f79f6172cf6ae8da79638d2718a426",
                "tokenId": "bd666f6719089472630dcf9a5920fefcd2da759372ad65045f0f512a0e10490f",
                "sign_alg": "secp256k1",
                "hash_alg": "sha256",
                "pubkey": "043577a5e888b2d42ba1c4fe4bf8987a53e1936f9e2b978ef8e8e74b8c169252f059c18b16a26964c921e660823d540c6bc8c77418bd2606c365d8c4e92a21d2fd",
                "nonce": "79d883704b06f4b1d1cd72ab07e8fd830cbb11aec0ad923197b8406b7b9c7c23"
            }
        },
        "transitions": [],
        "state": {
            "challenge": {
                "tokenClass": "27c709573730bff1d404e6345157d5e789f79f6172cf6ae8da79638d2718a426",
                "tokenId": "bd666f6719089472630dcf9a5920fefcd2da759372ad65045f0f512a0e10490f",
                "sign_alg": "secp256k1",
                "hash_alg": "sha256",
                "pubkey": "043577a5e888b2d42ba1c4fe4bf8987a53e1936f9e2b978ef8e8e74b8c169252f059c18b16a26964c921e660823d540c6bc8c77418bd2606c365d8c4e92a21d2fd",
                "nonce": "79d883704b06f4b1d1cd72ab07e8fd830cbb11aec0ad923197b8406b7b9c7c23"
            }
        }
    },
    "transaction": null
}
```
```bash
================================================================================
Command executed successfully. TX flow saved to txf/unicity_test_coin_125223.txf.
```

#### On User2: generate the recipient's pointer: 
```bash
stf/cli$ ./pointer.sh 
Enter Token Class (default: unicity_test_coin): 
Enter Nonce (default: random 6-digit number): 
Enter User Secret: 
Nonce: 113524
Pointer: 7931e59604d2b6a3db52d8debf1aedd7074758761d8f87e36b50793151f7013f
```

#### User2 shares pointer 7931e59604d2b6a3db52d8debf1aedd7074758761d8f87e36b50793151f7013f with User1

#### On User1: create transaction changing ownership of the token in txf/unicity_test_coin_125223.txf to User2:  
```bash
stf/cli$ ./send.sh
Available transaction flow files:
1. txf/unicity_test_coin_112036.txf
2. txf/unicity_test_coin_118750.txf
3. txf/unicity_test_coin_121558.txf
4. txf/unicity_test_coin_122949.txf
5. txf/unicity_test_coin_125223.txf
6. txf/unicity_test_coin_125719.txf
7. txf/unicity_test_coin_127804.txf
Select a file by its number: 5
Enter Destination Pointer: 7931e59604d2b6a3db52d8debf1aedd7074758761d8f87e36b50793151f7013f
Enter User Secret: secret1
```
```json
{
    "token": {
        "tokenId": "bd666f6719089472630dcf9a5920fefcd2da759372ad65045f0f512a0e10490f",
        "tokenClass": "27c709573730bff1d404e6345157d5e789f79f6172cf6ae8da79638d2718a426",
        "tokenValue": "1000000000000000000",
        "mintProofs": {
            "path": [
                {
                    "leaf": true,
                    "payload": "8ed257fdfe785fb631e2dfc85b9510c9b2b726a8050d2d1a579cb800a342f249",
                    "authenticator": {
                        "state": "0bfb45dcbf1183cfa7398ec15e042f1fc842114e306581e05fbea4f7f0c70348",
                        "pubkey": "04e75a8079c561babb297e3822046cb17385cca72535a3b01cf9bf3a4bed80dff4a26919463f6dba680a1e5e0d9b86aa832210152ca221911158eaf539ea538283",
                        "signature": "3045022100fab45c82a17d7aa0e5ba53ba08ed739bfce756a23e27afed10b2acad856f6fcf0220729affed31dda7f9862bb17c4934bab57684f3a76cbdb9e2044466801b14f078",
                        "sign_alg": "secp256k1",
                        "hash_alg": "sha256"
                    }
                }
            ]
        },
        "mintRequest": {
            "destPointer": "9ec0defaae8c4e52beba7499a91a9584a0cd8d467e1285cf8d90b83024b5618c"
        },
        "mintSalt": "49912c41447c29fbf1ecc147ed24df910ee995e005b448c80b8dcd9738a7f5bb",
        "genesis": {
            "challenge": {
                "tokenClass": "27c709573730bff1d404e6345157d5e789f79f6172cf6ae8da79638d2718a426",
                "tokenId": "bd666f6719089472630dcf9a5920fefcd2da759372ad65045f0f512a0e10490f",
                "sign_alg": "secp256k1",
                "hash_alg": "sha256",
                "pubkey": "043577a5e888b2d42ba1c4fe4bf8987a53e1936f9e2b978ef8e8e74b8c169252f059c18b16a26964c921e660823d540c6bc8c77418bd2606c365d8c4e92a21d2fd",
                "nonce": "79d883704b06f4b1d1cd72ab07e8fd830cbb11aec0ad923197b8406b7b9c7c23"
            }
        },
        "transitions": [],
        "state": {
            "challenge": {
                "tokenClass": "27c709573730bff1d404e6345157d5e789f79f6172cf6ae8da79638d2718a426",
                "tokenId": "bd666f6719089472630dcf9a5920fefcd2da759372ad65045f0f512a0e10490f",
                "sign_alg": "secp256k1",
                "hash_alg": "sha256",
                "pubkey": "043577a5e888b2d42ba1c4fe4bf8987a53e1936f9e2b978ef8e8e74b8c169252f059c18b16a26964c921e660823d540c6bc8c77418bd2606c365d8c4e92a21d2fd",
                "nonce": "79d883704b06f4b1d1cd72ab07e8fd830cbb11aec0ad923197b8406b7b9c7c23"
            }
        }
    },
    "transaction": {
        "tokenId": "bd666f6719089472630dcf9a5920fefcd2da759372ad65045f0f512a0e10490f",
        "source": {
            "challenge": {
                "tokenClass": "27c709573730bff1d404e6345157d5e789f79f6172cf6ae8da79638d2718a426",
                "tokenId": "bd666f6719089472630dcf9a5920fefcd2da759372ad65045f0f512a0e10490f",
                "sign_alg": "secp256k1",
                "hash_alg": "sha256",
                "pubkey": "043577a5e888b2d42ba1c4fe4bf8987a53e1936f9e2b978ef8e8e74b8c169252f059c18b16a26964c921e660823d540c6bc8c77418bd2606c365d8c4e92a21d2fd",
                "nonce": "79d883704b06f4b1d1cd72ab07e8fd830cbb11aec0ad923197b8406b7b9c7c23"
            }
        },
        "input": {
            "path": [
                {
                    "leaf": true,
                    "payload": "a64f868940ac4ab1292737e3c2eec50003eae14d3c52ac4e4b4b4d32923975f8",
                    "authenticator": {
                        "state": "990f87a5aeca0ece987b7ff943fc55d746b4fcbee0cf441e35abb7f6f18b554d",
                        "pubkey": "043577a5e888b2d42ba1c4fe4bf8987a53e1936f9e2b978ef8e8e74b8c169252f059c18b16a26964c921e660823d540c6bc8c77418bd2606c365d8c4e92a21d2fd",
                        "signature": "30450221008ff56cb24572eb85071835a3d72ef01ef9918a065e27988a56f208657d9bc66d02203e272f151ba735dbf71cd1a3cba28785e597d85d8c8106320b2852d60863788b",
                        "sign_alg": "secp256k1",
                        "hash_alg": "sha256"
                    }
                }
            ],
            "destPointer": "7931e59604d2b6a3db52d8debf1aedd7074758761d8f87e36b50793151f7013f",
            "salt": "ce9e1dbc6b7e25f7d943da0cca3934f97080c90134e85b1ebc7176bfe093c584"
        },
        "destPointer": "7931e59604d2b6a3db52d8debf1aedd7074758761d8f87e36b50793151f7013f"
    }
}
```
```bash
================================================================================
Token was spent successfully using transaction flow file txf/unicity_test_coin_125223.txf to destination 7931e59604d2b6a3db52d8debf1aedd7074758761d8f87e36b50793151f7013f.
File txf/unicity_test_coin_125223.txf was updated with the new transaction, but cannot be spent till the destination pointer is resolved into the full state.
Old transaction flow file is invalid now (unicity will not confirm spend from the old state anymore) and was archived into txf/unicity_test_coin_125223.txf.spent.1733269966
```

#### User1 shares file unicity_test_coin_125223.txf with User2. User2 places this file into txf/unicity_test_coin_125223.txf

#### On User2. User2 resolves the transaction in the unicity_test_coin_125223.txf into the transition transforming the token ownership state to User2. I.e., by knowing the recipient's nonce and secret, it is possible to re-generate the recipient state out of the pointer:
```bash
stf/cli$ ./receive.sh 
Available transaction flow files:
1. txf/unicity_test_coin_112036.txf
2. txf/unicity_test_coin_118750.txf
3. txf/unicity_test_coin_121558.txf
4. txf/unicity_test_coin_122949.txf
5. txf/unicity_test_coin_125223.txf
6. txf/unicity_test_coin_125719.txf
7. txf/unicity_test_coin_127804.txf
Select a file by its number: 5
Enter Nonce: 113524
Enter User Secret: secret2
```
```json
{
    "token": {
        "tokenId": "bd666f6719089472630dcf9a5920fefcd2da759372ad65045f0f512a0e10490f",
        "tokenClass": "27c709573730bff1d404e6345157d5e789f79f6172cf6ae8da79638d2718a426",
        "tokenValue": "1000000000000000000",
        "mintProofs": {
            "path": [
                {
                    "leaf": true,
                    "payload": "8ed257fdfe785fb631e2dfc85b9510c9b2b726a8050d2d1a579cb800a342f249",
                    "authenticator": {
                        "state": "0bfb45dcbf1183cfa7398ec15e042f1fc842114e306581e05fbea4f7f0c70348",
                        "pubkey": "04e75a8079c561babb297e3822046cb17385cca72535a3b01cf9bf3a4bed80dff4a26919463f6dba680a1e5e0d9b86aa832210152ca221911158eaf539ea538283",
                        "signature": "3045022100fab45c82a17d7aa0e5ba53ba08ed739bfce756a23e27afed10b2acad856f6fcf0220729affed31dda7f9862bb17c4934bab57684f3a76cbdb9e2044466801b14f078",
                        "sign_alg": "secp256k1",
                        "hash_alg": "sha256"
                    }
                }
            ]
        },
        "mintRequest": {
            "destPointer": "9ec0defaae8c4e52beba7499a91a9584a0cd8d467e1285cf8d90b83024b5618c"
        },
        "mintSalt": "49912c41447c29fbf1ecc147ed24df910ee995e005b448c80b8dcd9738a7f5bb",
        "genesis": {
            "challenge": {
                "tokenClass": "27c709573730bff1d404e6345157d5e789f79f6172cf6ae8da79638d2718a426",
                "tokenId": "bd666f6719089472630dcf9a5920fefcd2da759372ad65045f0f512a0e10490f",
                "sign_alg": "secp256k1",
                "hash_alg": "sha256",
                "pubkey": "043577a5e888b2d42ba1c4fe4bf8987a53e1936f9e2b978ef8e8e74b8c169252f059c18b16a26964c921e660823d540c6bc8c77418bd2606c365d8c4e92a21d2fd",
                "nonce": "79d883704b06f4b1d1cd72ab07e8fd830cbb11aec0ad923197b8406b7b9c7c23"
            }
        },
        "transitions": [
            {
                "tokenId": "bd666f6719089472630dcf9a5920fefcd2da759372ad65045f0f512a0e10490f",
                "source": {
                    "challenge": {
                        "tokenClass": "27c709573730bff1d404e6345157d5e789f79f6172cf6ae8da79638d2718a426",
                        "tokenId": "bd666f6719089472630dcf9a5920fefcd2da759372ad65045f0f512a0e10490f",
                        "sign_alg": "secp256k1",
                        "hash_alg": "sha256",
                        "pubkey": "043577a5e888b2d42ba1c4fe4bf8987a53e1936f9e2b978ef8e8e74b8c169252f059c18b16a26964c921e660823d540c6bc8c77418bd2606c365d8c4e92a21d2fd",
                        "nonce": "79d883704b06f4b1d1cd72ab07e8fd830cbb11aec0ad923197b8406b7b9c7c23"
                    }
                },
                "input": {
                    "path": [
                        {
                            "leaf": true,
                            "payload": "a64f868940ac4ab1292737e3c2eec50003eae14d3c52ac4e4b4b4d32923975f8",
                            "authenticator": {
                                "state": "990f87a5aeca0ece987b7ff943fc55d746b4fcbee0cf441e35abb7f6f18b554d",
                                "pubkey": "043577a5e888b2d42ba1c4fe4bf8987a53e1936f9e2b978ef8e8e74b8c169252f059c18b16a26964c921e660823d540c6bc8c77418bd2606c365d8c4e92a21d2fd",
                                "signature": "30450221008ff56cb24572eb85071835a3d72ef01ef9918a065e27988a56f208657d9bc66d02203e272f151ba735dbf71cd1a3cba28785e597d85d8c8106320b2852d60863788b",
                                "sign_alg": "secp256k1",
                                "hash_alg": "sha256"
                            }
                        }
                    ],
                    "destPointer": "7931e59604d2b6a3db52d8debf1aedd7074758761d8f87e36b50793151f7013f",
                    "salt": "ce9e1dbc6b7e25f7d943da0cca3934f97080c90134e85b1ebc7176bfe093c584"
                },
                "destination": {
                    "challenge": {
                        "tokenClass": "27c709573730bff1d404e6345157d5e789f79f6172cf6ae8da79638d2718a426",
                        "tokenId": "bd666f6719089472630dcf9a5920fefcd2da759372ad65045f0f512a0e10490f",
                        "sign_alg": "secp256k1",
                        "hash_alg": "sha256",
                        "pubkey": "045bf358d07019685c7462f428159f5b7ca5a8e591b5d525a02fe1cc1e2f2d311a70bdcd27d6a8658d959e3c9492cffb3b01d4d849280ce0fb81fe3415d1a26d5a",
                        "nonce": "d1527ffca1bd09828b54bb313d0f476a81ee085b6c452d72163fc56590b8a06c"
                    }
                }
            }
        ],
        "state": {
            "challenge": {
                "tokenClass": "27c709573730bff1d404e6345157d5e789f79f6172cf6ae8da79638d2718a426",
                "tokenId": "bd666f6719089472630dcf9a5920fefcd2da759372ad65045f0f512a0e10490f",
                "sign_alg": "secp256k1",
                "hash_alg": "sha256",
                "pubkey": "045bf358d07019685c7462f428159f5b7ca5a8e591b5d525a02fe1cc1e2f2d311a70bdcd27d6a8658d959e3c9492cffb3b01d4d849280ce0fb81fe3415d1a26d5a",
                "nonce": "d1527ffca1bd09828b54bb313d0f476a81ee085b6c452d72163fc56590b8a06c"
            }
        }
    },
    "transaction": null
}
```
```bash
======================================================================
Transaction received successfully for nonce 113524.
Updated file: txf/unicity_test_coin_125223.txf.
```

#### On User2. Scan/summarize tokens available for the spent by User2 in ./txf folder and calculate the total balance: 
```bash
stf/cli$ ./summarize.sh 
Transaction flow files:
1. txf/unicity_test_coin_112036.txf
2. txf/unicity_test_coin_118750.txf
3. txf/unicity_test_coin_121558.txf
4. txf/unicity_test_coin_122949.txf
5. txf/unicity_test_coin_125223.txf
6. txf/unicity_test_coin_125719.txf
7. txf/unicity_test_coin_127804.txf
Enter Token Class (default: unicity_test_coin): 
Enter User Secret: 
=============================
Tokens ready to be spent:
```
```javascript
{
  totalValue: 11000000000000000000n,
  tokens: [
    '8b49d4350bfd4f694e77fd7f683c794b12c47bd02f9b395bcd7c84a03e2d04db': Token {
      tokenId: 'bd666f6719089472630dcf9a5920fefcd2da759372ad65045f0f512a0e10490f',
      tokenClass: '27c709573730bff1d404e6345157d5e789f79f6172cf6ae8da79638d2718a426',
      tokenValue: '1000000000000000000',
      mintProofs: [Object],
      mintRequest: [Object],
      mintSalt: '49912c41447c29fbf1ecc147ed24df910ee995e005b448c80b8dcd9738a7f5bb',
      genesis: [State],
      transitions: [Array],
      state: [State]
    },
    '01947e619d7dd070b6f77a7b8aa42af6e1a17e05235386fa54027aa1893d9ecf': Token {
      tokenId: '60d3de380f9b73ac1ded37fb81ddc6fe52e9495614e47780d66bc6bf0b91505b',
      tokenClass: '27c709573730bff1d404e6345157d5e789f79f6172cf6ae8da79638d2718a426',
      tokenValue: '10000000000000000000',
      mintProofs: [Object],
      mintRequest: [Object],
      mintSalt: 'dd4380fdf1a288f557fac2a9791a1a98f0a9dd515c1c5792c2222d583ffba973',
      genesis: [State],
      transitions: [Array],
      state: [State]
    }
  ],
  stats: [
    '8b49d4350bfd4f694e77fd7f683c794b12c47bd02f9b395bcd7c84a03e2d04db': {
      id: 'bd666f6719089472630dcf9a5920fefcd2da759372ad65045f0f512a0e10490f',
      classId: '27c709573730bff1d404e6345157d5e789f79f6172cf6ae8da79638d2718a426',
      value: '1000000000000000000',
      unspent: true,
      owned: true
    },
    '01947e619d7dd070b6f77a7b8aa42af6e1a17e05235386fa54027aa1893d9ecf': {
      id: '60d3de380f9b73ac1ded37fb81ddc6fe52e9495614e47780d66bc6bf0b91505b',
      classId: '27c709573730bff1d404e6345157d5e789f79f6172cf6ae8da79638d2718a426',
      value: '10000000000000000000',
      unspent: true,
      owned: true
    }
  ]
}
```
```bash
=============================
TXF files storing the tokens: 
8b49d4350bfd4f694e77fd7f683c794b12c47bd02f9b395bcd7c84a03e2d04db: txf/unicity_test_coin_125223.txf
01947e619d7dd070b6f77a7b8aa42af6e1a17e05235386fa54027aa1893d9ecf: txf/unicity_test_coin_127804.txf
```
