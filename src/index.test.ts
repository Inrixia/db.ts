import fs from "fs";
import db from ".";

const testDB = db<{ boolean: boolean, object: { string: string, number: number, array: number[] } }>("test.json", true);

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
test("string", () => expect(testDB.object?.string).toBe(testObject.object.string));
test("number", () => expect(testDB.object?.number).toBe(testObject.object.number));
test("array", () => expect(testDB.object?.array).toEqual(testObject.object.array));

test("entire db", () => expect(testDB).toEqual(testObject));

fs.unlinkSync("./test.json");