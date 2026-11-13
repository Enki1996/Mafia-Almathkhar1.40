'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const style=fs.readFileSync(path.join(__dirname,'../public/styles.css'),'utf8');
const pkg=require('../package.json');
const theme=fs.readFileSync(path.join(__dirname,'../public/theme.css'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const relevant=(name)=>app.split('\n').find(line=>line.startsWith(`function ${name}(`))||'';
test('v1.4 footer has game title, design credit and version',()=>{
 assert.equal(pkg.version,'1.4.0');
 const footer=relevant('footer');
 assert.match(footer,/https:\/\/webnexiq\.com/);
 assert.match(footer,/>WEBNEXIQ<\/a> ✦ <b>ENKI<\/b>/);
 assert.match(footer,/rel=\"noopener noreferrer\"/);
 assert.match(app,/const GAME_VERSION='1\.4'/);
 assert.match(footer,/\$\{GAME_VERSION\}/);
 assert.match(footer,/مافيا المذخر - نسخة/);
 assert.doesNotMatch(footer,/data-do|rulesButton|الراوي يدير القوانين|المناقشة/);
});
test('game room has rules and leave controls outside the footer',()=>{
 const header=relevant('header');
 assert.match(header,/class=\\?"room-tools/);
 assert.match(header,/data-do=\\?"rules/);
 assert.match(header,/data-do=\\?"leave/);
});
test('on mobile, role reveal comes before action and reveal art is enlarged',()=>{
 assert.equal((app.match(/class="grid2 role-screen"/g)||[]).length,2);
 assert.match(style,/\.role-screen>\.role-identify\{order:-1\}/);
 assert.match(style,/width:min\(77vw,248px\)/);
 assert.match(style,/max-width:292px/);
});
test('visible phase wording is end of round, while internal event names remain supported',()=>{
 assert.match(app,/night:'نهاية الجولة'/);
 assert.match(app,/night:'End of round'/);
 assert.match(app,/night:submit/);
 assert.doesNotMatch(app,/ليلاً|الليل|ليلة|الليلة/);
});

test('narrator button and confirmation are concise',()=>{
 assert.match(app,/resolve:'إنهاء الجولة وإعلان النتيجة'/);
 assert.match(app,/إنهاء الجولة وإعلان النتيجة؟/);
 assert.doesNotMatch(app,/إنهاء مرحلة نهاية الجولة وإعلان النتيجة/);
});
test('the round heading and status omit phase names',()=>{
 const heading=relevant('viewHeading');
 assert.match(heading,/const currentRound=/);
 assert.match(heading,/active\?currentRound:phase/);
 assert.match(heading,/t\('wait'\):currentRound/);
 assert.doesNotMatch(heading,/•|t\('night'\):t\('day'\)/);
});
test('footer keeps version on right, credit on left in RTL desktop and mobile',()=>{
 const footer=relevant('footer');
 assert.ok(footer.indexOf('footer-version') < footer.indexOf('footer-credit'));
 assert.match(style,/\.footer\{direction:rtl;display:flex/);
 assert.match(style,/@media\(max-width:720px\)\{\s*\.footer\{direction:rtl;justify-content:space-between/);
});

test('v1.4 typography is centralized and loaded after the core CSS',()=>{
 assert.match(html,/href=\"\/styles\.css\"/);
 assert.match(html,/href=\"\/theme\.css\"/);
 assert.ok(html.indexOf('/styles.css')<html.indexOf('/theme.css'));
 for(const face of ['MafiaRetroBrush','MafiaDigiMaryam','MafiaLalezar'])assert.ok(theme.includes(face));
 for(const v of ['--font-headline','--font-heading','--font-body','--font-button','--font-button-secondary','--font-latin'])assert.ok(theme.includes(v));
 assert.match(theme,/\.btn\.primary/);
 assert.match(theme,/\.hero h1/);
 assert.match(theme,/\.rules-heading/);
 assert.match(theme,/html\[dir='ltr'\]/);
});
