
const apiObject = '_o'

const reportError = (text) => {
    console.error('ObjectScript transpilation error: ' + text)
}

module.exports = {
    data: {
        enums: [],
        types: [],
        prototypes: [],
        typechecks: [],
    },

    generate(ast) {
        if(ast?.type === 'Program') {
            return this.generateBody(ast.body)
        }
        else {
            throw new Error('Cannot generate code, not Program AST was passed')
        }
    },

    generateBody(body) {
        return body.map(stmt => this.generateStmt(stmt)).join(';\n')
    },

    generateStmt(node) {
        switch(node.type) {
            // Block
            case 'BlockStatement':
                return `{${this.generateBody(node.body)}}`
            // Expression
            case 'ExpressionStatement':
                // Enum declaration as statement
                if(node.expression.type === 'EnumExpression' && node.expression.id) {
                    // Register enum in data
                    this.data.enums.push(node.expression.id.name)

                    return `const ${node.expression.id.name}=${this.generateExpr(node.expression)}`
                }
                // Type declaration as statement
                if(node.expression.type === 'TypeExpression' && node.expression.id) {
                    // Register type in data
                    this.data.types.push(node.expression.id.name)

                    return `const ${node.expression.id.name}=${this.generateExpr(node.expression)}`
                }
                else
                return `${this.generateExpr(node.expression)}`
            // If/Else
            case 'IfStatement':
                let ifStmt = `if(${this.generateExpr(node.test)})${this.generateStmt(node.consequent)}`
                if(node.alternate)
                    return ifStmt + 'else ' + this.generateStmt(node.alternate)
                else
                    return ifStmt
            // Variable declaration
            case 'VariableDeclaration':
                let varType = node.kind[0] === 'let' ? 'let' : 'var'
                let varDecls = node.declarations.map(decl => {
                    let varName = this.generateExpr(decl.id)
                    
                    // Register enum in data
                    if(decl.init.type === 'EnumExpression')
                        this.data.enums.push(varName)
                    // Register type in data
                    else if(decl.init.type === 'TypeExpression')
                        this.data.types.push(varName)

                    return `${varName}=${this.generateExpr(decl.init) || 'null'}`
                }).join(',')
                return `${varType} ${varDecls}`
            // Typechecker declaration
            case 'TypecheckDeclaration':
                return `const ${node.id.name}=(value)=>${this.generateExpr(node.test)}`
            // Return
            case 'ReturnStatement':
                if(node.argument === null)
                    return 'return'
                else
                    return `return ${this.generateExpr(node.argument)}`
            // Break
            case 'BreakStatement':
                return 'break'
            default:
                return '/*STMT*/'
        }
    },

    generateTypecheck(node, withContext = false) {
        let checkExpr = ''
        let isDefaultCheck = true
        
        if(node.type === 'Identifier') {
            let name = node.name.toLowerCase()
            
            // Use primitive typechecker
            if(name === 'string')
                checkExpr = 'typeof value==="string"'
            else if(name === 'number')
                checkExpr = 'typeof value==="number"'
            else if(name === 'bool')
                checkExpr = 'typeof value==="boolean"'
            else if(name === 'function')
                checkExpr = 'typeof value==="function"'
            else if(name === 'object')
                checkExpr = 'typeof value==="object"'
            else if(name === 'array')
                checkExpr = 'Array.isArray(value)'
            // Enum value
            else if(this.data.enums.includes(node.name))
                checkExpr = `${node.name}.is(value)`
            // Type value
            else if(this.data.types.includes(node.name))
                checkExpr = `value[_o.$DataPointer]?.type==="${node.name}"`
            else {
                isDefaultCheck = false
                checkExpr = this.generateExpr(node)
            }
        }
        else {
            isDefaultCheck = false
            checkExpr = this.generateExpr(node)
        }

        return withContext && !isDefaultCheck ?
            // With 'this' context
            `function(value){return ${checkExpr};}`
            // Without
            : `(value)=>${checkExpr}`
    },

    generateExpr(node) {
        console.log(node)
        switch(node.type) {
            // Variable (abc)
            case 'Identifier':
                if(node.name === 'print')
                    node.name = `${apiObject}.$Log.print`
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
            // Dot expression (a.b.c)
            case 'MemberExpression':
                let memberTargetName = this.generateExpr(node.object)
                // Is enum member
                if(this.data.enums.includes(memberTargetName))
                    return '"' + node.property.name + '"'
                else {
                    if(node.computed === true)
                        return `${memberTargetName}[${this.generateExpr(node.property)}]`
                    else
                        return `${memberTargetName}.${this.generateExpr(node.property)}`
                }
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
            // Sequence expression (a = a, b = b)
            case 'SequenceExpression':
                return node.expressions.map(expr => this.generateExpr(expr)).join(',')
            // Update expression (a++)/(++a)
            case 'UpdateExpression':
                return node.prefix ?
                    `${node.operator}${this.generateExpr(node.argument)}`
                    : `${this.generateExpr(node.argument)}${node.operator}`
            // Unary expression (typeof a)/(a instanceof)
            case 'UnaryExpression':
                return node.prefix ?
                    `${node.operator} ${this.generateExpr(node.argument)}`
                    : `${this.generateExpr(node.argument)} ${node.operator}`
            // New expression (new a)
            case 'NewExpression':
                let varName = this.generateExpr(node.callee)

                // New instance of type
                if(this.data.types.includes(varName))
                    return `${varName}(${this.generateArgs(node.arguments)})`
                // New instance of prototype/etc
                else
                    return `new ${varName}(${this.generateArgs(node.arguments)})`
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
                return `${apiObject}.$Enum(${node.elements.map(ident => '"' + ident.name + '"').join(',')})`
            case 'TypeExpression':
                return `${apiObject}.$Type({
                    $name: "${node.id.name}",
                    ${node.body.map(member => member.type === 'FieldDeclaration' ?
                        // Field
                        `${member.id.name}:{get:'public', set:'private', initial: null, ${
                                // Type checking
                                member.test ? `typecheck:${this.generateTypecheck(member.test, true)}` : ''
                            }}`
                        // Method
                        : `${member.id.name}:{handler(${member.params.map(param => param.name).join(',')}){${this.generateBody(member.body)}}}`
                    )}
                })`
            default:
                return `/*-*/`
        }
    },

    generateArgs(exprArray) {
        return exprArray.map(expr => this.generateExpr(expr)).join(',')
    }
}