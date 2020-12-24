import fs from "fs";
import db from ".";

const templateObject = { boolean: false, object: { string: "123", number: 123, array: [1,2,3] } };

const testDB = db<typeof templateObject>("test.json", templateObject);
const testDBencrypte = db<typeof templateObject>("test.json", templateObject, { cryptKey: "SupahSecretKey" });

const testObject = { 
	boolean: true,
	object: {
		string: "hello",
		number: Math.random(),
		array: [1,2,3]
	}
};

testDB.boolean = testObject.boolean;
testDB.object = { string: testObject.object.string, number: testObject.object.number, array: testObject.object.array };

test("boolean", () => expect(testDB.boolean).toBe(testObject.boolean));
test("boolean [encrypted]", () => expect(testDBencrypte.boolean).toBe(testObject.boolean));

test("string", () => expect(testDB.object?.string).toBe(testObject.object.string));
test("string [encrypted]", () => expect(testDBencrypte.object?.string).toBe(testObject.object.string));

test("number", () => expect(testDB.object?.number).toBe(testObject.object.number));
test("number [encrypted]", () => expect(testDBencrypte.object?.number).toBe(testObject.object.number));

test("array", () => expect(testDB.object?.array).toEqual(testObject.object.array));
test("array [encrypted]", () => expect(testDBencrypte.object?.array).toEqual(testObject.object.array));

test("entire db", () => expect(testDB).toEqual(testObject));
test("entire db [encrypted]", () => expect(testDBencrypte).toEqual(testObject));

test("external access", () => {
	const testDBTwo = db<typeof templateObject>("test.json", templateObject);
	expect(testDBTwo).toEqual(testObject);
});
test("external access [encrypted]", () => {
	const testDBTwoEncrypted = db<typeof templateObject>("test.json", templateObject, { cryptKey: "SupahSecretKey" });
	expect(testDBTwoEncrypted).toEqual(testObject);
});

afterAll(() => fs.unlinkSync("./test.json"));