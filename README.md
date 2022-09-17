## @inrixia/db

This project provides a function that returns a object, all changes to that object are synchronously persisted to disk as json.

Encryption and live updates are supported.

## Installation

```
npm install @inrixia/db
```

## Usage

```ts
import db from "@inrixia/db";

type MyObjectType = {
	name: string;
	age: number;
	hobbies: string[];
};

const myObject = db<MyObjectType>("./filename.json", {
	template: {
		name: "Bob",
		age: 128,
		hobbies: [],
	},
	forceCreate: true,
	pretty: true,
});

// use myObject as you wish, all changes will be persisted to disk
```

## Options

The following options are supported:

```ts
db("./filename.json", {
	// Template object to initialize with.
	template: {},
	// Key to use for encryption. (Enables encryption if specified)
	cryptKey: "secret",
	// Pretty print the JSON file. (Default: false)
	pretty: true,
	// Write out to file if it doesn't exist. (Default: false)
	forceCreate: true,
	// Asynchronously live update the object when the file is changed externally.
	// Will enable forceCreate if true. (Default: false)
	updateOnExternalChanges: true,
});
```
