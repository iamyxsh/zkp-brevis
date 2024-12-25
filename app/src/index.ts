import { Brevis, ErrCode, ProofRequest, Prover, StorageData, asBytes32, asUint248 } from 'brevis-sdk-typescript';
import { ethers, JsonRpcProvider } from 'ethers';
import { Kafka, Consumer } from 'kafkajs';
import BrevisRequestABI from './abi.json';

const DextrZK = '0x4d7BA9746fdDC53F3757bF12fD5D330Ce488b00F';
const BREVIS_REQUEST_ADDRESS = '0x4a97B63b27576d774b6BD288Fa6aAe24F086B84c';
const CHAIN_ID = 84532;
const RPC_URL = 'https://sepolia.base.org';
const DEXTR_TOKEN_ADDRESS = '0x62725D7f09B4dF9b2B1d62C63bdEB1fBf9693E76';
const MEV_ADMIN_PK = '812979281379e8b3302650d69fe91baa98f5efcb71e6420d71008a6ba1c02e63';
const provider = new JsonRpcProvider(RPC_URL);

const wallet = new ethers.Wallet(MEV_ADMIN_PK);
const signer = wallet.connect(provider);

const kafka = new Kafka({
    clientId: 'kafka-listener',
    brokers: ['kafka:9092'],
});

const topic = 'raise-claim';
const groupId = 'brevis-service';

const runConsumer = async () => {
    const consumer: Consumer = kafka.consumer({
        groupId,
        allowAutoTopicCreation: true,
    });

    await consumer.connect();
    console.log(`Connected to Kafka as consumer for topic "${topic}".`);

    await consumer.subscribe({ topic });

    console.log(`Subscribed to topic "${topic}". Waiting for messages...`);

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            console.log({
                topic,
                partition,
                offset: message.offset,
                key: message.key?.toString(),
                value: message.value?.toString(),
            });
            await consumer.commitOffsets([
                {
                    topic,
                    partition,
                    offset: message.offset + 1,
                },
            ]);

            await handleMevClaim(message.value?.toString()!);
        },
    });
};

runConsumer().catch(error => {
    console.error('Error in Kafka consumer:', error);
});

async function handleMevClaim(message: string) {
    console.log('mesasage -> ', JSON.parse(message));

    const { challengerAddress, lpAddress, orderHash, txHash } = JSON.parse(message);

    console.log({ challengerAddress, lpAddress, orderHash, txHash });

    const prover = new Prover('host.docker.internal:33247');
    const brevis = new Brevis('appsdkv3.brevis.network:443');

    const proofReq = new ProofRequest();

    const blockNumber = await getBlockNumberFromHash(txHash);

    console.log('blockNumber', blockNumber);

    const slotHashChallenger = await getSlotHash(challengerAddress, 0);
    const slotHashLp = await getSlotHash(lpAddress, 0);

    console.log({ slotHashChallenger, slotHashLp });

    const slotValueChallenger = await getStorageValueAtSlot(DEXTR_TOKEN_ADDRESS, slotHashChallenger);

    console.log({
        slotValueChallenger,
        dec: BigInt(slotValueChallenger).toString(),
    });

    const slotValueLp = await getStorageValueAtSlot(DEXTR_TOKEN_ADDRESS, slotHashLp);

    console.log({ slotValueLp, dec: BigInt(slotValueLp).toString() });

    proofReq.addStorage(
        new StorageData({
            address: DEXTR_TOKEN_ADDRESS,
            block_num: blockNumber,
            slot: slotHashChallenger,
            value: slotValueChallenger,
        }),
        0,
    );

    proofReq.addStorage(
        new StorageData({
            address: DEXTR_TOKEN_ADDRESS,
            block_num: blockNumber,
            slot: slotHashLp,
            value: slotValueLp,
        }),
        1,
    );

    proofReq.setCustomInput({
        challengerAddress: asBytes32(ethers.zeroPadBytes(challengerAddress, 32)),
        orderHash: asBytes32(orderHash),
    });

    console.log({
        slotValueLp,
        slotValueChallenger,
        slotHashChallenger,
        slotHashLp,
    });

    try {
        console.log('0');

        const proofRes = await prover.prove(proofReq);

        console.log('1');

        if (proofRes.has_err) {
            const err = proofRes.err;
            switch (err.code) {
                case ErrCode.ERROR_INVALID_INPUT:
                    console.error('invalid receipt/storage/transaction input:', err.msg);
                    break;

                case ErrCode.ERROR_INVALID_CUSTOM_INPUT:
                    console.error('invalid custom input:', err.msg);
                    break;

                case ErrCode.ERROR_FAILED_TO_PROVE:
                    console.error('failed to prove:', err.msg);
                    break;
            }
            return;
        }

        console.log('proof', proofRes.proof);

        const brevisRes = await brevis.submit(proofReq, proofRes, CHAIN_ID, CHAIN_ID, 0, '', DextrZK);
        console.log('brevis res', brevisRes);

        const brevisRequest = new ethers.Contract(BREVIS_REQUEST_ADDRESS, BrevisRequestABI, signer);

        console.log({
            hash: brevisRes.queryKey.toObject().query_hash,
            nonce: brevisRes.queryKey.toObject().nonce,
            address: wallet.address,
            DextrZK,
        });

        const tx = await brevisRequest.sendRequest(
            brevisRes.queryKey.toObject().query_hash,
            brevisRes.queryKey.toObject().nonce,
            wallet.address,
            [DextrZK, 100000],
            0,
        );

        await tx.wait();

        await brevis.wait(brevisRes.queryKey, CHAIN_ID);
    } catch (err) {
        console.log('err', err);
    }
}

async function getBlockNumberFromHash(txHash: string): Promise<number> {
    try {
        const txReceipt = await provider.getTransactionReceipt(txHash);
        return txReceipt?.blockNumber! + 1;
    } catch (error) {
        console.error('Error fetching block number:', error);
        return provider.getBlockNumber();
    }
}

async function getStorageValueAtSlot(tokenAddress: string, slotHash: string): Promise<string> {
    try {
        if (!ethers.isAddress(tokenAddress)) {
            console.log('Invalid Ethereum address:', tokenAddress);
            throw new Error(`Invalid Ethereum address: ${tokenAddress}`);
        }

        // Fetch the storage value at the specified slotHash
        const value = await provider.getStorage(tokenAddress, slotHash);
        return value;
    } catch (error) {
        console.error('Error fetching storage value:', error);
        return '';
    }
}

async function getSlotHash(walletAddress: string, baseSlot: number) {
    // Ensure walletAddress is padded to 32 bytes
    const paddedAddress = ethers.zeroPadValue(ethers.hexlify(walletAddress), 32);

    // Compute the slotHash by applying keccak256 to the padded address and baseSlot
    const slotHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'uint256'], [paddedAddress, baseSlot]),
    );

    return slotHash;
}
