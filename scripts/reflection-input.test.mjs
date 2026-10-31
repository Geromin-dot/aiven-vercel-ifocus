import test from 'node:test';
import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';
const source=await readFile(new URL('../src/lib/reflectionInput.js',import.meta.url),'utf8');
const{reflectionInputError}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('greetings, typos, and empty text do not become cognitive assessments',()=>{
  for(const text of ['',null,'Hello','hello there!','Ty','hi','asdfghjkl','aaaaaaa'])assert.ok(reflectionInputError(text),String(text));
});
test('short meaningful moods and English or Tagalog study context remain valid',()=>{
  for(const text of ['tired','pagod','stressed','motivated','I want to review biology','Pagod ako pero gusto ko magreview','I have 25 minutes to study'])assert.equal(reflectionInputError(text),'',text);
});
