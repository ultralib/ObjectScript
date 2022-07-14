
const reportError = (text) => {
    console.error('ObjectScript transpilation error: ' + text)
}

module.exports = {
    generate(ast) {
        if(ast?.type === 'Program') {
            let finalCode = ''

            const walk = (node) => node.body.forEach(child => {
                finalCode += this.generateStmt(child)

                if(child.body)
                    walk(child)
            })

            walk(ast)

            return finalCode
        }
        else {
            throw new Error('Cannot generate code, not Program AST was passed')
        }
    },

    generateStmt(node) {
        switch(node.type) {
            case 'ExpressionStatement':
                if(node.expression.type === 'EnumExpression' && node.expression.id)
                    return `const ${node.expression.id.name} = ${this.generateExpr(node.expression)};`
                else
                    return `${this.generateExpr(node.expression)};\n`
            case 'VariableDeclaration':
                let varType = node.kind[0] === 'let' ? 'let' : 'var'
                let varDecls = node.declarations.map(decl => `${this.generateExpr(decl.id)}=${this.generateExpr(decl.init) || 'null'}`).join(',')
                return `${varType} ${varDecls};\n`
            case 'TypecheckDeclaration':
                return `const ${node.id.name} = function(value) {};\n`
            default:
                return '/*;*/'
        }
    },

    generateExpr(node) {
        console.log(node)
        switch(node.type) {
            // Variable (abc)
            case 'Identifier':
                if(node.name === 'print')
                    node.name = 'ObjectWebApi.$Log.print'
                return node.name
            // This literal (this)
            case 'ThisExpression':
                return 'this'
            // Literal string ('hello')
            case 'Literal':
                if(typeof node.value === 'string')
                    return '"' + node.value + '"'
                else if(node.value === undefined)
                    return 'undefined'
                else if(node.value === null)
                    return 'null'
                else if(typeof node.value === 'boolean')
                    return node.value === true ? 'true' : 'false'
                else
                    return node.value
            // Function call (fn())
            case 'CallExpression':
                return `${this.generateExpr(node.callee)}(${this.generateArgs(node.arguments)})`
            // Binary expressesion (a + b)
            case 'BinaryExpression':
            case 'LogicalExpression':
            case 'AssignmentExpression':
                // 'is' enum expression ('a' is B)
                if(node.operator === 'is') {
                    if(node.left.type === 'Literal' && node.right.type === 'Identifier')
                        return `${node.right.name}.is("${node.left.value}")`
                    else
                        reportError(`Operator 'is' can be perfomed only on String(left operand) and Identifier (right operand) values`)
                }
                // Grouping right expressions
                else if(node.right.type === 'BinaryExpression')
                    return `${this.generateExpr(node.left)}${node.operator}(${this.generateExpr(node.right)})`
                // Don't do grouping with literals
                else
                    return `${this.generateExpr(node.left)}${node.operator}${this.generateExpr(node.right)}`
            // Conditional expression (a ? true : false)
            case 'ConditionalExpression':
                return `${this.generateExpr(node.test)} ? ${this.generateExpr(node.consequent)} : ${this.generateExpr(node.alternate)}`
            // Update expression (a++)/(++a)
            case 'UpdateExpression':
                return node.prefix ?
                    `${node.operator}${this.generateExpr(node.argument)}`
                    : `${this.generateExpr(node.argument)}${node.operator}`
            // New expression (new a)
            case 'NewExpression':
                return `new ${this.generateExpr(node.callee)}(${this.generateArgs(node.arguments)})`
            // Array expression ([1,2,3])
            case 'ArrayExpression':
                return `[${node.elements.map(expr => this.generateExpr(expr)).join(',')}]`
            // Object expression({ a: 1 })
            case 'ObjectExpression':
                return `{${node.properties.map(prop =>
                    `${this.generateExpr(prop.key)}:${this.generateExpr(prop.value)}`    
                )}}`
            // Enum expression(enum a { b | c })
            case 'EnumExpression':
                return `ObjectWebApi.$Enum(${node.elements.map(ident => '"' + ident.name + '"').join(',')})`
            default:
                return `/*-*/`
        }
    },

    generateArgs(exprArray) {
        return exprArray.map(expr => this.generateExpr(expr)).join(',')
    }
}