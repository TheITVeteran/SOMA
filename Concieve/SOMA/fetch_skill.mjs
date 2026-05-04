
const res = await fetch('https://moltbook.com/skill.md');
const text = await res.text();
console.log(text);
