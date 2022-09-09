const fs = require('fs').promises
const path = require('path')

const Parser = require('./parser/Parser.js')
const Generator = require('./generator/Generator.js')

module.exports = {
    parse(code) {
        return Parser.parse(code)
    },
    async transpile(code, options) {
        let ast = this.parse(code)

        let webApiCode = await fs.readFile('src/native/ObjectWebApi.js', 'utf-8')
        let generatedCode = Generator.generate(ast)

        return {
            data: Generator.data,
            code: `${options?.debug !== true ? webApiCode : ''}\n\n${generatedCode}`
        }
    }
}