const fs = require('fs').promises
const objs = require('./src/index')

void (async function() {
    let objsCode = await fs.readFile('test.objs', 'utf-8')

    let { data, code } = await objs.transpile(objsCode, { debug: false })
    console.log(code)
    eval(code)
})()