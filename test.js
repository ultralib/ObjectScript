const fs = require('fs').promises
const objs = require('./src/index')

void (async function() {
    let code = await fs.readFile('test.objs', 'utf-8')

    let jsCode = await objs.transpile(code)
    console.log(jsCode)
    eval(jsCode)
})()