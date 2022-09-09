
const apiObject = '_o'

const reportError = (text) => {
    console.error('ObjectScript transpilation error: ' + text)
}

module.exports = {
    // Registered enums, types, etc
    data: {
        enums: [],
        types: [],
        typechecks: [],
        prototypes: [],
        functions: []
    },

    encodedIndex: 0,
    encoded: {},

    transform: {
        'print': `${apiObject}.$Log.print`
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
        return body.map(stmt => this.generateStmt(stmt)).join('\n')
    },

    generateStmt(node, beforeBlock = null) {
        // No node specified
        if(!node)
            return ''

        // Transform arrays of statements to BlockStatement
        if(Array.isArray(node))
            node = { type: 'BlockStatement',  body: node }
        
        switch(node.type) {
            // Block
            case 'BlockStatement':
                return `{${beforeBlock ?? ''}${this.generateBody(node.body)}}`
            // Expression
            case 'ExpressionStatement':
                // Enum declaration as statement
                if(node.expression.type === 'EnumExpression' && node.expression.id) {
                    // Register enum in data
                    this.data.enums.push(node.expression.id.name)

                    return `const ${node.expression.id.name}=${this.generateExpr(node.expression)};`
                }
                // Type declaration as statement
                if(node.expression.type === 'TypeExpression' && node.expression.id) {
                    // Register type in data
                    this.data.types.push(node.expression.id.name)

                    return `const ${node.expression.id.name}=${this.generateExpr(node.expression)};`
                }
                else
                return `${this.generateExpr(node.expression)};`
            // If/Else
            case 'IfStatement':
                let ifStmt = `if(${this.generateExpr(node.test)})${this.generateStmt(node.consequent)}`
                if(node.alternate)
                    return ifStmt + 'else ' + this.generateStmt(node.alternate)
                else
                    return ifStmt
            // For/Foreach
            // Variable declaration
            case 'VariableDeclaration':
                let varType = node.kind[0] === 'let' ? 'let' : 'var'
                let varDecls = node.declarations.map(decl => {
                    let varName = this.generateExpr(decl.id)
                    let encodedVarName = `_${this.encodedIndex++}`
                    
                    // Add to encoded
                    this.encoded[varName] = encodedVarName
                    // Encode
                    varName = encodedVarName
                    
                    // Register enum in data
                    if(decl.init.type === 'EnumExpression')
                        this.data.enums.push(varName)
                    // Register type in data
                    else if(decl.init.type === 'TypeExpression')
                        this.data.types.push(varName)

                    return `${varName}=${this.generateExpr(decl.init) || 'null'}`
                }).join(',')
                return `${varType} ${varDecls};`
            // Typechecker declaration
            case 'TypecheckDeclaration':
                // Register typecheck in data
                this.data.typechecks.push(node.id.name)
                return `const ${node.id.name}=(value)=>${this.generateExpr(node.test)};`
            // Function declaration
            case 'FunctionDeclaration':
                return `${this.generateFunction(node, 'function')}`
            // Return
            case 'ReturnStatement':
                if(node.argument === null)
                    return 'return;'
                else
                    return `return ${this.generateExpr(node.argument)};`
            // Break
            case 'BreakStatement':
                return 'break;'
            default:
                console.log('Unknown statement', node)
                return `/*STMT:${node.type}:*/`
        }
    },

    generateValidation(node, variable = 'value') {
        let isDefault = true
        let expr = ''

        if(node.type === 'Identifier') {
            let name = node.name.toLowerCase()
            
            // Use primitive typechecker
            if(name === 'string')
                expr = `typeof ${variable}==="string"`
            else if(name === 'number')
                expr = `typeof ${variable}==="number"`
            else if(name === 'bool' || name === 'boolean')
                expr = `typeof ${variable}==="boolean"`
            else if(name === 'function')
                expr = `typeof ${variable}==="function"`
            else if(name === 'object')
                expr = `typeof ${variable}==="object"`
            else if(name === 'array')
                expr = `Array.isArray(${variable})`
            // Enum value
            else if(this.data.enums.includes(node.name))
                expr = `${node.name}.is(${variable})`
            // Type value
            else if(this.data.types.includes(node.name))
                expr = `${variable}[_o.$DataPointer]?.type==="${node.name}"`
            // Typecheck value
            else if(this.data.typechecks.includes(node.name))
                expr = `${node.name}(${variable})`
            else {
                isDefault = false
                expr = `(${this.generateExpr(node)})`
            }
        }
        else {
            isDefault = false
            expr = `(${this.generateExpr(node)})`
        }

        return { expr, isDefault }
    },

    generateTypecheck(node, withContext = false) {
        let { expr, isDefault } = this.generateValidation(node)

        return withContext && !isDefault ?
            // With 'this' context
            `function(value){return ${expr};}`
            // Without
            : `(value)=>${expr}`
    },

    generateExpr(node) {
        switch(node.type) {
            // Variable (abc)
            case 'Identifier':
                // Transform variables/functions to JS (ObjectWebApi)
                if(this.transform[node.name])
                    node.name = this.transform[node.name]
                // Change to encoded identifiers
                else if(this.encoded[node.name])
                    node.name = this.encoded[node.name]
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
                const generateField = (member) => `${member.id.name}:{get:'public',set:'private',initial:null,${
                    // Type checking
                    member.test ? `typecheck:${this.generateTypecheck(member.test, true)}` : ''
                }}`
                const generateCtor = (member) => this.generateFunction(member, 'method', 'ctor')
                const generateMethod = (member) => `${member.id.name}:{${this.generateFunction(member, 'method', 'handler')}}`

                let typeName = node.id.name
                let typeMembers = node.body.map(member => member.type === 'FieldDeclaration' ?
                    // Field
                    generateField(member)
                    // Ctor/Method
                    : member.type === 'CtorDeclaration' ? generateCtor(member) : generateMethod(member)
                )

                return `${apiObject}.$Type({
                    $name:"${typeName}",
                    ${typeMembers}
                })`
            // Function expression
            case 'FunctionExpression':
                return this.generateFunction(node, 'function')
            default:
                console.log('Unknown expression', node)
                return `/*${node.type}*/`
        }
    },

    generateFunction(node, as = 'function', useId = null) {
        let id = useId ? useId : (typeof node.id === 'object' ? node.id.name : node.id)
        let paramValidation = node.params.length > 0 ? `if(!(${node.params.map(param => {
            if(param.test)
                return this.generateValidation(param.test, param.id.name).expr
            else
                return 'true'
        }).join('&&')})){${apiObject}.$Log.err('Arguments was invalid');return;}` : ''
        let params = node.params.map(param => param.id.name).join(',')

        // Function (declaration/expression)
        if(as === 'function')
            return `function ${id ?? ''}(${params})${this.generateStmt(node.body, paramValidation)}`
        // Anonymous
        else if(as === 'anonymous')
            return `(${params})=>${this.generateStmt(node.body, paramValidation)}`
        // Method (of object/class)
        else if(as === 'method')
            return `${id}(${params})${this.generateStmt(node.body, paramValidation)}`
    },

    generateArgs(exprArray) {
        return exprArray.map(expr => this.generateExpr(expr)).join(',')
    }
}