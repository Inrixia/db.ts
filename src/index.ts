/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import crypto from "crypto";

type UnknownObject = Record<string, unknown>;

type dbOptions<T> = { template?: T; cryptKey?: string; pretty?: true; forceCreate?: true; updateOnExternalChanges?: true };

/**
 * Returns a new file backed object database.
 * @param {string} file Database file.
 * @param template Template object used to initalize the db if it does not exist.
 * @param cryptKey Optional key used to encrypt database contents on disk.
 */
export default function db<T extends UnknownObject>(file: string, options: dbOptions<T> = {}): T {
	if (typeof file !== "string") throw new Error(`file must be string! Got: ${file}`);
	const folder: string = file.replace(/\\/g, "/").split("/").slice(0, -1).join("/");

	const cryptKey = options.cryptKey;
	const pretty = options.pretty === true && options.cryptKey === undefined;

	const defaultDB = options.template || ({} as T);

	let fileExists = fs.existsSync(file);

	let stat: fs.Stats;

	let decrypt: (s: string) => string;
	let encrypt: (s: string) => string;
	if (cryptKey !== undefined) {
		const hash = crypto.createHash("sha256");
		hash.update(cryptKey);
		const key = hash.digest().slice(0, 32);
		decrypt = (string: string) => {
			string = string.toString();
			const textParts = string.split(":");
			const iv = Buffer.from(textParts.shift() as string, "hex");
			const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
			const encryptedText = Buffer.from(textParts.join(":"), "hex");
			let decrypted = decipher.update(encryptedText);
			decrypted = Buffer.concat([decrypted, decipher.final()]);
			return decrypted.toString();
		};
		encrypt = (string: string) => {
			string = string.toString();
			const iv = crypto.randomBytes(16);
			const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
			let encrypted = cipher.update(string);
			encrypted = Buffer.concat([encrypted, cipher.final()]);
			return iv.toString("hex") + ":" + encrypted.toString("hex");
		};
	}

	/**
	 * Writes store to disk.
	 */
	let disableWrites = false;
	const _writeStore = (store: T) => {
		if (disableWrites === true) return;
		let rawStoreData = JSON.stringify(store, null, pretty ? "	" : undefined);
		if (cryptKey !== undefined) rawStoreData = encrypt(rawStoreData);
		if (!fileExists && folder !== "" && !fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(file, rawStoreData);
		if (options.updateOnExternalChanges === true) stat = fs.statSync(file);
		return store;
	};

	/**
	 * Reads store from disk.
	 * @returns Object of expected type T containing data from `file`
	 */
	const _readStore = (): T => {
		let rawStoreData = fs.readFileSync(file).toString();
		if (rawStoreData === "") throw new Error(`Database file ${file} is empty!`);
		else if (cryptKey !== undefined) {
			// Data was previously unencrypted, encrypt it
			if (rawStoreData[0] === "{") _writeStore(new Proxy(JSON.parse(rawStoreData), handler));
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			else rawStoreData = decrypt!(rawStoreData);
		}
		return JSON.parse(rawStoreData);
	};

	/**
	 * Recursively update `_old` to mirror `_new` ensuring that sub references to store's children are maintained.
	 * @param _new New object to apply to old object.
	 * @param _old Old object to be updated.
	 */
	const _recursiveUpdate = (_new: any, _old: any) => {
		disableWrites = true;
		// Update/Set all values from new to old.
		_rSet(_new, _old);
		// Removoe any values from old that are not in new.
		_rClean(_new, _old);
		disableWrites = false;
	};
	const _rSet = (_new: any, _old: any) => {
		for (const key in _new) {
			if (typeof _new[key] === "object") {
				if (_old[key] === undefined) _old[key] = _new[key];
				else _rSet(_new[key], _old[key]);
			} else _old[key] = _new[key];
		}
	};
	const _rClean = (_new: any, _old: any) => {
		for (const key in _old) {
			if (_new[key] === undefined) delete _old[key];
			else if (typeof _old[key] === "object") _rClean(_new[key], _old[key]);
		}
	};

	const _watchFile = () => {
		stat = fs.statSync(file);
		let watchTimeout = setTimeout(() => null, 0);
		fs.watch(file, () => {
			// Debounce fs.watch to only emit one event per 5ms
			clearTimeout(watchTimeout);
			watchTimeout = setTimeout(() => {
				// If the file modified is not the same as the one held in memory, reload it
				if (stat.mtimeMs !== fs.statSync(file).mtimeMs) _recursiveUpdate(_readStore(), store);
			}, 5);
		});
	};

	let store: T;
	const handler: ProxyHandler<T> = {
		get: (target, key: string, receiver) => {
			if (target[key] !== null && typeof target[key] === "object") return new Proxy(target[key] as T, handler);
			else return Reflect.get(target, key, receiver);
		},
		set: (target: UnknownObject, key: string, value) => {
			target[key] = value;
			_writeStore(store);
			return true;
		},
	};

	if (fileExists) {
		store = new Proxy(_readStore(), handler);
		if (options.updateOnExternalChanges === true) _watchFile();
	} else {
		store = new Proxy({ ...defaultDB }, handler);
		if (options.forceCreate === true) {
			_writeStore(defaultDB);
			if (options.updateOnExternalChanges === true) _watchFile();
			fileExists = true;
		}
	}
	return store;
}
