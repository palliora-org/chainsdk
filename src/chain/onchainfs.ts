
import { ApiPromise, Keyring } from "@polkadot/api";
import { testCrypt } from "../crypto/core";
import { encrypt, gen_stretched_key } from "../crypto/cipher";
import { hexToUint8Array, uint8ArrayToBase64 } from "../utils";
import type { Hex } from "viem";
import { signAndSend } from "./utils";

// Utility functions
//
type OnChainRef = {
	blockNumber: number | undefined;
	index: number | undefined;
};

type OnChainFileOptions = {
	file: File;
	filePath: string,
	fileName: string;
	description: string;
	baseCost: bigint;
	ownerL2Address: string;
	guardianInfo: any;
}

// Crypto-related types
interface KZG {
	// Add your KZG interface properties here
}

interface AggKey {
	// Add your AggKey interface properties here
}

// These should be imported from your crypto library
declare const kzg: KZG;
declare const agg_key: AggKey;

const getBlock = async (api: ApiPromise, blockNumber: number) => {
	const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
	return await api.rpc.chain.getBlock(blockHash);
};
const getFileMetadataCall = async (api: ApiPromise, metadataRef: any) => {
	const block = await getBlock(api, metadataRef[0]);
	const call = block.block.extrinsics[metadataRef[1]];
	return call.method;
};

const getFileMetadata = async (api: ApiPromise, metadataRef: any) => {
	const call = await getFileMetadataCall(api, metadataRef);

	// @ts-ignore
	const name = new TextDecoder().decode(call.args[0]);
	// @ts-ignore
	const description = new TextDecoder().decode(call.args[1]);
	// @ts-ignore
	const startRef = [call.args[2][0].toNumber(), call.args[2][1].toNumber()];

	return {
		name,
		description,
		startRef,
	};
};

async function getFileSHA256(file: File): Promise<string> {
	const buffer = new Array(12).fill(8);
	// const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
	const hashArray = Array.from(new Uint8Array(buffer));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
	return hashHex;

}

const readDataFromChain = async (api: ApiPromise, dataRef: any) => {
	const call = await getFileMetadataCall(api, dataRef);
	return call.args[0].toU8a();
};

class MCryptFs {
	_api;
	_init;
	_metaRef;
	_metadata;
	_chunkRefs: any;
	_startRef: any;

	constructor(mcryptApi: any, metadataRef: any, metadata: any) {
		this._api = mcryptApi;
		this._metaRef = metadataRef;
		this._metadata = metadata;
		this._init = true;
	}

	static dummyInstance(mcryptApi: any) {
		return new MCryptFs(mcryptApi, null, {
			name: "on-chain-file-name.txt",
			description: "File uploaded using mcrypt-onchain-fs",
		});
	}

	isValid() {
		if (!this._metaRef) {
			throw new Error("Metadata reference not set");
		}

		if (
			!this._metadata ||
			!this._metadata.name ||
			!this._metadata.description ||
			!this._metadata.startRef
		) {
			throw new Error("Metadata not set properly");
		}
	}

	getMetadata() {
		this.isValid();
		return this._metadata;
	}
}

class MCryptFsWriter {
	_file;
	_filePath;
	_description;
	_chunkSize;
	_fileKey: string;
	_fileName: string;
	_baseCost;
	_ownerL2Address;
	_guardianInfo: any;
	_api;
	_account: any;
	_chunkRefs: any[];
	_blockNumber;
	_extrinsicIndex;
	_progress;
	_error: any;

	constructor(fileOptions: OnChainFileOptions, chunkSize = 500, mcryptApi: any, account: any) {
		const {
			file: iFile,
			filePath,
			fileName,
			description,
			baseCost,
			ownerL2Address,
			guardianInfo,
		} = fileOptions;

		this._file = iFile;
		this._filePath = filePath;
		this._description = description;
		this._fileName = fileName;
		this._baseCost = baseCost;
		this._fileKey = "";
		this._ownerL2Address = ownerL2Address;
		this._guardianInfo = guardianInfo;
		this._chunkSize = chunkSize * 1024;
		this._api = mcryptApi;
		this._account = account;

		this._chunkRefs = [];
		this._blockNumber = 0;
		this._extrinsicIndex = 0;

		this._progress = {
			iFileSize: iFile.size,
			iBlocksWritten: 0,
		};

		this._error = null;
	}

	prependMetadata(chunk: any) {
		const blockNumberBuffer = new ArrayBuffer(4);
		const blockView = new DataView(blockNumberBuffer);
		blockView.setUint32(0, this._blockNumber, false);

		const extIndexBuffer = new ArrayBuffer(4);
		const extView = new DataView(extIndexBuffer);
		extView.setUint32(0, this._extrinsicIndex, false);

		return new Blob([blockNumberBuffer, extIndexBuffer, chunk]);
	}

	async writeChunk(chunk: any) {
		const request = this._api.tx.dataAvailability.submitData(
			Array.from(new Uint8Array(await chunk.arrayBuffer()))
		);
		console.log("account: ", this._account);
		return new Promise((resolve) => {
			request.signAndSend(this._account, { app_id: 1 }, (result: any) => {
				if (result.isInBlock || result.isFinalized || result.isError) {
					resolve({
						blockNumber: result.blockNumber?.toNumber(),
						index: result.txIndex,
					});
				}
			});
		});
	}

	async submitKey(account: any, data: any) {
		const { encoded: encryptedKey, ikm } = testCrypt(this._guardianInfo.tauParams, this._guardianInfo.aggKey);

		const td_params = uint8ArrayToBase64(hexToUint8Array(encryptedKey as Hex));
		const shared_key = gen_stretched_key(
			hexToUint8Array(ikm as Hex),
		);
		const { ciphertext, nonce } = encrypt(
			new Uint8Array(Uint8Array.from(data)),
			shared_key
		);
		const blobRef = this._chunkRefs[this._chunkRefs.length - 1];

		const modelSubmit = JSON.stringify({
			nonce: uint8ArrayToBase64(Uint8Array.from(nonce)),
			ciphertext: uint8ArrayToBase64(Uint8Array.from(ciphertext)),
			td_params,
			group_pk: this._guardianInfo.groupPk,
			tau_params: this._guardianInfo.tau_params,
			chosen_guardians: this._guardianInfo.guardians,
			blobRef: [blobRef.blockNumber, blobRef.extrinsicIndex],
		});

		const request = this._api.tx.dataAvailability.submitData(modelSubmit);
		return await signAndSend(request, account);
	}

	async writeMetadata() {

		const encoder = new TextEncoder();
		const fileName = this._fileName;
		const datasetRef = await this.submitKey(this._account, this._fileKey);
		const keyRef = [datasetRef.blockNumber, datasetRef.index];
		const request = this._api.tx.dataAvailability.daccRegisterData(
			Array.from(new TextEncoder().encode(fileName)),
			Array.from(new TextEncoder().encode(this._description)),
			keyRef,
			this._baseCost,
			0,
			Array.from(encoder.encode(this._ownerL2Address)),
			this._guardianInfo.groupId,
		);

		return await signAndSend(request, this._account);
	}

	async writeFile() {
		const chunks = [];
		let offset = 0;

		while (offset < this._file.size) {
			const chunk = this._file.slice(offset, offset + this._chunkSize);
			const prependedChunk = this.prependMetadata(chunk);
			const blockInfo = await this.writeChunk(prependedChunk);

			this._blockNumber = (blockInfo as any).blockNumber;
			this._extrinsicIndex = (blockInfo as any).index;
			this._progress.iBlocksWritten += chunk.size;
			this._chunkRefs.push({
				blockNumber: this._blockNumber,
				extrinsicIndex: this._extrinsicIndex,
			});

			offset += this._chunkSize;
		}

		this._fileKey = (await getFileSHA256(this._file)) as string;
		const metadataRef = await this.writeMetadata();
		return await FileFromMetadataRef(this._api, [
			(metadataRef as any).blockNumber,
			(metadataRef as any).index,
		]);
	}
}

class MCryptFsReader {
	_filename;
	_api;
	_onChainFile;

	constructor(filename: string, mcryptApi: any, onChainFile: any) {
		this._filename = filename;
		this._api = mcryptApi;
		this._onChainFile = onChainFile;
	}

	async downloadFile() {
		const chunks = [];

		let _blockNumber = this._onChainFile._metadata.startRef[0];
		let _extIndex = this._onChainFile._metadata.startRef[1];

		while (_blockNumber !== 0) {
			const prependedChunk = await readDataFromChain(this._api, [
				_blockNumber,
				_extIndex,
			]);
			const chunk = prependedChunk.slice(12);
			chunks.push(chunk);

			const view = new DataView(new Uint8Array(prependedChunk).buffer);
			_blockNumber = view.getUint32(4);
			_extIndex = view.getUint32(8);
		}

		// Combine all chunks into a single blob
		const blob = new Blob(chunks.reverse());

		// Create download link
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = this._filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		return blob;
	}
}

const FileFromMetadataRef = async (mcryptApi: any, metadataRef: any) => {
	const metadata = await getFileMetadata(mcryptApi, metadataRef);
	return new MCryptFs(mcryptApi, metadataRef, metadata);
};

export { MCryptFs, MCryptFsWriter, MCryptFsReader, FileFromMetadataRef };
