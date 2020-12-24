import fs from "fs";
import crypto from "crypto";

type UnknownObject = { [key: string]: unknown }

type dbOptions = { cryptKey?: string, pretty?: boolean }

/**
 * Returns a new file backed object database.
 * @param {string} file Database file.
 * @param template Template object used to initalize the db if it does not exist.
 * @param cryptKey Optional key used to encrypt database contents on disk.
 */
export default function db<T extends UnknownObject>(file: string, template: T, options: dbOptions = {}): T {
	if (typeof file !== "string") throw new Error(`file must be string! Got: ${file}`);
	const folder: string = file.replace(/\\/g, "/").split("/").slice(0, -1).join("/");

	const cryptKey = options.cryptKey;
	const pretty = (options.pretty === true && options.cryptKey === undefined);

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
	 * Writes `this.store` to disk.
	 */
	const _writeStore = (store: T): T => { 
		let rawStoreData = JSON.stringify(store, null, pretty?"	":undefined);
		if (cryptKey !== undefined) rawStoreData = encrypt(rawStoreData);
		if (folder !== "" && !fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(file, rawStoreData);
		return store;
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
		}
	};
	
	if (fs.existsSync(file)) {
		let rawStoreData = fs.readFileSync(file).toString();
		if (rawStoreData === "") throw new Error("Database file corrupt!");
		else if (cryptKey !== undefined) {
			// Data was previously unencrypted, encrypt it
			if (rawStoreData[0] === "{") store = _writeStore(new Proxy(JSON.parse(rawStoreData), handler));
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			else rawStoreData = decrypt!(rawStoreData);
		}
		store = new Proxy(JSON.parse(rawStoreData), handler); 
	} else store = new Proxy(template, handler);
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	return store!;
}