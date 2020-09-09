const fs = require('fs')
const crypto = require('crypto')

class db {
	/**
	 * Returns a new file backed object database.
	 * @param {string} file Database file.
	 * @param {boolean} crypt True to encrypt database contents on disk.
	 * 
	 * @returns {Object} `{dbData}` Transparent object database.
	 */
	constructor(file, crypt=false) {
		if (typeof file !== 'string') throw new Error(`file must be string! Got: ${file}`)
		this.file = file
		this.folder = file.replace(/\\/g, '/').split("/").slice(0, -1).join('/')
		
		if (crypt) {
			const hash = crypto.createHash("sha256");
			hash.update(crypt);
			const key = hash.digest().slice(0, 32);
			this.encrypt = string => {
				string = string.toString()
				const iv = crypto.randomBytes(16);
				const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
				let encrypted = cipher.update(string);
				encrypted = Buffer.concat([encrypted, cipher.final()]);
				return iv.toString('hex') + ':' + encrypted.toString('hex');
			}
			this.decrypt = string => {
				string = string.toString()
				const textParts = string.split(':');
				const iv = Buffer.from(textParts.shift(), 'hex');
				const encryptedText = Buffer.from(textParts.join(':'), 'hex');
				const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
				let decrypted = decipher.update(encryptedText);
				decrypted = Buffer.concat([decrypted, decipher.final()]);
				return decrypted.toString();
			}
		}

		this.handler = {
			get: (target, key, receiver) => {
				if (target[key] !== null && typeof target[key] === 'object') return new Proxy(target[key], this.handler)
				else return Reflect.get(target, key, receiver);
			},
			set: (target, key, value) => {
				target[key] = value
				this._writeStore()
				return true
			}
		}
		this._readStore();
		
		return this.store
	}

	/**
	 * Loads a object into a db
	 * @param {db} db db Instance
	 * @param {object} object Object with data to store in db
	 */
	static load(db, object) {
		for (const key in object) db[key] = object[key]
	}

	/**
	 * Loads databse from disk into `this.store`
	 */
	_readStore() {
		if (fs.existsSync(this.file)) {
			let rawStoreData = fs.readFileSync(this.file)
			if (rawStoreData === '') this.store =  new Proxy({}, this.handler)
			else if (this.decrypt && rawStoreData[0] === '{') { // Data was previously unencrypted, encrypt it
				this.store = new Proxy(JSON.parse(rawStoreData), this.handler)
				this._writeStore()
			} else {
				if (this.decrypt) rawStoreData = this.decrypt(rawStoreData)
				this.store = new Proxy(JSON.parse(rawStoreData), this.handler)
			}
		} else this.store = new Proxy({}, this.handler)
	}

	/**
	 * Writes `this.store` to disk.
	 */
	_writeStore() { 
		let rawStoreData = JSON.stringify(this.store, null, 2)
		if (this.encrypt) rawStoreData = this.encrypt(rawStoreData)
		if (this.folder !== '' && !fs.existsSync(this.folder)) fs.mkdirSync(this.folder, { recursive: true })
		fs.writeFileSync(this.file, rawStoreData)
	}
}

module.exports = db